const express = require('express');
const cors = require('cors');
const { Innertube } = require('youtubei.js');
const Groq = require('groq-sdk').default;
const OpenAI = require('openai');
const YtDlp = require('yt-dlp-exec');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { createWriteStream } = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Gemini configuration (PRIMARY for transcription)
const geminiClient = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// OpenAI configuration (SECONDARY for Whisper)
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Whisper API configuration (FALLBACK - from whisper-api.com)
const WHISPER_API_KEY = process.env.WHISPER_API_KEY;
const WHISPER_API_URL = 'https://api.whisperapi.com/transcribe';

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

// Download video audio (no MP3 conversion needed - Whisper accepts multiple formats)
async function downloadAudio(videoId) {
  try {
    const audioDir = path.join(tempDir, videoId);
    
    // Create directory for this video's audio
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    
    console.log('Starting audio download...');
    
    // Download best audio-only format (no MP3 conversion needed)
    await YtDlp.exec(`https://www.youtube.com/watch?v=${videoId}`, {
      format: 'bestaudio',
      output: path.join(audioDir, '%(title)s.%(ext)s'),
      quiet: false,
      noWarnings: true
    });
    
    // Find the downloaded file
    const files = fs.readdirSync(audioDir);
    const audioFile = files.find(f => !f.startsWith('.'));
    
    if (!audioFile) {
      throw new Error('No audio file found after download');
    }
    
    const audioPath = path.join(audioDir, audioFile);
    console.log('Audio downloaded successfully to:', audioPath);
    return audioPath;
  } catch (error) {
    console.error('Error downloading audio:', error.message);
    throw new Error(`Failed to download audio: ${error.message}`);
  }
}

// Transcribe audio using Gemini, OpenAI Whisper, or Whisper API (in priority order)
async function transcribeWithWhisper(audioPath) {
  let transcriptionMethod = null;
  
  // PRIORITY 1: Try Google Gemini
  if (geminiClient) {
    try {
      console.log('🟢 Attempting PRIMARY: Google Gemini API...');
      
      // Read the audio file and convert to base64
      const audioBuffer = fs.readFileSync(audioPath);
      const base64Audio = audioBuffer.toString('base64');
      
      // Determine MIME type based on file extension
      const ext = path.extname(audioPath).toLowerCase();
      let mimeType = 'audio/webm'; // default
      if (ext === '.mp3') mimeType = 'audio/mpeg';
      else if (ext === '.wav') mimeType = 'audio/wav';
      else if (ext === '.m4a') mimeType = 'audio/mp4';
      else if (ext === '.ogg') mimeType = 'audio/ogg';
      else if (ext === '.flac') mimeType = 'audio/flac';
      
      console.log(`Audio MIME type: ${mimeType}`);
      
      // Try gemini-2.0-flash first, fallback to gemini-1.5-flash
      let model;
      try {
        model = geminiClient.getGenerativeModel({ model: 'gemini-2.0-flash' });
        console.log('Using gemini-2.0-flash model');
      } catch (err) {
        console.log('gemini-2.0-flash not available, trying gemini-1.5-flash');
        model = geminiClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
      }
      
      const response = await model.generateContent([
        {
          inlineData: {
            data: base64Audio,
            mimeType: mimeType
          }
        },
        {
          text: 'Transcribe all the speech in this audio file. Return only the transcribed text, nothing else.'
        }
      ]);
      
      const transcribedText = response.response.text();
      
      if (transcribedText && transcribedText.length > 0) {
        console.log('✅ Gemini transcription completed!');
        console.log('Transcribed text length:', transcribedText.length);
        return { text: transcribedText, method: 'gemini' };
      }
    } catch (geminiError) {
      console.warn('⚠️ Gemini API failed:', geminiError.message);
      console.log('Falling back to OpenAI Whisper...');
    }
  } else {
    console.log('⚠️ GEMINI_API_KEY not set. Skipping Gemini, trying OpenAI Whisper...');
  }
  
  // PRIORITY 2: Try OpenAI Whisper API
  if (openai) {
    try {
      console.log('🔵 Attempting SECONDARY: OpenAI Whisper API...');
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
      console.warn('⚠️ OpenAI Whisper failed:', openaiError.message);
      console.log('Falling back to Whisper API...');
    }
  } else {
    console.log('⚠️ OPENAI_API_KEY not set. Skipping OpenAI, trying Whisper API...');
  }
  
  // PRIORITY 3: Fallback to Whisper API (whisper-api.com)
  if (WHISPER_API_KEY) {
    try {
      console.log('🟠 Attempting FALLBACK: Whisper API (whisper-api.com)...');
      
      // Read the audio file
      const audioStream = fs.createReadStream(audioPath);
      const fileName = path.basename(audioPath);
      
      // Create FormData for multipart request
      const form = new FormData();
      form.append('file', audioStream, fileName);
      form.append('language', 'en');
      
      // Send to Whisper API using axios
      const response = await axios.post(WHISPER_API_URL, form, {
        headers: {
          'Authorization': `Bearer ${WHISPER_API_KEY}`,
          ...form.getHeaders()
        },
        timeout: 120000 // 2 minute timeout for large files
      });
      
      if (response.data.text && response.data.text.length > 0) {
        console.log('✅ Whisper API transcription completed!');
        console.log('Transcribed text length:', response.data.text.length);
        return { text: response.data.text, method: 'whisper-api' };
      } else {
        throw new Error('No transcription text received from Whisper API');
      }
    } catch (whisperError) {
      console.error('❌ Whisper API also failed:', whisperError.message);
      if (whisperError.response) {
        console.error('Whisper API Response:', whisperError.response.status, whisperError.response.data);
      }
      throw new Error(`All transcription methods failed. Gemini: ${geminiClient ? 'tried' : 'not configured'}, OpenAI: ${openai ? 'tried' : 'not configured'}, Whisper API: ${WHISPER_API_KEY ? 'failed' : 'not configured'}`);
    }
  } else {
    throw new Error('No transcription API keys configured. Set GEMINI_API_KEY, OPENAI_API_KEY, or WHISPER_API_KEY in .env');
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
    
    // If no captions, use Gemini, OpenAI Whisper, or Whisper API (in priority order)
    if (!originalText || originalText.length === 0) {
      console.log('No captions found. Attempting Gemini/Whisper transcription...');
      
      // Download audio
      audioPath = await downloadAudio(videoId);
      
      // Transcribe with Gemini, OpenAI Whisper, or Whisper API (tries Gemini first, then falls back)
      const whisperResult = await transcribeWithWhisper(audioPath);
      originalText = whisperResult.text;
      transcriptionMethod = whisperResult.method; // 'gemini', 'openai', or 'whisper-api'
      
      if (!originalText || originalText.length === 0) {
        return res.status(400).json({ 
          error: 'Could not extract text from transcription services.' 
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
