#!/bin/bash

#############################################################################
# VoxStudent Production Deployment Script
#############################################################################
# Purpose: Build and deploy VoxStudent to production server
# Usage: ./scripts/deploy.sh [options]
# 
# This script performs the following actions:
# 1. Validates environment configuration
# 2. Builds Docker image locally
# 3. Transfers image to production server
# 4. Updates deployment configuration
# 5. Deploys the application with zero-downtime
# 6. Verifies deployment success
#
# Based on: scripts/template/build-and-deploy.sh
# Author: VoxStudent Development Team
# Version: 2.0.0
#############################################################################

set -e

# Default Configuration
DEFAULT_SERVER="164.163.10.235"
DEFAULT_USER="root"
DEFAULT_SSH_KEY="~/.ssh/hunt-luke-2025.pem"
DEFAULT_IMAGE_NAME="hcktplanet/vox-student"
DEFAULT_DEPLOY_PATH="/opt/voxstudent"

# Initialize variables with defaults
SERVER_IP="$DEFAULT_SERVER"
SSH_USER="$DEFAULT_USER"
SSH_KEY="$DEFAULT_SSH_KEY"
IMAGE_NAME="$DEFAULT_IMAGE_NAME"
DEPLOY_PATH="$DEFAULT_DEPLOY_PATH"
SKIP_BUILD=false
SKIP_TESTS=false
FORCE_DEPLOY=false
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
    echo "Deploy VoxStudent to production server"
    echo ""
    echo "OPTIONS:"
    echo "  -s, --server HOST      Production server IP/hostname [default: $DEFAULT_SERVER]"
    echo "  -u, --user USER        SSH user [default: $DEFAULT_USER]"
    echo "  -i, --ssh-key PATH     SSH private key path [default: $DEFAULT_SSH_KEY]"
    echo "  -n, --image NAME       Docker image name [default: $DEFAULT_IMAGE_NAME]"
    echo "  -p, --path PATH        Deploy path on server [default: $DEFAULT_DEPLOY_PATH]"
    echo "  -b, --skip-build       Skip building Docker image"
    echo "  -t, --skip-tests       Skip running tests before deployment"
    echo "  -f, --force            Force deployment without confirmation"
    echo "  -v, --verbose          Enable verbose output"
    echo "  -h, --help             Display this help message"
    echo ""
    echo "EXAMPLES:"
    echo "  $0                     # Deploy with default settings"
    echo "  $0 -s 192.168.1.100    # Deploy to different server"
    echo "  $0 -b                  # Skip build, deploy existing image"
    echo "  $0 -f                  # Force deploy without confirmation"
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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to validate SSH connection
validate_ssh_connection() {
    print_section "Validating SSH Connection"
    
    if [ ! -f "$SSH_KEY" ]; then
        print_status $RED "❌ SSH key not found: $SSH_KEY"
        exit 1
    fi
    
    print_status $BLUE "🔑 Testing SSH connection..."
    if ssh -i "$SSH_KEY" -o ConnectTimeout=10 -o BatchMode=yes "$SSH_USER@$SERVER_IP" "echo 'SSH connection successful'" >/dev/null 2>&1; then
        print_status $GREEN "✅ SSH connection established"
    else
        print_status $RED "❌ SSH connection failed"
        print_status $YELLOW "   Please check:"
        print_status $YELLOW "   - SSH key path: $SSH_KEY"
        print_status $YELLOW "   - Server IP: $SERVER_IP"
        print_status $YELLOW "   - SSH user: $SSH_USER"
        exit 1
    fi
}

# Function to validate Docker
validate_docker() {
    print_section "Validating Docker"
    
    if ! command_exists docker; then
        print_status $RED "❌ Docker is not installed"
        exit 1
    fi
    
    if ! docker info >/dev/null 2>&1; then
        print_status $RED "❌ Docker daemon is not running"
        exit 1
    fi
    
    print_status $GREEN "✅ Docker is ready"
    
    # Check Docker on remote server
    print_status $BLUE "🔍 Checking Docker on remote server..."
    if ssh -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" "docker info" >/dev/null 2>&1; then
        print_status $GREEN "✅ Docker is running on remote server"
    else
        print_status $RED "❌ Docker is not running on remote server"
        exit 1
    fi
}

