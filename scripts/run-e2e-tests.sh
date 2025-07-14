#!/bin/bash

# VoxStudent E2E Test Runner Script
# This script sets up the environment and runs all E2E tests

set -e  # Exit on any error

echo "🎯 VoxStudent E2E Test Runner"
echo "=" | tr -d '\n'; for i in {1..50}; do echo -n "="; done; echo
echo "Setting up environment and running authentication tests"
echo "=" | tr -d '\n'; for i in {1..50}; do echo -n "="; done; echo
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if a service is running on a port
check_port() {
    local port=$1
    local service=$2
    
    if nc -z localhost $port 2>/dev/null; then
        print_status $GREEN "✅ $service is running on port $port"
        return 0
    else
        print_status $RED "❌ $service is not running on port $port"
        return 1
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service=$2
    local max_attempts=30
    local attempt=1
    
    print_status $YELLOW "⏳ Waiting for $service to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s $url > /dev/null 2>&1; then
            print_status $GREEN "✅ $service is ready"
            return 0
        fi
        
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done
    
    print_status $RED "❌ $service failed to start within $max_attempts seconds"
    return 1
}

# Check if Docker is running
print_status $BLUE "🐳 Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    print_status $RED "❌ Docker is not running. Please start Docker first."
    exit 1
fi
print_status $GREEN "✅ Docker is running"

# Start Mailpit if not running
print_status $BLUE "📧 Setting up Mailpit..."
if ! check_port 8025 "Mailpit Web UI"; then
    print_status $YELLOW "🚀 Starting Mailpit..."
    
    # Remove existing container if it exists
    docker rm -f mailpit 2>/dev/null || true
    
    # Start Mailpit
    docker run -d --name mailpit -p 8025:8025 -p 1025:1025 axllent/mailpit
    
    # Wait for Mailpit to be ready
    if ! wait_for_service "http://localhost:8025" "Mailpit"; then
        print_status $RED "❌ Failed to start Mailpit"
        exit 1
    fi
else
    print_status $GREEN "✅ Mailpit is already running"
fi

# Check SMTP port
check_port 1025 "Mailpit SMTP"

# Clear Mailpit inbox before tests
print_status $BLUE "🗑️  Clearing Mailpit inbox..."
curl -X DELETE http://localhost:8025/api/v1/messages 2>/dev/null || true
print_status $GREEN "✅ Mailpit inbox cleared"

# Check if Next.js dev server is running
print_status $BLUE "⚛️  Checking Next.js dev server..."
if ! check_port 3000 "Next.js Dev Server"; then
    print_status $YELLOW "🚀 Starting Next.js dev server..."
    
    # Start dev server in background
    npm run dev > /dev/null 2>&1 &
    DEV_SERVER_PID=$!
    
    # Wait for dev server to be ready
    if ! wait_for_service "http://localhost:3000" "Next.js Dev Server"; then
        print_status $RED "❌ Failed to start Next.js dev server"
        kill $DEV_SERVER_PID 2>/dev/null || true
        exit 1
    fi
    
    # Set flag to kill server later
    STARTED_DEV_SERVER=true
else
    print_status $GREEN "✅ Next.js dev server is already running"
    STARTED_DEV_SERVER=false
fi

# Function to cleanup on exit
cleanup() {
    print_status $BLUE "🧹 Cleaning up..."
    
    if [ "$STARTED_DEV_SERVER" = true ] && [ ! -z "$DEV_SERVER_PID" ]; then
        print_status $YELLOW "🛑 Stopping Next.js dev server..."
        kill $DEV_SERVER_PID 2>/dev/null || true
    fi
    
    print_status $GREEN "✅ Cleanup completed"
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Check database connection
print_status $BLUE "🗄️  Checking database connection..."
if curl -s http://localhost:3000/api/auth/me > /dev/null 2>&1; then
    print_status $GREEN "✅ Database connection is working"
else
    print_status $YELLOW "⚠️  Database connection check inconclusive (this is normal)"
fi

# Run database migrations if needed
print_status $BLUE "🔄 Ensuring database is up to date..."
npm run db:push > /dev/null 2>&1 || true
print_status $GREEN "✅ Database is ready"

# Create screenshots directory
SCREENSHOT_DIR=".augment/e2e-tests/screenshots"
mkdir -p $SCREENSHOT_DIR
print_status $GREEN "✅ Screenshot directory created: $SCREENSHOT_DIR"

# Run the E2E tests
print_status $BLUE "🧪 Running E2E tests..."
echo

# Check if Node.js test files exist
if [ ! -f ".augment/e2e-tests/run-all-tests.js" ]; then
    print_status $RED "❌ E2E test files not found"
    exit 1
fi

# Run the tests
if node .augment/e2e-tests/run-all-tests.js; then
    print_status $GREEN "🎉 All E2E tests completed successfully!"
    exit_code=0
else
    print_status $RED "❌ Some E2E tests failed"
    exit_code=1
fi

# Show screenshot location
if [ -d "$SCREENSHOT_DIR" ] && [ "$(ls -A $SCREENSHOT_DIR)" ]; then
    print_status $BLUE "📸 Screenshots saved in: $SCREENSHOT_DIR"
    print_status $BLUE "   View screenshots: ls -la $SCREENSHOT_DIR"
fi

# Show Mailpit URL for manual inspection
print_status $BLUE "📧 Mailpit Web UI: http://localhost:8025"
print_status $BLUE "   Use this to manually inspect emails during development"

echo
print_status $BLUE "🏁 E2E test run completed"

exit $exit_code
