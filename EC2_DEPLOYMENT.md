# EC2 Deployment Guide for YouTube Transcript Generator

This guide will help you deploy the YouTube Transcript Generator application on AWS EC2.

## Prerequisites

- AWS EC2 instance (Ubuntu 22.04 LTS recommended)
- Domain name (optional, for production)
- SSH access to EC2 instance
- API keys:
  - GROQ_API_KEY
  - OPENAI_API_KEY

## Step 1: EC2 Instance Setup

### 1.1 Launch EC2 Instance

1. Launch an EC2 instance (Ubuntu 22.04 LTS, t2.medium or larger recommended)
2. Configure Security Group to allow:
   - SSH (22) - from your IP
   - HTTP (80) - from anywhere (0.0.0.0/0)
   - HTTPS (443) - from anywhere (0.0.0.0/0)
   - Custom TCP (3000) - from anywhere (0.0.0.0/0) - for backend API

### 1.2 Connect to EC2 Instance

```bash
ssh -i your-key.pem ubuntu@your-ec2-public-ip
```

## Step 2: Install Dependencies

### 2.1 Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2 Install Node.js (v18 or later)

**Check if Node.js is already installed:**
```bash
if command -v node &> /dev/null; then
    echo "Node.js is already installed: $(node --version)"
    echo "npm version: $(npm --version)"
else
    echo "Node.js not found. Installing..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi
node --version  # Verify installation
```

**If Node.js version is too old (< v18), upgrade it:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2.3 Install Python and yt-dlp

**Check if Python 3 is already installed:**
```bash
if command -v python3 &> /dev/null; then
    echo "Python 3 is already installed: $(python3 --version)"
else
    echo "Python 3 not found. Installing..."
    sudo apt install -y python3 python3-pip
fi
```

**Check if ffmpeg is already installed:**
```bash
if command -v ffmpeg &> /dev/null; then
    echo "ffmpeg is already installed: $(ffmpeg -version | head -n 1)"
else
    echo "ffmpeg not found. Installing..."
    sudo apt install -y ffmpeg
fi
```

**Check if yt-dlp is already installed:**
```bash
if command -v yt-dlp &> /dev/null; then
    echo "yt-dlp is already installed: $(yt-dlp --version)"
else
    echo "yt-dlp not found. Installing..."
    sudo pip3 install yt-dlp
fi
yt-dlp --version  # Verify installation
```

### 2.4 Install Nginx

**Check if Nginx is already installed:**
```bash
if command -v nginx &> /dev/null; then
    echo "Nginx is already installed: $(nginx -v 2>&1)"
    sudo systemctl status nginx | grep -q "active" && echo "Nginx is running" || sudo systemctl start nginx
else
    echo "Nginx not found. Installing..."
    sudo apt install -y nginx
    sudo systemctl start nginx
fi
sudo systemctl enable nginx  # Enable auto-start on boot
```

### 2.5 Install PM2 (Process Manager)

**Check if PM2 is already installed:**
```bash
if command -v pm2 &> /dev/null; then
    echo "PM2 is already installed: $(pm2 --version)"
else
    echo "PM2 not found. Installing..."
    sudo npm install -g pm2
fi
pm2 --version  # Verify installation
```

## Step 3: Deploy Application

### 3.1 Clone Repository

**Check if repository is already cloned:**
```bash
if [ -d "/home/ubuntu/youtube-transcript" ]; then
    echo "Repository already exists. Updating..."
    cd /home/ubuntu/youtube-transcript
    git pull origin main
else
    echo "Cloning repository..."
    cd /home/ubuntu
    git clone https://github.com/menahilnadeem08/Youtube-Transcriptor-App youtube-transcript
    cd youtube-transcript
fi
```

### 3.2 Setup Backend

```bash
cd backend

# Check if node_modules exists
if [ -d "node_modules" ]; then
    echo "Dependencies already installed. Updating..."
    npm install
else
    echo "Installing dependencies..."
    npm install
fi

# Check if .env file exists
if [ -f ".env" ]; then
    echo ".env file already exists. Review it to ensure API keys are correct:"
    cat .env
    echo ""
    read -p "Do you want to edit .env file? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        nano .env
    fi
else
    echo "Creating .env file..."
    nano .env
fi
```

