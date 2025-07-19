#!/bin/bash

# VoxStudent Deployment Script with Auto-Rollback
# Usage: ./scripts/deploy.sh [IMAGE_TAG]
#        ./scripts/deploy.sh rollback  (to manually rollback to backup)

set -e  # Exit on any error

# Default values
SERVER="164.163.10.235"
IDENTITY_FILE="~/.ssh/hunt-luke-2025.pem"
USER="root"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
ROLLBACK_TIMEOUT=60  # seconds to wait for smoke test

# Check for rollback command
if [ "$1" = "rollback" ] || [ "$1" = "--rollback" ]; then
    rollback_deployment
fi

# Get image tag from argument or use latest built image
if [ -n "$1" ]; then
    NEW_IMAGE_TAG="$1"
else
    # Find latest built image locally
    NEW_IMAGE_TAG=$(docker images hcktplanet/vox-student --format "{{.Tag}}" | grep -E '^[0-9]{8}[0-9]{6}$' | head -1 || echo "")
    if [ -z "$NEW_IMAGE_TAG" ]; then
        echo "❌ No local image found. Please build first or specify image tag."
        exit 1
    fi
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${CYAN}
╔═══════════════════════════════════════════════════════════════╗
║               VoxStudent Smart Deployment                    ║
║                     with Auto-Rollback                       ║
╚═══════════════════════════════════════════════════════════════╝${NC}"
}

