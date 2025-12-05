# YouTube Transcript Generator - Architecture Diagram

## Project Overview

**YouTube Transcript Generator** is a full-stack web application that extracts transcripts from YouTube videos and translates them into multiple languages. It supports both videos with captions (fast path) and videos without captions (using AI transcription as fallback).

---

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER BROWSER / CLIENT                               │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    React Frontend (Vite)                             │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  App.jsx                                                    │   │   │
│  │  │  ├─ YouTube URL Input Field                                │   │   │
│  │  │  ├─ Language Dropdown (8 languages)                        │   │   │
│  │  │  ├─ Submit Button                                          │   │   │
│  │  │  ├─ Progress Bar (LoadingOverlay)                          │   │   │
│  │  │  └─ Result Display                                         │   │   │
│  │  │     ├─ Original Text                                       │   │   │
│  │  │     ├─ Translated Text                                     │   │   │
│  │  │     ├─ Stats (Words, Reading Time)                         │   │   │
│  │  │     └─ Download Buttons (TXT, PDF, DOCX)                   │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  Dependencies:                                              │   │   │
│  │  │  ├─ React 19.2.0      (UI Framework)                        │   │   │
│  │  │  ├─ Vite              (Build Tool)                          │   │   │
│  │  │  ├─ Lucide React      (Icons)                               │   │   │
│  │  │  ├─ jsPDF             (PDF Generation)                      │   │   │
│  │  │  └─ docx              (Word Document Generation)            │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                     │                                        │
│                                     │ HTTP POST                              │
│                                     │ /api/transcript                       │
│                                     │                                        │
└─────────────────────────────────────┼────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      BACKEND SERVER (Node.js/Express)                       │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ server.js - Main Express Application                                │   │
│  │                                                                      │   │
│  │  PORT: 3000 (default)                                               │   │
│  │  CORS: Enabled                                                      │   │
│  │  Middleware: cors(), express.json()                                 │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ STEP 1: URL Validation & Video ID Extraction                         │  │
│  │                                                                        │  │
│  │  Input: { videoUrl: string, targetLanguage: string }                 │  │
│  │                                                                        │  │
│  │  Supported URL Formats:                                               │  │
│  │  ├─ https://www.youtube.com/watch?v=VIDEO_ID                        │  │
│  │  ├─ https://youtu.be/VIDEO_ID                                        │  │
│  │  ├─ https://www.youtube.com/embed/VIDEO_ID                          │  │
│  │  ├─ https://www.youtube.com/shorts/VIDEO_ID                         │  │
│  │  └─ VIDEO_ID (direct 11-character ID)                               │  │
│  │                                                                        │  │
│  │  Function: extractVideoId(url) → videoId                             │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                         │                                     │
│                                         ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ STEP 2: Initialize YouTube Client                                     │  │
│  │                                                                        │  │
│  │  Library: youtubei.js v16.0.1                                         │  │
│  │  Purpose: Fetch video metadata and captions                           │  │
│  │                                                                        │  │
│  │  Function: Innertube.create() → Initialize client                     │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                         │                                     │
│                                         ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ STEP 3: Fetch Video Info & Transcription                              │  │
│  │                                                                        │  │
│  │  youtube.getInfo(videoId) → Get video metadata                        │  │
│  │  info.getTranscript()     → Fetch available captions                  │  │
│  │                                                                        │  │
│  │  Extract from: transcript.content.body.initial_segments               │  │
│  │                                                                        │  │
│  │  Output: originalText (string)                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                         │                                     │
│                    ┌────────────────────┴────────────────────┐                │
│                    │                                         │                │
│           FOUND CAPTIONS?                           CAPTIONS MISSING?        │
│                    │                                         │                │
│                    ▼                                         ▼                │
│  ┌────────────────────────┐              ┌────────────────────────────────┐  │
│  │ PRIMARY PATH           │              │ FALLBACK PATH: AI Transcription│  │
│  │ Caption Extraction ✓   │              │ (Whisper-based)              │  │
│  │                        │              │                              │  │
│  │ Direct → originalText  │              │ STEP 4A: Download Audio      │  │
│  │                        │              │ ├─ Tool: yt-dlp-exec         │  │
│  │ Time: ~300-500ms       │              │ ├─ Format: bestaudio/mp3    │  │
│  │                        │              │ ├─ Location: ./temp/         │  │
│  │                        │              │ ├─ Retry Logic (3 attempts)  │  │
│  │                        │              │ ├─ Bot Detection Handling    │  │
│  │                        │              │ └─ Time: ~10-30s             │  │
│  │                        │              │                              │  │
│  │                        │              │ STEP 4B: Transcription       │  │
│  │                        │              │                              │  │
│  │                        │              │ Priority Order:              │  │
│  │                        │              │ 1️⃣  Google Gemini API       │  │
│  │                        │              │    (gemini-2.0-flash or      │  │
│  │                        │              │     gemini-1.5-flash)        │  │
│  │                        │              │                              │  │
│  │                        │              │ 2️⃣  OpenAI Whisper API      │  │
│  │                        │              │    (whisper-1 model)         │  │
│  │                        │              │                              │  │
│  │                        │              │ 3️⃣  Whisper API Fallback    │  │
│  │                        │              │    (whisper-api.com)         │  │
│  │                        │              │                              │  │
│  │                        │              │ Output: originalText         │  │
│  │                        │              │ Time: ~15-25s                │  │
│  │                        │              │                              │  │
│  │                        │              │ STEP 4C: Cleanup Temp Files  │  │
│  │                        │              │ └─ fs.rmSync(audioDir)       │  │
│  └────────────────────────┘              └────────────────────────────────┘  │
│                    │                                         │                │
│                    └────────────────────┬────────────────────┘                │
│                                         │                                     │
│                                         ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ STEP 5: Translation Engine                                             │  │
│  │                                                                        │  │
│  │  AI Provider: Groq Cloud                                              │  │
│  │  Model: llama-3.3-70b-versatile                                       │  │
│  │  Temperature: 0.3 (deterministic, consistent)                         │  │
│  │  Max Tokens: 8000                                                     │  │
│  │                                                                        │  │
│  │  Input: originalText + targetLanguage                                 │  │
│  │  Output: translatedText                                               │  │
│  │  Time: ~2-5s                                                          │  │
│  │                                                                        │  │
│  │  Supported Languages: 8 options                                       │  │
│  │  ├─ English     ├─ Arabic       ├─ Urdu                               │  │
│  │  ├─ Spanish     ├─ Hindi                                              │  │
│  │  ├─ French      └─ Chinese                                            │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                         │                                     │
│                                         ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ STEP 6: Calculate Statistics                                           │  │
│  │                                                                        │  │
│  │  wordCount = translatedText.split(/\s+/).length                       │  │
│  │  readingTime = Math.ceil(wordCount / 200) (in minutes)                │  │
│  │                                                                        │  │
│  │  Assumption: Average reading speed ~200 words/minute                  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                         │                                     │
│                                         ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ STEP 7: Send Response                                                  │  │
│  │                                                                        │  │
│  │  HTTP 200 (Success)                                                   │  │
│  │  {                                                                    │  │
│  │    "success": true,                                                   │  │
│  │    "original": "Original English text...",                            │  │
│  │    "translated": "Translated text...",                                │  │
│  │    "wordCount": 1250,                                                 │  │
│  │    "readingTime": 7,                                                  │  │
│  │    "videoId": "dQw4w9WgXcQ",                                          │  │
│  │    "transcriptionMethod": "captions" | "gemini" | "openai" | "whisper-api"  │  │
│  │  }                                                                    │  │
│  │                                                                        │  │
│  │  HTTP 400 (Validation Error)                                          │  │
│  │  {"error": "Invalid YouTube URL"}                                     │  │
│  │                                                                        │  │
│  │  HTTP 500 (Server Error)                                              │  │
│  │  {"error": "Failed to download audio: ..."}                           │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ ERROR HANDLING & FALLBACK LOGIC                                      │   │
│  │                                                                      │   │
│  │  1. Invalid URL → Reject at step 1                                   │   │
│  │  2. Video not found → YouTube API error                              │   │
│  │  3. No captions & can't download → User error message               │   │
│  │  4. Transcription fails → Try next method in priority list          │   │
│  │  5. Translation fails → Return 500 error                             │   │
│  │  6. Cleanup always runs → finally block executes                     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ DEPENDENCIES & EXTERNAL SERVICES                                     │   │
│  │                                                                      │   │
│  │ 🔵 express@5.1.0          - Web server framework                     │   │
│  │ 🔵 cors@2.8.5              - Cross-origin resource sharing          │   │
│  │ 🎥 youtubei.js@16.0.1      - YouTube API client                     │   │
│  │ 📥 yt-dlp-exec@latest      - Audio downloader (with bot bypass)     │   │
│  │ 🤖 groq-sdk@0.35.0         - Groq API client (translation)          │   │
│  │ 🤖 @google/generative-ai   - Google Gemini API (transcription)      │   │
│  │ 🤖 openai@4.28.0           - OpenAI Whisper API (transcription)     │   │
│  │ 🔧 axios@1.6.0             - HTTP client for Whisper API            │   │
│  │ 📝 form-data@4.0.0         - Multipart form data handling           │   │
│  │ ⚙️  dotenv@17.2.3          - Environment variable loader             │   │
│  │ 📦 nodemon@3.1.11          - Development auto-restart               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend
| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Runtime | Node.js + Browser | Latest | Execution environment |
| Framework | React | 19.2.0 | UI component library |
| Build Tool | Vite | 7.2.2 | Fast build & dev server |
| Styling | CSS-in-JS | - | Inline styles with React |
| Icons | Lucide React | 0.553.0 | Icon library |
| PDF Export | jsPDF | 3.0.3 | Generate PDF documents |
| Word Export | docx | 9.5.1 | Generate DOCX documents |
| Linting | ESLint | 9.39.1 | Code quality checks |

