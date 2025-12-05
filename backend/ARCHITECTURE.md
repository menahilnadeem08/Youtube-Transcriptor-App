# System Architecture - Whisper API Integration

## Overview Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Application                        │
│              (Frontend/External Request)                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                    POST /api/transcript
                  {videoUrl, targetLanguage}
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   Express Server                             │
│                   (server.js)                                │
└────────────────────────┬────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
    Extract Video ID            Validate Request
          │                             │
          └──────────────┬──────────────┘
                         │
            Initialize YouTube Client
                  (Innertube.js)
                         │
                    Get Video Info
                         │
          ┌──────────────▼──────────────┐
          │                             │
       Try YouTube                      │
       Captions                         │
          │                             │
    ┌─────▼─────┐                      │
    │ Captions? │                      │
    └────┬──┬───┘                      │
      YES│ │NO                         │
    ┌────▼─▼────────────────────────┐  │
    │ Fallback to Whisper API ◄─────┼──┘
    │ 1. Download Audio             │
    │ 2. Send to Whisper API        │
    │ 3. Get Transcription          │
    └──────────────┬─────────────────┘
                   │
           Extract Text
           (Both paths converge)
                   │
    ┌──────────────▼──────────────┐
    │  Translate with Groq        │
    │  (llama-3.3-70b-versatile)  │
    └──────────────┬──────────────┘
                   │
         Calculate Stats
      (Word Count, Reading Time)
                   │
         Clean Up Temp Files
                   │
    ┌──────────────▼──────────────┐
    │   Send JSON Response        │
    │ {original, translated,      │
    │  wordCount, readingTime,    │
    │  transcriptionMethod}       │
    └────────────────────────────┘
```

## Component Details

### 1. Video URL Processing
```
YouTube URL Formats Supported:
├── https://www.youtube.com/watch?v=VIDEO_ID
├── https://youtu.be/VIDEO_ID
├── https://www.youtube.com/embed/VIDEO_ID
└── VIDEO_ID (direct)

Processing:
extractVideoId() → Regex Pattern Matching → Video ID
```

### 2. Caption Retrieval Path (PRIMARY)
```
Initialize Innertube Client
         │
    youtube.getInfo(videoId)
         │
    info.getTranscript()
         │
    Extract from transcript.content.body.initial_segments
         │
    Map segments → text
         │
    Join with spaces → Full Text
```

### 3. Whisper Fallback Path (SECONDARY)
```
A. Audio Download
   ytdl(videoURL) 
   ├── quality: 'lowestaudio'
   ├── filter: 'audioonly'
   └── Output: MP3 file in ./temp/

B. Whisper Transcription
   openai.audio.transcriptions.create()
   ├── file: audioStream
   ├── model: 'whisper-1'
   ├── language: 'en'
   └── Output: Transcribed Text

C. Cleanup
   fs.unlinkSync(audioPath)
   └── Remove temp audio file
```

### 4. Translation Engine
```
Groq LLM (llama-3.3-70b-versatile)
├── Input: Original Text + Target Language
├── Model: llama-3.3-70b-versatile
├── Temperature: 0.3 (deterministic)
├── Max Tokens: 8000
└── Output: Translated Text
```

## Data Flow Diagram

```
REQUEST
  │
  ├─ videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  └─ targetLanguage: "Spanish"
       │
       ▼
PROCESSING
  │
  ├─ Extract: videoId = "dQw4w9WgXcQ"
  │
  ├─ Try Captions
  │  ├─ ✅ Found → Extract Text → originalText
  │  └─ ❌ Not Found → Go to Whisper
  │
  ├─ Whisper (if needed)
  │  ├─ Download Audio → ./temp/dQw4w9WgXcQ.mp3
  │  ├─ Transcribe → originalText
  │  └─ Cleanup → Remove MP3
  │
  ├─ Translate
  │  ├─ Send to Groq: originalText + targetLanguage
  │  └─ Get: translatedText
  │
  ├─ Calculate Stats
  │  ├─ wordCount = translatedText.split().length
  │  └─ readingTime = ceil(wordCount / 200)
  │
  ▼
RESPONSE
  {
    success: true,
    original: "original text",
    translated: "translated text",
    wordCount: 150,
    readingTime: 1,
    videoId: "dQw4w9WgXcQ",
    transcriptionMethod: "captions" | "whisper"
  }
