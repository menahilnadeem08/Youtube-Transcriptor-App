const express = require('express');
const cors = require('cors');
const { Innertube } = require('youtubei.js');
const Groq = require('groq-sdk').default;
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Extract video ID from URL
function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Get transcript endpoint
app.post('/api/transcript', async (req, res) => {
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
    
    // Get transcript
    console.log('Fetching transcript...');
    const transcriptData = await info.getTranscript();
    
    if (!transcriptData || !transcriptData.transcript) {
      return res.status(400).json({ 
        error: 'No captions available for this video. Try another video with captions enabled.' 
      });
    }

    // Extract text from transcript segments
    const transcript = transcriptData.transcript.content.body.initial_segments;
    
    if (!transcript || transcript.length === 0) {
      return res.status(400).json({ 
        error: 'Transcript is empty. This video may not have captions available.' 
      });
    }

    console.log('Number of transcript segments:', transcript.length);
    
    // Combine all transcript text
    const originalText = transcript
      .map(segment => segment.snippet.text)
      .join(' ')
      .trim();
    
    console.log('Original text length:', originalText.length);
    console.log('First 200 chars:', originalText.substring(0, 200));

    if (!originalText || originalText.length === 0) {
      return res.status(400).json({ 
        error: 'Could not extract text from transcript.' 
      });
    }

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
      videoId
    });

  } catch (error) {
    console.error('❌ Server error:', error.message);
    res.status(500).json({ 
      error: error.message || 'Failed to process video'
    });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend server running on http://localhost:${PORT}`);
  console.log(`📝 Ready to process YouTube transcripts!`);
});