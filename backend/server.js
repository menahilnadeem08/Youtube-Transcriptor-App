// Backend server for YouTube Transcript Generator
import express from 'express';
import cors from 'cors';
import { Innertube } from 'youtubei.js';
import Groq from 'groq-sdk';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

const app = express();
app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// OpenAI configuration for Whisper
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Create temp directory for audio files
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Extract video ID from URL
function extractVideoId(url) {
  const patterns = [
    // Regular YouTube URLs: youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/watch\?v=)([^&\n?#]+)/,
    // Short YouTube URLs: youtu.be/VIDEO_ID
    /(?:youtu\.be\/)([^&\n?#]+)/,
    // YouTube embed URLs: youtube.com/embed/VIDEO_ID
    /(?:youtube\.com\/embed\/)([^&\n?#]+)/,
    // YouTube Shorts URLs: youtube.com/shorts/VIDEO_ID
    /(?:youtube\.com\/shorts\/)([^&\n?#]+)/,
    // Direct video ID (11 characters)
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Download video audio using yt-dlp (same as main project)
async function downloadAudio(url, retryCount = 0) {
  const MAX_RETRIES = 3;
  
  try {
    console.log(`  📥 Downloading: ${url} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
    
    const outputTemplate = path.join(tempDir, '%(title)s.%(ext)s');
    
    // Use yt-dlp - detect OS and use appropriate command
    // On Linux/EC2: use 'yt-dlp', on Windows: use 'py -m yt_dlp'
    const isWindows = process.platform === 'win32';
    const ytDlpCmd = isWindows ? 'py -m yt_dlp' : 'yt-dlp';
    const cmd = `${ytDlpCmd} -f bestaudio --no-playlist -o "${outputTemplate}" "${url}" 2>&1`;
    
    const { stdout, stderr } = await execAsync(cmd, { 
      maxBuffer: 50 * 1024 * 1024, // Increased to 50MB
      timeout: 120000 
    });
    
    if (stderr && stderr.includes('ERROR')) {
      console.log(`   Debug: ${stderr.substring(0, 150)}`);
    }

    // Wait and find the downloaded file
    await new Promise(resolve => setTimeout(resolve, 1500));

    const files = fs.readdirSync(tempDir);
    console.log(`   Files in temp: ${files.join(', ')}`);
    
    // Filter for audio files (same as main project)
    const audioFiles = files.filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.webm', '.m4a', '.mp3', '.opus', '.aac', '.flac', '.wav', '.mkv', '.f251', '.m4b'].includes(ext);
    });
    
    if (audioFiles.length > 0) {
      const latestFile = audioFiles.sort().reverse()[0];
      const fullPath = path.join(tempDir, latestFile);
      const stats = fs.statSync(fullPath);
      console.log(`  ✓ Downloaded (${path.extname(latestFile)}, ${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
      return fullPath;
    }

    console.log(`  ✗ No audio file found - Video might be age-restricted`);
    
    // Retry if not found
    if (retryCount < MAX_RETRIES) {
      const delayMs = Math.pow(2, retryCount) * 5000;
      console.log(`⏳ Waiting ${delayMs / 1000}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return downloadAudio(url, retryCount + 1);
    }
    
    return null;
  } catch (error) {
    const errorMsg = error.message || error.toString();
    console.log(`  ✗ Download failed: ${errorMsg.substring(0, 100)}`);
    
    // Check if it's a bot detection error
    const isBotError = errorMsg.includes('Sign in to confirm') || 
                       errorMsg.includes('bot') ||
                       errorMsg.includes('429') ||
                       errorMsg.includes('403');
    
    // Retry with delay if it's a bot detection error and we haven't exceeded max retries
    if (isBotError && retryCount < MAX_RETRIES) {
      const delayMs = Math.pow(2, retryCount) * 5000;
      console.log(`⏳ Waiting ${delayMs / 1000}s before retry...`);
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return downloadAudio(url, retryCount + 1);
    }
    
    return null;
  }
}

// Transcribe audio using OpenAI Whisper API
async function transcribeWithWhisper(audioPath) {
  try {
    console.log('🔵 Attempting: OpenAI Whisper API...');
    const audioStream = fs.createReadStream(audioPath);
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-1',
      language: 'en'
    });
    
    if (transcription.text && transcription.text.length > 0) {
      console.log('✅ OpenAI Whisper transcription completed!');
      console.log('Transcribed text length:', transcription.text.length);
      return { text: transcription.text, method: 'openai' };
    }
  } catch (openaiError) {
    console.error('❌ OpenAI Whisper failed:', openaiError.message);
    throw new Error(`Transcription failed: ${openaiError.message}`);
  }
}

// Clean up temporary files and directories
function cleanupTempFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      // If it's a file, delete it
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        fs.unlinkSync(filePath);
        console.log('Cleaned up temp file:', filePath);
      } else if (stats.isDirectory()) {
        // If it's a directory, delete it and all contents
        fs.rmSync(filePath, { recursive: true, force: true });
        console.log('Cleaned up temp directory:', filePath);
      }
    }
  } catch (error) {
    console.error('Error cleaning up temp file:', error.message);
  }
}

// Helper function to send progress via SSE
function sendProgress(res, progress, message) {
  res.write(`data: ${JSON.stringify({ progress, message })}\n\n`);
}

// Get transcript endpoint with SSE progress updates
app.post('/api/transcript', async (req, res) => {
  let audioPath = null;
  
  // Set headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const { videoUrl, targetLanguage } = req.body;
    
    console.log('Received request:', { videoUrl, targetLanguage });
    
    // Extract video ID
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      sendProgress(res, 0, 'Invalid YouTube URL');
      res.write(`data: ${JSON.stringify({ error: 'Invalid YouTube URL' })}\n\n`);
      res.end();
      return;
    }

    console.log('Extracted video ID:', videoId);
    sendProgress(res, 5, 'Initializing...');

    // Initialize YouTube client
    console.log('Initializing YouTube client...');
    const youtube = await Innertube.create();
    sendProgress(res, 10, 'YouTube client initialized');

    // Fetch video info and transcript
    console.log('Fetching video info...');
    sendProgress(res, 15, 'Fetching video information...');
    const info = await youtube.getInfo(videoId);
    sendProgress(res, 20, 'Video information retrieved');
    
    let originalText = null;
    let transcriptionMethod = 'captions';
    
    // Try to get captions first
    console.log('📝 Checking for video captions...');
    sendProgress(res, 25, 'Fetching captions...');
    try {
      const transcriptData = await info.getTranscript();
      
      if (transcriptData && transcriptData.transcript) {
        // Extract text from transcript segments
        const transcript = transcriptData.transcript.content.body.initial_segments;
        
        if (transcript && transcript.length > 0) {
          console.log('✅ Video HAS captions available');
          console.log('📊 Number of transcript segments:', transcript.length);
          console.log('🔧 Transcription Method: YouTube Captions (No AI model needed)');
          sendProgress(res, 35, 'Processing captions...');
          
          // Combine all transcript text
          originalText = transcript
            .map(segment => segment.snippet.text)
            .join(' ')
            .trim();
          
          sendProgress(res, 40, 'Captions extracted successfully');
        } else {
          console.log('❌ Video does NOT have captions');
          console.log('🔧 Will use: OpenAI Whisper-1 model for transcription');
        }
      }
    } catch (captionError) {
      console.log('❌ Video does NOT have captions');
      console.log('🔧 Will use: OpenAI Whisper-1 model for transcription');
      sendProgress(res, 30, 'No captions found, downloading audio...');
    }
    
    // If no captions, use OpenAI Whisper
    if (!originalText || originalText.length === 0) {
      console.log('🎤 Starting transcription with OpenAI Whisper-1 model...');
      
      try {
        // Try to download audio using the full YouTube URL
        sendProgress(res, 45, 'Downloading audio from YouTube...');
        audioPath = await downloadAudio(videoUrl);
        
        if (!audioPath) {
          sendProgress(res, 0, 'Could not download audio');
          res.write(`data: ${JSON.stringify({ 
            error: 'Could not download audio from YouTube. The video might be age-restricted, private, or unavailable.' 
          })}\n\n`);
          res.end();
          return;
        }
        
        sendProgress(res, 60, 'Audio downloaded, transcribing...');
        
        // Transcribe with OpenAI Whisper
        console.log('🤖 Using Model: OpenAI Whisper-1');
        const whisperResult = await transcribeWithWhisper(audioPath);
        originalText = whisperResult.text;
        transcriptionMethod = whisperResult.method; // 'openai'
        
        console.log('✅ Transcription completed using OpenAI Whisper-1');
        
        if (!originalText || originalText.length === 0) {
          sendProgress(res, 0, 'Transcription failed');
          res.write(`data: ${JSON.stringify({ 
            error: 'Could not extract text from transcription services.' 
          })}\n\n`);
          res.end();
          return;
        }
        
        sendProgress(res, 75, 'Transcription completed');
      } catch (downloadError) {
        console.error('Audio download failed:', downloadError.message);
        sendProgress(res, 0, 'Download failed');
        res.write(`data: ${JSON.stringify({
          error: downloadError.message || 'Could not download audio from YouTube. Please try a video with available captions, or try again in a few moments.',
          hint: 'YouTube may be blocking downloads. Videos with captions work best without audio download.'
        })}\n\n`);
        res.end();
        return;
      }
    }

    console.log('📄 Original text length:', originalText.length, 'characters');
    console.log('📝 First 200 chars:', originalText.substring(0, 200));

    // Translate with GROQ
    console.log('🌐 Starting translation...');
    console.log('🤖 Using Model: Groq Llama-3.3-70b-versatile');
    console.log('🎯 Target Language:', targetLanguage);
    console.log('⚙️  Translation Config: temperature=0.3, max_tokens=32768');
    sendProgress(res, 80, 'Translating content...');
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `Translate this text to ${targetLanguage}. Only output the translation, nothing else:\n\n${originalText}`
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 32768, // Increased from 8000 to maximum (32,768 tokens)
    });

    const translatedText = completion.choices[0].message.content;
    
    console.log('✅ Translation completed using Groq Llama-3.3-70b-versatile!');
    console.log('📄 Translation length:', translatedText.length, 'characters');
    
    sendProgress(res, 95, 'Translation completed, finalizing...');
    
    // Calculate stats
    const wordCount = translatedText.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);

    sendProgress(res, 100, 'Complete!');
    
    // Final summary log
    console.log('='.repeat(80));
    console.log('📊 PROCESSING SUMMARY:');
    console.log('='.repeat(80));
    console.log('🎥 Video ID:', videoId);
    console.log('📝 Captions Available:', originalText && transcriptionMethod === 'captions' ? 'YES ✅' : 'NO ❌');
    console.log('🤖 Transcription Model:', transcriptionMethod === 'captions' ? 'YouTube Captions (No AI)' : 'OpenAI Whisper-1');
    console.log('🌐 Translation Model: Groq Llama-3.3-70b-versatile');
    console.log('📄 Word Count:', wordCount);
    console.log('⏱️  Reading Time:', readingTime, 'minutes');
    console.log('='.repeat(80));
    
    // Send final result
    res.write(`data: ${JSON.stringify({
      success: true,
      original: originalText,
      translated: translatedText,
      wordCount,
      readingTime,
      videoId,
      transcriptionMethod
    })}\n\n`);
    
    res.end();

  } catch (error) {
    console.error('❌ Server error:', error.message);
    sendProgress(res, 0, 'Error occurred');
    res.write(`data: ${JSON.stringify({ 
      error: error.message || 'Failed to process video'
    })}\n\n`);
    res.end();
  } finally {
    // Clean up temporary audio directory (contains downloaded audio files)
    if (audioPath) {
      // Get the parent directory (videoId folder)
      const audioDir = path.dirname(audioPath);
      cleanupTempFile(audioDir);
    }
  }
});

app.get('/api/health', (req, res) => {
  console.log(`[HEALTH CHECK] ${new Date().toISOString()}`);
  res.json({ 
    status: 'ok',
    service: 'YouTube Transcript Backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/', (req, res) => {
  res.json({ message: 'YouTube Transcript Backend', status: 'running' });
});
const PORT = process.env.PORT || 3000;

// Listen on all interfaces (0.0.0.0) for EC2 deployment
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