```

## File Structure

```
youtube-transcript/backend/
├── server.js                      # Main Express server
├── package.json                   # Dependencies
├── package-lock.json              # Locked versions
├── .env                           # Environment variables (not in repo)
│   ├── GROQ_API_KEY
│   ├── OPENAI_API_KEY
│   └── PORT
├── temp/                          # Temporary audio files (auto-cleanup)
│   └── VIDEO_ID.mp3               # Downloaded audio
├── Documentation
│   ├── SETUP.md                   # Setup guide
│   ├── CHANGES.md                 # Detailed changelog
│   ├── ARCHITECTURE.md            # This file
│   └── IMPLEMENTATION_SUMMARY.md  # Quick reference
└── node_modules/                  # Installed dependencies
    ├── express
    ├── cors
    ├── youtubei.js
    ├── groq-sdk
    ├── openai
    ├── ytdl-core
    └── ...
```

## Error Handling Flow

```
Request Error
    │
    ├─ Invalid URL → 400: "Invalid YouTube URL"
    │
    ├─ Video Not Found → 500: "Failed to process video"
    │
    ├─ Audio Download Failed → 500: "Failed to download audio: [reason]"
    │
    ├─ Whisper API Failed → 500: "Whisper transcription failed: [reason]"
    │
    ├─ Translation Failed → 500: "Error message from Groq API"
    │
    └─ Generic Error → 500: "Failed to process video"
```

## Key Functions Reference

### `extractVideoId(url)` 
- **Location:** Line 26-37
- **Input:** YouTube URL or Video ID
- **Output:** 11-character video ID
- **Purpose:** Validate and extract video ID from various URL formats

### `downloadAudio(videoId)`
- **Location:** Line 40-61
- **Input:** YouTube Video ID
- **Output:** Path to downloaded MP3 file
- **Purpose:** Download video audio in lowest quality
- **Uses:** ytdl-core library

### `transcribeWithWhisper(audioPath)`
- **Location:** Line 64-84
- **Input:** Path to audio file
- **Output:** Transcribed text
- **Purpose:** Send audio to OpenAI Whisper API
- **Uses:** OpenAI SDK

### `cleanupTempFile(filePath)`
- **Location:** Line 87-96
- **Input:** Path to temporary file
- **Output:** None (cleanup only)
- **Purpose:** Delete temporary audio files
- **Called:** In finally block

### `POST /api/transcript`
- **Location:** Line 99-213
- **Input:** `{videoUrl, targetLanguage}`
- **Output:** JSON response with transcription and translation
- **Purpose:** Main API endpoint

## Environment & Dependencies

### Runtime Dependencies
- **express**: Web server framework
- **cors**: Cross-origin resource sharing
- **youtubepi.js**: YouTube API client
- **groq-sdk**: Groq API client
- **openai**: OpenAI API client (for Whisper)
- **ytdl-core**: YouTube audio downloader
- **dotenv**: Environment variable loading

### External APIs
- **YouTube API**: Get video info and captions
- **OpenAI Whisper API**: Transcribe audio (~$0.006/min)
- **Groq API**: Translate text (free tier available)

## Performance Metrics

### Response Times
```
Scenario 1: Video with Captions
├─ YouTube Lookup: ~200ms
├─ Caption Fetch: ~300ms
├─ Translation: ~2s
└─ TOTAL: ~2.5s

Scenario 2: Video without Captions (Whisper)
├─ YouTube Lookup: ~200ms
├─ Audio Download: ~10s
├─ Whisper Transcription: ~20s
├─ Translation: ~2s
├─ Cleanup: ~100ms
└─ TOTAL: ~32s
```

### Resource Usage
```
Disk Space: ~50-100MB per video (temp audio)
Memory: ~200-500MB per request (streaming)
Network: Minimal (audio-only stream)
```

## Security Considerations

1. **API Key Protection**
   - Keys stored in `.env` (not in repo)
   - Never commit `.env` file

2. **Rate Limiting**
   - Not implemented (consider adding)
   - Monitor API usage

3. **File Cleanup**
   - Auto-cleanup of temp files
   - Cleanup in finally block (always executes)

4. **Error Messages**
   - Generic error messages to clients
   - Detailed logs on server

## Extensibility Points

### Future Enhancements
1. **Language Detection**
   - Auto-detect video language
   - Pass to Whisper API

2. **Audio Quality Selection**
   - Allow client to specify quality
   - Affects download time and accuracy

3. **Transcription Caching**
   - Cache transcriptions by video ID
   - Avoid re-processing

4. **Batch Processing**
   - Handle multiple videos
   - Async job queue

5. **Webhook Notifications**
   - Long-running requests
   - Client polling or push notifications

---

**Diagram Legend:**
- `→` : Data flow
- `├─` : Branch
- `│` : Vertical line
- `▼` : Direction
- `✅` : Success
- `❌` : Failure

