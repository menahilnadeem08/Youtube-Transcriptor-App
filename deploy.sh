#!/bin/bash

# Deployment script for YouTube Transcript Generator
# This script can be run manually or used as a reference for CI/CD

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="$HOME/youtube-transcript"
BACKUP_DIR="$HOME/youtube-transcript-backup-$(date +%Y%m%d-%H%M%S)"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${GREEN}🚀 Starting deployment...${NC}"

# Check if we're in the right directory
if [ ! -d "$REPO_DIR/backend" ] || [ ! -d "$REPO_DIR/frontend" ]; then
  echo -e "${RED}❌ Error: Must run from youtube-transcript directory${NC}"
  exit 1
fi

# Step 1: Build frontend
echo -e "${YELLOW}📦 Building frontend...${NC}"
cd "$REPO_DIR/frontend"
npm ci
npm run build

if [ ! -d "dist" ]; then
  echo -e "${RED}❌ Error: Frontend build failed${NC}"
  exit 1
fi

# Step 2: Create backup
if [ -d "$APP_DIR" ]; then
  echo -e "${YELLOW}💾 Creating backup...${NC}"
  cp -r "$APP_DIR" "$BACKUP_DIR"
  echo -e "${GREEN}✓ Backup created at $BACKUP_DIR${NC}"
fi

# Step 3: Copy files to app directory
echo -e "${YELLOW}📋 Copying files...${NC}"
mkdir -p "$APP_DIR"
cp -r "$REPO_DIR/backend"/* "$APP_DIR/"
mkdir -p "$APP_DIR/frontend-dist"
cp -r "$REPO_DIR/frontend/dist"/* "$APP_DIR/frontend-dist/" 2>/dev/null || {
  echo -e "${RED}❌ Error: Frontend dist directory not found. Did you run 'npm run build'?${NC}"
  exit 1
}

# Step 4: Install dependencies
echo -e "${YELLOW}📥 Installing dependencies...${NC}"
cd "$APP_DIR"
npm ci --production

# Step 5: Ensure yt-dlp is installed
echo -e "${YELLOW}🔧 Checking yt-dlp...${NC}"
if ! command -v yt-dlp &> /dev/null; then
  echo -e "${YELLOW}Installing yt-dlp...${NC}"
  sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
  sudo chmod a+rx /usr/local/bin/yt-dlp
  echo -e "${GREEN}✓ yt-dlp installed${NC}"
else
  echo -e "${GREEN}✓ yt-dlp already installed${NC}"
fi

# Step 6: Restart application
echo -e "${YELLOW}🔄 Restarting application...${NC}"
if command -v pm2 &> /dev/null; then
  # Update PM2 config path
  sed -i "s|process.env.HOME + '/youtube-transcript'|'$APP_DIR'|g" "$APP_DIR/ecosystem.config.js" 2>/dev/null || true
  
  if pm2 list | grep -q "youtube-transcript"; then
    pm2 restart youtube-transcript
    echo -e "${GREEN}✓ Application restarted${NC}"
  else
    pm2 start "$APP_DIR/ecosystem.config.js"
    pm2 save
    echo -e "${GREEN}✓ Application started${NC}"
  fi
  
  # Show status
  pm2 status
else
  echo -e "${YELLOW}⚠ PM2 not found. Installing PM2...${NC}"
  npm install -g pm2
  pm2 start "$APP_DIR/ecosystem.config.js"
  pm2 save
  pm2 startup
  echo -e "${GREEN}✓ PM2 installed and application started${NC}"
fi

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}📊 Application status:${NC}"
pm2 status youtube-transcript

