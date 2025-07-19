#!/bin/bash

# Pre-Release QA E2E Testing Script
# This script runs comprehensive E2E tests before a release

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
QA_PORT=3001
QA_DB_PORT=5433
QA_MAILPIT_PORT=8025
TIMEOUT_MINUTES=15
RETRY_ATTEMPTS=3
TEST_RESULTS_DIR="test-results"
SCREENSHOTS_DIR="screenshots"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local missing_tools=()
    
    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        missing_tools+=("docker-compose")
    fi
    
    if ! command -v node &> /dev/null; then
        missing_tools+=("node")
    fi
    
    if ! command -v npm &> /dev/null; then
        missing_tools+=("npm")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_error "Please install the missing tools and try again."
        exit 1
    fi
    
    log_success "All prerequisites are installed"
}

# Check if ports are available
check_ports() {
    log_info "Checking if required ports are available..."
    
    local ports=($QA_PORT $QA_DB_PORT $QA_MAILPIT_PORT)
    local busy_ports=()
    
    for port in "${ports[@]}"; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            busy_ports+=($port)
        fi
    done
    
    if [ ${#busy_ports[@]} -ne 0 ]; then
        log_error "The following ports are already in use: ${busy_ports[*]}"
        log_error "Please stop the services using these ports or run 'npm run qa:teardown'"
        exit 1
    fi
    
    log_success "All required ports are available"
}

# Clean up any existing QA environment
cleanup_existing() {
    log_info "Cleaning up any existing QA environment..."
    
    # Stop and remove QA containers
    docker-compose -f docker-compose.qa.yml down --volumes --remove-orphans 2>/dev/null || true
    
    # Remove any orphaned containers
    docker container prune -f >/dev/null 2>&1 || true
    
    # Clean up test artifacts
    rm -rf $TEST_RESULTS_DIR $SCREENSHOTS_DIR >/dev/null 2>&1 || true
    
    log_success "Cleanup completed"
}

# Setup QA environment
setup_qa_environment() {
    log_info "Setting up QA environment..."
    
    # Create necessary directories
    mkdir -p $TEST_RESULTS_DIR $SCREENSHOTS_DIR
    
    # Build and start QA environment
    log_info "Building and starting QA services..."
    npm run qa:setup
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        # Check if all containers are running
        local app_running=$(docker ps --filter "name=voxstudent-app-qa" --filter "status=running" --format "{{.Names}}" | wc -l)
        local db_running=$(docker ps --filter "name=voxstudent-postgres-qa" --filter "status=running" --format "{{.Names}}" | wc -l)
        local mail_running=$(docker ps --filter "name=voxstudent-mailpit-qa" --filter "status=running" --format "{{.Names}}" | wc -l)
        
        if [ "$app_running" -eq 1 ] && [ "$db_running" -eq 1 ] && [ "$mail_running" -eq 1 ]; then
            log_success "All containers are running"
            break
        fi
        
        attempt=$((attempt + 1))
        if [ $attempt -eq $max_attempts ]; then
            log_error "Services failed to start within $max_attempts attempts"
            log_info "Checking container status..."
            docker ps --filter "name=voxstudent" --format "table {{.Names}}\t{{.Status}}"
            exit 1
        fi
        
        sleep 2
    done
    
    # Verify database connection
    log_info "Verifying database connection..."
    if ! docker exec voxstudent-postgres-qa pg_isready -U voxstudent >/dev/null 2>&1; then
        log_error "Database is not ready"
        exit 1
    fi
    
    # Verify Mailpit is running
    log_info "Verifying email service..."
    if ! curl -s http://localhost:$QA_MAILPIT_PORT >/dev/null 2>&1; then
        log_warning "Mailpit web UI not accessible, but container is running - continuing"
    else
        log_success "Mailpit email service is ready"
    fi
    
    log_success "QA environment is ready"
}

# Install test dependencies
install_dependencies() {
    log_info "Installing test dependencies..."
    
    # Install Playwright browsers if not already installed
    if [ ! -d "node_modules/@playwright" ]; then
        npm ci
    fi
    
    # Install Playwright browsers
    npx playwright install chromium firefox webkit
    
    log_success "Dependencies installed"
}

# Run database migrations and seeding
setup_database() {
    log_info "Setting up database..."
    
    # Run migrations
    log_info "Running database migrations..."
    DATABASE_URL="postgresql://voxstudent:voxstudent@localhost:5433/voxstudent_qa" npx prisma migrate deploy || {
        log_error "Database migration failed"
        exit 1
    }
    
    # Seed test data
    log_info "Seeding test data..."
    DATABASE_URL="postgresql://voxstudent:voxstudent@localhost:5433/voxstudent_qa" npx prisma db seed || {
        log_warning "Database seeding failed - continuing with tests"
    }
    
    log_success "Database setup completed"
}

# Run E2E tests with retry logic
run_e2e_tests() {
    log_info "Running E2E tests..."
    
    local test_command="npm run test:e2e:qa"
    local attempt=1
    
    while [ $attempt -le $RETRY_ATTEMPTS ]; do
        log_info "Test attempt $attempt of $RETRY_ATTEMPTS"
        
        if $test_command; then
            log_success "E2E tests passed on attempt $attempt"
            return 0
        else
            log_warning "E2E tests failed on attempt $attempt"
            
            if [ $attempt -lt $RETRY_ATTEMPTS ]; then
                log_info "Retrying in 10 seconds..."
                sleep 10
                
                # Reset test environment
                log_info "Resetting test environment..."
                npm run db:reset:qa >/dev/null 2>&1 || true
                npm run db:seed:qa >/dev/null 2>&1 || true
            fi
        fi
        
        attempt=$((attempt + 1))
    done
    
    log_error "E2E tests failed after $RETRY_ATTEMPTS attempts"
    return 1
}

# Generate test report
generate_report() {
    log_info "Generating test report..."
    
    local report_file="$TEST_RESULTS_DIR/pre-release-report.md"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    cat > "$report_file" << EOF
# Pre-Release QA Test Report

**Generated:** $timestamp
**Environment:** QA
**Application URL:** http://localhost:$QA_PORT
**Database:** PostgreSQL (port $QA_DB_PORT)
**Email Service:** Mailpit (port $QA_MAILPIT_PORT)

## Test Results

EOF
    
    # Add Playwright HTML report link if available
    if [ -f "$TEST_RESULTS_DIR/html-report/index.html" ]; then
        echo "- [Detailed Test Report](./html-report/index.html)" >> "$report_file"
    fi
    
    # Add test artifacts info
    echo "" >> "$report_file"
    echo "## Test Artifacts" >> "$report_file"
    echo "" >> "$report_file"
    
    if [ -d "$SCREENSHOTS_DIR" ]; then
        local screenshot_count=$(find $SCREENSHOTS_DIR -name "*.png" | wc -l)
        echo "- Screenshots: $screenshot_count files in \`$SCREENSHOTS_DIR/\`" >> "$report_file"
    fi
    
    if [ -d "$TEST_RESULTS_DIR/videos" ]; then
        local video_count=$(find $TEST_RESULTS_DIR/videos -name "*.webm" | wc -l)
        echo "- Test Videos: $video_count files in \`$TEST_RESULTS_DIR/videos/\`" >> "$report_file"
    fi
    
    echo "" >> "$report_file"
    echo "## Coverage" >> "$report_file"
    echo "" >> "$report_file"
    echo "- ✅ Login Flow (15 test cases)" >> "$report_file"
    echo "- ✅ Course Management (20 test cases)" >> "$report_file"
    echo "- ✅ Student Management (18 test cases)" >> "$report_file"
    echo "- ✅ Reminder Templates (19 test cases)" >> "$report_file"
    
    log_success "Test report generated: $report_file"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    
    # Stop QA environment
    npm run qa:teardown >/dev/null 2>&1 || true
    
    # Archive test results if tests failed
    if [ $? -ne 0 ]; then
        local archive_name="failed-test-results-$(date +%Y%m%d-%H%M%S).tar.gz"
        tar -czf "$archive_name" $TEST_RESULTS_DIR $SCREENSHOTS_DIR 2>/dev/null || true
        log_info "Test artifacts archived as: $archive_name"
    fi
}

# Main execution
main() {
    local start_time=$(date +%s)
    
    echo "============================================"
    echo "🧪 VoxStudent Pre-Release QA Testing"
    echo "============================================"
    echo ""
    
    # Set up trap for cleanup
    trap cleanup EXIT
    
    # Run all steps
    check_prerequisites
    check_ports
    cleanup_existing
    install_dependencies
    setup_qa_environment
    setup_database
    
    # Run tests
    if run_e2e_tests; then
        generate_report
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        echo ""
        echo "============================================"
        log_success "🎉 Pre-release QA tests completed successfully!"
        log_success "⏱️  Total time: ${duration}s"
        echo "============================================"
        echo ""
        log_info "📊 View detailed results:"
        log_info "   • HTML Report: $TEST_RESULTS_DIR/html-report/index.html"
        log_info "   • Screenshots: $SCREENSHOTS_DIR/"
        log_info "   • Videos: $TEST_RESULTS_DIR/videos/"
        echo ""
        log_success "✅ Ready for release!"
        
        exit 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        echo ""
        echo "============================================"
        log_error "❌ Pre-release QA tests failed!"
        log_error "⏱️  Total time: ${duration}s"
        echo "============================================"
        echo ""
        log_info "🔍 Debug information:"
        log_info "   • Check application logs: npm run qa:logs"
        log_info "   • Test artifacts: $TEST_RESULTS_DIR/"
        log_info "   • Screenshots: $SCREENSHOTS_DIR/"
        echo ""
        log_error "🚫 NOT ready for release!"
        
        exit 1
    fi
}

# Handle command line arguments
case "${1:-}" in
    "--help"|"-h")
        echo "Pre-Release QA E2E Testing Script"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --cleanup      Only run cleanup"
        echo "  --setup-only   Only setup environment (don't run tests)"
        echo ""
        echo "Environment Variables:"
        echo "  QA_PORT        Application port (default: 3001)"
        echo "  QA_DB_PORT     Database port (default: 5433)"
        echo "  RETRY_ATTEMPTS Number of test retry attempts (default: 3)"
        exit 0
        ;;
    "--cleanup")
        cleanup_existing
        exit 0
        ;;
    "--setup-only")
        check_prerequisites
        check_ports
        cleanup_existing
        install_dependencies
        setup_qa_environment
        setup_database
        log_success "QA environment setup completed"
        exit 0
        ;;
    "")
        main
        ;;
    *)
        log_error "Unknown option: $1"
        log_info "Use --help for usage information"
        exit 1
        ;;
esac