# CI/CD Setup Guide for EC2 Deployment

This guide explains how to set up continuous integration and deployment (CI/CD) for the YouTube Transcript Generator project using GitHub Actions.

## Overview

The CI/CD pipeline automatically:
1. Builds the frontend React application
2. Packages the backend and frontend together
3. Deploys to your EC2 instance via SSH
4. Restarts the application using PM2

## Prerequisites

1. **EC2 Instance** running Ubuntu/Amazon Linux
2. **Node.js** (v18+) installed on EC2
3. **PM2** (will be installed automatically if not present)
4. **yt-dlp** (will be installed automatically if not present)
5. **GitHub Repository** with Actions enabled

## Step 1: Prepare Your EC2 Instance

### 1.1 Initial Server Setup

SSH into your EC2 instance and run:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version

# Install PM2 globally (optional, will be auto-installed)
npm install -g pm2

# Install yt-dlp
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# Verify yt-dlp
yt-dlp --version
```

### 1.2 Create Application Directory

```bash
mkdir -p ~/youtube-transcript
cd ~/youtube-transcript
```

### 1.3 Set Up Environment Variables

Create a `.env` file in the backend directory:

```bash
nano ~/youtube-transcript/.env
```

Add your API keys:

```env
OPENAI_API_KEY=your_openai_api_key_here
GROQ_API_KEY=your_groq_api_key_here
PORT=3000
NODE_ENV=production
```

### 1.4 Configure Security Group

Ensure your EC2 security group allows:
- **Inbound**: Port 3000 (or your chosen PORT) from your IP/load balancer
- **Outbound**: HTTPS (443) to download from YouTube

## Step 2: Set Up GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add the following secrets:

| Secret Name | Description | Example |
|------------|-------------|---------|
| `EC2_HOST` | Your EC2 instance public IP or domain | `ec2-12-34-56-78.compute-1.amazonaws.com` |
| `EC2_USER` | SSH username (usually `ubuntu` or `ec2-user`) | `ubuntu` |
| `EC2_SSH_KEY` | Your private SSH key (entire content of `.pem` file) | `-----BEGIN RSA PRIVATE KEY-----...` |
| `VITE_API_URL` | (Optional) Frontend API URL override | `https://yourdomain.com/api` |

### How to Get Your SSH Key

1. If you're using AWS EC2, download your `.pem` key file
2. Copy the entire contents of the file (including `-----BEGIN` and `-----END` lines)
3. Paste it into the `EC2_SSH_KEY` secret

**Important**: Never commit your SSH key to the repository!

## Step 3: Configure the Workflow

The workflow file is already created at `.github/workflows/deploy.yml`. It will:

- Trigger on pushes to `main` or `master` branch
- Build the frontend
- Deploy to EC2 automatically

### Manual Deployment

You can also trigger deployments manually:
1. Go to Actions tab in GitHub
2. Select "Deploy to EC2" workflow
3. Click "Run workflow"

## Step 4: First Deployment

### Option A: Automatic (via GitHub Actions)

1. Push your code to the `main` branch
2. GitHub Actions will automatically deploy
3. Check the Actions tab for deployment status

### Option B: Manual (using deploy script)

1. Copy the `deploy.sh` script to your EC2 instance
2. Make it executable: `chmod +x deploy.sh`
3. Run it: `./deploy.sh`

## Step 5: Verify Deployment

After deployment, verify everything is working:

```bash
# SSH into your EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Check PM2 status
pm2 status

# View logs
pm2 logs youtube-transcript

# Check if server is running
curl http://localhost:3000/api/health
```

## Troubleshooting

### Deployment Fails

1. **Check GitHub Actions logs**: Go to Actions → Latest workflow run
2. **Verify SSH connection**: Test manually with `ssh -i key.pem user@host`
3. **Check EC2 security group**: Ensure SSH (port 22) is allowed from GitHub Actions IPs

### Application Not Starting

1. **Check PM2 logs**: `pm2 logs youtube-transcript`
2. **Verify environment variables**: Ensure `.env` file exists and has correct values
3. **Check Node.js version**: `node --version` should be 18.x or higher
4. **Verify yt-dlp**: `yt-dlp --version`

### Frontend Not Loading

1. **Check if frontend is built**: `ls -la ~/youtube-transcript/frontend-dist`
2. **Verify backend is serving static files**: Check `server.js` has static file serving
3. **Check browser console**: Look for errors in browser developer tools

### PM2 Issues

```bash
# Restart application
pm2 restart youtube-transcript

# Stop application
pm2 stop youtube-transcript

# Delete application
pm2 delete youtube-transcript

# Start fresh
pm2 start ~/youtube-transcript/ecosystem.config.js
```

## Manual Deployment Script

If you prefer to deploy manually, use the included `deploy.sh` script:

```bash
# Make executable
chmod +x youtube-transcript/deploy.sh

# Run from project root
./youtube-transcript/deploy.sh
```

## Environment Variables

The following environment variables are required:

- `OPENAI_API_KEY`: Your OpenAI API key for Whisper transcription
- `GROQ_API_KEY`: Your Groq API key for translation
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Set to `production` for production deployments

## Monitoring

### View Logs

```bash
# Real-time logs
pm2 logs youtube-transcript

# Last 100 lines
pm2 logs youtube-transcript --lines 100

# Error logs only
pm2 logs youtube-transcript --err
```

### Monitor Resources

```bash
# PM2 monitoring
pm2 monit

# System resources
htop
```

## Updating the Application

### Automatic Updates

Simply push to the `main` branch - GitHub Actions will handle the rest!

### Manual Updates

1. Pull latest code: `git pull origin main`
2. Run deploy script: `./deploy.sh`
3. Or manually:
   ```bash
   cd ~/youtube-transcript
   cd ../frontend && npm run build
   cd ../backend
   pm2 restart youtube-transcript
   ```

## Rollback

If something goes wrong, you can rollback:

```bash
# List backups
ls -la ~/youtube-transcript-backup-*

# Restore from backup
BACKUP_DIR="~/youtube-transcript-backup-YYYYMMDD-HHMMSS"
cp -r "$BACKUP_DIR" ~/youtube-transcript
cd ~/youtube-transcript
npm ci --production
pm2 restart youtube-transcript
```

## Security Best Practices

1. **Never commit secrets**: Use GitHub Secrets for sensitive data
2. **Use SSH keys**: Don't use password authentication
3. **Restrict security groups**: Only allow necessary ports
4. **Keep dependencies updated**: Regularly run `npm audit`
5. **Use HTTPS**: Set up a reverse proxy (nginx) with SSL for production

## Next Steps

- Set up a reverse proxy (nginx) for better performance
- Configure SSL certificates (Let's Encrypt)
- Set up monitoring and alerts
- Configure automatic backups
- Set up a staging environment

## Support

For issues or questions:
1. Check the logs: `pm2 logs youtube-transcript`
2. Review GitHub Actions workflow logs
3. Check the EC2-SETUP.md for server-specific issues

