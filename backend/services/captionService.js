// Caption extraction service using yt-dlp
import { promisify } from 'util';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

/**
 * Extract captions from YouTube video using yt-dlp
 * @param {string} videoUrl - YouTube video URL
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Object>} Caption data with timestamps and text
 */
export async function extractCaptionsWithYtDlp(videoUrl, videoId) {
  console.log('📝 Extracting captions with yt-dlp...');
  console.log('Video URL:', videoUrl);
  console.log('Video ID:', videoId);

  const ytDlpCmd = process.platform === 'win32' ? 'yt-dlp' : 'yt-dlp';
  const tempDir = path.join(__dirname, '..', 'temp');

  try {
    // Step 1: Check if subtitles are available
    console.log('🔍 Checking available subtitles...');
    const listCmd = `${ytDlpCmd} --list-subs --skip-download --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" --sleep-requests 1 "${videoUrl}" 2>&1`;
    
    let subsOutput = '';
    try {
      const subsResult = await execAsync(listCmd, { timeout: 15000 });
      subsOutput = (subsResult.stdout || '') + (subsResult.stderr || '');
    } catch (subsError) {
      subsOutput = (subsError.stdout || '') + (subsError.stderr || '');
    }

    // Check if subtitles are available (any language)
    const hasSubtitles = subsOutput.includes('Available subtitles') || 
                        subsOutput.includes('automatic captions') ||
                        subsOutput.includes('[info] Available subtitles');

    if (!hasSubtitles) {
      console.log('❌ No subtitles available for this video');
      return null;
    }

    console.log('✅ Subtitles detected! Extracting captions...');

    // Step 2: Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Step 3: Download captions (try English first, then any available language)
    console.log('📥 Downloading captions...');
    const extractCmd = `${ytDlpCmd} --write-auto-subs --sub-lang en,en-US,en-GB --sub-format vtt --skip-download --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" --sleep-requests 2 --retries 3 -o "${path.join(tempDir, videoId)}" "${videoUrl}" 2>&1`;
    
    try {
      const result = await execAsync(extractCmd, { timeout: 30000 });
      console.log('Caption download output:', result.stdout || result.stderr);
    } catch (downloadError) {
      const errorOutput = downloadError.stdout || downloadError.stderr || downloadError.message;
      console.log('Caption download error output:', errorOutput);
      
      // If rate limited or English not available
      if (errorOutput.includes('429') || errorOutput.includes('Too Many Requests')) {
        console.log('⚠️  Rate limited by YouTube. Waiting 3 seconds and retrying...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const retryCmd = `${ytDlpCmd} --write-auto-subs --sub-lang en,en-US,en-GB --sub-format vtt --skip-download --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" --sleep-requests 3 --retries 5 -o "${path.join(tempDir, videoId)}" "${videoUrl}" 2>&1`;
        
        try {
          const retryResult = await execAsync(retryCmd, { timeout: 45000 });
          console.log('✅ Retry successful:', retryResult.stdout || retryResult.stderr);
        } catch (retryError) {
          console.log('❌ Retry failed, captions not available');
          return null;
        }
      } else if (errorOutput.includes('There are no subtitles')) {
        console.log('⚠️  No English captions, trying any available language...');
        const fallbackCmd = `${ytDlpCmd} --write-auto-subs --sub-format vtt --skip-download --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" --sleep-requests 2 --retries 3 -o "${path.join(tempDir, videoId)}" "${videoUrl}" 2>&1`;
        
        try {
          const fallbackResult = await execAsync(fallbackCmd, { timeout: 30000 });
          console.log('Fallback caption download:', fallbackResult.stdout || fallbackResult.stderr);
        } catch (fallbackError) {
          console.log('⚠️  No captions available in any language');
          return null;
        }
      } else {
        // Re-throw other errors
        throw downloadError;
      }
    }

    // Step 4: Find the caption file (check for ANY language)
    console.log('🔍 Looking for caption file...');
    
    let captionFilePath = null;
    const files = fs.readdirSync(tempDir).filter(f => f.startsWith(videoId) && f.endsWith('.vtt'));
    
    if (files.length > 0) {
      // Prefer English variants first
      const englishFile = files.find(f => f.includes('.en.vtt') || f.includes('.en-'));
      captionFilePath = englishFile ? path.join(tempDir, englishFile) : path.join(tempDir, files[0]);
      
      const detectedLang = path.basename(captionFilePath).match(/\.([a-z]{2}(-[A-Z]{2})?)\./)?.[1] || 'unknown';
      console.log(`📝 Using captions in language: ${detectedLang}`);
    }

    if (!captionFilePath) {
      console.log('❌ Caption file not found');
      return null;
    }

    console.log(`✅ Caption file found: ${path.basename(captionFilePath)}`);

    // Step 5: Parse VTT file
    console.log('📄 Parsing VTT file...');
    const vttContent = fs.readFileSync(captionFilePath, 'utf-8');
    
    const lines = vttContent.split('\n');
    const captionSegments = [];
    const textLines = [];
    
    let currentTimestamp = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip WEBVTT header and metadata
      if (trimmedLine.startsWith('WEBVTT') || 
          trimmedLine.startsWith('Kind:') ||
          trimmedLine.startsWith('Language:') ||
          trimmedLine === '') {
        continue;
      }
      
      // Check if this is a timestamp line (format: 00:00:00.000 --> 00:00:03.000)
      if (/^\d{2}:\d{2}/.test(trimmedLine)) {
        const [startTime, endTime] = trimmedLine.split(' --> ');
        currentTimestamp = startTime;
        continue;
      }
      
      // Skip cue numbers
      if (/^\d+$/.test(trimmedLine)) {
        continue;
      }
      
      // This is caption text
      if (currentTimestamp && trimmedLine.length > 0) {
        // Clean the text: remove HTML-like tags (<c>, </c>, <00:00:00.000>, etc.)
        let cleanText = trimmedLine
          .replace(/<\/?c[^>]*>/g, '') // Remove <c> and </c> tags
          .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '') // Remove timestamp tags
          .replace(/<[^>]+>/g, '') // Remove any other HTML-like tags
          .trim();
        
        if (cleanText.length > 0) {
          captionSegments.push({
            timestamp: currentTimestamp,
            text: cleanText
          });
          textLines.push(cleanText);
        }
        currentTimestamp = null;
      }
    }
    
    const fullText = textLines.join(' ').trim().replace(/\s+/g, ' ');

    // Detect language from filename
    const captionLanguage = path.basename(captionFilePath).match(/\.([a-z]{2}(-[A-Z]{2})?)\./)?.[1] || 'en';

    // Cleanup VTT file
    console.log('🗑️  Cleaning up temporary VTT file...');
    fs.unlinkSync(captionFilePath);

    console.log('✅ Captions extracted successfully via yt-dlp');
    console.log(`📊 Total segments: ${captionSegments.length}`);
    console.log(`📄 Total length: ${fullText.length} characters`);
    console.log(`🌐 Caption language: ${captionLanguage}`);

    return {
      segments: captionSegments,
      fullText: fullText,
      language: captionLanguage,
      totalSegments: captionSegments.length,
      totalCharacters: fullText.length,
      totalWords: fullText.split(/\s+/).length,
      method: 'yt-dlp'
    };

  } catch (error) {
    console.error('❌ Caption extraction failed:', error.message);
    
    // Clean up any leftover files
    try {
      const files = fs.readdirSync(tempDir).filter(f => f.startsWith(videoId) && f.endsWith('.vtt'));
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    return null;
  }
}

/**
 * Format captions for display
 * @param {Array} segments - Array of caption segments with timestamps
 * @returns {string} Formatted caption text
 */
export function formatCaptionsForDisplay(segments) {
  return segments
    .map(segment => `[${segment.timestamp}] ${segment.text}`)
    .join('\n');
}

/**
 * Convert timestamp to seconds
 * @param {string} timestamp - Timestamp in format HH:MM:SS.mmm
 * @returns {number} Seconds
 */
export function timestampToSeconds(timestamp) {
  const parts = timestamp.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseFloat(parts[2]);
  return hours * 3600 + minutes * 60 + seconds;
}