Add the following to `.env`:
```
GROQ_API_KEY=your_groq_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
PORT=3000
NODE_ENV=production
```

### 3.3 Setup Frontend

```bash
cd ../frontend

# Check if node_modules exists
if [ -d "node_modules" ]; then
    echo "Dependencies already installed. Updating..."
    npm install
else
    echo "Installing dependencies..."
    npm install
fi

# Check if dist folder exists and is recent
if [ -d "dist" ]; then
    echo "Frontend build already exists."
    read -p "Do you want to rebuild? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm run build
    fi
else
    echo "Building frontend..."
    npm run build
fi
```

The built files will be in `frontend/dist/` directory.

## Step 4: Configure PM2

### 4.1 Start Backend with PM2

```bash
cd /home/ubuntu/youtube-transcript/backend

# Check if PM2 process already exists
if pm2 list | grep -q "youtube-backend"; then
    echo "Backend is already running with PM2. Restarting..."
    pm2 restart youtube-backend
else
    echo "Starting backend with PM2..."
    pm2 start server.js --name youtube-backend
    pm2 save
    # Only run startup if not already configured
    if ! pm2 startup | grep -q "already"; then
        pm2 startup  # Follow instructions to enable auto-start on reboot
    fi
fi
```

### 4.2 Verify Backend is Running

```bash
pm2 status
pm2 logs youtube-backend
```

Test the backend:
```bash
curl http://localhost:3000/api/health
```

## Step 5: Configure Nginx

### 5.1 Create Nginx Configuration

**Check if Nginx configuration already exists:**
```bash
if [ -f "/etc/nginx/sites-available/youtube-transcript" ]; then
    echo "Nginx configuration already exists."
    read -p "Do you want to edit it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo nano /etc/nginx/sites-available/youtube-transcript
    else
        echo "Using existing configuration."
    fi
else
    echo "Creating Nginx configuration..."
    sudo nano /etc/nginx/sites-available/youtube-transcript
fi
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name 18.217.107.170;

    # Serve frontend static files
    root /home/ubuntu/youtube-transcript/frontend/dist;
    index index.html;

    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Increase timeouts for long-running requests
    proxy_read_timeout 300;
    proxy_connect_timeout 300;
    proxy_send_timeout 300;
}
```

### 5.2 Enable Site and Test Configuration

```bash
# Check if symlink already exists
if [ -L "/etc/nginx/sites-enabled/youtube-transcript" ]; then
    echo "Nginx site already enabled."
else
    echo "Enabling Nginx site..."
npm stfi

# Test configuration
sudo nginx -t

# Reload Nginx if test passes
if [ $? -eq 0 ]; then
    sudo systemctl reload nginx
    echo "Nginx configuration reloaded successfully."
else
    echo "Nginx configuration test failed. Please fix errors before proceeding."
    exit 1
fi
```

## Step 6: SSL Certificate (Optional but Recommended)

### 6.1 Install Certbot

**Check if Certbot is already installed:**
```bash
if command -v certbot &> /dev/null; then
    echo "Certbot is already installed: $(certbot --version)"
else
    echo "Certbot not found. Installing..."
    sudo apt install -y certbot python3-certbot-nginx
fi
```

### 6.2 Obtain SSL Certificate

**Note:** SSL certificates typically require a domain name. If you only have an IP address (18.217.107.170), you may need to use a service like Let's Encrypt with a domain, or skip SSL setup for now.

If you have a domain name pointing to your EC2 IP:
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Follow the prompts. Certbot will automatically configure Nginx for HTTPS.

## Step 7: Firewall Configuration

