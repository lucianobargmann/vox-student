#!/bin/bash
set -e

# Configuration
SERVER_IP="164.163.10.235"
SSH_KEY="~/.ssh/hunt-luke-2025.pem"
IMAGE_NAME="hcktplanet/vox-student"
DEPLOY_PATH="/opt/voxstudent"

echo "🚀 Building and deploying VoxStudent..."

# Check if .env.production exists and use it, otherwise fall back to .env
if [ -f .env.production ]; then
  echo "Using .env.production for build"
  ENV_FILE=".env.production"
else
  echo "Warning: .env.production not found, falling back to .env"
  ENV_FILE=".env"
fi

# Load env file into current shell (for any build args if needed)
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' $ENV_FILE | xargs)
  echo "✅ Environment variables loaded from $ENV_FILE"
else
  echo "❌ No environment file found!"
  exit 1
fi

# Timestamped tag
TIMESTAMP=$(date '+%Y%m%d%H%M%S')
TAG="$IMAGE_NAME:$TIMESTAMP"
LATEST_TAG="$IMAGE_NAME:latest"

echo "📦 Building Docker image: $TAG"

# Build the Docker image
docker build \
  --platform linux/amd64 \
  -t $TAG \
  -t $LATEST_TAG \
  .

echo "✅ Docker image built successfully"

# Check if pv is available for progress bar
if command -v pv &> /dev/null; then
  PROGRESS_CMD="pv"
  echo "📊 Using pv for transfer progress"
else
  PROGRESS_CMD="cat"
  echo "⚠️  pv not found, transferring without progress bar"
  echo "   Install with: sudo apt-get install pv (Ubuntu/Debian) or brew install pv (macOS)"
fi

echo "🚢 Transferring image to server..."

# Transfer to server with optional progress
docker save $TAG $LATEST_TAG | $PROGRESS_CMD | bzip2 | ssh -i $SSH_KEY root@$SERVER_IP 'bunzip2 | docker load'

echo "✅ Image built and transferred: $TAG"

echo "📁 Creating deployment directory on server..."

# Create deployment directory and copy necessary files
ssh -i $SSH_KEY root@$SERVER_IP "mkdir -p $DEPLOY_PATH"

echo "📋 Transferring configuration files..."

# Transfer docker-compose.yml
scp -i $SSH_KEY docker-compose.yml root@$SERVER_IP:$DEPLOY_PATH/

# Transfer .env.production
scp -i $SSH_KEY .env.production root@$SERVER_IP:$DEPLOY_PATH/

# Create data directory for database
ssh -i $SSH_KEY root@$SERVER_IP "mkdir -p $DEPLOY_PATH/data"
ssh -i $SSH_KEY root@$SERVER_IP "mkdir -p $DEPLOY_PATH/whatsapp-session"

echo "🔄 Updating docker-compose.yml with new image tag..."

# Update docker-compose.yml to use the new image tag
ssh -i $SSH_KEY root@$SERVER_IP "cd $DEPLOY_PATH && sed -i 's|image: lucianobargmann/vox-student:.*|image: $TAG|g' docker-compose.yml"

echo "🚀 Deploying application..."

# Deploy the application
ssh -i $SSH_KEY root@$SERVER_IP "cd $DEPLOY_PATH && docker-compose down && docker-compose up -d"

echo "✅ Deployment completed successfully!"
echo "📝 Built using $ENV_FILE"
echo ""
echo "🔧 Application deployed to: $DEPLOY_PATH"
echo "🌐 Application URLs:"
echo "   Direct access: http://$SERVER_IP:3000"
echo "   With Traefik: https://vox-student.hcktplanet.com"
echo ""
echo "📊 To check status:"
echo "   ssh -i $SSH_KEY root@$SERVER_IP 'cd $DEPLOY_PATH && docker-compose ps'"
echo ""
echo "📋 To view logs:"
echo "   ssh -i $SSH_KEY root@$SERVER_IP 'cd $DEPLOY_PATH && docker-compose logs -f'"
echo ""
echo "🔄 To restart:"
echo "   ssh -i $SSH_KEY root@$SERVER_IP 'cd $DEPLOY_PATH && docker-compose restart'"
echo ""
echo "🔗 Traefik setup:"
echo "   If using Traefik, ensure it's running and configured with Let's Encrypt"
echo "   Example: docker-compose.traefik.yml provided for reference"
