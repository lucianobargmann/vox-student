#!/bin/bash

# VoxStudent Disaster Recovery Script
# This script provides tools for backup, restore, and recovery operations

set -e

# Configuration
SERVER="164.163.10.235"
IDENTITY_FILE="~/.ssh/hunt-luke-2025.pem"
USER="root"
BACKUP_DIR="./disaster-recovery-backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Expand tilde in identity file path
IDENTITY_FILE="${IDENTITY_FILE/#\~/$HOME}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}     VoxStudent Disaster Recovery      ${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_info() { echo -e "${BLUE}→ $1${NC}"; }

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to create a full backup
create_full_backup() {
    print_header
    print_info "Creating full backup..."
    
    BACKUP_NAME="vox-student-full-backup-$TIMESTAMP"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
    mkdir -p "$BACKUP_PATH"
    
    # 1. Export Docker images
    print_info "Backing up Docker images..."
    CURRENT_IMAGE=$(ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
        "docker ps --filter name=vox-student --format '{{.Image}}' | head -1" || echo "")
    
    if [ -n "$CURRENT_IMAGE" ]; then
        ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
            "docker save $CURRENT_IMAGE" | gzip > "$BACKUP_PATH/docker-image.tar.gz"
        echo "$CURRENT_IMAGE" > "$BACKUP_PATH/image-tag.txt"
        print_success "Docker image backed up"
    else
        print_warning "No running container found"
    fi
    
    # 2. Backup Docker volumes
    print_info "Backing up Docker volumes..."
    ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" << 'EOF' | tar xzf - -C "$BACKUP_PATH"
        cd /tmp
        rm -rf vox-backup-temp
        mkdir -p vox-backup-temp/data vox-backup-temp/whatsapp
        
        # Copy data from volumes
        docker run --rm -v vox-student_vox-student-db:/source:ro -v /tmp/vox-backup-temp/data:/backup alpine \
            sh -c "cp -a /source/. /backup/ 2>/dev/null || true"
        
        docker run --rm -v vox-student_vox-student-whatsapp:/source:ro -v /tmp/vox-backup-temp/whatsapp:/backup alpine \
            sh -c "cp -a /source/. /backup/ 2>/dev/null || true"
        
        # Create archive
        tar czf - -C vox-backup-temp .
        rm -rf vox-backup-temp
EOF
    print_success "Docker volumes backed up"
    
    # 3. Backup configuration files
    print_info "Backing up configuration files..."
    scp -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" \
        "$USER@$SERVER:/opt/hcktplanet/vox-student/.env.production" \
        "$BACKUP_PATH/" 2>/dev/null || print_warning ".env.production not found"
    
    scp -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" \
        "$USER@$SERVER:/opt/hcktplanet/vox-student/docker-compose.yml" \
        "$BACKUP_PATH/" 2>/dev/null || print_warning "docker-compose.yml not found"
    
    print_success "Configuration files backed up"
    
    # 4. Create backup manifest
    cat > "$BACKUP_PATH/manifest.txt" << EOL
Backup Created: $(date)
Server: $SERVER
Docker Image: $CURRENT_IMAGE
Backup Contents:
- Docker image: docker-image.tar.gz
- Database volume: data/
- WhatsApp session: whatsapp/
- Environment file: .env.production
- Docker Compose: docker-compose.yml
EOL
    
    print_success "Full backup completed: $BACKUP_NAME"
    echo ""
    echo "Backup location: $BACKUP_PATH"
    echo "Total size: $(du -sh "$BACKUP_PATH" | cut -f1)"
}

