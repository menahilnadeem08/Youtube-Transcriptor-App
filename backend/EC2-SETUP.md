# EC2 Deployment Setup Guide

## Prerequisites

1. **Node.js** (v18 or higher)
2. **yt-dlp** (required for downloading YouTube audio)

## Installing yt-dlp on EC2

### Option 1: Using the Installation Script (Recommended)

```bash
cd youtube-transcript/backend
sudo bash install-yt-dlp.sh
```

### Option 2: Manual Installation

#### Method A: Direct Download (Fastest)

```bash
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

#### Method B: Using pip (if Python is installed)

```bash
pip3 install yt-dlp
# or
sudo pip3 install yt-dlp
```

### Verify Installation

```bash
yt-dlp --version
```

You should see a version number like `2024.xx.xx`

## Common Issues and Solutions

### Issue: "yt-dlp: command not found"

**Solution:** 
- Make sure yt-dlp is installed (see above)
- Check if it's in PATH: `which yt-dlp`
- If installed via pip, you may need to add Python's bin directory to PATH

### Issue: "Could not download audio from YouTube"

This can happen for several reasons:

1. **yt-dlp not installed**: Install using the methods above
2. **Video is age-restricted/private**: Some videos cannot be downloaded
3. **YouTube rate limiting**: Wait a few minutes and try again
4. **Network/firewall issues**: Check EC2 security group allows outbound HTTPS
5. **yt-dlp needs update**: Update with `sudo yt-dlp -U` or reinstall

### Issue: Permission Denied

```bash
sudo chmod a+rx /usr/local/bin/yt-dlp
```

### Issue: YouTube Blocking Requests

- YouTube may temporarily block EC2 IPs if too many requests are made
- Solution: Wait a few minutes, or use videos with available captions (which don't require audio download)

## Updating yt-dlp

```bash
sudo yt-dlp -U
```

Or reinstall using the installation script.

## Testing the Installation

Test with a simple video:

```bash
yt-dlp --version
yt-dlp --dump-json "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

## Environment Variables

Make sure your `.env` file has:

```
OPENAI_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
PORT=3000
```

## Starting the Server

```bash
cd youtube-transcript/backend
npm install
npm start
```

## Monitoring Logs

Check server logs for detailed error messages. The improved error handling will show:
- Whether yt-dlp is installed
- Specific YouTube error messages
- Download progress and issues

## Security Group Configuration

Ensure your EC2 security group allows:
- **Inbound**: Port 3000 (or your chosen PORT) from your IP/load balancer
- **Outbound**: HTTPS (443) to download from YouTube