**Check firewall status and configure:**
```bash
# Check if UFW is installed
if command -v ufw &> /dev/null; then
    echo "UFW is installed."
    # Check current status
    sudo ufw status
    
    # Check if rules already exist
    if sudo ufw status | grep -q "22/tcp"; then
        echo "Firewall rules may already be configured."
    else
        echo "Configuring firewall rules..."
        sudo ufw allow 22/tcp
        sudo ufw allow 80/tcp
        sudo ufw allow 443/tcp
    fi
    
    # Enable firewall if not already enabled
    if sudo ufw status | grep -q "Status: active"; then
        echo "Firewall is already active."
    else
        echo "Enabling firewall..."
        echo "y" | sudo ufw enable
    fi
else
    echo "UFW not found. Installing and configuring..."
    sudo apt install -y ufw
    sudo ufw allow 22/tcp
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    echo "y" | sudo ufw enable
fi
```

## Step 8: Verify Deployment

1. **Backend Health Check:**
   ```bash
   curl http://localhost:3000/api/health
   ```

2. **Frontend Access:**
   - Open browser: `http://18.217.107.170`

3. **Test Full Flow:**
   - Enter a YouTube URL
   - Select a language
   - Submit and verify transcript generation

## Step 9: Monitoring and Maintenance

### 9.1 PM2 Commands

```bash
pm2 status              # Check status
pm2 logs youtube-backend # View logs
pm2 restart youtube-backend  # Restart backend
pm2 stop youtube-backend     # Stop backend
pm2 monit              # Monitor resources
```

### 9.2 Nginx Logs

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 9.3 Application Logs

```bash
pm2 logs youtube-backend --lines 100
```

## Step 10: Auto-Update Script (Optional)

Create a script to update the application:

```bash
nano /home/ubuntu/update-app.sh
```

```bash
#!/bin/bash
set -e  # Exit on error

cd /home/ubuntu/youtube-transcript
echo "Pulling latest changes..."
git pull origin main

echo "Updating backend..."
cd backend
npm install
pm2 restart youtube-backend

echo "Updating frontend..."
cd ../frontend
npm install
npm run build

echo "Reloading Nginx..."
sudo systemctl reload nginx

echo "Application updated successfully!"
```

Make it executable:
```bash
chmod +x /home/ubuntu/update-app.sh
```

## Troubleshooting

### Backend Not Starting

1. Check PM2 logs: `pm2 logs youtube-backend`
2. Verify .env file exists and has correct API keys
3. Check if port 3000 is in use: `sudo lsof -i :3000`
4. Verify Node.js version: `node --version`

### Frontend Not Loading

1. Check Nginx status: `sudo systemctl status nginx`
2. Verify Nginx config: `sudo nginx -t`
3. Check file permissions: `ls -la /home/ubuntu/youtube-transcript/frontend/dist`
4. Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`

### API Requests Failing

1. Verify backend is running: `pm2 status`
2. Test backend directly: `curl http://localhost:3000/api/health`
3. Check CORS settings in `server.js`
4. Verify Nginx proxy configuration

### yt-dlp Not Working

1. Verify installation: `yt-dlp --version`
2. Test manually: `yt-dlp --version`
3. Check Python: `python3 --version`
4. Reinstall if needed: `sudo pip3 install --upgrade yt-dlp`

### High Memory Usage

1. Monitor with PM2: `pm2 monit`
2. Consider upgrading EC2 instance type
3. Implement cleanup for temp files (already in code)
4. Set up log rotation for PM2

## Security Best Practices

1. **Keep .env file secure:**
   - Never commit .env to git
   - Use proper file permissions: `chmod 600 backend/.env`

2. **Regular Updates:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   npm update -g pm2
   ```

3. **Firewall:**
   - Only open necessary ports
   - Restrict SSH access to your IP

4. **SSL/TLS:**
   - Always use HTTPS in production
   - Set up automatic certificate renewal

5. **Backup:**
   - Regular backups of application code
   - Backup .env file securely

## Cost Optimization

1. Use EC2 instance types based on actual usage
2. Consider using AWS Elastic IP for static IP
3. Set up CloudWatch alarms for monitoring
4. Use S3 for storing large files if needed

## Next Steps

- Set up domain name and DNS
- Configure CloudWatch for monitoring
- Set up automated backups
- Implement CI/CD pipeline
- Add rate limiting for API endpoints
- Set up error tracking (e.g., Sentry)

