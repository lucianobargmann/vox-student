#!/bin/bash

# QA Setup Validation Script
# Validates that all QA testing components are properly configured

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REQUIRED_FILES=(
    ".env.qa"
    "docker-compose.qa.yml"
    "playwright.config.ts"
    "scripts/pre-release-qa.sh"
    ".github/workflows/pre-release-qa.yml"
)

REQUIRED_DIRS=(
    "tests/e2e"
    "scripts"
    ".github/workflows"
    "docs"
)

REQUIRED_TESTS=(
    "tests/e2e/login-flow.qa.spec.ts"
    "tests/e2e/course-crud.qa.spec.ts"
    "tests/e2e/student-management.qa.spec.ts"
    "tests/e2e/reminder-templates.qa.spec.ts"
)

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if file exists and is readable
check_file() {
    local file="$1"
    if [ -f "$file" ] && [ -r "$file" ]; then
        log_success "File exists: $file"
        return 0
    else
        log_error "File missing or not readable: $file"
        return 1
    fi
}

# Check if directory exists
check_directory() {
    local dir="$1"
    if [ -d "$dir" ]; then
        log_success "Directory exists: $dir"
        return 0
    else
        log_error "Directory missing: $dir"
        return 1
    fi
}

# Check if command exists
check_command() {
    local cmd="$1"
    if command -v "$cmd" &> /dev/null; then
        log_success "Command available: $cmd"
        return 0
    else
        log_error "Command not found: $cmd"
        return 1
    fi
}

