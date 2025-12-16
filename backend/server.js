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
import Stripe from 'stripe';
import { getUserFriendlyError, formatErrorResponse, logError } from './services/errorHandler.js';
import { generateSummary } from './services/aiSummaryService.js';
import { detectCountryFromIP, buildProxyURL, getProxyDetails, getUserIP, logProxyUsage } from './services/proxyService.js';

dotenv.config();

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);
const app = express();
app.use(cors());

// Stripe configuration - use dummy key if not provided
const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy_key_for_development_only_replace_with_real_key';
const stripe = new Stripe(stripeKey, {
  apiVersion: '2024-12-18.acacia',
});

// Warn if using dummy key
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('⚠️  WARNING: Using dummy Stripe key. Set STRIPE_SECRET_KEY in .env for real payments.');
}

// In-memory store for paid sessions (in production, use a database)
const paidSessions = new Map();

// Stripe webhook - MUST come before express.json() to get raw body
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (webhookSecret) {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // For development without webhook secret
      event = JSON.parse(req.body.toString());
      console.warn('⚠️  Webhook signature verification skipped (no STRIPE_WEBHOOK_SECRET)');
    }

    console.log('📥 Webhook received:', event.type);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('✅ Checkout session completed:', session.id);
        console.log('   Customer:', session.customer);
        console.log('   Subscription:', session.subscription);
        console.log('   Client Reference ID:', session.client_reference_id);
        
        // Update session status in our store
        if (session.client_reference_id && paidSessions.has(session.client_reference_id)) {
          const sessionData = paidSessions.get(session.client_reference_id);
          sessionData.status = 'completed';
          sessionData.stripeCustomerId = session.customer;
          sessionData.stripeSubscriptionId = session.subscription;
          paidSessions.set(session.client_reference_id, sessionData);
          console.log('✅ Updated session status to completed');
        }
        break;

      case 'customer.subscription.created':
        const subscription = event.data.object;
        console.log('✅ Subscription created:', subscription.id);
        console.log('   Customer:', subscription.customer);
        console.log('   Status:', subscription.status);
        console.log('   Trial end:', subscription.trial_end ? new Date(subscription.trial_end * 1000) : 'No trial');
        break;

      case 'customer.subscription.trial_will_end':
        const trialEndingSub = event.data.object;
        console.log('⏰ Trial ending soon for subscription:', trialEndingSub.id);
        console.log('   Trial ends:', new Date(trialEndingSub.trial_end * 1000));
        break;

      case 'customer.subscription.updated':
        const updatedSub = event.data.object;
        console.log('🔄 Subscription updated:', updatedSub.id);
        console.log('   Status:', updatedSub.status);
        break;

      case 'customer.subscription.deleted':
        const deletedSub = event.data.object;
        console.log('❌ Subscription canceled:', deletedSub.id);
        break;

      case 'invoice.payment_succeeded':
        const invoice = event.data.object;
        console.log('💰 Payment succeeded for invoice:', invoice.id);
        console.log('   Customer:', invoice.customer);
        console.log('   Subscription:', invoice.subscription);
        break;

      case 'invoice.payment_failed':
        const failedInvoice = event.data.object;
        console.log('❌ Payment failed for invoice:', failedInvoice.id);
        console.log('   Customer:', failedInvoice.customer);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook error:', error.message);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

// Apply JSON parsing AFTER webhook endpoint
app.use(express.json());

// Pricing plans configuration
const PRICING_PLANS = {
  free: {
    id: 'free',
    name: 'Free Plan',
    price: 0, // Free
    description: 'Basic transcript and translation - Limited features',
    trialDays: 0
  },
  basic: {
    id: 'basic',
    name: 'Basic Plan',
    price: 500, // $5.00 in cents
    description: 'Standard transcript and translation - Full features',
    stripePriceId: process.env.STRIPE_PRICE_ID_BASIC || 'price_basic_placeholder', // Replace with your Stripe Price ID
    trialDays: 7
  },
  premium: {
    id: 'premium',
    name: 'Premium Plan',
    price: 1000, // $10.00 in cents
    description: 'Enhanced transcript and translation with priority processing',
    stripePriceId: process.env.STRIPE_PRICE_ID_PREMIUM || 'price_premium_placeholder', // Replace with your Stripe Price ID
    trialDays: 10
  }
};

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