### Backend
| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Runtime | Node.js | Latest | JavaScript runtime |
| Web Server | Express | 5.1.0 | HTTP server framework |
| CORS | cors | 2.8.5 | Enable cross-origin requests |
| Configuration | dotenv | 17.2.3 | Environment variables |
| YouTube | youtubei.js | 16.0.1 | YouTube data extraction |
| Audio Download | yt-dlp-exec | Latest | Download video audio |
| Translation | groq-sdk | 0.35.0 | Groq LLM API |
| Transcription | openai | 4.28.0 | OpenAI Whisper API |
| Transcription | @google/generative-ai | 0.24.1 | Google Gemini API |
| Transcription | axios | 1.6.0 | HTTP requests (Whisper API fallback) |
| Form Data | form-data | 4.0.0 | Multipart form handling |
| Dev Tools | nodemon | 3.1.11 | Auto-restart during development |

---

## Data Flow Sequences

### Scenario 1: Video with Available Captions (Fast Path)

```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌────────┐     ┌──────────┐
│ Frontend│────▶│Validate &│────▶│YouTube   │────▶│Caption │────▶│Translate │
│ Input   │     │Extract ID│     │Fetch Info│     │Extract │     │with Groq │
└─────────┘     └──────────┘     └──────────┘     └────────┘     └────────┬─┘
                                                                            │
                 ┌──────────────────────────────────────────────────────────┘
                 │
                 ▼
            ┌────────────┐     ┌──────────┐     ┌──────────┐
            │Calculate   │────▶│Prepare   │────▶│Return    │
            │Stats       │     │Response  │     │JSON      │
            └────────────┘     └──────────┘     └──────────┘

Timeline: ~2.5-3s total
  • Step 1 (URL validation): 10ms
  • Step 2-3 (YouTube fetch): 300-500ms
  • Step 5 (Translation): 2-5s
  • Step 6-7 (Response): 10ms
```