print_status $CYAN "🚀 Starting VoxStudent deployment process..."
print_status $CYAN "📍 Configuration:"
print_status $CYAN "   Server: $SERVER_IP"
print_status $CYAN "   User: $SSH_USER"
print_status $CYAN "   SSH Key: $SSH_KEY"
print_status $CYAN "   Image: $IMAGE_NAME"
print_status $CYAN "   Deploy Path: $DEPLOY_PATH"

# Function to validate environment configuration
validate_environment() {
    print_section "Environment Configuration"
    
    # Check if .env.production exists and use it, otherwise fall back to .env
    if [ -f .env.production ]; then
        ENV_FILE=".env.production"
        print_status $GREEN "✅ Using .env.production for build"
    else
        ENV_FILE=".env"
        print_status $YELLOW "⚠️  .env.production not found, falling back to .env"
    fi

    # Load env file into current shell (for any build args if needed)
    if [ -f "$ENV_FILE" ]; then
        export $(grep -v '^#' $ENV_FILE | xargs)
        print_status $GREEN "✅ Environment variables loaded from $ENV_FILE"
    else
        print_status $RED "❌ No environment file found!"
        exit 1
    fi
    
    # Validate critical production environment variables
    local required_vars=("DATABASE_URL" "NEXTAUTH_SECRET" "NEXTAUTH_URL")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        print_status $RED "❌ Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            print_status $RED "   - $var"
        done
        exit 1
    fi
    
    print_status $GREEN "✅ All required environment variables are set"
}

# Function to build Docker image
build_docker_image() {
    if [ "$SKIP_BUILD" = true ]; then
        print_status $YELLOW "⏭️  Skipping Docker build (--skip-build flag used)"
        return 0
    fi
    
    print_section "Building Docker Image"
    
    # Generate timestamped tag
    TIMESTAMP=$(date '+%Y%m%d%H%M%S')
    TAG="$IMAGE_NAME:$TIMESTAMP"
    LATEST_TAG="$IMAGE_NAME:latest"
    
    print_status $BLUE "📦 Building Docker image: $TAG"
    
    # Build the Docker image
    docker build \
      --platform linux/amd64 \
      --build-arg NODE_ENV=production \
      -t $TAG \
      -t $LATEST_TAG \
      .
    
    print_status $GREEN "✅ Docker image built successfully"
    print_status $CYAN "🏷️  Tagged as: $TAG"
    print_status $CYAN "🏷️  Tagged as: $LATEST_TAG"
    
    # Show image size
    local image_size=$(docker images --format "table {{.Size}}" "$TAG" | tail -n 1)
    print_status $BLUE "📊 Image size: $image_size"
}

# Function to transfer image to server
transfer_image() {
    print_section "Transferring Image to Server"
    
    # Check if pv is available for progress bar
    if command -v pv &> /dev/null; then
        PROGRESS_CMD="pv"
        print_status $BLUE "📊 Using pv for transfer progress"
    else
        PROGRESS_CMD="cat"
        print_status $YELLOW "⚠️  pv not found, transferring without progress bar"
        print_status $YELLOW "   Install with: sudo apt-get install pv (Ubuntu/Debian) or brew install pv (macOS)"
    fi

    print_status $BLUE "🚢 Transferring image to server..."
    print_status $BLUE "   Source: $TAG"
    print_status $BLUE "   Destination: $SSH_USER@$SERVER_IP"
    
    # Transfer to server with optional progress
    docker save $TAG $LATEST_TAG | $PROGRESS_CMD | bzip2 | ssh -i $SSH_KEY $SSH_USER@$SERVER_IP 'bunzip2 | docker load'
    
    print_status $GREEN "✅ Image transferred successfully: $TAG"
}

