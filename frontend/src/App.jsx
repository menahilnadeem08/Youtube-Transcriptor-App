import React, { useState } from 'react';
import { Download, Loader2, CheckCircle, AlertCircle, Clock, FileText } from 'lucide-react';

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'zh', name: 'Chinese' }
];

export default function App() {
  const [videoUrl, setVideoUrl] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // Extract YouTube video ID from URL
  const extractVideoId = (url) => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  // Validate YouTube URL
  const isValidYouTubeUrl = (url) => {
    return extractVideoId(url) !== null;
  };

  // Fetch transcript from YouTube
  const fetchTranscript = async (videoId) => {
    const response = await fetch(`https://api.anthropic.com/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `You are a YouTube transcript fetcher. Extract the transcript/captions from this YouTube video ID: ${videoId}

Use this method:
1. The video URL is: https://www.youtube.com/watch?v=${videoId}
2. Try to fetch captions using the YouTube Transcript API approach
3. Return ONLY the transcript text, nothing else

If captions are not available, return: "NO_CAPTIONS_AVAILABLE"`
        }]
      })
    });

    const data = await response.json();
    const text = data.content[0].text;
    
    if (text === "NO_CAPTIONS_AVAILABLE") {
      throw new Error("This video doesn't have captions available. Try another video.");
    }
    
    return text;
  };

  // Translate text using Claude
  const translateText = async (text, targetLang) => {
    const langName = SUPPORTED_LANGUAGES.find(l => l.code === targetLang)?.name || 'Spanish';
    
    const response = await fetch(`https://api.anthropic.com/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `You are a professional translator. Translate the following text to ${langName}. 
Maintain the original meaning, tone, and formatting. Return ONLY the translated text without any preamble or explanations.

Text to translate:
${text}`
        }]
      })
    });

    const data = await response.json();
    return data.content[0].text;
  };

  // Calculate reading stats
  const calculateStats = (text) => {
    const words = text.trim().split(/\s+/).length;
    const readingTime = Math.ceil(words / 200); // 200 WPM average
    return { words, readingTime };
  };

  // Handle form submission
// Replace the entire handleSubmit function with this:
const handleSubmit = () => {
  setError('');
  setResult(null);
  
  if (!videoUrl.trim()) {
    setError('Please enter a YouTube URL');
    return;
  }
  
  if (!isValidYouTubeUrl(videoUrl)) {
    setError('Please enter a valid YouTube URL');
    return;
  }

  setLoading(true);

  // Call your backend instead of Anthropic directly
  fetch('http://localhost:3000/api/transcript', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      videoUrl: videoUrl,
      targetLanguage: SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage)?.name 
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      setResult({
        original: data.original,
        translated: data.translated,
        words: data.wordCount,
        readingTime: data.readingTime,
        videoId: data.videoId
      });
    } else {
      setError(data.error || 'Failed to process video');
    }
  })
  .catch(err => {
    setError('Failed to connect to server. Make sure backend is running.');
  })
  .finally(() => {
    setLoading(false);
  });
};

  // Download transcript as TXT
  const downloadTranscript = () => {
    const element = document.createElement('a');
    const file = new Blob([result.translated], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `transcript_${result.videoId}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        background: 'white',
        borderRadius: '20px',
        padding: '40px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{
            fontSize: '2.5rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '10px'
          }}>
            🎥 YouTube Transcript Generator
          </h1>
          <p style={{ color: '#666', fontSize: '1.1rem' }}>
            Extract and translate YouTube captions instantly
          </p>
        </div>

        {/* Form */}
        <div style={{ marginBottom: '30px' }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '600',
              color: '#333'
            }}>
              YouTube URL
            </label>
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="https://www.youtube.com/watch?v=..."
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '1rem',
                border: '2px solid #e0e0e0',
                borderRadius: '10px',
                outline: 'none',
                transition: 'border 0.3s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '600',
              color: '#333'
            }}>
              Target Language
            </label>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '1rem',
                border: '2px solid #e0e0e0',
                borderRadius: '10px',
                outline: 'none',
                backgroundColor: 'white',
                cursor: 'pointer',
                boxSizing: 'border-box'
              }}
            >
              {SUPPORTED_LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '1.1rem',
              fontWeight: '600',
              color: 'white',
              background: loading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '10px',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'transform 0.2s',
              boxSizing: 'border-box'
            }}
            onMouseOver={(e) => {
              if (!loading) e.target.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'translateY(0)';
            }}
          >
            {loading ? (
              <>
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                Processing...
              </>
            ) : (
              'Generate Transcript'
            )}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '16px',
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '10px',
            color: '#c33',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '20px'
          }}>
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {/* Success Result */}
        {result && (
          <div style={{
            border: '2px solid #667eea',
            borderRadius: '15px',
            padding: '30px',
            background: '#f8f9ff'
          }}>
            {/* Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '15px',
              marginBottom: '25px'
            }}>
              <div style={{
                background: 'white',
                padding: '15px',
                borderRadius: '10px',
                textAlign: 'center'
              }}>
                <FileText size={24} style={{ color: '#667eea', marginBottom: '8px' }} />
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#333' }}>
                  {result.words}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>Words</div>
              </div>

              <div style={{
                background: 'white',
                padding: '15px',
                borderRadius: '10px',
                textAlign: 'center'
              }}>
                <Clock size={24} style={{ color: '#667eea', marginBottom: '8px' }} />
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#333' }}>
                  {result.readingTime} min
                </div>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>Reading Time</div>
              </div>

              <div style={{
                background: 'white',
                padding: '15px',
                borderRadius: '10px',
                textAlign: 'center'
              }}>
                <CheckCircle size={24} style={{ color: '#10b981', marginBottom: '8px' }} />
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#333' }}>
                  ✓
                </div>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>Translated</div>
              </div>
            </div>

            {/* Transcript */}
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '10px',
              marginBottom: '20px',
              maxHeight: '400px',
              overflowY: 'auto',
              lineHeight: '1.8',
              color: '#333',
              fontSize: '1rem'
            }}>
              {result.translated}
            </div>

            {/* Download Button */}
            <button
              onClick={downloadTranscript}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '1rem',
                fontWeight: '600',
                color: 'white',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                transition: 'transform 0.2s',
                boxSizing: 'border-box'
              }}
              onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
            >
              <Download size={20} />
              Download Transcript (TXT)
            </button>
          </div>
        )}

        {/* Footer Note */}
        <div style={{
          marginTop: '30px',
          padding: '15px',
          background: '#f0f0f0',
          borderRadius: '10px',
          fontSize: '0.9rem',
          color: '#666',
          textAlign: 'center'
        }}>
          <strong>Phase 1:</strong> Works with videos that have captions/subtitles available
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}