#!/bin/bash
set -e

# Configuration
SERVER_IP="164.163.10.235"
SSH_KEY="~/.ssh/hunt-luke-2025.pem"
IMAGE_NAME="lucianobargmann/vox-student"
KEEP_IMAGES=5  # Number of images to keep

echo "🧹 VoxStudent Cleanup Script"
echo ""

echo "📋 Getting list of images on server..."

# Get current running image
CURRENT_IMAGE=$(ssh -i $SSH_KEY root@$SERVER_IP "cd /opt/voxstudent && docker-compose ps --format json | jq -r '.Image' | head -1")
echo "🔄 Current running image: $CURRENT_IMAGE"

# Get all images sorted by creation date (newest first)
ALL_IMAGES=$(ssh -i $SSH_KEY root@$SERVER_IP "docker images $IMAGE_NAME --format '{{.Tag}}' | grep -v latest | sort -r")

if [ -z "$ALL_IMAGES" ]; then
    echo "ℹ️  No timestamped images found to clean up."
    exit 0
fi

echo "📦 Found images:"
echo "$ALL_IMAGES"
echo ""

# Convert to array and skip the first N images (keep recent ones)
IMAGES_ARRAY=($ALL_IMAGES)
TOTAL_IMAGES=${#IMAGES_ARRAY[@]}

if [ $TOTAL_IMAGES -le $KEEP_IMAGES ]; then
    echo "ℹ️  Only $TOTAL_IMAGES images found. Keeping all (configured to keep $KEEP_IMAGES)."
    exit 0
fi

echo "🗑️  Will remove $((TOTAL_IMAGES - KEEP_IMAGES)) old images (keeping $KEEP_IMAGES most recent)"
echo ""

# Get images to remove (skip first KEEP_IMAGES)
IMAGES_TO_REMOVE=("${IMAGES_ARRAY[@]:$KEEP_IMAGES}")

echo "Images to be removed:"
for img in "${IMAGES_TO_REMOVE[@]}"; do
    echo "  - $IMAGE_NAME:$img"
done
echo ""

# Ask for confirmation
read -p "❓ Do you want to proceed with cleanup? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cleanup cancelled."
    exit 0
fi

echo "🧹 Starting cleanup..."

# Remove old images
for img in "${IMAGES_TO_REMOVE[@]}"; do
    echo "🗑️  Removing $IMAGE_NAME:$img..."
    ssh -i $SSH_KEY root@$SERVER_IP "docker rmi $IMAGE_NAME:$img" || echo "⚠️  Failed to remove $IMAGE_NAME:$img (might be in use)"
done

echo ""
echo "🧹 Running Docker system cleanup..."

# Clean up unused containers, networks, and build cache
ssh -i $SSH_KEY root@$SERVER_IP "docker system prune -f"

echo ""
echo "📊 Current disk usage:"
ssh -i $SSH_KEY root@$SERVER_IP "df -h /"

echo ""
echo "📦 Remaining images:"
ssh -i $SSH_KEY root@$SERVER_IP "docker images $IMAGE_NAME"

echo ""
echo "✅ Cleanup completed!"
echo "📋 Kept $KEEP_IMAGES most recent images"
echo "🔄 Current running image: $CURRENT_IMAGE"