# Function to restore from backup
restore_from_backup() {
    print_header
    
    if [ -z "$1" ]; then
        print_info "Available backups:"
        ls -la "$BACKUP_DIR" | grep "vox-student-full-backup"
        echo ""
        echo "Usage: $0 restore <backup-name>"
        exit 1
    fi
    
    BACKUP_NAME="$1"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
    
    if [ ! -d "$BACKUP_PATH" ]; then
        print_error "Backup not found: $BACKUP_NAME"
        exit 1
    fi
    
    print_info "Restoring from backup: $BACKUP_NAME"
    
    # Show backup info
    if [ -f "$BACKUP_PATH/manifest.txt" ]; then
        echo ""
        cat "$BACKUP_PATH/manifest.txt"
        echo ""
    fi
    
    read -p "Continue with restore? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Restore cancelled"
        exit 0
    fi
    
    # 1. Stop current containers
    print_info "Stopping current containers..."
    ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
        "cd /opt/hcktplanet/vox-student && docker compose down || docker stop vox-student || true"
    
    # 2. Restore Docker image
    if [ -f "$BACKUP_PATH/docker-image.tar.gz" ]; then
        print_info "Restoring Docker image..."
        cat "$BACKUP_PATH/docker-image.tar.gz" | ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
            "gunzip | docker load"
        
        if [ -f "$BACKUP_PATH/image-tag.txt" ]; then
            IMAGE_TAG=$(cat "$BACKUP_PATH/image-tag.txt")
            ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
                "docker tag $IMAGE_TAG hcktplanet/vox-student:latest"
        fi
        print_success "Docker image restored"
    fi
    
    # 3. Restore volumes
    print_info "Restoring Docker volumes..."
    tar czf - -C "$BACKUP_PATH" data whatsapp 2>/dev/null | \
    ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" << 'EOF'
        cd /tmp
        rm -rf vox-restore-temp
        mkdir vox-restore-temp
        tar xzf - -C vox-restore-temp
        
        # Clear existing volumes
        docker volume rm vox-student_vox-student-db vox-student_vox-student-whatsapp 2>/dev/null || true
        
        # Create new volumes
        docker volume create vox-student_vox-student-db
        docker volume create vox-student_vox-student-whatsapp
        
        # Restore data
        docker run --rm -v /tmp/vox-restore-temp/data:/source:ro -v vox-student_vox-student-db:/target alpine \
            sh -c "cp -a /source/. /target/"
        
        docker run --rm -v /tmp/vox-restore-temp/whatsapp:/source:ro -v vox-student_vox-student-whatsapp:/target alpine \
            sh -c "cp -a /source/. /target/"
        
        rm -rf vox-restore-temp
EOF
    print_success "Docker volumes restored"
    
    # 4. Restore configuration files
    if [ -f "$BACKUP_PATH/.env.production" ]; then
        print_info "Restoring configuration files..."
        scp -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" \
            "$BACKUP_PATH/.env.production" \
            "$USER@$SERVER:/opt/hcktplanet/vox-student/"
    fi
    
    if [ -f "$BACKUP_PATH/docker-compose.yml" ]; then
        scp -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" \
            "$BACKUP_PATH/docker-compose.yml" \
            "$USER@$SERVER:/opt/hcktplanet/vox-student/"
    fi
    
    # 5. Start containers
    print_info "Starting containers..."
    ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
        "cd /opt/hcktplanet/vox-student && docker compose up -d"
    
    print_success "Restore completed!"
    
    # 6. Verify
    sleep 10
    print_info "Verifying restoration..."
    ssh -o StrictHostKeyChecking=no -i "$IDENTITY_FILE" "$USER@$SERVER" \
        "docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep vox-student || echo 'No container running'"
}

# Function to verify backups
verify_backup() {
    print_header
    
    if [ -z "$1" ]; then
        print_error "Usage: $0 verify <backup-name>"
        exit 1
    fi
    
    BACKUP_NAME="$1"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
    
    if [ ! -d "$BACKUP_PATH" ]; then
        print_error "Backup not found: $BACKUP_NAME"
        exit 1
    fi
    
    print_info "Verifying backup: $BACKUP_NAME"
    echo ""
    
    # Check all components
    [ -f "$BACKUP_PATH/manifest.txt" ] && print_success "Manifest found" || print_error "Manifest missing"
    [ -f "$BACKUP_PATH/docker-image.tar.gz" ] && print_success "Docker image found ($(du -h "$BACKUP_PATH/docker-image.tar.gz" | cut -f1))" || print_error "Docker image missing"
    [ -d "$BACKUP_PATH/data" ] && print_success "Database backup found" || print_error "Database backup missing"
    [ -d "$BACKUP_PATH/whatsapp" ] && print_success "WhatsApp session found" || print_error "WhatsApp session missing"
    [ -f "$BACKUP_PATH/.env.production" ] && print_success "Environment file found" || print_warning "Environment file missing"
    [ -f "$BACKUP_PATH/docker-compose.yml" ] && print_success "Docker compose file found" || print_warning "Docker compose file missing"
    
    echo ""
    echo "Total backup size: $(du -sh "$BACKUP_PATH" | cut -f1)"
}

# Function for emergency quick restore
emergency_restore() {
    print_header
    print_warning "EMERGENCY RESTORE MODE"
    echo ""
    
    # Find latest backup
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR" | grep "vox-student-full-backup" | head -1)
    
    if [ -z "$LATEST_BACKUP" ]; then
        print_error "No backups found!"
        exit 1
    fi
    
    print_info "Latest backup found: $LATEST_BACKUP"
    restore_from_backup "$LATEST_BACKUP"
}

# Main script logic
case "$1" in
    backup)
        create_full_backup
        ;;
    restore)
        restore_from_backup "$2"
        ;;
    verify)
        verify_backup "$2"
        ;;
    emergency)
        emergency_restore
        ;;
    list)
        print_header
        print_info "Available backups:"
        ls -la "$BACKUP_DIR" | grep "vox-student-full-backup" || echo "No backups found"
        ;;
    *)
        print_header
        echo "Usage: $0 {backup|restore|verify|emergency|list}"
        echo ""
        echo "Commands:"
        echo "  backup              Create a full backup"
        echo "  restore <name>      Restore from a specific backup"
        echo "  verify <name>       Verify backup integrity"
        echo "  emergency           Quick restore from latest backup"
        echo "  list                List all available backups"
        echo ""
        echo "Examples:"
        echo "  $0 backup"
        echo "  $0 restore vox-student-full-backup-20250719-120000"
        echo "  $0 verify vox-student-full-backup-20250719-120000"
        echo "  $0 emergency"
        ;;
esac