// Download video audio using yt-dlp with proxy support
async function downloadAudio(url, retryCount = 0, proxyURL = null) {
  const MAX_RETRIES = 3;
  try {
    console.log(` 📥 Downloading: ${url} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
    if (proxyURL) {
      // Don't log the full proxy URL with password
      const sanitizedProxy = proxyURL.replace(/:[^:@]+@/, ':***@');
      console.log(` 🌐 Using proxy: ${sanitizedProxy}`);
    }

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

    // Set proxy - use both environment variables and --proxy flag for maximum compatibility
    const env = { ...process.env };
    if (proxyURL) {
      // Set environment variables (works for most tools)
      env.HTTP_PROXY = proxyURL;
      env.HTTPS_PROXY = proxyURL;
      env.http_proxy = proxyURL;
      env.https_proxy = proxyURL;
    }

    // Build yt-dlp command with proxy only (no extractor args or geo-bypass)
    const cmdParts = [
      `${ytDlpCmd}`,
      '-f bestaudio',
      '--no-playlist',
      proxyURL ? `--proxy ${proxyURL}` : '', // Use proxy for country-based routing
      `-o "${outputTemplate}"`,
      `"${url}"`,
      '2>&1'
    ].filter(Boolean);

    const cmd = cmdParts.join(' ');
    let stdout = '';
    let stderr = '';

    try {
      const result = await execAsync(cmd, {
        maxBuffer: 50 * 1024 * 1024,
        timeout: 1200000,
        env: env
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
    
    // Check for proxy 403 errors - fallback to no proxy
    const isProxy403Error = proxyURL && (
      combinedOutput.includes('403 forbidden') || 
      combinedOutput.includes('tunnel connection failed: 403') ||
      combinedOutput.includes('403') && combinedOutput.includes('proxy')
    );
    
    if (isProxy403Error && retryCount === 0) {
      console.log('⚠️  Proxy returned 403 Forbidden, retrying without proxy...');
      return downloadAudio(url, retryCount + 1, null); // Retry without proxy
    }
    
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
      return downloadAudio(url, retryCount + 1, proxyURL);
    }

    throw new Error('No audio file was downloaded. The video might be age-restricted, private, or unavailable.');
  } catch (error) {
    const errorMsg = error.message || error.toString();
    console.error(` ✗ Download failed: ${errorMsg}`);

    // If proxy failed and we haven't tried without proxy yet, retry without proxy
    if (proxyURL && retryCount === 0 && (errorMsg.includes('403') || errorMsg.includes('Forbidden'))) {
      console.log('⚠️  Proxy authentication failed, retrying without proxy...');
      return downloadAudio(url, retryCount + 1, null);
    }

    const isBotError = errorMsg.includes('Sign in to confirm') || errorMsg.includes('bot') || 
                       errorMsg.includes('429') || errorMsg.includes('rate limit');

    if (isBotError && retryCount < MAX_RETRIES) {
      const delayMs = Math.pow(2, retryCount) * 5000;
      console.log(`⏳ Waiting ${delayMs / 1000}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return downloadAudio(url, retryCount + 1, proxyURL);
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

// Translate text using OpenAI (fallback)
async function translateWithOpenAI(text, targetLanguage) {
  console.log('🌐 Fallback to OpenAI for translation...');
  console.log('🤖 Using Model: OpenAI GPT-4o-mini');
  console.log('🎯 Target Language:', targetLanguage);
  console.log('⚙️ Translation Config: temperature=0.33, max_tokens=16384');

  const translationPrompt = `You are a professional translator. Translate the following text to ${targetLanguage}. 

Requirements:
- Maintain the original meaning and tone
- Preserve any formatting, punctuation, and structure
- If the text is already in ${targetLanguage}, return it as-is
- Only output the translated text, no explanations or additional text
- Ensure natural, fluent translation in ${targetLanguage}

Text to translate:
${text}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: translationPrompt
        }
      ],
      temperature: 0.33,
      max_tokens: 16384,
    });

    const translatedText = completion.choices[0].message.content.trim();
    console.log('✅ Translation completed using OpenAI GPT-4o-mini!');
    console.log('📄 Translation length:', translatedText.length, 'characters');
    
    return translatedText;
  } catch (openaiError) {
    console.error('❌ OpenAI translation failed:', openaiError.message);
    throw new Error(`Both Groq and OpenAI translation failed: ${openaiError.message}`);
  }
}

// Translate text using Groq with OpenAI fallback
async function translateWithGroq(text, targetLanguage) {
  console.log('🌐 Starting translation...');
  console.log('🤖 Using Model: Groq Llama-3.3-70b-versatile');
  console.log('🎯 Target Language:', targetLanguage);
  console.log('⚙️ Translation Config: temperature=0.33, max_tokens=32768');

  // Enhanced translation prompt for better accuracy with all languages
  const translationPrompt = `You are a professional translator. Translate the following text to ${targetLanguage}. 

Requirements:
- Maintain the original meaning and tone
- Preserve any formatting, punctuation, and structure
- If the text is already in ${targetLanguage}, return it as-is
- Only output the translated text, no explanations or additional text
- Ensure natural, fluent translation in ${targetLanguage}

Text to translate:
${text}`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: translationPrompt
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.33,
      max_tokens: 32768,
    });

    const translatedText = completion.choices[0].message.content.trim();
    console.log('✅ Translation completed using Groq Llama-3.3-70b-versatile!');
    console.log('📄 Translation length:', translatedText.length, 'characters');
    
    return translatedText;
  } catch (groqError) {
    // Groq SDK errors can come in different formats
    // Extract error information from various possible structures
    let errorMessage = groqError.message || groqError.toString();
    let errorObj = groqError.error;
    let statusCode = groqError.statusCode || groqError.status;
    let errorCode = null;
    
    // Check if error message contains "429 {...}" format
    if (typeof errorMessage === 'string' && /^\d+\s*\{/.test(errorMessage.trim())) {
      const jsonMatch = errorMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.error) {
            errorObj = parsed.error;
            errorMessage = parsed.error.message || errorMessage;
            errorCode = parsed.error.code;
            statusCode = statusCode || 429;
          }
        } catch (e) {
          // Keep original message
        }
      }
    }
    
    // Extract error code from nested structure
    if (!errorCode && errorObj) {
      errorCode = errorObj.code || (errorObj.error && errorObj.error.code);
    }
    
    // Check if it's a rate limit error (multiple conditions for reliability)
    const isRateLimitError = statusCode === 429 || 
                             errorMessage.toLowerCase().includes('rate limit') ||
                             errorCode === 'rate_limit_exceeded' ||
                             (errorObj && (errorObj.code === 'rate_limit_exceeded' || 
                              (errorObj.error && errorObj.error.code === 'rate_limit_exceeded')));
    
    if (isRateLimitError) {
      console.log('⚠️ Groq rate limit reached, falling back to OpenAI...');
      try {
        return await translateWithOpenAI(text, targetLanguage);
      } catch (fallbackError) {
        console.error('❌ OpenAI fallback also failed:', fallbackError.message);
        // Re-throw original Groq error with fallback info
        const enhancedError = new Error(`${errorMessage} (OpenAI fallback also failed)`);
        enhancedError.statusCode = statusCode;
        enhancedError.status = statusCode;
        enhancedError.error = errorObj;
        throw enhancedError;
      }
    }
    
    // Re-throw with better error structure for non-rate-limit errors
    const enhancedError = new Error(errorMessage);
    enhancedError.statusCode = statusCode;
    enhancedError.status = statusCode;
    enhancedError.error = errorObj || groqError.error || groqError.response?.data || groqError.body;
    enhancedError.response = groqError.response;
    enhancedError.originalError = groqError;
    throw enhancedError;
  }
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
  res.write(`data: ${JSON.stringify({ progress, message })}\n\n`);
}

// Get transcript endpoint with SSE progress updates
app.post('/api/transcript', async (req, res) => {
  let audioPath = null;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { videoUrl, targetLanguage } = req.body;
    
    console.log('Received request:', { videoUrl, targetLanguage });
    
    // ============================================================
    // PROXY ROUTING FLOW:
    // 1. Extract user's IP from request headers
    // 2. Detect user's country from IP (using GeoIP)
    // 3. Build country-specific proxy URL (e.g., ...country-in or ...country-pk)
    // 4. Use proxy for all YouTube requests (yt-dlp download)
    // ============================================================
    const userIP = getUserIP(req);
    const userCountry = detectCountryFromIP(userIP);
    const proxyURL = buildProxyURL(userCountry);
    const proxyDetails = getProxyDetails(userCountry);
    
    // Log proxy usage details (only if proxy is enabled)
    if (proxyURL) {
      logProxyUsage(proxyDetails, videoUrl);
      console.log(`✅ Request will use ${proxyDetails.country} proxy for YouTube access`);
    } else {
      console.log('⚠️  Proxy is disabled, downloading without proxy');
    }
    
    // Extract video ID
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
      
      sendProgress(res, 35, proxyURL ? 'Downloading audio via proxy...' : 'Downloading audio...');
      audioPath = await downloadAudio(videoUrl, 0, proxyURL); // Pass proxy URL (can be null if disabled)

      if (!audioPath) {
        throw new Error('Could not download audio from YouTube');
      }

      sendProgress(res, 50, 'Transcribing audio (auto-detecting language)...');
      const whisperResult = await transcribeWithWhisper(audioPath);
      originalText = whisperResult.text;
      transcriptionMethod = 'openai-whisper';

      sendProgress(res, 65, 'Transcription completed');
    }

    // If targetLanguage is provided, translate; otherwise just return transcript
    let finalText = originalText;
    let translatedText = null;
    
    if (targetLanguage) {
      sendProgress(res, 70, `Translating to ${targetLanguage}...`);
      translatedText = await translateWithGroq(originalText, targetLanguage);
      finalText = translatedText;
    } else {
      sendProgress(res, 70, 'Finalizing transcript...');
    }

    // Calculate stats
    const wordCount = finalText.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);

    sendProgress(res, 100, 'Complete!');

    console.log('='.repeat(80));
    console.log(targetLanguage ? '📊 TRANSLATION SUMMARY:' : '📊 TRANSCRIPTION SUMMARY:');
    console.log('='.repeat(80));
    console.log('🎥 Video ID:', videoId);
    console.log('📝 Transcription Method:', transcriptionMethod);
    if (proxyURL) {
      console.log('🌍 User Country:', proxyDetails.country);
      console.log('🌐 Proxy Used:', proxyDetails.host + ':' + proxyDetails.port);
    } else {
      console.log('🌐 Proxy: Disabled');
    }
    if (targetLanguage) {
      console.log('🌐 Translation Target:', targetLanguage);
    }
    console.log('📄 Word Count:', wordCount);
    console.log('⏱️ Reading Time:', readingTime, 'minutes');
    console.log('='.repeat(80));

    const responseData = {
      success: true,
      wordCount,
      readingTime,
      videoId,
      transcriptionMethod
    };

    if (targetLanguage) {
      // Translation mode - return both original and translated
      responseData.original = originalText;
      responseData.translated = translatedText;
      responseData.targetLanguage = targetLanguage;
    } else {
      // Transcribe mode - return only transcript
      responseData.transcript = originalText;
    }

    res.write(`data: ${JSON.stringify(responseData)}\n\n`);
    res.end();

  } catch (error) {
    logError('transcript', error);
    const errorResponse = formatErrorResponse(error);
    
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
      res.end();
    }
  } finally {
    if (audioPath) {
      const audioDir = path.dirname(audioPath);
      cleanupTempFile(audioDir);
    }
  }
});

// Generate summary endpoint
app.post('/api/summary', async (req, res) => {
  try {
    const { text, summaryLength } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        error: 'No text provided for summarization'
      });
    }

    console.log('Received summary request');
    console.log('Text length:', text.length, 'characters');
    console.log('Summary length:', summaryLength || 'medium');
    
    const summary = await generateSummary(text, summaryLength || 'medium');
    
    // Calculate stats
    const wordCount = summary.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);

    console.log('='.repeat(80));
    console.log('📊 SUMMARY GENERATION SUMMARY:');
    console.log('='.repeat(80));
    console.log('📝 Original Length:', text.length, 'characters');
    console.log('📝 Summary Length:', summary.length, 'characters');
    console.log('📄 Summary Word Count:', wordCount);
    console.log('⏱️ Reading Time:', readingTime, 'minutes');
    console.log('='.repeat(80));

    res.json({
      success: true,
      summary,
      wordCount,
      readingTime,
      originalLength: text.length,
      summaryLength: summary.length,
      compressionRatio: ((1 - summary.length / text.length) * 100).toFixed(1) + '%'
    });

  } catch (error) {
    logError('summary', error);
    const errorResponse = formatErrorResponse(error);
    res.status(500).json(errorResponse);
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

// Test proxy endpoint
app.get('/api/test-proxy', (req, res) => {
  const userIP = getUserIP(req);
  const country = detectCountryFromIP(userIP);
  const proxyURL = buildProxyURL(country);
  const details = getProxyDetails(country);
  
  res.json({
    userIP,
    detectedCountry: country.toUpperCase(),
    proxy: {
      enabled: details.enabled,
      host: details.host,
      port: details.port,
      username: details.username,
      country: details.country,
      url: proxyURL ? proxyURL.replace(/:[^:@]+@/, ':***@') : null // Sanitized
    }
  });
});

// Get pricing plans endpoint
app.get('/api/plans', (req, res) => {
  try {
    // Convert PRICING_PLANS object to array and format for frontend
    const plans = Object.values(PRICING_PLANS).map(plan => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      priceFormatted: plan.price === 0 ? 'Free' : `$${(plan.price / 100).toFixed(2)}`,
      description: plan.description
    }));

    console.log('📋 Returning plans:', plans);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
      plans: plans
    });
  } catch (error) {
    logError('plans', error);
    const errorResponse = formatErrorResponse(error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({
      ...errorResponse,
      error: 'Unable to load pricing plans. Please refresh the page and try again.',
      plans: []
    });
  }
});

// Create Stripe checkout session with subscription
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { videoUrl, targetLanguage, planId } = req.body;
    
    console.log('💳 Creating checkout session for plan:', planId);
    
    const plan = PRICING_PLANS[planId];
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    // Handle free plan
    if (plan.price === 0) {
      const sessionId = `free_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      paidSessions.set(sessionId, {
        planId: 'free',
        videoUrl,
        targetLanguage,
        timestamp: Date.now()
      });
      
      console.log('✅ Free plan session created:', sessionId);
      return res.json({
        isFree: true,
        sessionId: sessionId
      });
    }

    // For paid plans, create Stripe subscription checkout with trial
    const sessionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store session info to retrieve after payment
    paidSessions.set(sessionId, {
      planId,
      videoUrl,
      targetLanguage,
      timestamp: Date.now(),
      status: 'pending'
    });

    // Create Stripe checkout session with subscription mode
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: plan.trialDays,
        metadata: {
          planId: planId,
          videoUrl: videoUrl,
          targetLanguage: targetLanguage || 'none'
        }
      },
      client_reference_id: sessionId,
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/?session_id=${sessionId}&videoUrl=${encodeURIComponent(videoUrl)}&targetLanguage=${encodeURIComponent(targetLanguage || 'en')}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/?canceled=true`,
      metadata: {
        sessionId: sessionId,
        planId: planId
      }
    });
    
    console.log(`💳 Subscription checkout created with ${plan.trialDays} days trial:`, checkoutSession.id);
    
    res.json({
      url: checkoutSession.url,
      sessionId: sessionId,
      trialDays: plan.trialDays
    });

  } catch (error) {
    logError('checkout', error);
    const errorResponse = formatErrorResponse(error);
    
    res.status(500).json(errorResponse);
  }
});

// Serve static files from frontend dist directory
// Try multiple possible paths for flexibility
const possibleFrontendPaths = [
  path.join(__dirname, 'frontend-dist'),  // Deployment path
  path.join(__dirname, '..', 'frontend', 'dist'),  // Development path
  path.join(__dirname, 'dist')  // Alternative deployment path
];

let frontendDistPath = null;
for (const possiblePath of possibleFrontendPaths) {
  if (fs.existsSync(possiblePath)) {
    frontendDistPath = possiblePath;
    break;
  }
}

if (frontendDistPath) {
  console.log(`Serving frontend from: ${frontendDistPath}`);
  // Serve static files first
  app.use(express.static(frontendDistPath));
  
  // Serve index.html for all non-API routes (SPA routing)
  // Use app.use() instead of app.get('*') for Express 5 compatibility
  app.use((req, res, next) => {
    // Skip API routes - let them be handled by API endpoints
    if (req.path.startsWith('/api')) {
      return next();
    }
    // For all other routes, serve index.html (SPA routing)
    const indexPath = path.join(frontendDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
} else {
  console.log('Frontend dist not found. Serving API only.');
  // Fallback if frontend is not built yet
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
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('Available endpoints:');
  console.log('  - POST /api/transcript (transcribe + translate with SSE)');
  console.log('  - POST /api/summary (generate AI summary)');
  console.log('  - GET  /api/plans (get pricing plans)');
  console.log('  - POST /api/create-checkout-session (initiate payment)');
  console.log('  - GET  /api/health (health check)');
});