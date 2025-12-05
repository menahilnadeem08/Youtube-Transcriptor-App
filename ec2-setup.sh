#!/bin/bash
# EC2 One-Time Setup Script
# Run this on your EC2 instance: bash ec2-setup.sh

set -e

echo "🚀 Starting EC2 Setup..."

# Install Node.js 20.x
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Setup project directory
echo "📂 Setting up project..."
cd ~
if [ ! -d "Youtube-Transcriptor-App" ]; then
    git clone https://github.com/menahilnadeem08/Youtube-Transcriptor-App.git
fi
cd Youtube-Transcriptor-App

# Setup backend
echo "⚙️  Setting up backend..."
cd backend
npm install --production

# Create .env if needed (you'll need to add your API keys)
if [ ! -f ".env" ]; then
    echo "Creating .env file - PLEASE UPDATE WITH YOUR API KEYS"
    cat > .env << EOF
GROQ_API_KEY=your_groq_key_here
OPENAI_API_KEY=your_openai_key_here
PORT=3000
EOF
fi

pm2 start server.js --name youtube-backend
cd ..

# Setup frontend
echo "⚙️  Setting up frontend..."
cd frontend
npm install
npm run build

# Serve frontend on port 80
pm2 serve dist 80 --spa --name youtube-frontend
cd ..

# Save PM2 configuration
pm2 save
pm2 startup

# Configure firewall
echo "🔒 Configuring firewall..."
sudo ufw allow 80
sudo ufw allow 3000
sudo ufw allow 22
sudo ufw --force enable

echo "✅ Setup complete!"
echo "🔑 Remember to update backend/.env with your API keys"
echo "📊 Check status: pm2 status"
echo "📝 View logs: pm2 logs"

