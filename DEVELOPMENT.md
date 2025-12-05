# Development Guide

## Quick Start

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- yt-dlp installed (for audio transcription)

### Starting the Application

#### Option 1: Run Both Servers Separately (Recommended for Development)

**Terminal 1 - Backend:**
```bash
cd youtube-transcript/backend
npm install
npm start
```

The backend will start on `http://localhost:3000`

**Terminal 2 - Frontend:**
```bash
cd youtube-transcript/frontend
npm install
npm run dev
```

The frontend will start on `http://localhost:5173` (or another port if 5173 is taken)

#### Option 2: Run Backend Only (Production Mode)

If you've built the frontend, you can run just the backend which will serve the built frontend:

```bash
cd youtube-transcript/backend
npm install

# Build frontend first
cd ../frontend
npm install
npm run build

# Start backend (serves frontend from dist)
cd ../backend
npm start
```

Then visit `http://localhost:3000`

## Environment Variables

### Backend (.env file in `youtube-transcript/backend/`)

Create a `.env` file with:

```env
OPENAI_API_KEY=your_openai_api_key_here
GROQ_API_KEY=your_groq_api_key_here
PORT=3000
NODE_ENV=development
```

### Frontend

The frontend uses environment variables prefixed with `VITE_`:

- `VITE_API_URL` - (Optional) Override API URL. Defaults to `/api` which uses Vite proxy in dev mode.

## Common Issues

### 1. Proxy Error: ECONNREFUSED

**Error:**
```
Proxy error: ECONNREFUSED
```

**Solution:**
- Make sure the backend server is running on port 3000
- Check if port 3000 is already in use: `netstat -ano | findstr :3000` (Windows) or `lsof -i :3000` (Mac/Linux)
- Start the backend: `cd youtube-transcript/backend && npm start`

### 2. Backend Not Starting

**Check:**
- Node.js version: `node --version` (should be 18+)
- Dependencies installed: `cd youtube-transcript/backend && npm install`
- Environment variables set in `.env` file
- Port 3000 is available

### 3. Frontend Not Connecting to Backend

**In Development Mode:**
- Vite proxy should handle this automatically
- Make sure backend is running on `http://localhost:3000`
- Check browser console for errors

**In Production Mode:**
- Set `VITE_API_URL` environment variable to your backend URL
- Or ensure backend is serving frontend static files correctly

### 4. yt-dlp Not Found

**Error:**
```
yt-dlp: command not found
```

**Solution:**

**Windows:**
```powershell
# Using pip
pip install yt-dlp

# Or using winget
winget install yt-dlp
```

**Mac:**
```bash
brew install yt-dlp
```

**Linux:**
```bash
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

## Development Workflow

### Making Changes

1. **Backend Changes:**
   - Edit files in `youtube-transcript/backend/`
   - Restart the backend server (or use `nodemon` for auto-restart)
   - Changes take effect immediately

2. **Frontend Changes:**
   - Edit files in `youtube-transcript/frontend/src/`
   - Vite will hot-reload automatically
   - No restart needed

### Testing

1. **Backend API:**
   ```bash
   curl http://localhost:3000/api/health
   ```

2. **Frontend:**
   - Open `http://localhost:5173` in browser
   - Check browser console for errors
   - Test transcription/translation features

## Project Structure

```
youtube-transcript/
├── backend/
│   ├── server.js          # Main backend server
│   ├── package.json       # Backend dependencies
│   ├── .env               # Environment variables (not in git)
│   └── ecosystem.config.js # PM2 config for production
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main React component
│   │   └── ...
│   ├── dist/              # Built frontend (generated)
│   ├── package.json       # Frontend dependencies
│   └── vite.config.js     # Vite configuration
└── .github/
    └── workflows/
        └── deploy.yml     # CI/CD pipeline
```

## Debugging

### Backend Logs
- Check console output when running `npm start`
- Logs show transcription progress and errors

### Frontend Logs
- Open browser DevTools (F12)
- Check Console tab for errors
- Check Network tab for API requests

### PM2 Logs (Production)
```bash
pm2 logs youtube-transcript
pm2 logs youtube-transcript --err  # Errors only
```

## Port Configuration

### Default Ports
- **Backend:** 3000
- **Frontend (Dev):** 5173 (Vite default)
- **Frontend (Production):** Served by backend on port 3000

### Changing Ports

**Backend:**
```env
# In backend/.env
PORT=3001
```

**Frontend (Dev):**
```bash
# In frontend/vite.config.js or command line
npm run dev -- --port 5174
```

## Hot Reload

- **Frontend:** Vite provides hot module replacement (HMR) automatically
- **Backend:** Use `nodemon` for auto-restart:
  ```bash
  npm install -g nodemon
  nodemon server.js
  ```

## Building for Production

```bash
# Build frontend
cd youtube-transcript/frontend
npm run build

# The dist/ folder will be created
# Backend will serve it automatically when running in production mode
```

## Next Steps

- See [CI-CD-SETUP.md](./CI-CD-SETUP.md) for deployment instructions
- See [backend/EC2-SETUP.md](./backend/EC2-SETUP.md) for server setup
- See [QUICK-START-CICD.md](./QUICK-START-CICD.md) for quick deployment guide

