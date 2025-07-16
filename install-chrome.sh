#!/bin/bash

# Install Chrome for headless WhatsApp Web automation
echo "Installing Google Chrome for headless operation..."

# Update package list
sudo apt-get update

# Install dependencies
sudo apt-get install -y wget gnupg

# Add Google's signing key
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -

# Add Google Chrome repository
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list

# Update package list again
sudo apt-get update

# Install Google Chrome
sudo apt-get install -y google-chrome-stable

# Verify installation
google-chrome --version

echo "Google Chrome installed successfully!"
echo "You can now set PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome in your environment"