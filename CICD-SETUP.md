# CI/CD Setup Guide for EC2 Deployment

## Step 1: Configure GitHub Secrets

1. Go to your GitHub repository: https://github.com/menahilnadeem08/Youtube-Transcriptor-App
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add these 5 secrets:

### Secret 1: EC2_HOST
- Name: `EC2_HOST`
- Value: `18.217.107.170`

### Secret 2: EC2_USER
- Name: `EC2_USER`
- Value: `ubuntu`

### Secret 3: EC2_SSH_KEY
- Name: `EC2_SSH_KEY`
- Value: Open your `Youtube-App.pem` file from Downloads and copy the entire content (including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`)

### Secret 4: GROQ_API_KEY
- Name: `GROQ_API_KEY`
- Value: Your Groq API key

### Secret 5: OPENAI_API_KEY
- Name: `OPENAI_API_KEY`
- Value: Your OpenAI API key

## Step 2: EC2 Setup (One-time)

SSH into your EC2:
```bash
ssh -i "Youtube-App.pem" ubuntu@18.217.107.170
```

Run these commands on EC2:

```bash
# Install Node.js (if not installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Clone your repo (if not already there)
cd ~
git clone https://github.com/menahilnadeem08/Youtube-Transcriptor-App.git
cd Youtube-Transcriptor-App

# Setup backend
cd backend
npm install
pm2 start server.js --name youtube-backend
cd ..

# Setup frontend
cd frontend
npm install
npm run build
pm2 serve dist 80 --spa --name youtube-frontend
cd ..

# Save PM2 config
pm2 save
pm2 startup

# Configure firewall
sudo ufw allow 80
sudo ufw allow 3000
sudo ufw allow 22
```

## Step 3: Push Code to GitHub

On your local machine:

```powershell
cd "C:\Users\UserIBM\Desktop\Job\Claude-YT\youtube-transcript"
git add .
git commit -m "Add CI/CD workflow"
git push origin main
```

## Step 4: Test Deployment

1. Go to GitHub repo → **Actions** tab
2. You should see the workflow running
3. Once complete, visit http://18.217.107.170/ to verify

## How It Works

- Every push to `main` branch triggers auto-deployment
- GitHub Actions SSHs into EC2
- Pulls latest code
- Installs dependencies
- Restarts services with PM2

## Manual Trigger

You can manually trigger deployment:
1. Go to **Actions** → **Deploy to EC2**
2. Click **Run workflow** → **Run workflow**