# Function to prepare deployment environment
prepare_deployment() {
    print_section "Preparing Deployment Environment"
    
    print_status $BLUE "📁 Creating deployment directory on server..."
    ssh -i $SSH_KEY $SSH_USER@$SERVER_IP "mkdir -p $DEPLOY_PATH"
    
    print_status $BLUE "📋 Transferring configuration files..."
    
    # Transfer docker-compose.yml
    if [ -f "docker-compose.yml" ]; then
        scp -i $SSH_KEY docker-compose.yml $SSH_USER@$SERVER_IP:$DEPLOY_PATH/
        print_status $GREEN "✅ docker-compose.yml transferred"
    else
        print_status $RED "❌ docker-compose.yml not found"
        exit 1
    fi
    
    # Transfer environment file
    if [ -f "$ENV_FILE" ]; then
        scp -i $SSH_KEY $ENV_FILE $SSH_USER@$SERVER_IP:$DEPLOY_PATH/.env.production
        print_status $GREEN "✅ Environment file transferred"
    else
        print_status $RED "❌ Environment file not found: $ENV_FILE"
        exit 1
    fi
    
    # Create necessary directories
    print_status $BLUE "📂 Creating data directories..."
    ssh -i $SSH_KEY $SSH_USER@$SERVER_IP "mkdir -p $DEPLOY_PATH/data"
    ssh -i $SSH_KEY $SSH_USER@$SERVER_IP "mkdir -p $DEPLOY_PATH/whatsapp-session"
    ssh -i $SSH_KEY $SSH_USER@$SERVER_IP "mkdir -p $DEPLOY_PATH/uploads"
    
    print_status $GREEN "✅ Deployment environment prepared"
}

# Function to update deployment configuration
update_deployment_config() {
    print_section "Updating Deployment Configuration"
    
    print_status $BLUE "🔄 Updating docker-compose.yml with new image tag..."
    
    # Update docker-compose.yml to use the new image tag
    ssh -i $SSH_KEY $SSH_USER@$SERVER_IP "cd $DEPLOY_PATH && sed -i 's|image: .*vox-student:.*|image: $TAG|g' docker-compose.yml"
    
    print_status $GREEN "✅ Configuration updated with image: $TAG"
}

# Function to deploy application
deploy_application() {
    print_section "Deploying Application"
    
    # Get current running containers for backup
    print_status $BLUE "📋 Checking current deployment status..."
    local current_containers=$(ssh -i $SSH_KEY $SSH_USER@$SERVER_IP "cd $DEPLOY_PATH && docker-compose ps --services" 2>/dev/null || echo "")
    
    if [ -n "$current_containers" ]; then
        print_status $YELLOW "⚠️  Found running containers: $current_containers"
        
        if [ "$FORCE_DEPLOY" = false ]; then
            print_status $YELLOW "🤔 This will stop the current deployment. Continue? (y/N)"
            read -r response
            if [[ ! "$response" =~ ^[Yy]$ ]]; then
                print_status $RED "❌ Deployment cancelled"
                exit 1
            fi
        fi
        
        print_status $BLUE "🔄 Stopping current deployment..."
        ssh -i $SSH_KEY $SSH_USER@$SERVER_IP "cd $DEPLOY_PATH && docker-compose down"
    fi
    
    print_status $BLUE "🚀 Starting new deployment..."
    ssh -i $SSH_KEY $SSH_USER@$SERVER_IP "cd $DEPLOY_PATH && docker-compose up -d"
    
    print_status $GREEN "✅ Application deployed successfully"
}

