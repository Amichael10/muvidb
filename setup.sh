#!/bin/bash
# Nollywood Scraper Server Setup Script
# Target: Ubuntu 24.04 LTS

set -e

echo "==========================================="
echo "🚀 Nollywood Scraper Server Setup Starting"
echo "==========================================="

# Update package lists
echo "🔄 Updating package lists..."
apt-get update -y

# Install standard dependencies
echo "📦 Installing system dependencies..."
apt-get install -y git curl build-essential software-properties-common

# Install Node.js (NodeSource 20.x)
echo "🟢 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install Python 3, pip and virtual env
echo "🐍 Installing Python, pip and venv..."
apt-get install -y python3 python3-pip python3-venv python3-dev

# Install FFmpeg & Tesseract OCR & required libraries for OpenCV / PaddleOCR
echo "🎥 Installing FFmpeg, Tesseract OCR, and graphics libraries..."
apt-get install -y ffmpeg tesseract-ocr libgl1 libglib2.0-0

# Verify installations
echo "🔍 Verification:"
node -v
npm -v
python3 --version

# Setup Python virtual environment
echo "🐍 Creating Python virtual environment..."
mkdir -p /var/www/ensembla
python3 -m venv /var/www/ensembla/venv
source /var/www/ensembla/venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install Python scraper dependencies
echo "🐍 Installing Python dependencies (PaddleOCR, yt-dlp, cv2, etc.)..."
pip install yt-dlp paddleocr opencv-python-headless imagehash rapidfuzz pytesseract python-dotenv google-genai requests pillow

# Setup Node.js project dependencies
echo "🎭 Installing Node dependencies & Playwright browsers..."
cd /var/www/ensembla
npm ci --omit=dev || npm install --production

# Install Playwright dependencies (browsers + system packages)
npx playwright install --with-deps chromium

# Install PM2 globally to manage background sync tasks
echo "🚀 Installing PM2 globally..."
npm install -g pm2

echo "==========================================="
echo "✅ Server dependencies installed successfully!"
echo "==========================================="
