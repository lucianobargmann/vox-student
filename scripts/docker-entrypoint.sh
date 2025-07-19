#!/bin/sh
set -e

echo "🚀 Starting VoxStudent container..."
echo "📍 Environment: $NODE_ENV"

# Ensure data directory exists
mkdir -p /app/data

# Run database migrations on startup
echo "🔄 Running database migrations..."
cd /app && npx prisma migrate deploy

# Check if database needs seeding (for first-time setup)
if [ ! -f "/app/data/prod.db" ]; then
    echo "🌱 First-time setup detected, initializing database..."
    cd /app && npx prisma db push
fi

echo "✅ Database ready"

# Start the application
echo "🚀 Starting Next.js application..."
exec "$@"