### Scenario 2: Video without Captions (AI Transcription Path)

```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Frontend│────▶│Validate &│────▶│YouTube   │────▶│No Captions
│ Input   │     │Extract ID│     │Fetch Info│     │Found
└─────────┘     └──────────┘     └──────────┘     └──────┬────┘
                                                        │
                  ┌─────────────────────────────────────┘
                  │
                  ▼
          ┌──────────────────┐
          │Download Audio    │
          │(yt-dlp-exec)     │ ◄─── Retry logic (3x with backoff)
          │~10-30s           │
          └────────┬─────────┘
                   │
        ┌──────────▼──────────┐
        │                     │
        ▼                     ▼
   ┌─────────────┐      ┌──────────────┐
   │Gemini API   │      │OpenAI Whisper│
   │(Priority 1) │      │(Priority 2)  │
   └────┬────────┘      └───────┬──────┘
        │                       │
        │ (if fails)            │ (if fails)
        │                       │
        └───────────┬───────────┘
                    │
                    ▼
          ┌────────────────────┐
          │Whisper API Fallback│ ◄─── whisper-api.com
          │(Priority 3)        │
          └────────┬───────────┘
                   │
                   ▼
          ┌──────────────────┐
          │Cleanup Temp Files│
          │fs.rmSync()       │
          └────────┬─────────┘
                   │
                   ▼
          ┌──────────────────────┐     ┌────────────┐     ┌──────────┐
          │Translate with Groq   │────▶│Calculate   │────▶│Return    │
          │llama-3.3-70b         │     │Stats       │     │JSON      │
          └──────────────────────┘     └────────────┘     └──────────┘

Timeline: ~30-40s total
  • Audio download: 10-30s
  • Transcription: 15-25s
  • Translation: 2-5s
  • Total: 27-60s (depending on video length & network)
```

