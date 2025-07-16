#!/bin/bash
set -e

# Configuration
SERVER_IP="164.163.10.235"
SSH_KEY="~/.ssh/hunt-luke-2025.pem"
DEPLOY_PATH="/opt/voxstudent"

echo "🔧 Setting up VoxStudent server..."

echo "📦 Installing Docker and Docker Compose on server..."

# Install Docker and Docker Compose on the server
ssh -i $SSH_KEY root@$SERVER_IP << 'EOF'
# Update package index
apt-get update

# Install required packages
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    pv

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Set up the stable repository
echo \
  "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update package index again
apt-get update

# Install Docker Engine
apt-get install -y docker-ce docker-ce-cli containerd.io

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Start and enable Docker
systemctl start docker
systemctl enable docker

# Create deployment directory
mkdir -p /opt/voxstudent
mkdir -p /opt/voxstudent/data
mkdir -p /opt/voxstudent/whatsapp-session
mkdir -p /opt/voxstudent/ssl

echo "✅ Docker and Docker Compose installed successfully"
EOF

echo "🔥 Setting up firewall rules..."

# Setup basic firewall rules
ssh -i $SSH_KEY root@$SERVER_IP << 'EOF'
# Install ufw if not present
apt-get install -y ufw

# Reset firewall rules
ufw --force reset

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH
ufw allow ssh

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Allow application port (if not using nginx)
ufw allow 3000/tcp

# Enable firewall
ufw --force enable

echo "✅ Firewall configured successfully"
EOF

echo "📋 Creating systemd service for auto-restart..."

# Create systemd service for the application
ssh -i $SSH_KEY root@$SERVER_IP << 'EOF'
cat > /etc/systemd/system/voxstudent.service << 'SERVICE'
[Unit]
Description=VoxStudent Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/voxstudent
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
SERVICE

# Reload systemd and enable the service
systemctl daemon-reload
systemctl enable voxstudent.service

echo "✅ Systemd service created and enabled"
EOF

echo "🔍 Creating monitoring script..."

# Create a simple monitoring script
ssh -i $SSH_KEY root@$SERVER_IP << 'EOF'
cat > /opt/voxstudent/monitor.sh << 'MONITOR'
#!/bin/bash

# Check if containers are running
if ! docker-compose ps | grep -q "Up"; then
    echo "$(date): VoxStudent containers are down, restarting..." >> /var/log/voxstudent.log
    docker-compose up -d
fi

# Check if application is responding
if ! curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "$(date): VoxStudent health check failed, restarting..." >> /var/log/voxstudent.log
    docker-compose restart
fi
MONITOR

chmod +x /opt/voxstudent/monitor.sh

# Add to crontab for monitoring every 5 minutes
(crontab -l 2>/dev/null; echo "*/5 * * * * cd /opt/voxstudent && ./monitor.sh") | crontab -

echo "✅ Monitoring script created and scheduled"
EOF

echo "✅ Server setup completed successfully!"
echo ""
echo "🔧 Next steps:"
echo "   1. Run the deploy script: ./deploy.sh"
echo "   2. Configure SSL certificates in /opt/voxstudent/ssl/ (if using nginx)"
echo "   3. Update DNS to point to $SERVER_IP"
echo ""
echo "📊 Useful commands:"
echo "   Check status: ssh -i $SSH_KEY root@$SERVER_IP 'cd $DEPLOY_PATH && docker-compose ps'"
echo "   View logs: ssh -i $SSH_KEY root@$SERVER_IP 'cd $DEPLOY_PATH && docker-compose logs -f'"
echo "   Restart: ssh -i $SSH_KEY root@$SERVER_IP 'systemctl restart voxstudent'"
