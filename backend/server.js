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
    /(?:youtube\.com\/watch\?v=)([^&\n?#]+)/,
    /(?:youtu\.be\/)([^&\n?#]+)/,
    /(?:youtube\.com\/embed\/)([^&\n?#]+)/,
    /(?:youtube\.com\/shorts\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Download video audio using yt-dlp
async function downloadAudio(url, retryCount = 0) {
  const MAX_RETRIES = 3;
  try {
    console.log(` 📥 Downloading: ${url} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

    const outputTemplate = path.join(tempDir, '%(title)s.%(ext)s');
    const isWindows = process.platform === 'win32';
    const ytDlpCmd = isWindows ? 'py -m yt_dlp' : 'yt-dlp';

    try {
      await execAsync(`${ytDlpCmd} --version`, { timeout: 5000 });
    } catch (versionError) {
      const errorMsg = versionError.message || versionError.toString();
      console.error(` ✗ yt-dlp not found or not accessible: ${errorMsg}`);
      throw new Error(`yt-dlp is not installed. Please install it on your server.`);
    }

    const cmd = `${ytDlpCmd} -f bestaudio --no-playlist -o "${outputTemplate}" "${url}" 2>&1`;
    let stdout = '';
    let stderr = '';

    try {
      const result = await execAsync(cmd, {
        maxBuffer: 50 * 1024 * 1024,
        timeout: 120000
      });
      stdout = result.stdout || '';
      stderr = result.stderr || '';
    } catch (execError) {
      stdout = execError.stdout || '';
      stderr = execError.stderr || '';
      console.error(` ✗ yt-dlp execution error:`);
      console.error(` stdout: ${stdout.substring(0, 500)}`);
      console.error(` stderr: ${stderr.substring(0, 500)}`);
    }

    const combinedOutput = (stdout + stderr).toLowerCase();
    if (combinedOutput.includes('error') || combinedOutput.includes('unavailable') || combinedOutput.includes('private')) {
      if (combinedOutput.includes('private') || combinedOutput.includes('sign in')) {
        throw new Error('Video is private or requires sign-in');
      }
      if (combinedOutput.includes('unavailable') || combinedOutput.includes('not available')) {
        throw new Error('Video is unavailable or removed');
      }
      if (combinedOutput.includes('age-restricted') || combinedOutput.includes('age restricted')) {
        throw new Error('Video is age-restricted');
      }
      if (combinedOutput.includes('429') || combinedOutput.includes('rate limit')) {
        throw new Error('YouTube rate limit exceeded. Please try again later.');
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
    const files = fs.readdirSync(tempDir);
    
    const audioFiles = files.filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.webm', '.m4a', '.mp3', '.opus', '.aac', '.flac', '.wav', '.mkv', '.f251', '.m4b'].includes(ext);
    });

    if (audioFiles.length > 0) {
      const latestFile = audioFiles.sort().reverse()[0];
      const fullPath = path.join(tempDir, latestFile);
      const stats = fs.statSync(fullPath);
      console.log(` ✓ Downloaded (${path.extname(latestFile)}, ${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
      return fullPath;
    }

    if (retryCount < MAX_RETRIES) {
      const delayMs = Math.pow(2, retryCount) * 5000;
      console.log(`⏳ Waiting ${delayMs / 1000}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return downloadAudio(url, retryCount + 1);
    }

    throw new Error('No audio file was downloaded. The video might be age-restricted, private, or unavailable.');
  } catch (error) {
    const errorMsg = error.message || error.toString();
    console.error(` ✗ Download failed: ${errorMsg}`);

    const isBotError = errorMsg.includes('Sign in to confirm') || errorMsg.includes('bot') || 
                       errorMsg.includes('429') || errorMsg.includes('403') || 
                       errorMsg.includes('rate limit');

    if (isBotError && retryCount < MAX_RETRIES) {
      const delayMs = Math.pow(2, retryCount) * 5000;
      console.log(`⏳ Waiting ${delayMs / 1000}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return downloadAudio(url, retryCount + 1);
    }

    throw error;
  }
}

// Transcribe audio using OpenAI Whisper API (auto-detect language)
async function transcribeWithWhisper(audioPath, retryCount = 0) {
  const MAX_RETRIES = 3;
  try {
    console.log(`🔵 Attempting: OpenAI Whisper API... (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    const stats = fs.statSync(audioPath);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(` Audio file: ${path.basename(audioPath)} (${fileSizeMB}MB)`);

    if (stats.size > 25 * 1024 * 1024) {
      throw new Error(`Audio file is too large (${fileSizeMB}MB). OpenAI Whisper limit is 25MB.`);
    }

    const audioStream = fs.createReadStream(audioPath);
    
    // Auto-detect language by not specifying the language parameter
    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-1'
      // Language will be auto-detected
    });

    if (transcription.text && transcription.text.length > 0) {
      console.log('✅ OpenAI Whisper transcription completed (language auto-detected)!');
      console.log('Transcribed text length:', transcription.text.length);
      return {
        text: transcription.text,
        method: 'openai'
      };
    } else {
      throw new Error('Transcription returned empty text');
    }
  } catch (openaiError) {
    const errorMsg = openaiError.message || openaiError.toString();
    console.error(`❌ OpenAI Whisper failed: ${errorMsg}`);

    const isRetryableError = errorMsg.includes('Connection') || 
                            errorMsg.includes('ECONNREFUSED') || 
                            errorMsg.includes('ETIMEDOUT') || 
                            errorMsg.includes('timeout') || 
                            errorMsg.includes('network') || 
                            (openaiError.status >= 500 && openaiError.status < 600);

    if (isRetryableError && retryCount < MAX_RETRIES) {
      const delayMs = Math.pow(2, retryCount) * 2000;
      console.log(`⏳ Waiting ${delayMs / 1000}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return transcribeWithWhisper(audioPath, retryCount + 1);
    }

    let errorMessage = 'Transcription failed';
    if (errorMsg.includes('Connection') || errorMsg.includes('ECONNREFUSED')) {
      errorMessage = 'Failed to connect to OpenAI API. Please check your internet connection and API key.';
    } else if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
      errorMessage = 'OpenAI API key is invalid or expired. Please check your OPENAI_API_KEY.';
    } else if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
      errorMessage = 'OpenAI API rate limit exceeded. Please try again in a few moments.';
    } else if (errorMsg.includes('too large')) {
      errorMessage = errorMsg;
    } else {
      errorMessage = `Transcription failed: ${errorMsg}`;
    }

    throw new Error(errorMessage);
  }
}

// Translate text using Groq
async function translateWithGroq(text, targetLanguage) {
  console.log('🌐 Starting translation...');
  console.log('🤖 Using Model: Groq Llama-3.3-70b-versatile');
  console.log('🎯 Target Language:', targetLanguage);
  console.log('⚙️ Translation Config: temperature=0.3, max_tokens=32768');

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: `Translate this text to ${targetLanguage}. Only output the translation, nothing else:\n\n${text}`
      }
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.3,
    max_tokens: 32768,
  });

  const translatedText = completion.choices[0].message.content;
  console.log('✅ Translation completed using Groq Llama-3.3-70b-versatile!');
  console.log('📄 Translation length:', translatedText.length, 'characters');
  
  return translatedText;
}

// Clean up temporary files and directories
function cleanupTempFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        fs.unlinkSync(filePath);
        console.log('Cleaned up temp file:', filePath);
      } else if (stats.isDirectory()) {
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
  try {
    if (!res.writableEnded && !res.destroyed) {
      res.write(`data: ${JSON.stringify({ progress, message })}\n\n`);
    }
  } catch (error) {
    console.error('Failed to send progress:', error.message);
  }
}

// FLOW 1: Transcribe only endpoint (returns original language)
app.post('/api/transcribe', async (req, res) => {
  let audioPath = null;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { videoUrl } = req.body;
    console.log('📝 TRANSCRIBE REQUEST:', { videoUrl });

    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      sendProgress(res, 0, 'Invalid YouTube URL');
      res.write(`data: ${JSON.stringify({ error: 'Invalid YouTube URL' })}\n\n`);
      res.end();
      return;
    }

    sendProgress(res, 10, 'Initializing YouTube client...');
    const youtube = await Innertube.create();

    sendProgress(res, 20, 'Fetching video information...');
    const info = await youtube.getInfo(videoId);

    let transcriptText = null;
    let transcriptionMethod = 'captions';

    // Try to get captions first
    console.log('📝 Checking for video captions...');
    sendProgress(res, 30, 'Checking for captions...');

    try {
      const transcriptData = await info.getTranscript();
      if (transcriptData && transcriptData.transcript) {
        const transcript = transcriptData.transcript.content.body.initial_segments;
        if (transcript && transcript.length > 0) {
          console.log('✅ Video HAS captions available');
          sendProgress(res, 50, 'Extracting captions...');

          transcriptText = transcript
            .map(segment => segment.snippet.text)
            .join(' ')
            .trim();

          sendProgress(res, 80, 'Captions extracted successfully');
        }
      }
    } catch (captionError) {
      console.log('❌ No captions found, will transcribe audio');
    }

    // If no captions, transcribe with Whisper
    if (!transcriptText || transcriptText.length === 0) {
      console.log('🎤 Starting transcription with OpenAI Whisper (auto-detect language)...');
      
      sendProgress(res, 40, 'Downloading audio...');
      audioPath = await downloadAudio(videoUrl);

      if (!audioPath) {
        throw new Error('Could not download audio from YouTube');
      }

      sendProgress(res, 60, 'Transcribing audio (auto-detecting language)...');
      const whisperResult = await transcribeWithWhisper(audioPath);
      transcriptText = whisperResult.text;
      transcriptionMethod = 'openai-whisper';

      sendProgress(res, 80, 'Transcription completed');
    }

    // Calculate stats
    const wordCount = transcriptText.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);

    sendProgress(res, 100, 'Complete!');

    console.log('='.repeat(80));
    console.log('📊 TRANSCRIPTION SUMMARY:');
    console.log('='.repeat(80));
    console.log('🎥 Video ID:', videoId);
    console.log('📝 Method:', transcriptionMethod);
    console.log('📄 Word Count:', wordCount);
    console.log('⏱️ Reading Time:', readingTime, 'minutes');
    console.log('='.repeat(80));

    res.write(`data: ${JSON.stringify({
      success: true,
      transcript: transcriptText,
      wordCount,
      readingTime,
      videoId,
      transcriptionMethod,
      languageNote: 'Transcribed in original video language'
    })}\n\n`);
    res.end();

  } catch (error) {
    console.error('❌ Transcription error:', error.message);
    
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        error: error.message || 'Failed to transcribe video',
        hint: 'Check server logs for more details'
      })}\n\n`);
      res.end();
    }
  } finally {
    if (audioPath) {
      const audioDir = path.dirname(audioPath);
      cleanupTempFile(audioDir);
    }
  }
});

// FLOW 2: Transcribe and Translate endpoint
app.post('/api/translate', async (req, res) => {
  let audioPath = null;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { videoUrl, targetLanguage } = req.body;
    console.log('🌐 TRANSLATE REQUEST:', { videoUrl, targetLanguage });

    if (!targetLanguage) {
      throw new Error('Target language is required for translation');
    }

    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      sendProgress(res, 0, 'Invalid YouTube URL');
      res.write(`data: ${JSON.stringify({ error: 'Invalid YouTube URL' })}\n\n`);
      res.end();
      return;
    }

    sendProgress(res, 5, 'Initializing YouTube client...');
    const youtube = await Innertube.create();

    sendProgress(res, 10, 'Fetching video information...');
    const info = await youtube.getInfo(videoId);

    let originalText = null;
    let transcriptionMethod = 'captions';

    // Try to get captions first
    console.log('📝 Checking for video captions...');
    sendProgress(res, 15, 'Checking for captions...');

    try {
      const transcriptData = await info.getTranscript();
      if (transcriptData && transcriptData.transcript) {
        const transcript = transcriptData.transcript.content.body.initial_segments;
        if (transcript && transcript.length > 0) {
          console.log('✅ Video HAS captions available');
          sendProgress(res, 30, 'Extracting captions...');

          originalText = transcript
            .map(segment => segment.snippet.text)
            .join(' ')
            .trim();

          sendProgress(res, 40, 'Captions extracted successfully');
        }
      }
    } catch (captionError) {
      console.log('❌ No captions found, will transcribe audio');
    }

    // If no captions, transcribe with Whisper
    if (!originalText || originalText.length === 0) {
      console.log('🎤 Starting transcription with OpenAI Whisper (auto-detect language)...');
      
      sendProgress(res, 35, 'Downloading audio...');
      audioPath = await downloadAudio(videoUrl);

      if (!audioPath) {
        throw new Error('Could not download audio from YouTube');
      }

      sendProgress(res, 50, 'Transcribing audio (auto-detecting language)...');
      const whisperResult = await transcribeWithWhisper(audioPath);
      originalText = whisperResult.text;
      transcriptionMethod = 'openai-whisper';

      sendProgress(res, 65, 'Transcription completed');
    }

    // Translate the text
    sendProgress(res, 70, `Translating to ${targetLanguage}...`);
    const translatedText = await translateWithGroq(originalText, targetLanguage);

    // Calculate stats
    const wordCount = translatedText.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);

    sendProgress(res, 100, 'Complete!');

    console.log('='.repeat(80));
    console.log('📊 TRANSLATION SUMMARY:');
    console.log('='.repeat(80));
    console.log('🎥 Video ID:', videoId);
    console.log('📝 Transcription Method:', transcriptionMethod);
    console.log('🌐 Translation Target:', targetLanguage);
    console.log('📄 Word Count:', wordCount);
    console.log('⏱️ Reading Time:', readingTime, 'minutes');
    console.log('='.repeat(80));

    res.write(`data: ${JSON.stringify({
      success: true,
      original: originalText,
      translated: translatedText,
      wordCount,
      readingTime,
      videoId,
      transcriptionMethod,
      targetLanguage
    })}\n\n`);
    res.end();

  } catch (error) {
    console.error('❌ Translation error:', error.message);
    
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        error: error.message || 'Failed to translate video',
        hint: 'Check server logs for more details'
      })}\n\n`);
      res.end();
    }
  } finally {
    if (audioPath) {
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
  res.json({
    message: 'YouTube Transcript Backend',
    status: 'running',
    endpoints: {
      transcribe: 'POST /api/transcribe - Get transcript in original language',
      translate: 'POST /api/translate - Get transcript translated to target language'
    }
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('Available endpoints:');
  console.log('  - POST /api/transcribe (transcribe only)');
  console.log('  - POST /api/translate (transcribe + translate)');
});