print_step() {
    echo -e "${BLUE}🔄 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

rollback_deployment() {
    print_step "Performing manual rollback to backup image..."
    
    # Check if backup image exists
    BACKUP_EXISTS=$(ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
        "docker images hcktplanet/vox-student:backup -q" || echo "")
    
    if [ -z "$BACKUP_EXISTS" ]; then
        print_error "No backup image found on remote server"
        exit 1
    fi
    
    # Stop current containers with error handling
    print_step "Stopping containers for rollback..."
    ROLLBACK_STOP_OUTPUT=$(ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
        "cd /opt/hcktplanet/vox-student && docker compose down" 2>&1)
    
    if [ $? -ne 0 ]; then
        print_warning "Docker compose down failed during rollback:"
        echo "   $ROLLBACK_STOP_OUTPUT"
        print_warning "Trying manual stop for rollback..."
        ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
            "docker stop vox-student && docker rm vox-student" || true
    fi
    
    # Tag backup as latest
    ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
        "docker tag hcktplanet/vox-student:backup hcktplanet/vox-student:latest"
    
    # Restart with backup
    ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
        "cd /opt/hcktplanet/vox-student && docker compose up -d"
    
    print_success "Manual rollback completed"
    exit 0
}

# Expand tilde in identity file path
IDENTITY_FILE="${IDENTITY_FILE/#\~/$HOME}"

print_header

echo -e "${PURPLE}📍 Configuration:${NC}"
echo "   🖼️  New Image: hcktplanet/vox-student:$NEW_IMAGE_TAG"
echo "   🌐 Server: $SERVER"
echo "   👤 User: $USER"
echo "   🔑 SSH Key: $IDENTITY_FILE"
echo "   📅 Timestamp: $TIMESTAMP"
echo ""

# Step 1: Get current state for rollback
print_step "Capturing current state for potential rollback..."

CURRENT_IMAGE=$(ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
    "docker ps --filter name=vox-student --format '{{.Image}}' | head -1" || echo "")

if [ -n "$CURRENT_IMAGE" ]; then
    print_success "Current image captured: $CURRENT_IMAGE"
    
    # Tag current image as backup on remote server
    print_step "Creating backup tag on remote server..."
    ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
        "docker tag $CURRENT_IMAGE hcktplanet/vox-student:backup"
    print_success "Current image tagged as :backup"
    
    ROLLBACK_IMAGE="hcktplanet/vox-student:backup"
else
    print_warning "No current container found - fresh deployment"
    ROLLBACK_IMAGE=""
fi

# Step 2: Create database backup
print_step "Creating database backup before deployment..."
./scripts/backup-database.sh "$SERVER" "$IDENTITY_FILE" "$USER"
BACKUP_FILE="vox-student-db-backup-$TIMESTAMP.tar.gz"
print_success "Database backup completed: $BACKUP_FILE"

# Step 3: Build and tag latest image locally if needed
print_step "Ensuring latest image is built and tagged..."
if ! docker image inspect hcktplanet/vox-student:latest >/dev/null 2>&1; then
    echo "Building latest image..."
    docker build -t hcktplanet/vox-student:latest .
fi

# Tag the timestamped version as latest locally
docker tag hcktplanet/vox-student:$NEW_IMAGE_TAG hcktplanet/vox-student:latest
print_success "Latest image tagged locally"

# Step 4: Transfer latest image to server
print_step "Transferring latest image to server..."
IMAGE_SIZE=$(docker image inspect hcktplanet/vox-student:latest --format='{{.Size}}' | awk '{printf "%.1f MB", $1/1024/1024}')
echo "📊 Image size: $IMAGE_SIZE"

if command -v pv >/dev/null 2>&1; then
    echo -e "${PURPLE}📍 Using pv for transfer progress${NC}"
    docker save hcktplanet/vox-student:latest | pv | ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" "docker load"
else
    docker save hcktplanet/vox-student:latest | ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" "docker load"
fi
print_success "Latest image transferred successfully"
print_success "Ready for deployment - using latest image"

# Step 5: Deploy new version
print_step "Deploying new version..."

# Validate docker-compose.yml before stopping containers
print_step "Validating docker-compose configuration..."
VALIDATION_OUTPUT=$(ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
    "cd /opt/hcktplanet/vox-student && docker compose config" 2>&1)

if [ $? -ne 0 ]; then
    print_warning "Docker compose validation failed:"
    echo "   $VALIDATION_OUTPUT"
    print_warning "Attempting deployment anyway with error handling..."
fi

# Stop existing containers with enhanced error handling
print_step "Stopping existing containers..."
STOP_OUTPUT=$(ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
    "cd /opt/hcktplanet/vox-student && docker compose down" 2>&1)

if [ $? -ne 0 ]; then
    print_warning "Docker compose down failed:"
    echo "   $STOP_OUTPUT"
    print_warning "Trying manual container stop..."
    
    MANUAL_STOP_OUTPUT=$(ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
        "docker stop vox-student 2>&1 && docker rm vox-student 2>&1" 2>&1)
    
    if [ $? -ne 0 ]; then
        print_warning "Manual container stop also failed:"
        echo "   $MANUAL_STOP_OUTPUT"
        print_warning "Continuing with deployment - containers may not exist..."
    else
        print_success "Manual container stop successful"
    fi
else
    print_success "Containers stopped successfully"
fi

# Start new containers with enhanced error handling
print_step "Starting new containers..."
START_OUTPUT=$(ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
    "cd /opt/hcktplanet/vox-student && docker compose up -d" 2>&1)

if [ $? -eq 0 ]; then
    print_success "New container started"
else
    print_error "Container deployment failed:"
    echo "   $START_OUTPUT"
    
    # Try to get more diagnostic information
    print_step "Gathering diagnostic information..."
    ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
        "cd /opt/hcktplanet/vox-student && echo 'Docker images:' && docker images hcktplanet/vox-student && echo 'Docker compose version:' && docker compose version" || true
    
    print_error "Deployment failed - check logs above for details"
    exit 1
fi

# Step 6: Wait for application startup
print_step "Waiting for application to start..."
sleep 20

# Step 7: Smoke test - Try to access login page and test authentication flow
print_step "Running smoke test (login functionality)..."

SMOKE_TEST_PASSED=false

# Test 1: Check if application responds
echo "   🔍 Testing application response..."
for i in {1..5}; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://$SERVER" || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        echo "   ✅ Application responding (HTTP 200)"
        break
    else
        if [ $i -eq 5 ]; then
            print_error "Application not responding after 5 attempts (HTTP $HTTP_CODE)"
            break
        else
            echo "   ⏳ Attempt $i failed (HTTP $HTTP_CODE), retrying..."
            sleep 5
        fi
    fi
done

# Test 2: Check if login page loads
if [ "$HTTP_CODE" = "200" ]; then
    echo "   🔍 Testing login page..."
    LOGIN_TEST=$(curl -s -w "%{http_code}" "http://$SERVER/login" -o /tmp/login_test.html || echo "000")
    if [[ "$LOGIN_TEST" == *"200" ]] && grep -q "Login" /tmp/login_test.html 2>/dev/null; then
        echo "   ✅ Login page loads correctly"
        
        # Test 3: Try to access API health endpoint
        echo "   🔍 Testing API health..."
        API_TEST=$(curl -s -w "%{http_code}" "http://$SERVER/api/health" -o /tmp/api_test.json || echo "000")
        
        if [[ "$API_TEST" == *"200" ]] || [[ "$API_TEST" == *"302" ]]; then
            echo "   ✅ API responding"
            SMOKE_TEST_PASSED=true
        else
            echo "   ❌ API failed (HTTP: ${API_TEST#*\}}})"
        fi
    else
        echo "   ❌ Login page not loading correctly (HTTP: ${LOGIN_TEST#*\}}})"
    fi
fi

# Clean up test files
rm -f /tmp/login_test.html /tmp/api_test.json

# Step 8: Decision point - Success or Rollback
if [ "$SMOKE_TEST_PASSED" = true ]; then
    print_success "🎉 Smoke test passed! Deployment successful!"
    
    echo ""
    echo -e "${PURPLE}📊 Deployment Summary:${NC}"
    echo "   🌐 Application URL: http://$SERVER"
    echo "   🔧 Admin Panel: http://$SERVER/admin"  
    echo "   📅 Deployment Time: $TIMESTAMP"
    echo "   🖼️  New Image: hcktplanet/vox-student:$NEW_IMAGE_TAG"
    echo "   💾 Backup File: ./database-backups/$BACKUP_FILE"
    
    # Show running containers
    print_step "Current running containers:"
    ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
        "docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep vox-student"
    
    echo ""
    print_success "🚀 Deployment completed successfully!"
    
else
    print_error "💥 Smoke test failed! Initiating auto-rollback..."
    
    if [ -n "$ROLLBACK_IMAGE" ]; then
        print_step "Rolling back to previous image: $ROLLBACK_IMAGE"
        
        # Stop current containers with error handling
        print_step "Stopping containers for auto-rollback..."
        AUTO_ROLLBACK_STOP_OUTPUT=$(ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
            "cd /opt/hcktplanet/vox-student && docker compose down" 2>&1)
        
        if [ $? -ne 0 ]; then
            print_warning "Docker compose down failed during auto-rollback:"
            echo "   $AUTO_ROLLBACK_STOP_OUTPUT"
            print_warning "Trying manual stop for auto-rollback..."
            ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
                "docker stop vox-student && docker rm vox-student" || true
        fi
        
        # Tag backup image as latest for rollback
        ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
            "docker tag $ROLLBACK_IMAGE hcktplanet/vox-student:latest"
        
        # Restart with rolled back image (docker-compose should use :latest)
        ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
            "cd /opt/hcktplanet/vox-student && docker compose up -d"
        
        print_success "Rollback deployment completed"
        
        # Restore database backup
        print_step "Restoring database from backup..."
        ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
            "cd /opt/hcktplanet/vox-student && docker stop vox-student && sleep 5"
        
        # Download and restore the backup we just created
        scp -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" \
            "./database-backups/$BACKUP_FILE" "$USER@$SERVER:/tmp/"
        
        ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
            "cd /tmp && tar -xzf $BACKUP_FILE && \
             docker run --rm -v /tmp/${BACKUP_FILE%.*.*}/data:/source -v vox-student_vox-student-db:/target alpine sh -c 'cp -a /source/. /target/' && \
             docker run --rm -v /tmp/${BACKUP_FILE%.*.*}/whatsapp-session:/source -v vox-student_vox-student-whatsapp:/target alpine sh -c 'cp -a /source/. /target/'"
        
        # Restart container
        ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
            "cd /opt/hcktplanet/vox-student && docker compose up -d"
        
        print_success "Rollback completed! System restored to previous state."
        
    else
        print_error "No previous image to rollback to! Manual intervention required."
    fi
    
    print_error "🚨 DEPLOYMENT FAILED - System has been rolled back"
    echo ""
    echo -e "${RED}📋 Manual Investigation Required:${NC}"
    echo "   • Check application logs: ssh -i $IDENTITY_FILE $USER@$SERVER 'docker logs vox-student'"
    echo "   • Verify database: ssh -i $IDENTITY_FILE $USER@$SERVER 'docker exec vox-student npx prisma db pull --print'"
    echo "   • Test locally with: docker run -p 3001:3000 hcktplanet/vox-student:$NEW_IMAGE_TAG"
    
    exit 1
fi