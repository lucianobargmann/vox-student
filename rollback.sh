#!/bin/bash
set -e

# Configuration
SERVER_IP="164.163.10.235"
SSH_KEY="~/.ssh/hunt-luke-2025.pem"
IMAGE_NAME="lucianobargmann/vox-student"
DEPLOY_PATH="/opt/voxstudent"

echo "🔄 VoxStudent Rollback Script"
echo ""

# Get list of available images on server
echo "📋 Getting list of available images on server..."
IMAGES=$(ssh -i $SSH_KEY root@$SERVER_IP "docker images $IMAGE_NAME --format 'table {{.Tag}}\t{{.CreatedAt}}' | grep -v TAG")

if [ -z "$IMAGES" ]; then
    echo "❌ No images found on server!"
    exit 1
fi

echo "Available images:"
echo "$IMAGES"
echo ""

# Ask user to select image
echo "🔍 Enter the tag you want to rollback to (e.g., 20241216123456):"
read -r ROLLBACK_TAG

if [ -z "$ROLLBACK_TAG" ]; then
    echo "❌ No tag specified!"
    exit 1
fi

# Verify image exists
if ! ssh -i $SSH_KEY root@$SERVER_IP "docker images $IMAGE_NAME:$ROLLBACK_TAG --format '{{.Tag}}'" | grep -q "$ROLLBACK_TAG"; then
    echo "❌ Image $IMAGE_NAME:$ROLLBACK_TAG not found on server!"
    exit 1
fi

echo "🔄 Rolling back to $IMAGE_NAME:$ROLLBACK_TAG..."

# Create backup of current state
echo "💾 Creating backup of current configuration..."
BACKUP_DIR="/opt/voxstudent/backups/$(date +%Y%m%d_%H%M%S)"
ssh -i $SSH_KEY root@$SERVER_IP "mkdir -p $BACKUP_DIR"
ssh -i $SSH_KEY root@$SERVER_IP "cp $DEPLOY_PATH/docker-compose.yml $BACKUP_DIR/"
ssh -i $SSH_KEY root@$SERVER_IP "cp $DEPLOY_PATH/.env.production $BACKUP_DIR/"

# Stop current application
echo "⏹️  Stopping current application..."
ssh -i $SSH_KEY root@$SERVER_IP "cd $DEPLOY_PATH && docker-compose down"

# Update docker-compose.yml with rollback image
echo "📝 Updating docker-compose.yml with rollback image..."
ssh -i $SSH_KEY root@$SERVER_IP "cd $DEPLOY_PATH && sed -i 's|image: lucianobargmann/vox-student:.*|image: $IMAGE_NAME:$ROLLBACK_TAG|g' docker-compose.yml"

# Start application with rollback image
echo "🚀 Starting application with rollback image..."
ssh -i $SSH_KEY root@$SERVER_IP "cd $DEPLOY_PATH && docker-compose up -d"

# Wait for application to start
echo "⏳ Waiting for application to start..."
sleep 10

# Check if application is healthy
echo "🔍 Checking application health..."
if ssh -i $SSH_KEY root@$SERVER_IP "curl -f http://localhost:3000/api/health > /dev/null 2>&1"; then
    echo "✅ Rollback completed successfully!"
    echo "🌐 Application is running with image: $IMAGE_NAME:$ROLLBACK_TAG"
    echo "📋 Backup saved to: $BACKUP_DIR"
else
    echo "❌ Health check failed after rollback!"
    echo "📋 Check logs: ssh -i $SSH_KEY root@$SERVER_IP 'cd $DEPLOY_PATH && docker-compose logs'"
    exit 1
fi

echo ""
echo "📊 To check status:"
echo "   ssh -i $SSH_KEY root@$SERVER_IP 'cd $DEPLOY_PATH && docker-compose ps'"
echo ""
echo "📋 To view logs:"
echo "   ssh -i $SSH_KEY root@$SERVER_IP 'cd $DEPLOY_PATH && docker-compose logs -f'"