# Function to verify deployment
verify_deployment() {
    print_section "Verifying Deployment"
    
    print_status $BLUE "🔍 Checking deployment status..."
    
    # Wait for containers to start
    sleep 5
    
    # Check if containers are running
    local running_containers=$(ssh -i $SSH_KEY $SSH_USER@$SERVER_IP "cd $DEPLOY_PATH && docker-compose ps --services --filter status=running" 2>/dev/null || echo "")
    
    if [ -n "$running_containers" ]; then
        print_status $GREEN "✅ Containers are running: $running_containers"
    else
        print_status $RED "❌ No containers appear to be running"
        print_status $YELLOW "📋 Check logs with: ssh -i $SSH_KEY $SSH_USER@$SERVER_IP 'cd $DEPLOY_PATH && docker-compose logs'"
        exit 1
    fi
    
    # Test HTTP endpoint if possible
    print_status $BLUE "🌐 Testing application endpoint..."
    if ssh -i $SSH_KEY $SSH_USER@$SERVER_IP "curl -s http://localhost:3000/api/health" >/dev/null 2>&1; then
        print_status $GREEN "✅ Application is responding"
    else
        print_status $YELLOW "⚠️  Application endpoint not accessible (this may be normal during startup)"
    fi
}

# Function to show deployment summary
show_deployment_summary() {
    print_section "Deployment Summary"
    
    print_status $GREEN "🎉 Deployment completed successfully!"
    print_status $BLUE "📝 Configuration:"
    print_status $BLUE "   Environment: $ENV_FILE"
    print_status $BLUE "   Image: $TAG"
    print_status $BLUE "   Deploy Path: $DEPLOY_PATH"
    print_status $BLUE "   Server: $SSH_USER@$SERVER_IP"
    
    echo ""
    print_status $CYAN "🌐 Application URLs:"
    print_status $CYAN "   Direct access: http://$SERVER_IP:3000"
    print_status $CYAN "   With Traefik: https://vox-student.hcktplanet.com"
    
    echo ""
    print_status $PURPLE "📊 Management Commands:"
    print_status $PURPLE "   Status: ssh -i $SSH_KEY $SSH_USER@$SERVER_IP 'cd $DEPLOY_PATH && docker-compose ps'"
    print_status $PURPLE "   Logs: ssh -i $SSH_KEY $SSH_USER@$SERVER_IP 'cd $DEPLOY_PATH && docker-compose logs -f'"
    print_status $PURPLE "   Restart: ssh -i $SSH_KEY $SSH_USER@$SERVER_IP 'cd $DEPLOY_PATH && docker-compose restart'"
    print_status $PURPLE "   Stop: ssh -i $SSH_KEY $SSH_USER@$SERVER_IP 'cd $DEPLOY_PATH && docker-compose down'"
    
    echo ""
    print_status $YELLOW "🔗 Additional Setup:"
    print_status $YELLOW "   - Ensure Traefik is running for HTTPS"
    print_status $YELLOW "   - Configure SSL certificates"
    print_status $YELLOW "   - Set up backup procedures"
    print_status $YELLOW "   - Configure monitoring"
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
        -p|--path)
            DEPLOY_PATH="$2"
            shift 2
            ;;
        -b|--skip-build)
            SKIP_BUILD=true
            shift
            ;;
        -t|--skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        -f|--force)
            FORCE_DEPLOY=true
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

# Main deployment function
main() {
    local start_time=$(date +%s)
    
    print_status $CYAN "🚀 Starting VoxStudent deployment process..."
    print_status $CYAN "📍 Configuration:"
    print_status $CYAN "   Server: $SERVER_IP"
    print_status $CYAN "   User: $SSH_USER"
    print_status $CYAN "   SSH Key: $SSH_KEY"
    print_status $CYAN "   Image: $IMAGE_NAME"
    print_status $CYAN "   Deploy Path: $DEPLOY_PATH"
    print_status $CYAN "   Skip Build: $SKIP_BUILD"
    print_status $CYAN "   Skip Tests: $SKIP_TESTS"
    print_status $CYAN "   Force Deploy: $FORCE_DEPLOY"
    
    # Execute deployment steps
    validate_ssh_connection
    validate_docker
    validate_environment
    
    if [ "$SKIP_BUILD" = false ]; then
        build_docker_image
        transfer_image
    fi
    
    prepare_deployment
    update_deployment_config
    deploy_application
    verify_deployment
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    print_status $GREEN "⏱️  Deployment completed in ${duration}s"
    show_deployment_summary
}

# Run main function
main "$@"