# Check package.json scripts
check_npm_scripts() {
    log_info "Checking npm scripts..."
    
    local required_scripts=(
        "test:e2e:qa"
        "qa:setup"
        "qa:teardown" 
        "qa:logs"
        "db:migrate:qa"
        "db:seed:qa"
        "db:reset:qa"
        "pre-release"
        "pre-release:setup"
        "pre-release:cleanup"
    )
    
    local missing_scripts=()
    
    for script in "${required_scripts[@]}"; do
        if npm run --silent "$script" --dry-run &> /dev/null; then
            log_success "npm script: $script"
        else
            log_error "npm script missing: $script"
            missing_scripts+=("$script")
        fi
    done
    
    if [ ${#missing_scripts[@]} -eq 0 ]; then
        log_success "All required npm scripts are configured"
        return 0
    else
        log_error "Missing npm scripts: ${missing_scripts[*]}"
        return 1
    fi
}

# Check test file content
check_test_content() {
    log_info "Checking test file content..."
    
    local issues=0
    
    for test_file in "${REQUIRED_TESTS[@]}"; do
        if [ -f "$test_file" ]; then
            # Check if test file has proper structure
            if grep -q "test.describe" "$test_file" && 
               grep -q "test(" "$test_file" && 
               grep -q "expect(" "$test_file"; then
                log_success "Test structure valid: $test_file"
            else
                log_error "Test structure invalid: $test_file"
                issues=$((issues + 1))
            fi
            
            # Check if test file has proper imports
            if grep -q "from '@playwright/test'" "$test_file"; then
                log_success "Playwright imports found: $test_file"
            else
                log_error "Missing Playwright imports: $test_file"
                issues=$((issues + 1))
            fi
        else
            log_error "Test file missing: $test_file"
            issues=$((issues + 1))
        fi
    done
    
    return $issues
}

# Check environment variables
check_environment() {
    log_info "Checking environment configuration..."
    
    if [ -f ".env.qa" ]; then
        local required_vars=(
            "NODE_ENV"
            "DATABASE_URL"
            "NEXTAUTH_SECRET"
            "BASE_URL"
        )
        
        local missing_vars=()
        
        for var in "${required_vars[@]}"; do
            if grep -q "^$var=" ".env.qa"; then
                log_success "Environment variable: $var"
            else
                log_warning "Environment variable missing: $var"
                missing_vars+=("$var")
            fi
        done
        
        if [ ${#missing_vars[@]} -eq 0 ]; then
            log_success "All required environment variables are configured"
        else
            log_warning "Some environment variables may be missing: ${missing_vars[*]}"
        fi
    else
        log_error "Environment file missing: .env.qa"
        return 1
    fi
}

# Check Docker configuration
check_docker_config() {
    log_info "Checking Docker configuration..."
    
    if [ -f "docker-compose.qa.yml" ]; then
        # Check if required services are defined
        local required_services=(
            "postgres-qa"
            "mailpit-qa"
            "app-qa"
        )
        
        local missing_services=()
        
        for service in "${required_services[@]}"; do
            if grep -q "$service:" "docker-compose.qa.yml"; then
                log_success "Docker service: $service"
            else
                log_warning "Docker service missing: $service"
                missing_services+=("$service")
            fi
        done
        
        if [ ${#missing_services[@]} -eq 0 ]; then
            log_success "All required Docker services are configured"
        else
            log_warning "Some Docker services may be missing: ${missing_services[*]}"
        fi
    else
        log_error "Docker Compose file missing: docker-compose.qa.yml"
        return 1
    fi
}

# Check Node.js dependencies
check_dependencies() {
    log_info "Checking Node.js dependencies..."
    
    local required_deps=(
        "@playwright/test"
        "dotenv-cli"
    )
    
    local missing_deps=()
    
    for dep in "${required_deps[@]}"; do
        if npm list "$dep" &> /dev/null; then
            log_success "Dependency installed: $dep"
        else
            log_error "Dependency missing: $dep"
            missing_deps+=("$dep")
        fi
    done
    
    if [ ${#missing_deps[@]} -eq 0 ]; then
        log_success "All required dependencies are installed"
        return 0
    else
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_info "Run 'npm install' to install missing dependencies"
        return 1
    fi
}

# Main validation function
main() {
    local errors=0
    
    echo "============================================"
    echo "🔍 VoxStudent QA Setup Validation"
    echo "============================================"
    echo ""
    
    log_info "Starting validation..."
    echo ""
    
    # Check prerequisites
    log_info "Checking prerequisites..."
    check_command "docker" || errors=$((errors + 1))
    check_command "docker-compose" || errors=$((errors + 1))
    check_command "node" || errors=$((errors + 1))
    check_command "npm" || errors=$((errors + 1))
    echo ""
    
    # Check required directories
    log_info "Checking directory structure..."
    for dir in "${REQUIRED_DIRS[@]}"; do
        check_directory "$dir" || errors=$((errors + 1))
    done
    echo ""
    
    # Check required files
    log_info "Checking required files..."
    for file in "${REQUIRED_FILES[@]}"; do
        check_file "$file" || errors=$((errors + 1))
    done
    echo ""
    
    # Check test files
    log_info "Checking test files..."
    for test_file in "${REQUIRED_TESTS[@]}"; do
        check_file "$test_file" || errors=$((errors + 1))
    done
    echo ""
    
    # Check test content
    check_test_content || errors=$((errors + 1))
    echo ""
    
    # Check npm scripts
    check_npm_scripts || errors=$((errors + 1))
    echo ""
    
    # Check environment
    check_environment || errors=$((errors + 1))
    echo ""
    
    # Check Docker configuration
    check_docker_config || errors=$((errors + 1))
    echo ""
    
    # Check dependencies
    check_dependencies || errors=$((errors + 1))
    echo ""
    
    # Final report
    echo "============================================"
    if [ $errors -eq 0 ]; then
        log_success "🎉 QA setup validation completed successfully!"
        log_success "All components are properly configured."
        echo ""
        log_info "Next steps:"
        log_info "  • Run 'npm run pre-release' to test the complete workflow"
        log_info "  • Check the generated reports in test-results/"
        log_info "  • Review the documentation in docs/PRE-RELEASE-QA.md"
    else
        log_error "❌ QA setup validation failed with $errors error(s)!"
        log_error "Please fix the issues above before running QA tests."
        echo ""
        log_info "Common fixes:"
        log_info "  • Run 'npm install' to install missing dependencies"
        log_info "  • Copy .env.example to .env.qa and configure"
        log_info "  • Install Docker and Docker Compose"
        log_info "  • Run 'npx playwright install' to install browsers"
    fi
    echo "============================================"
    
    exit $errors
}

# Handle command line arguments
case "${1:-}" in
    "--help"|"-h")
        echo "QA Setup Validation Script"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --quick        Run quick validation (skip content checks)"
        echo ""
        echo "This script validates that all QA testing components are properly configured."
        exit 0
        ;;
    "--quick")
        log_info "Running quick validation..."
        # Skip content checks for faster validation
        REQUIRED_TESTS=()
        main
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