---

## File Structure

```
youtube-transcript/
│
├── frontend/                          # React/Vite Application
│   ├── src/
│   │   ├── App.jsx                    # Main component (UI + Logic)
│   │   ├── LoadingOverlay.jsx          # Progress bar overlay
│   │   ├── main.jsx                    # React entry point
│   │   ├── App.css                     # Component styles
│   │   ├── index.css                   # Global styles
│   │   └── assets/
│   ├── public/                         # Static assets
│   │   └── vite.svg
│   ├── dist/                           # Production build output
│   │   ├── index.html
│   │   ├── vite.svg
│   │   └── assets/
│   ├── package.json                    # Dependencies
│   ├── vite.config.js                  # Vite build config
│   ├── eslint.config.js                # ESLint configuration
│   └── index.html                      # HTML template
│
├── backend/                           # Node.js/Express Server
│   ├── server.js                       # Main server file
│   │   ├─ yt-dlp auto-update on start
│   │   ├─ extractVideoId()
│   │   ├─ downloadAudio()
│   │   ├─ transcribeWithWhisper()
│   │   ├─ cleanupTempFile()
│   │   ├─ POST /api/transcript
│   │   └─ Error handling
│   │
│   ├── temp/                           # Temporary directory for audio
│   │   └── {videoId}/
│   │       └── {title}.{ext}          # Downloaded audio files
│   │
│   ├── package.json                    # Dependencies + scripts
│   ├── .env                            # Environment variables (gitignored)
│   │   ├─ GROQ_API_KEY
│   │   ├─ GEMINI_API_KEY (optional)
│   │   ├─ OPENAI_API_KEY (optional)
│   │   ├─ WHISPER_API_KEY (optional)
│   │   ├─ PORT (default 3000)
│   │   └─ YOUTUBE_COOKIES (optional)
│   │
│   └── node_modules/                  # Installed dependencies
│
├── ARCHITECTURE.md                     # This file
├── README.md                           # Project overview
└── .gitignore                          # Git ignore rules
```

---

## API Endpoints

### POST /api/transcript
**Purpose:** Extract and translate YouTube video transcript

**Request:**
```json
{
  "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "targetLanguage": "Spanish"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "original": "Full original transcript text...",
  "translated": "Texto traducido completo...",
  "wordCount": 1250,
  "readingTime": 7,
  "videoId": "dQw4w9WgXcQ",
  "transcriptionMethod": "captions"
}
```

**Error Responses:**
```json
// 400 - Invalid URL
{ "error": "Invalid YouTube URL" }

// 500 - Download failed
{ 
  "error": "YouTube is blocking downloads from this server...",
  "hint": "Please try a video with available captions..."
}

// 500 - All transcription methods failed
{
  "error": "All transcription methods failed..."
}
```

---

## Environment Variables

```bash
# Required
GROQ_API_KEY=your_groq_api_key            # For translation (free tier)
PORT=3000                                  # Server port (default: 3000)

# Optional (Transcription - at least ONE required)
GEMINI_API_KEY=your_gemini_key            # Google Gemini API
OPENAI_API_KEY=your_openai_key            # OpenAI Whisper
WHISPER_API_KEY=your_whisper_key          # Whisper API (whisper-api.com)

# Optional
YOUTUBE_COOKIES=cookie_string             # For bot detection bypass
```

**Priority Order for Transcription:**
1. **Google Gemini** (if `GEMINI_API_KEY` set)
2. **OpenAI Whisper** (if `OPENAI_API_KEY` set)
3. **Whisper API** (if `WHISPER_API_KEY` set)

---

## Performance Characteristics

### Response Times
| Scenario | Time | Components |
|----------|------|------------|
| Video with captions | 2.5-3s | URL validation + YouTube fetch + Translation |
| Video without captions | 30-60s | Download + Transcription + Translation |
| Average (mixed) | ~15-20s | Depends on video caption availability |

### Resource Usage
| Resource | Typical | Peak |
|----------|---------|------|
| Memory per request | 200-300MB | 500MB (with large audio) |
| Disk space per video | 50-100MB | 200MB+ (large videos) |
| Network bandwidth | Minimal | ~5-10Mbps (audio stream) |

### Scalability Considerations
- **Sequential Processing:** Currently processes one request at a time per server
- **Bottlenecks:** YouTube rate limiting, external API timeouts
- **Improvements:** Add request queue, implement caching, use worker threads

---

## Security & Best Practices

### ✅ Implemented
- API keys stored in `.env` (not in repository)
- CORS properly configured
- Input validation (URL format checking)
- Automatic temp file cleanup
- Error messages sanitized for clients
- Retry logic with exponential backoff for bot detection

