// At the top of your main server file (e.g., index.js, server.js)
const { execSync } = require('child_process');
const path = require('path');

// Auto-update yt-dlp on server start
const ytdlpPath = path.join(__dirname, 'node_modules/yt-dlp-exec/bin/yt-dlp');

console.log('Checking yt-dlp version...');
try {
  execSync(`${ytdlpPath} -U`, { 
    stdio: 'inherit',
    timeout: 60000 
  });
  console.log('✓ yt-dlp updated successfully');
} catch (error) {
  console.warn('⚠ Could not update yt-dlp:', error.message);
}

const express = require('express');
const cors = require('cors');
const { Innertube } = require('youtubei.js');
const Groq = require('groq-sdk').default;
const OpenAI = require('openai');
const YtDlp = require('yt-dlp-exec');
const fs = require('fs');
const { createWriteStream } = require('fs');
require('dotenv').config();

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

// Download video audio with retry logic and anti-bot measures
async function downloadAudio(videoId, retryCount = 0) {
  const MAX_RETRIES = 3;
  
  try {
    const audioDir = path.join(tempDir, videoId);
    
    // Create directory for this video's audio
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    
    console.log(`Starting audio download (attempt ${retryCount + 1}/${MAX_RETRIES + 1})...`);
    
    // Options to bypass YouTube bot detection
    const dlpOptions = {
      format: 'bestaudio',
      output: path.join(audioDir, '%(title)s.%(ext)s'),
      quiet: false,
      noWarnings: true,
      // Add headers to look like a browser request
      addHeader: [
        'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language:en-US,en;q=0.9',
        'Accept-Encoding:gzip, deflate, br'
      ],
      // Disable QUIC to improve compatibility
      httpChunkSize: '1M',
      // Add socket timeout
      socketTimeout: '30'
    };
    
    // Add cookies if available from environment
    if (process.env.YOUTUBE_COOKIES) {
      dlpOptions.cookies = process.env.YOUTUBE_COOKIES;
      console.log('Using stored YouTube cookies...');
    }
    
    // Try to download
    await YtDlp.exec(`https://www.youtube.com/watch?v=${videoId}`, dlpOptions);
    
    // Find the downloaded file
    const files = fs.readdirSync(audioDir);
    const audioFile = files.find(f => !f.startsWith('.'));
    
    if (!audioFile) {
      throw new Error('No audio file found after download');
    }
    
    const audioPath = path.join(audioDir, audioFile);
    console.log('✅ Audio downloaded successfully to:', audioPath);
    return audioPath;
  } catch (error) {
    const errorMsg = error.message || error;
    console.error(`❌ Download attempt ${retryCount + 1} failed:`, errorMsg);
    
    // Check if it's a bot detection error
    const isBotError = errorMsg.includes('Sign in to confirm') || 
                       errorMsg.includes('bot') ||
                       errorMsg.includes('429') ||
                       errorMsg.includes('403');
    
    // Retry with delay if it's a bot detection error and we haven't exceeded max retries
    if (isBotError && retryCount < MAX_RETRIES) {
      const delayMs = Math.pow(2, retryCount) * 5000; // Exponential backoff: 5s, 10s, 20s
      console.log(`⏳ Waiting ${delayMs / 1000}s before retry...`);
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return downloadAudio(videoId, retryCount + 1);
    }
    
    // Provide helpful error message
    if (isBotError) {
      throw new Error('YouTube is blocking downloads from this server. This is a YouTube rate-limiting issue. Please try again later or use a video with available captions.');
    }
    
    throw new Error(`Failed to download audio: ${errorMsg}`);
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

// Get transcript endpoint
app.post('/api/transcript', async (req, res) => {
  let audioPath = null;
  try {
    const { videoUrl, targetLanguage } = req.body;
    
    console.log('Received request:', { videoUrl, targetLanguage });
    
    // Extract video ID
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    console.log('Extracted video ID:', videoId);

    // Initialize YouTube client
    console.log('Initializing YouTube client...');
    const youtube = await Innertube.create();

    // Fetch video info and transcript
    console.log('Fetching video info...');
    const info = await youtube.getInfo(videoId);
    
    let originalText = null;
    let transcriptionMethod = 'captions';
    
    // Try to get captions first
    console.log('Fetching transcript...');
    try {
      const transcriptData = await info.getTranscript();
      
      if (transcriptData && transcriptData.transcript) {
        // Extract text from transcript segments
        const transcript = transcriptData.transcript.content.body.initial_segments;
        
        if (transcript && transcript.length > 0) {
          console.log('Number of transcript segments:', transcript.length);
          
          // Combine all transcript text
          originalText = transcript
            .map(segment => segment.snippet.text)
            .join(' ')
            .trim();
        }
      }
    } catch (captionError) {
      console.log('Could not fetch captions, will use Whisper API...');
    }
    
    // If no captions, use OpenAI Whisper
    if (!originalText || originalText.length === 0) {
      console.log('No captions found. Attempting Whisper transcription...');
      
      try {
        // Try to download audio
        audioPath = await downloadAudio(videoId);
        
        // Transcribe with OpenAI Whisper
        const whisperResult = await transcribeWithWhisper(audioPath);
        originalText = whisperResult.text;
        transcriptionMethod = whisperResult.method; // 'openai'
        
        if (!originalText || originalText.length === 0) {
          return res.status(400).json({ 
            error: 'Could not extract text from transcription services.' 
          });
        }
      } catch (downloadError) {
        console.error('Audio download failed:', downloadError.message);
        
        // If audio download fails, provide helpful error to user
        return res.status(400).json({
          error: downloadError.message || 'Could not download audio from YouTube. Please try a video with available captions, or try again in a few moments.',
          hint: 'YouTube may be blocking downloads. Videos with captions work best without audio download.'
        });
      }
    }

    console.log('Original text length:', originalText.length);
    console.log('First 200 chars:', originalText.substring(0, 200));

    // Translate with GROQ
    console.log('Translating to:', targetLanguage);
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `Translate this text to ${targetLanguage}. Only output the translation, nothing else:\n\n${originalText}`
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 8000,
    });

    const translatedText = completion.choices[0].message.content;
    
    console.log('✅ Translation completed!');
    console.log('Translation length:', translatedText.length);
    
    // Calculate stats
    const wordCount = translatedText.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);

    res.json({
      success: true,
      original: originalText,
      translated: translatedText,
      wordCount,
      readingTime,
      videoId,
      transcriptionMethod
    });

  } catch (error) {
    console.error('❌ Server error:', error.message);
    res.status(500).json({ 
      error: error.message || 'Failed to process video'
    });
  } finally {
    // Clean up temporary audio directory (contains downloaded audio files)
    if (audioPath) {
      // Get the parent directory (videoId folder)
      const audioDir = path.dirname(audioPath);
      cleanupTempFile(audioDir);
    }
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
