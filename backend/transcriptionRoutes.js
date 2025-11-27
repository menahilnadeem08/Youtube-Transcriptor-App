/**
 * Transcription Routes
 * API endpoints for Whisper transcription and translation
 */

const express = require('express');
const router = express.Router();
const TranscriptionService = require('./transcriptionService');
const fs = require('fs');
const path = require('path');

const transcriptionService = new TranscriptionService();

/**
 * POST /api/transcribe
 * Transcribe and translate audio file
 * 
 * Body:
 * {
 *   audioPath: string,
 *   targetLanguages: string[] (optional, defaults to all 7)
 * }
 */
router.post('/transcribe', async (req, res) => {
  try {
    const { audioPath, targetLanguages } = req.body;

    if (!audioPath) {
      return res.status(400).json({
        success: false,
        error: 'audioPath is required'
      });
    }

    // Check if file exists
    if (!fs.existsSync(audioPath)) {
      return res.status(400).json({
        success: false,
        error: `Audio file not found: ${audioPath}`
      });
    }

    console.log(`\n📥 Transcription request for: ${audioPath}`);

    // Transcribe with Whisper
    const transcriptionResult = await transcriptionService.transcribeWithWhisper(audioPath);

    // Translate to target languages
    const languages = targetLanguages || Object.values(transcriptionService.languages);
    const translations = await transcriptionService.translateToMultipleLanguages(
      transcriptionResult.text,
      languages
    );

    // Calculate metrics
    const metrics = transcriptionService.calculateMetrics(transcriptionResult.text);

    // Format response
    const response = {
      success: true,
      data: {
        original: {
          text: transcriptionResult.text,
          stats: metrics
        },
        translations: Object.entries(translations).map(([lang, text]) => ({
          language: lang,
          text: text || 'Translation failed',
          wordCount: text ? text.split(/\s+/).length : 0
        })),
        metadata: {
          transcriptionTime: transcriptionResult.duration,
          timestamp: new Date().toISOString(),
          audioFile: path.basename(audioPath),
          fileSize: `${(fs.statSync(audioPath).size / 1024 / 1024).toFixed(2)}MB`
        }
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/transcribe-youtube
 * Download YouTube video, transcribe, and translate
 * 
 * Body:
 * {
 *   videoId: string,
 *   audioPath: string (from previous download),
 *   targetLanguages: string[] (optional)
 * }
 */
router.post('/transcribe-youtube', async (req, res) => {
  try {
    const { audioPath, targetLanguages } = req.body;

    if (!audioPath) {
      return res.status(400).json({
        success: false,
        error: 'audioPath is required'
      });
    }

    if (!fs.existsSync(audioPath)) {
      return res.status(400).json({
        success: false,
        error: `Audio file not found: ${audioPath}`
      });
    }

    console.log(`\n🎬 YouTube transcription for: ${audioPath}`);

    // Transcribe with Whisper
    const transcriptionResult = await transcriptionService.transcribeWithWhisper(audioPath);

    // Translate
    const languages = targetLanguages || Object.values(transcriptionService.languages);
    const translations = await transcriptionService.translateToMultipleLanguages(
      transcriptionResult.text,
      languages
    );

    // Metrics
    const metrics = transcriptionService.calculateMetrics(transcriptionResult.text);

    const response = {
      success: true,
      data: {
        original: {
          text: transcriptionResult.text,
          stats: metrics
        },
        translations: Object.entries(translations).map(([lang, text]) => ({
          language: lang,
          text: text || 'Translation failed',
          wordCount: text ? text.split(/\s+/).length : 0
        })),
        metadata: {
          transcriptionTime: transcriptionResult.duration,
          timestamp: new Date().toISOString(),
          audioFile: path.basename(audioPath)
        }
      }
    };

    res.json(response);

  } catch (error) {
    console.error('YouTube transcription error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/translate
 * Translate existing transcription
 * 
 * Body:
 * {
 *   text: string,
 *   languages: string[]
 * }
 */
router.post('/translate', async (req, res) => {
  try {
    const { text, languages } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'text is required'
      });
    }

    const targetLanguages = languages || Object.values(transcriptionService.languages);
    const translations = await transcriptionService.translateToMultipleLanguages(text, targetLanguages);

    res.json({
      success: true,
      data: {
        originalText: text,
        translations: Object.entries(translations).map(([lang, translatedText]) => ({
          language: lang,
          text: translatedText,
          wordCount: translatedText ? translatedText.split(/\s+/).length : 0
        })),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/languages
 * Get available languages
 */
router.get('/languages', (req, res) => {
  res.json({
    success: true,
    languages: Object.entries(transcriptionService.languages).map(([code, name]) => ({
      code,
      name
    })),
    total: Object.keys(transcriptionService.languages).length
  });
});

/**
 * POST /api/metrics
 * Calculate metrics for text
 * 
 * Body:
 * {
 *   text: string
 * }
 */
router.post('/metrics', (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'text is required'
      });
    }

    const metrics = transcriptionService.calculateMetrics(text);

    res.json({
      success: true,
      data: {
        text: text.substring(0, 100) + '...',
        metrics
      }
    });

  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

