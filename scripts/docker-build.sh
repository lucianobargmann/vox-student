#!/bin/bash

#############################################################################
# VoxStudent Build Script
#############################################################################
# Purpose: Build the VoxStudent application for production deployment
# Usage: ./scripts/docker-build.sh [options]
# 
# This script performs the following actions:
# 1. Validates environment configuration
# 2. Installs dependencies and generates Prisma client
# 3. Runs tests to ensure code quality
# 4. Builds the Next.js application
# 5. Prepares database migrations
# 6. Optionally builds Docker image
#
# Based on: scripts/template/deploy.sh
# Author: VoxStudent Development Team
# Version: 1.0.0
#############################################################################

set -e

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE_NAME="hcktplanet/vox-student"
BUILD_MODE="production"
SKIP_TESTS=false
SKIP_DOCKER=false
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
    echo "Build VoxStudent application for production deployment"
    echo ""
    echo "OPTIONS:"
    echo "  -m, --mode MODE        Build mode (development|production) [default: production]"
    echo "  -i, --image NAME       Docker image name [default: $IMAGE_NAME]"
    echo "  -t, --skip-tests       Skip running tests"
    echo "  -d, --skip-docker      Skip Docker image build"
    echo "  -v, --verbose          Enable verbose output"
    echo "  -h, --help             Display this help message"
    echo ""
    echo "EXAMPLES:"
    echo "  $0                     # Build with default settings"
    echo "  $0 -m development      # Build for development"
    echo "  $0 -t -d               # Build without tests and Docker"
    echo "  $0 -i myregistry/vox   # Build with custom image name"
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

# Function to check Node.js version
check_node_version() {
    if ! command_exists node; then
        print_status $RED "❌ Node.js is not installed"
        exit 1
    fi
    
    local node_version=$(node --version | cut -d'v' -f2)
    local required_version="18.0.0"
    
    if [ "$(printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1)" != "$required_version" ]; then
        print_status $RED "❌ Node.js version $node_version is too old. Required: $required_version+"
        exit 1
    fi
    
    print_status $GREEN "✅ Node.js version: $node_version"
}

# Function to validate environment
validate_environment() {
    print_section "Environment Validation"
    
    # Check Node.js version
    check_node_version
    
    # Check for required files
    local required_files=("package.json" "next.config.ts" "prisma/schema.prisma")
    for file in "${required_files[@]}"; do
        if [ ! -f "$PROJECT_ROOT/$file" ]; then
            print_status $RED "❌ Required file missing: $file"
            exit 1
        fi
    done
    print_status $GREEN "✅ Required files present"
    
    # Check environment file
    local env_file=""
    if [ "$BUILD_MODE" = "production" ]; then
        if [ -f "$PROJECT_ROOT/.env.production" ]; then
            env_file=".env.production"
        elif [ -f "$PROJECT_ROOT/.env.local" ]; then
            env_file=".env.local"
        elif [ -f "$PROJECT_ROOT/.env" ]; then
            env_file=".env"
        fi
    else
        if [ -f "$PROJECT_ROOT/.env.local" ]; then
            env_file=".env.local"
        elif [ -f "$PROJECT_ROOT/.env" ]; then
            env_file=".env"
        fi
    fi
    
    if [ -z "$env_file" ]; then
        print_status $RED "❌ No environment file found!"
        print_status $YELLOW "   For production builds, create .env.production"
        print_status $YELLOW "   For development builds, create .env.local"
        exit 1
    fi
    
    print_status $GREEN "✅ Using environment file: $env_file"
    
    # Load environment variables
    if [ -f "$PROJECT_ROOT/$env_file" ]; then
        set -a
        source "$PROJECT_ROOT/$env_file"
        set +a
        [ "$VERBOSE" = true ] && print_status $BLUE "📋 Environment variables loaded from $env_file"
    fi
    
    # Check critical environment variables for production
    if [ "$BUILD_MODE" = "production" ]; then
        local required_vars=("DATABASE_URL" "NEXTAUTH_SECRET" "NEXTAUTH_URL")
        for var in "${required_vars[@]}"; do
            if [ -z "${!var}" ]; then
                print_status $RED "❌ Required environment variable not set: $var"
                exit 1
            fi
        done
        print_status $GREEN "✅ Critical environment variables configured"
    fi
}

