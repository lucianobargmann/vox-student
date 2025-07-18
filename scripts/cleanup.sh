#!/bin/bash

#############################################################################
# VoxStudent Server Cleanup Script
#############################################################################
# Purpose: Clean up old Docker images and system resources on production server
# Usage: ./scripts/cleanup.sh [options]
# 
# This script performs the following actions:
# 1. Connects to production server via SSH
# 2. Identifies old Docker images (keeping N most recent)
# 3. Safely removes unused images (with confirmation)
# 4. Cleans up Docker system resources
# 5. Reports disk usage and remaining images
#
# Safety Features:
# - Never removes currently running images
# - Requires confirmation before deletion
# - Shows what will be deleted before proceeding
# - Preserves configurable number of recent images
#
# Author: VoxStudent Development Team
# Version: 1.0.0
#############################################################################

set -e

# Default Configuration
DEFAULT_SERVER="164.163.10.235"
DEFAULT_USER="root"
DEFAULT_SSH_KEY="~/.ssh/hunt-luke-2025.pem"
DEFAULT_IMAGE_NAME="lucianobargmann/vox-student"
DEFAULT_KEEP_IMAGES=5

# Initialize variables with defaults
SERVER_IP="$DEFAULT_SERVER"
SSH_USER="$DEFAULT_USER"
SSH_KEY="$DEFAULT_SSH_KEY"
IMAGE_NAME="$DEFAULT_IMAGE_NAME"
KEEP_IMAGES=$DEFAULT_KEEP_IMAGES
FORCE_CLEANUP=false
VERBOSE=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Clean up old Docker images and system resources on production server"
    echo ""
    echo "OPTIONS:"
    echo "  -s, --server HOST      Production server IP/hostname [default: $DEFAULT_SERVER]"
    echo "  -u, --user USER        SSH user [default: $DEFAULT_USER]"
    echo "  -i, --ssh-key PATH     SSH private key path [default: $DEFAULT_SSH_KEY]"
    echo "  -n, --image NAME       Docker image name [default: $DEFAULT_IMAGE_NAME]"
    echo "  -k, --keep NUM         Number of images to keep [default: $DEFAULT_KEEP_IMAGES]"
    echo "  -f, --force            Force cleanup without confirmation"
    echo "  -v, --verbose          Enable verbose output"
    echo "  -h, --help             Display this help message"
    echo ""
    echo "EXAMPLES:"
    echo "  $0                     # Clean up with default settings"
    echo "  $0 -k 3                # Keep only 3 most recent images"
    echo "  $0 -f                  # Force cleanup without confirmation"
    echo "  $0 -s 192.168.1.100    # Clean up different server"
    echo ""
    exit 1
}

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to print section header
print_section() {
    local title=$1
    echo ""
    print_status $PURPLE "════════════════════════════════════════════════════════════════"
    print_status $PURPLE "  $title"
    print_status $PURPLE "════════════════════════════════════════════════════════════════"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--server)
            SERVER_IP="$2"
            shift 2
            ;;
        -u|--user)
            SSH_USER="$2"
            shift 2
            ;;
        -i|--ssh-key)
            SSH_KEY="$2"
            shift 2
            ;;
        -n|--image)
            IMAGE_NAME="$2"
            shift 2
            ;;
        -k|--keep)
            KEEP_IMAGES="$2"
            shift 2
            ;;
        -f|--force)
            FORCE_CLEANUP=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Main cleanup function
main() {
    print_section "VoxStudent Server Cleanup"
    print_status $CYAN "🧹 Starting cleanup process..."
    print_status $CYAN "📍 Configuration:"
    print_status $CYAN "   Server: $SERVER_IP"
    print_status $CYAN "   User: $SSH_USER"
    print_status $CYAN "   SSH Key: $SSH_KEY"
    print_status $CYAN "   Image: $IMAGE_NAME"
    print_status $CYAN "   Keep Images: $KEEP_IMAGES"

    print_section "Getting Image List"
    print_status $BLUE "📋 Getting list of images on server..."

    # Get current running image
    local current_image=$(ssh -i $SSH_KEY $SSH_USER@$SERVER_IP "cd /opt/voxstudent && docker-compose ps --format json | jq -r '.Image' | head -1" 2>/dev/null || echo "none")
    print_status $BLUE "🔄 Current running image: $current_image"

    # Get all images sorted by creation date (newest first)
    local all_images=$(ssh -i $SSH_KEY $SSH_USER@$SERVER_IP "docker images $IMAGE_NAME --format '{{.Tag}}' | grep -v latest | sort -r" 2>/dev/null || echo "")

    if [ -z "$all_images" ]; then
        print_status $YELLOW "ℹ️  No timestamped images found to clean up."
        exit 0
    fi

    print_status $GREEN "📦 Found images:"
    echo "$all_images"
    echo ""

    # Convert to array and skip the first N images (keep recent ones)
    local images_array=($all_images)
    local total_images=${#images_array[@]}

    if [ $total_images -le $KEEP_IMAGES ]; then
        print_status $YELLOW "ℹ️  Only $total_images images found. Keeping all (configured to keep $KEEP_IMAGES)."
        exit 0
    fi

    print_status $BLUE "🗑️  Will remove $((total_images - KEEP_IMAGES)) old images (keeping $KEEP_IMAGES most recent)"
    echo ""

    # Get images to remove (skip first KEEP_IMAGES)
    local images_to_remove=("${images_array[@]:$KEEP_IMAGES}")

    print_status $YELLOW "Images to be removed:"
    for img in "${images_to_remove[@]}"; do
        print_status $YELLOW "  - $IMAGE_NAME:$img"
    done
    echo ""

    # Ask for confirmation unless forced
    if [ "$FORCE_CLEANUP" = false ]; then
        print_status $YELLOW "❓ Do you want to proceed with cleanup? (y/N): "
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            print_status $RED "❌ Cleanup cancelled."
            exit 0
        fi
    fi

    print_section "Removing Old Images"
    print_status $BLUE "🧹 Starting cleanup..."

    # Remove old images
    for img in "${images_to_remove[@]}"; do
        print_status $BLUE "🗑️  Removing $IMAGE_NAME:$img..."
        if ssh -i $SSH_KEY $SSH_USER@$SERVER_IP "docker rmi $IMAGE_NAME:$img" 2>/dev/null; then
            print_status $GREEN "✅ Removed $IMAGE_NAME:$img"
        else
            print_status $YELLOW "⚠️  Failed to remove $IMAGE_NAME:$img (might be in use)"
        fi
    done

    print_section "System Cleanup"
    print_status $BLUE "🧹 Running Docker system cleanup..."

    # Clean up unused containers, networks, and build cache
    ssh -i $SSH_KEY $SSH_USER@$SERVER_IP "docker system prune -f"
    print_status $GREEN "✅ Docker system cleanup completed"

    print_section "Cleanup Summary"
    print_status $BLUE "📊 Current disk usage:"
    ssh -i $SSH_KEY $SSH_USER@$SERVER_IP "df -h /"

    echo ""
    print_status $BLUE "📦 Remaining images:"
    ssh -i $SSH_KEY $SSH_USER@$SERVER_IP "docker images $IMAGE_NAME"

    echo ""
    print_status $GREEN "✅ Cleanup completed successfully!"
    print_status $BLUE "📋 Kept $KEEP_IMAGES most recent images"
    print_status $BLUE "🔄 Current running image: $current_image"
}

# Run main function
main "$@"
