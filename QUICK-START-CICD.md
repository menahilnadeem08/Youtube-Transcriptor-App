# Quick Start: CI/CD Setup

## 🚀 Quick Setup (5 minutes)

### 1. Add GitHub Secrets

Go to: **Repository → Settings → Secrets and variables → Actions**

Add these 4 secrets:

```
EC2_HOST          → Your EC2 IP or domain (e.g., ec2-12-34-56-78.compute-1.amazonaws.com)
EC2_USER          → SSH username (usually "ubuntu" or "ec2-user")
EC2_SSH_KEY       → Your private SSH key (entire .pem file content)
VITE_API_URL      → (Optional) Your API URL
```

### 2. Prepare EC2 Instance

SSH into your EC2 and run:

```bash
# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install yt-dlp
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# Create app directory
mkdir -p ~/youtube-transcript
cd ~/youtube-transcript

# Create .env file
nano .env
```

Add to `.env`:
```env
OPENAI_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
PORT=3000
NODE_ENV=production
```

### 3. Configure Security Group

Allow inbound:
- **Port 22** (SSH) from your IP
- **Port 3000** (or your PORT) from 0.0.0.0/0 (or your IP)

### 4. Deploy!

**Option A: Automatic (Recommended)**
- Push to `main` branch → Auto-deploys! 🎉

**Option B: Manual Trigger**
- Go to Actions → "Deploy to EC2" → "Run workflow"

### 5. Verify

```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@your-ec2-ip

# Check status
pm2 status
pm2 logs youtube-transcript

# Test API
curl http://localhost:3000/api/health
```

## 📋 What Gets Deployed?

- ✅ Frontend (React) - Built and optimized
- ✅ Backend (Node.js/Express) - With all dependencies
- ✅ PM2 configuration - For process management
- ✅ Automatic restarts - On deployment

## 🔧 Troubleshooting

**Deployment fails?**
- Check GitHub Actions logs
- Verify SSH key is correct
- Ensure EC2 security group allows SSH

**App not starting?**
```bash
pm2 logs youtube-transcript
pm2 restart youtube-transcript
```

**Frontend not loading?**
- Check if `frontend-dist` folder exists
- Verify backend is running: `pm2 status`

## 📚 Full Documentation

See [CI-CD-SETUP.md](./CI-CD-SETUP.md) for detailed instructions.

## 🆘 Need Help?

1. Check logs: `pm2 logs youtube-transcript`
2. Review GitHub Actions workflow logs
3. See [EC2-SETUP.md](./backend/EC2-SETUP.md) for server setup

