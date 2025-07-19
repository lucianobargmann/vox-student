#!/bin/bash

# VoxStudent Build and Deploy Script
# Usage: ./scripts/build-and-deploy.sh [build-options] [deploy-options]
# 
# This script combines the build and deploy processes:
# 1. Builds the application using docker-build.sh
# 2. Deploys the built application using deploy.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

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
    print_status $CYAN "════════════════════════════════════════════════════════════════"
    print_status $CYAN "  $title"
    print_status $CYAN "════════════════════════════════════════════════════════════════"
}

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Build and deploy VoxStudent application"
    echo ""
    echo "This script runs docker-build.sh followed by deploy.sh"
    echo ""
    echo "OPTIONS:"
    echo "  --build-only           Run only the build step"
    echo "  --deploy-only          Run only the deploy step (skip build)"
    echo "  --help                 Display this help message"
    echo ""
    echo "BUILD OPTIONS (passed to docker-build.sh):"
    echo "  --skip-tests           Skip running tests during build"
    echo "  --skip-docker          Skip Docker image build"
    echo "  --verbose              Enable verbose build output"
    echo ""
    echo "DEPLOY OPTIONS (passed to deploy.sh):"
    echo "  IMAGE_TAG              Specify image tag for deployment"
    echo "  rollback               Perform rollback instead of deploy"
    echo ""
    echo "EXAMPLES:"
    echo "  $0                     # Full build and deploy"
    echo "  $0 --build-only        # Build only"
    echo "  $0 --deploy-only       # Deploy only"
    echo "  $0 --skip-tests        # Build without tests, then deploy"
    echo "  $0 rollback            # Rollback deployment"
    echo ""
    exit 1
}

# Parse command line arguments
BUILD_ONLY=false
DEPLOY_ONLY=false
BUILD_ARGS=()
DEPLOY_ARGS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        --build-only)
            BUILD_ONLY=true
            shift
            ;;
        --deploy-only)
            DEPLOY_ONLY=true
            shift
            ;;
        --help|-h)
            usage
            ;;
        --skip-tests|--skip-docker|--verbose)
            BUILD_ARGS+=("$1")
            shift
            ;;
        rollback|--rollback)
            DEPLOY_ARGS+=("rollback")
            shift
            ;;
        *)
            # Assume it's an image tag for deployment
            DEPLOY_ARGS+=("$1")
            shift
            ;;
    esac
done

# Validate options
if [ "$BUILD_ONLY" = true ] && [ "$DEPLOY_ONLY" = true ]; then
    print_status $RED "❌ Cannot specify both --build-only and --deploy-only"
    exit 1
fi

# Main execution
main() {
    local start_time=$(date +%s)
    
    print_section "VoxStudent Build and Deploy Process"
    print_status $BLUE "🕒 Started at: $(date)"
    
    cd "$PROJECT_ROOT"
    
    # Step 1: Build (unless deploy-only)
    if [ "$DEPLOY_ONLY" = false ]; then
        print_section "Step 1: Building Application"
        print_status $BLUE "🏗️  Running build script with args: ${BUILD_ARGS[*]}"
        
        if ! ./scripts/docker-build.sh "${BUILD_ARGS[@]}"; then
            print_status $RED "❌ Build failed!"
            exit 1
        fi
        
        print_status $GREEN "✅ Build completed successfully"
    else
        print_status $YELLOW "⏭️  Skipping build (--deploy-only specified)"
    fi
    
    # Step 2: Deploy (unless build-only)
    if [ "$BUILD_ONLY" = false ]; then
        print_section "Step 2: Deploying Application"
        print_status $BLUE "🚀 Running deployment script with args: ${DEPLOY_ARGS[*]}"
        
        if ! ./scripts/deploy.sh "${DEPLOY_ARGS[@]}"; then
            print_status $RED "❌ Deployment failed!"
            exit 1
        fi
        
        print_status $GREEN "✅ Deployment completed successfully"
    else
        print_status $YELLOW "⏭️  Skipping deployment (--build-only specified)"
    fi
    
    # Summary
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    print_section "Process Complete"
    print_status $GREEN "🎉 Build and deploy process completed successfully!"
    print_status $BLUE "⏱️  Total time: ${duration}s"
    print_status $BLUE "🕒 Finished at: $(date)"
}

# Run main function
main "$@"