#!/bin/bash

# Setup Mailpit for VoxStudent local development
# This script starts Mailpit for email testing during development

echo "🚀 Setting up Mailpit for VoxStudent email testing..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if Mailpit container already exists
if docker ps -a --format 'table {{.Names}}' | grep -q "^mailpit$"; then
    echo "📦 Mailpit container already exists."
    
    # Check if it's running
    if docker ps --format 'table {{.Names}}' | grep -q "^mailpit$"; then
        echo "✅ Mailpit is already running!"
    else
        echo "🔄 Starting existing Mailpit container..."
        docker start mailpit
        echo "✅ Mailpit started!"
    fi
else
    echo "📥 Creating and starting new Mailpit container..."
    docker run -d --name mailpit -p 8025:8025 -p 1025:1025 axllent/mailpit
    echo "✅ Mailpit container created and started!"
fi

# Wait a moment for the service to be ready
sleep 2

# Check if Mailpit is accessible
echo "🔍 Checking Mailpit accessibility..."

# Check SMTP port
if nc -z localhost 1025 2>/dev/null; then
    echo "✅ SMTP server is running on port 1025"
else
    echo "⚠️  SMTP server not accessible on port 1025"
fi

# Check Web UI port
if nc -z localhost 8025 2>/dev/null; then
    echo "✅ Web interface is running on port 8025"
else
    echo "⚠️  Web interface not accessible on port 8025"
fi

echo ""
echo "🎉 Mailpit setup complete!"
echo ""
echo "📧 Email Configuration:"
echo "   - SMTP Server: localhost:1025"
echo "   - Web Interface: http://localhost:8025"
echo ""
echo "💡 Usage:"
echo "   1. Start your VoxStudent app: npm run dev"
echo "   2. Go to login page and request a magic link"
echo "   3. Check emails at: http://localhost:8025"
echo ""
echo "🛑 To stop Mailpit:"
echo "   docker stop mailpit"
echo ""
echo "🗑️  To remove Mailpit:"
echo "   docker rm mailpit"