### ⚠️ To Consider
- Rate limiting (not yet implemented)
- Request timeout handling
- API key rotation
- Monitoring and alerting
- Video duration limits
- Quota management per user/IP

---

## Supported Languages

The application supports translation to 8 languages:

| Code | Language |
|------|----------|
| en | English |
| es | Spanish |
| fr | French |
| ar | Arabic |
| hi | Hindi |
| zh | Chinese (Simplified) |
| ur | Urdu |

---

## Deployment Architecture

```
┌──────────────────────────────────────────────────┐
│         Production Environment                    │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ Load Balancer / Reverse Proxy              │  │
│  │ (nginx / Apache)                           │  │
│  └────────────────────┬───────────────────────┘  │
│                       │                          │
│       ┌───────────────┼───────────────┐          │
│       │               │               │          │
│       ▼               ▼               ▼          │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐     │
│  │Backend  │    │Backend  │    │Backend  │     │
│  │Server 1 │    │Server 2 │    │Server 3 │     │
│  │(Node.js)│    │(Node.js)│    │(Node.js)│     │
│  └────┬────┘    └────┬────┘    └────┬────┘     │
│       │              │              │          │
│       └──────────────┼──────────────┘          │
│                      │                         │
│                      ▼                         │
│          ┌──────────────────────┐              │
│          │ Shared File Storage  │              │
│          │ (for temp audio files)              │
│          │ or distributed cleanup              │
│          └──────────────────────┘              │
│                                                │
│  External APIs:                                │
│  ├─ YouTube (caption extraction)              │
│  ├─ Groq (translation)                        │
│  ├─ Google Gemini (transcription)             │
│  ├─ OpenAI Whisper (transcription)            │
│  └─ Whisper API (transcription fallback)      │
└──────────────────────────────────────────────────┘
```

---

## Development Workflow

### Local Setup
```bash
# Backend
cd backend
npm install
npm start                 # Runs with nodemon (auto-restart)

# Frontend (in another terminal)
cd frontend
npm install
npm run dev              # Runs Vite dev server (typically port 5173)
```

### Production Build
```bash
# Frontend
cd frontend
npm run build            # Creates optimized dist/ folder

# Backend
cd backend
npm start                # Runs server.js
```

### Environment Setup
1. Create `.env` file in `backend/` directory
2. Add required API keys (see Environment Variables section)
3. Set PORT (default: 3000)

---

## Key Features

✅ **Multiple Caption Sources**
- Primary: Built-in YouTube captions
- Fallback: AI transcription (Gemini, Whisper)

✅ **Smart Language Support**
- 8 target languages for translation
- Powered by Groq LLM

✅ **Export Options**
- TXT (plain text)
- PDF (formatted document)
- DOCX (editable Word document)

✅ **Robust Error Handling**
- Graceful fallbacks
- User-friendly error messages
- Automatic retry logic

✅ **Performance Optimized**
- Fast caption extraction when available
- Minimal dependencies
- Efficient audio streaming

---

## Troubleshooting

### Common Issues

**Issue:** "YouTube is blocking downloads from this server"
- **Cause:** YouTube bot detection
- **Solution:** Server issue, try again later or use video with captions

**Issue:** "CORS error when calling backend"
- **Cause:** Backend not running or wrong port
- **Solution:** Ensure backend is running on port 3000

**Issue:** "Invalid YouTube URL"
- **Cause:** URL format not recognized
- **Solution:** Use full URL format (youtube.com/watch?v=ID)

**Issue:** "No transcription API keys configured"
- **Cause:** Missing API keys in .env
- **Solution:** Add at least one transcription API key

---

## Future Enhancement Ideas

1. **Caching Layer**
   - Store transcriptions by video ID
   - Avoid re-processing popular videos

2. **Advanced Scheduling**
   - Async job queue for long requests
   - WebSocket updates for progress

3. **Language Detection**
   - Auto-detect source language
   - Automatic optimal language selection

4. **Subtitle Synchronization**
   - Return time-coded transcripts
   - Segment-by-segment translations

5. **User Management**
   - API key system
   - Usage quotas
   - Download history

6. **Multi-video Batch Processing**
   - Handle multiple videos in one request
   - Parallel processing optimization

---

## License & Attribution

- Project uses publicly available APIs
- Respects YouTube ToS for caption extraction
- Uses free/paid tiers of Groq, Whisper, and Gemini APIs

---

**Last Updated:** November 27, 2025  
**Architecture Version:** 2.0  
**Project Status:** Active Development