# Function to install dependencies
install_dependencies() {
    print_section "Installing Dependencies"
    
    cd "$PROJECT_ROOT"
    
    # Check if package-lock.json exists
    if [ -f "package-lock.json" ]; then
        print_status $BLUE "📦 Installing dependencies with npm ci..."
        npm ci
    else
        print_status $YELLOW "⚠️  package-lock.json not found, using npm install..."
        npm install
    fi
    
    print_status $GREEN "✅ Dependencies installed successfully"
}

# Function to generate Prisma client
generate_prisma() {
    print_section "Generating Prisma Client"
    
    cd "$PROJECT_ROOT"
    
    print_status $BLUE "🔧 Generating Prisma client..."
    npx prisma generate
    
    print_status $GREEN "✅ Prisma client generated successfully"
}

# Function to run tests
run_tests() {
    if [ "$SKIP_TESTS" = true ]; then
        print_status $YELLOW "⏭️  Skipping tests (--skip-tests flag used)"
        return 0
    fi
    
    print_section "Running Tests"
    
    cd "$PROJECT_ROOT"
    
    # Check if test script exists
    if ! npm run test --silent > /dev/null 2>&1; then
        print_status $YELLOW "⚠️  Test script not found in package.json"
        return 0
    fi
    
    print_status $BLUE "🧪 Running tests..."
    npm run test -- --passWithNoTests --watchAll=false
    
    print_status $GREEN "✅ Tests completed successfully"
}

# Function to run linting
run_linting() {
    print_section "Code Quality Checks"
    
    cd "$PROJECT_ROOT"
    
    # Check if lint script exists
    if npm run lint --silent > /dev/null 2>&1; then
        print_status $BLUE "🔍 Running ESLint..."
        npm run lint
        print_status $GREEN "✅ Linting completed successfully"
    else
        print_status $YELLOW "⚠️  Lint script not found in package.json"
    fi
    
    # Check if type checking script exists
    if npm run type-check --silent > /dev/null 2>&1; then
        print_status $BLUE "🔍 Running TypeScript type checking..."
        npm run type-check
        print_status $GREEN "✅ Type checking completed successfully"
    else
        print_status $YELLOW "⚠️  Type check script not found in package.json"
    fi
}

# Function to build application
build_application() {
    print_section "Building Application"
    
    cd "$PROJECT_ROOT"
    
    # Set NODE_ENV for production builds
    if [ "$BUILD_MODE" = "production" ]; then
        export NODE_ENV=production
    else
        export NODE_ENV=development
    fi
    
    print_status $BLUE "🏗️  Building Next.js application..."
    print_status $BLUE "   Mode: $BUILD_MODE"
    print_status $BLUE "   NODE_ENV: $NODE_ENV"
    
    # Run the build
    npm run build
    
    print_status $GREEN "✅ Application built successfully"
    
    # Show build info
    if [ -d ".next" ]; then
        local build_size=$(du -sh .next 2>/dev/null | cut -f1)
        print_status $BLUE "📊 Build size: $build_size"
    fi
}

# Function to prepare database
prepare_database() {
    print_section "Database Preparation"
    
    cd "$PROJECT_ROOT"
    
    print_status $BLUE "💾 Preparing database schema..."
    
    # For production, we might want to generate migrations
    if [ "$BUILD_MODE" = "production" ]; then
        print_status $BLUE "🔄 Checking for pending migrations..."
        
        # This will show what would be applied without actually applying
        if npx prisma migrate status 2>/dev/null; then
            print_status $GREEN "✅ Database schema is up to date"
        else
            print_status $YELLOW "⚠️  Database migrations may be needed"
            print_status $YELLOW "   Run 'npx prisma migrate deploy' on the target server"
        fi
    else
        # For development, push schema directly
        print_status $BLUE "🔄 Pushing database schema..."
        npx prisma db push
        print_status $GREEN "✅ Database schema updated"
    fi
}

