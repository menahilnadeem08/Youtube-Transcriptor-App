# Environment Variables Setup Guide

## Overview

Your app uses environment variables in:
- **Backend**: API keys for Groq and OpenAI
- **Frontend**: Backend API URL

## How It Works in CI/CD

### Backend Environment Variables

The GitHub Actions workflow automatically creates a `.env` file on EC2 with:
```bash
GROQ_API_KEY=your_actual_key
OPENAI_API_KEY=your_actual_key
PORT=3000
```

These values come from **GitHub Secrets**, so they're never exposed in your code.

### Frontend Environment Variables

The frontend uses `.env.production` file which is committed to the repo:
```bash
VITE_API_URL=http://18.217.107.170:3000
```

During build (`npm run build`), Vite embeds this value into the bundle.

## Setup Instructions

### 1. Add GitHub Secrets

Go to: https://github.com/menahilnadeem08/Youtube-Transcriptor-App/settings/secrets/actions

Add these secrets:
- `GROQ_API_KEY` - Your Groq API key
- `OPENAI_API_KEY` - Your OpenAI API key

### 2. Frontend Production URL

Already configured in `frontend/.env.production`:
```
VITE_API_URL=http://18.217.107.170:3000
```

If your EC2 IP changes, update this file.

### 3. For Local Development

**Backend** (`backend/.env`):
```bash
GROQ_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
PORT=3000
```

**Frontend** (`frontend/.env.development`):
```bash
VITE_API_URL=http://localhost:3000
```

Or use the proxy in `vite.config.js` (already configured).

## Files Summary

| File | Purpose | Committed to Git? |
|------|---------|-------------------|
| `backend/.env` | Local/EC2 runtime vars | ❌ No (gitignored) |
| `backend/.env.example` | Template for developers | ✅ Yes |
| `frontend/.env.production` | Production API URL | ✅ Yes |
| `frontend/.env.development` | Local dev API URL | ❌ No (optional) |

## How Deployment Handles Env Vars

When you push to GitHub:

1. **GitHub Actions** runs
2. SSHs into EC2
3. Creates `backend/.env` from GitHub Secrets:
   ```bash
   echo "GROQ_API_KEY=${{ secrets.GROQ_API_KEY }}" > .env
   echo "OPENAI_API_KEY=${{ secrets.OPENAI_API_KEY }}" >> .env
   echo "PORT=3000" >> .env
   ```
4. Builds frontend with `.env.production`
5. Restarts services

## Verify on EC2

SSH into EC2:
```bash
ssh -i "Youtube-App.pem" ubuntu@18.217.107.170
```

Check backend env:
```bash
cd ~/Youtube-Transcriptor-App/backend
cat .env
```

Check if services are running:
```bash
pm2 status
pm2 logs youtube-backend
```

## Troubleshooting

**Problem**: API not responding
```bash
# Check backend logs
pm2 logs youtube-backend

# Check if env vars are set
cd ~/Youtube-Transcriptor-App/backend
cat .env
```

**Problem**: Frontend can't connect to backend
- Check `frontend/.env.production` has correct URL
- Verify backend is running on port 3000: `pm2 status`

**Problem**: Missing API keys error
- Verify GitHub Secrets are set: https://github.com/menahilnadeem08/Youtube-Transcriptor-App/settings/secrets/actions
- Redeploy to update EC2 env vars

