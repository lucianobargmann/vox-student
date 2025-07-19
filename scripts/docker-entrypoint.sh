#!/bin/sh
set -e

echo "Starting VoxStudent container..."
echo "Environment: $NODE_ENV"

# Ensure data directory exists
mkdir -p /app/data

# Note: Database migrations should be run outside the container
# or the full Prisma CLI needs to be included in the image

echo "Database directory ready"

# Start the application
echo "Starting Next.js application..."
exec "$@"