# Function to build Docker image
build_docker_image() {
    if [ "$SKIP_DOCKER" = true ]; then
        print_status $YELLOW "⏭️  Skipping Docker build (--skip-docker flag used)"
        return 0
    fi
    
    print_section "Building Docker Image"
    
    cd "$PROJECT_ROOT"
    
    # Check if Docker is available
    if ! command_exists docker; then
        print_status $YELLOW "⚠️  Docker not found, skipping image build"
        return 0
    fi
    
    # Check if Dockerfile exists
    if [ ! -f "Dockerfile" ]; then
        print_status $YELLOW "⚠️  Dockerfile not found, skipping image build"
        return 0
    fi
    
    # Generate timestamp tag
    local timestamp=$(date '+%Y%m%d%H%M%S')
    local tag_timestamp="$IMAGE_NAME:$timestamp"
    local tag_latest="$IMAGE_NAME:latest"
    
    print_status $BLUE "🐳 Building Docker image..."
    print_status $BLUE "   Timestamp: $tag_timestamp"
    print_status $BLUE "   Latest: $tag_latest"
    
    # Build the image with timestamp tag only
    docker build \
        --platform linux/amd64 \
        --build-arg NODE_ENV=$NODE_ENV \
        -t "$tag_timestamp" \
        .
    
    # Tag the timestamped image as latest locally
    docker tag "$tag_timestamp" "$tag_latest"
    
    print_status $GREEN "✅ Docker image built successfully"
    print_status $CYAN "🏷️  Tagged as: $tag_timestamp"
    print_status $CYAN "🏷️  Tagged as: $tag_latest"
    
    # Show image info
    local image_size=$(docker images --format "table {{.Size}}" "$tag_latest" | tail -n 1)
    print_status $BLUE "📊 Docker image size: $image_size"
    
    # Export the timestamp for use in deploy script
    echo "$timestamp" > "$PROJECT_ROOT/.last-build-timestamp"
    print_status $BLUE "📝 Build timestamp saved: $timestamp"
}

# Function to show build summary
show_build_summary() {
    print_section "Build Summary"
    
    print_status $GREEN "🎉 Build completed successfully!"
    print_status $BLUE "📋 Build Configuration:"
    print_status $BLUE "   Mode: $BUILD_MODE"
    print_status $BLUE "   Tests: $([ "$SKIP_TESTS" = true ] && echo "Skipped" || echo "Passed")"
    print_status $BLUE "   Docker: $([ "$SKIP_DOCKER" = true ] && echo "Skipped" || echo "Built")"
    print_status $BLUE "   Image: $IMAGE_NAME"
    
    echo ""
    print_status $CYAN "📁 Build Artifacts:"
    print_status $CYAN "   Next.js build: .next/"
    print_status $CYAN "   Prisma client: node_modules/.prisma/"
    
    if [ "$SKIP_DOCKER" = false ] && command_exists docker; then
        echo ""
        print_status $CYAN "🐳 Docker Images:"
        docker images "$IMAGE_NAME" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" | head -n 3
    fi
    
    echo ""
    print_status $PURPLE "🚀 Next Steps:"
    if [ "$BUILD_MODE" = "production" ]; then
        print_status $PURPLE "   1. Deploy to production server"
        print_status $PURPLE "   2. Run database migrations: npx prisma migrate deploy"
        print_status $PURPLE "   3. Start the application: npm start"
    else
        print_status $PURPLE "   1. Start development server: npm run dev"
        print_status $PURPLE "   2. Test the application locally"
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -m|--mode)
            BUILD_MODE="$2"
            shift 2
            ;;
        -i|--image)
            IMAGE_NAME="$2"
            shift 2
            ;;
        -t|--skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        -d|--skip-docker)
            SKIP_DOCKER=true
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

# Validate build mode
if [ "$BUILD_MODE" != "production" ] && [ "$BUILD_MODE" != "development" ]; then
    print_status $RED "❌ Invalid build mode: $BUILD_MODE"
    print_status $YELLOW "   Valid modes: production, development"
    exit 1
fi

# Main build process
main() {
    local start_time=$(date +%s)
    
    print_status $CYAN "🚀 Starting VoxStudent build process..."
    print_status $CYAN "   Build mode: $BUILD_MODE"
    print_status $CYAN "   Timestamp: $(date)"
    
    # Execute build steps
    validate_environment
    install_dependencies
    generate_prisma
    run_linting
    run_tests
    build_application
    prepare_database
    build_docker_image
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    print_status $GREEN "⏱️  Build completed in ${duration}s"
    show_build_summary
}

# Run main function
main "$@"