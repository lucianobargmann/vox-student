#!/bin/bash

# Face Recognition E2E Test Runner
# This script sets up the environment and runs face recognition tests

set -e

echo "🎭 Starting Face Recognition E2E Tests..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required dependencies are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_warning "Docker is not installed - Mailpit may not work"
    fi
    
    print_success "Dependencies check completed"
}

# Setup test environment
setup_environment() {
    print_status "Setting up test environment..."
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_status "Installing npm dependencies..."
        npm install
    fi
    
    # Check if face-api models are downloaded
    if [ ! -d "public/models" ] || [ -z "$(ls -A public/models)" ]; then
        print_error "Face-api models not found in public/models/"
        print_status "Please run the face recognition setup first"
        exit 1
    fi
    
    # Setup test database
    print_status "Setting up test database..."
    npm run db:push
    
    print_success "Environment setup completed"
}

# Start required services
start_services() {
    print_status "Starting required services..."
    
    # Start Mailpit if Docker is available
    if command -v docker &> /dev/null; then
        print_status "Starting Mailpit..."
        ./scripts/setup-mailpit.sh
    fi
    
    # Start Next.js development server
    print_status "Starting Next.js server..."
    npm run dev &
    NEXTJS_PID=$!
    
    # Wait for server to be ready
    print_status "Waiting for server to be ready..."
    sleep 10
    
    # Check if server is responding
    if curl -f http://localhost:3000 > /dev/null 2>&1; then
        print_success "Next.js server is ready"
    else
        print_error "Next.js server failed to start"
        kill $NEXTJS_PID 2>/dev/null || true
        exit 1
    fi
}

# Run face recognition tests
run_tests() {
    print_status "Running face recognition tests..."
    
    # Set test environment variables
    export NODE_ENV=test
    export HEADLESS=false  # Set to true for CI
    
    # Run the tests
    if node e2e-tests/face-recognition.test.js; then
        print_success "Basic face recognition tests passed"
    else
        print_error "Basic face recognition tests failed"
        return 1
    fi
    
    if node e2e-tests/face-recognition-flow.test.js; then
        print_success "Face recognition flow tests passed"
    else
        print_error "Face recognition flow tests failed"
        return 1
    fi
    
    print_success "All face recognition tests completed successfully!"
}

# Cleanup function
cleanup() {
    print_status "Cleaning up..."
    
    # Kill Next.js server
    if [ ! -z "$NEXTJS_PID" ]; then
        kill $NEXTJS_PID 2>/dev/null || true
        print_status "Next.js server stopped"
    fi
    
    # Stop Mailpit
    if command -v docker &> /dev/null; then
        docker stop mailpit 2>/dev/null || true
        print_status "Mailpit stopped"
    fi
    
    print_success "Cleanup completed"
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Main execution
main() {
    print_status "Face Recognition E2E Test Suite"
    print_status "================================"
    
    check_dependencies
    setup_environment
    start_services
    
    if run_tests; then
        print_success "🎉 All face recognition tests passed!"
        exit 0
    else
        print_error "❌ Some face recognition tests failed!"
        exit 1
    fi
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Face Recognition E2E Test Runner"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --headless     Run tests in headless mode"
        echo "  --setup-only   Only setup environment, don't run tests"
        echo ""
        exit 0
        ;;
    --headless)
        export HEADLESS=true
        main
        ;;
    --setup-only)
        check_dependencies
        setup_environment
        print_success "Environment setup completed. You can now run tests manually."
        exit 0
        ;;
    *)
        main
        ;;
esac
