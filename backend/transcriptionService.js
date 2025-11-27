/**
 * Enhanced Transcription Service using Whisper API
 * Handles non-captioned YouTube videos with automatic transcription & translation
 */

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config();

class TranscriptionService {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // 7 languages for translation
    this.languages = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'zh': 'Chinese',
      'ja': 'Japanese',
      'ur': 'Urdu'
    };

    // Language codes for API
    this.languageCodes = {
      'English': 'en',
      'Spanish': 'es',
      'French': 'fr',
      'German': 'de',
      'Chinese': 'zh',
      'Japanese': 'ja',
      'Urdu': 'ur'
    };
  }

  /**
   * Transcribe audio using Whisper API
   * @param {string} audioPath - Path to audio file
   * @returns {Promise<string>} - Transcribed text
   */
  async transcribeWithWhisper(audioPath) {
    try {
      const startTime = Date.now();
      
      // Check file size
      const fileSize = fs.statSync(audioPath).size;
      console.log(`📊 Audio file size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);

      if (fileSize > 25 * 1024 * 1024) {
        throw new Error(`File too large: ${(fileSize / 1024 / 1024).toFixed(2)}MB. Max: 25MB`);
      }

      console.log('🎙️  Sending to Whisper API...');
      
      // Create file stream and send to Whisper
      const audioStream = fs.createReadStream(audioPath);
      
      const transcript = await this.openai.audio.transcriptions.create({
        file: audioStream,
        model: 'whisper-1',
        language: 'en'
      });

      const duration = (Date.now() - startTime) / 1000;
      console.log(`✓ Transcription complete in ${duration.toFixed(2)}s`);

      return {
        text: transcript.text.trim(),
        duration,
        wordCount: transcript.text.trim().split(/\s+/).length
      };

    } catch (error) {
      throw new Error(`Whisper transcription failed: ${error.message}`);
    }
  }

  /**
   * Translate text to specified language
   * @param {string} text - Text to translate
   * @param {string} language - Target language
   * @param {number} attempt - Current retry attempt
   * @returns {Promise<string>} - Translated text
   */
  async translateText(text, language, attempt = 1) {
    const MAX_RETRIES = 3;

    if (!text || text.length === 0) {
      return null;
    }

    try {
      // Chunk large texts
      const chunkSize = 3000; // characters
      const chunks = [];
      
      for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.substring(i, i + chunkSize));
      }

      const translations = [];

      for (const chunk of chunks) {
        // Add delay between chunk translations
        if (translations.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        const response = await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'user',
              content: `Translate to ${language}. Return ONLY the translation:\n\n${chunk}`
            }
          ],
          max_tokens: 4096,
          temperature: 0.3
        });

        const translatedChunk = response.choices[0].message.content.trim();
        translations.push(translatedChunk);
      }

      return translations.join(' ').trim();

    } catch (error) {
      if (error.status === 429 && attempt < MAX_RETRIES) {
        // Rate limit - wait and retry
        const delay = Math.pow(3, attempt) * 1000;
        console.log(`⏳ Rate limited, retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.translateText(text, language, attempt + 1);
      }

      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.translateText(text, language, attempt + 1);
      }

      throw new Error(`Translation to ${language} failed: ${error.message}`);
    }
  }

  /**
   * Transcribe and translate audio
   * @param {string} audioPath - Path to audio file
   * @param {string} targetLanguage - Target language for translation
   * @returns {Promise<object>} - Transcription and translation results
   */
  async transcribeAndTranslate(audioPath, targetLanguage = 'Spanish') {
    try {
      console.log('\n🎙️ TRANSCRIPTION & TRANSLATION PIPELINE\n');
      console.log('═'.repeat(50));

      // Step 1: Transcribe with Whisper
      console.log('\n📝 Step 1: Transcribing audio...');
      const transcriptionResult = await this.transcribeWithWhisper(audioPath);

      // Step 2: Translate to target language
      console.log(`\n🌍 Step 2: Translating to ${targetLanguage}...`);
      const translations = {};
      
      // Translate to target language
      translations[targetLanguage] = await this.translateText(
        transcriptionResult.text,
        targetLanguage
      );
      console.log(`✓ ${targetLanguage} translation complete`);

      // Step 3: Calculate metrics
      console.log('\n📊 Step 3: Calculating metrics...');
      const metrics = this.calculateMetrics(transcriptionResult.text);

      const result = {
        status: 'success',
        transcription: {
          text: transcriptionResult.text,
          wordCount: transcriptionResult.wordCount,
          duration: transcriptionResult.duration
        },
        translations,
        metrics,
        timestamp: new Date().toISOString()
      };

      console.log('\n═'.repeat(50));
      console.log('✓ Transcription & Translation Complete!');
      console.log(`  - Original text: ${transcriptionResult.wordCount} words`);
      console.log(`  - Time taken: ${transcriptionResult.duration.toFixed(2)}s`);

      return result;

    } catch (error) {
      console.error(`\n❌ Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Translate to multiple languages
   * @param {string} text - Text to translate
   * @param {Array<string>} languages - Array of target languages
   * @returns {Promise<object>} - Translations for all languages
   */
  async translateToMultipleLanguages(text, languages = null) {
    const targetLanguages = languages || Object.values(this.languages);
    const translations = {};

    console.log(`\n🌍 Translating to ${targetLanguages.length} languages...`);

    for (let i = 0; i < targetLanguages.length; i++) {
      const lang = targetLanguages[i];
      
      // Add delay between languages
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      try {
        console.log(`  ⏳ ${lang}...`);
        translations[lang] = await this.translateText(text, lang);
        console.log(`  ✓ ${lang}`);
      } catch (error) {
        console.log(`  ✗ ${lang}: ${error.message.substring(0, 50)}`);
        translations[lang] = null;
      }
    }

    return translations;
  }

  /**
   * Calculate text metrics
   * @param {string} text - Text to analyze
   * @returns {object} - Metrics
   */
  calculateMetrics(text) {
    const words = text.trim().split(/\s+/);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const characters = text.length;
    const charactersNoSpaces = text.replace(/\s/g, '').length;

    // Estimate reading time (average 200 words per minute)
    const readingTimeMinutes = Math.ceil(words.length / 200);
    const readingTimeSeconds = Math.ceil((words.length / 200) * 60);

    return {
      wordCount: words.length,
      sentenceCount: sentences.length,
      characterCount: characters,
      characterCountNoSpaces: charactersNoSpaces,
      averageWordLength: (charactersNoSpaces / words.length).toFixed(2),
      averageSentenceLength: (words.length / sentences.length).toFixed(2),
      readingTime: {
        minutes: readingTimeMinutes,
        seconds: readingTimeSeconds,
        display: `${readingTimeMinutes} min ${readingTimeSeconds % 60} sec`
      }
    };
  }

  /**
   * Format result for API response
   * @param {object} result - Raw result object
   * @returns {object} - Formatted result
   */
  formatResult(result) {
    return {
      success: true,
      data: {
        original: {
          text: result.transcription.text,
          stats: result.metrics
        },
        translations: Object.entries(result.translations).map(([lang, text]) => ({
          language: lang,
          text: text || 'Translation failed',
          wordCount: text ? text.split(/\s+/).length : 0
        })),
        metadata: {
          transcriptionTime: result.transcription.duration,
          timestamp: result.timestamp,
          audioProcessing: {
            success: true,
            duration: result.transcription.duration
          }
        }
      }
    };
  }
}

module.exports = TranscriptionService;

