#!/bin/bash

# Database Backup Script for VoxStudent
# Usage: ./backup-database.sh [server] [identity-file] [user]

SERVER=${1:-164.163.10.235}
IDENTITY_FILE=${2:-~/.ssh/hunt-luke-2025.pem}
USER=${3:-root}
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="vox-student-db-backup-${TIMESTAMP}"

echo "🔄 Starting VoxStudent database backup..."
echo "📍 Server: ${SERVER}"
echo "🕐 Timestamp: ${TIMESTAMP}"

# Expand tilde in identity file path
IDENTITY_FILE="${IDENTITY_FILE/#\~/$HOME}"

# Create backup directory on server
ssh -o StrictHostKeyChecking=no -i "${IDENTITY_FILE}" "${USER}@${SERVER}" "mkdir -p /opt/hcktplanet/voxstudent/backups"

# Copy data from Docker volumes using temporary containers
echo "📦 Backing up SQLite database and WhatsApp session data from Docker volumes..."
ssh -o StrictHostKeyChecking=no -i "${IDENTITY_FILE}" "${USER}@${SERVER}" "mkdir -p /opt/hcktplanet/voxstudent/backups/${BACKUP_NAME}/data"
ssh -o StrictHostKeyChecking=no -i "${IDENTITY_FILE}" "${USER}@${SERVER}" "mkdir -p /opt/hcktplanet/voxstudent/backups/${BACKUP_NAME}/whatsapp-session"

# Backup database volume
echo "   📊 Backing up database volume..."
ssh -o StrictHostKeyChecking=no -i "${IDENTITY_FILE}" "${USER}@${SERVER}" \
    "docker run --rm -v voxstudent_vox-student-db:/source -v /opt/hcktplanet/voxstudent/backups/${BACKUP_NAME}/data:/backup alpine sh -c 'cp -a /source/. /backup/'"

# Backup WhatsApp session volume
echo "   📱 Backing up WhatsApp session volume..."
ssh -o StrictHostKeyChecking=no -i "${IDENTITY_FILE}" "${USER}@${SERVER}" \
    "docker run --rm -v voxstudent_vox-student-whatsapp:/source -v /opt/hcktplanet/voxstudent/backups/${BACKUP_NAME}/whatsapp-session:/backup alpine sh -c 'cp -a /source/. /backup/'"

# Create compressed archive on server
echo "🗜️ Creating compressed backup on server..."
ssh -o StrictHostKeyChecking=no -i "${IDENTITY_FILE}" "${USER}@${SERVER}" "cd /opt/hcktplanet/voxstudent/backups && tar -czf ${BACKUP_NAME}.tar.gz ${BACKUP_NAME} && rm -rf ${BACKUP_NAME}"

# Download backup to local machine
echo "📥 Downloading backup to local machine..."
mkdir -p ./database-backups
scp -i "${IDENTITY_FILE}" "${USER}@${SERVER}:/opt/hcktplanet/voxstudent/backups/${BACKUP_NAME}.tar.gz" "./database-backups/"

# Verify backup
if [ -f "./database-backups/${BACKUP_NAME}.tar.gz" ]; then
    SIZE=$(ls -lh "./database-backups/${BACKUP_NAME}.tar.gz" | awk '{print $5}')
    echo "✅ Backup completed successfully!"
    echo "📍 Local backup: ./database-backups/${BACKUP_NAME}.tar.gz"
    echo "📊 Size: ${SIZE}"
    
    # List all backups
    echo ""
    echo "📋 All local backups:"
    ls -lh ./database-backups/
else
    echo "❌ Backup failed!"
    exit 1
fi

# Cleanup old backups on server (keep last 7 days)
echo ""
echo "🧹 Cleaning up old backups on server (keeping last 7 days)..."
ssh -o StrictHostKeyChecking=no -i "${IDENTITY_FILE}" "${USER}@${SERVER}" "find /opt/hcktplanet/voxstudent/backups -name 'vox-student-db-backup-*.tar.gz' -mtime +7 -delete"

echo ""
echo "🎉 Backup process complete!"