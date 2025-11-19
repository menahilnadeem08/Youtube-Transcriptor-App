import React, { useState } from 'react';
import { Download, Loader2, AlertCircle, Clock, FileText, File } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun } from 'docx';

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ur', name: 'Urdu' },
  { code: 'pa', name: 'Punjabi (Indian)' },
  { code: 'pa-PK', name: 'Punjabi (Pakistani)' }
];

export default function App() {
  const [videoUrl, setVideoUrl] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [focusedInput, setFocusedInput] = useState(false);

  const extractVideoId = (url) => {
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
  };

  const isValidYouTubeUrl = (url) => {
    return extractVideoId(url) !== null;
  };

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

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000' || process.env.REACT_APP_API_URL;
    
    fetch(`${API_URL}/api/transcript`, {
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

  // Download as TXT
  const downloadTxt = () => {
    const element = document.createElement('a');
    const file = new Blob([result.translated], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `transcript_${result.videoId}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Download as PDF
  const downloadPdf = () => {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const maxWidth = pageWidth - 2 * margin;

    // Add title
    pdf.setFontSize(16);
    pdf.text('YouTube Transcript', margin, margin);

    // Add metadata
    pdf.setFontSize(10);
    pdf.text(`Video ID: ${result.videoId}`, margin, margin + 10);
    pdf.text(`Word Count: ${result.words} | Reading Time: ${result.readingTime} min`, margin, margin + 16);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, margin + 22);

    // Add content
    pdf.setFontSize(11);
    const textContent = result.translated;
    const splitText = pdf.splitTextToSize(textContent, maxWidth);
    
    let yPosition = margin + 35;
    splitText.forEach((line) => {
      if (yPosition > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.text(line, margin, yPosition);
      yPosition += 5;
    });

    pdf.save(`transcript_${result.videoId}.pdf`);
  };

  // Download as Word
  const downloadWord = async () => {
    const sections = [];

    // Add title
    sections.push(
      new Paragraph({
        text: 'YouTube Transcript',
        style: 'Heading1',
        spacing: { after: 200 }
      })
    );

    // Add metadata
    sections.push(
      new Paragraph({
        text: `Video ID: ${result.videoId}`,
        spacing: { after: 100 }
      }),
      new Paragraph({
        text: `Word Count: ${result.words} | Reading Time: ${result.readingTime} min`,
        spacing: { after: 100 }
      }),
      new Paragraph({
        text: `Generated: ${new Date().toLocaleString()}`,
        spacing: { after: 300 }
      })
    );

    // Add content
    sections.push(
      new Paragraph({
        text: result.translated,
        spacing: { line: 360, lineRule: 'auto' }
      })
    );

    const doc = new Document({ sections: [{ children: sections }] });
    const blob = await Packer.toBlob(doc);
    
    const element = document.createElement('a');
    element.href = URL.createObjectURL(blob);
    element.download = `transcript_${result.videoId}.docx`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          color: 'white',
          marginBottom: '40px'
        }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            marginBottom: '10px'
          }}>
            🎥 YouTube Transcript Generator
          </h1>
          <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>
            Extract and translate YouTube captions instantly
          </p>
        </div>

        {/* Form */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '20px',
          padding: '40px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontWeight: '600',
              marginBottom: '8px',
              color: '#333'
            }}>
              YouTube URL
            </label>
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
              onFocus={() => setFocusedInput(true)}
              onBlur={() => setFocusedInput(false)}
              placeholder="https://www.youtube.com/watch?v=..."
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '1rem',
                border: `2px solid ${focusedInput ? '#667eea' : '#e0e0e0'}`,
                borderRadius: '10px',
                outline: 'none',
                transition: 'border 0.3s',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontWeight: '600',
              marginBottom: '8px',
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
              background: loading ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '10px',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'transform 0.2s'
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
            marginTop: '20px',
            padding: '16px',
            backgroundColor: '#fee2e2',
            border: '2px solid #ef4444',
            borderRadius: '10px',
            color: '#991b1b',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <AlertCircle size={24} />
            <span>{error}</span>
          </div>
        )}

        {/* Success Result */}
        {result && (
          <div style={{
            marginTop: '30px',
            backgroundColor: 'white',
            borderRadius: '20px',
            padding: '30px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            {/* Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px',
              marginBottom: '24px'
            }}>
              <div style={{
                padding: '16px',
                backgroundColor: '#f3f4f6',
                borderRadius: '10px',
                textAlign: 'center'
              }}>
                <FileText size={24} style={{ margin: '0 auto 8px', color: '#667eea' }} />
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#333' }}>
                  {result.words}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>Words</div>
              </div>
              <div style={{
                padding: '16px',
                backgroundColor: '#f3f4f6',
                borderRadius: '10px',
                textAlign: 'center'
              }}>
                <Clock size={24} style={{ margin: '0 auto 8px', color: '#667eea' }} />
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#333' }}>
                  {result.readingTime} min
                </div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>Reading Time</div>
              </div>
              <div style={{
                padding: '16px',
                backgroundColor: '#f3f4f6',
                borderRadius: '10px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.5rem', margin: '0 auto 8px' }}>✓</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#333' }}>Done</div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>Translated</div>
              </div>
            </div>

            {/* Transcript */}
            <div style={{
              padding: '20px',
              backgroundColor: '#f9fafb',
              borderRadius: '10px',
              marginBottom: '20px',
              maxHeight: '400px',
              overflowY: 'auto',
              lineHeight: '1.8',
              color: '#333'
            }}>
              {result.translated}
            </div>

            {/* Download Buttons */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              marginBottom: '20px'
            }}>
              {/* Download TXT */}
              <button
                onClick={downloadTxt}
                style={{
                  padding: '12px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  color: 'white',
                  backgroundColor: '#10b981',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'background 0.2s',
                  hover: { backgroundColor: '#059669' }
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
              >
                <FileText size={18} />
                TXT
              </button>

              {/* Download PDF */}
              <button
                onClick={downloadPdf}
                style={{
                  padding: '12px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  color: 'white',
                  backgroundColor: '#f59e0b',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#d97706'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#f59e0b'}
              >
                <File size={18} />
                PDF
              </button>

              {/* Download Word */}
              <button
                onClick={downloadWord}
                style={{
                  padding: '12px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  color: 'white',
                  backgroundColor: '#3b82f6',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#1d4ed8'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#3b82f6'}
              >
                <Download size={18} />
                DOCX
              </button>
            </div>
          </div>
        )}

        {/* Footer Note */}
        <div style={{
          marginTop: '30px',
          textAlign: 'center',
          color: 'white',
          opacity: 0.8,
          fontSize: '0.875rem'
        }}>
          ✨ Works with videos with captions + AI transcription for videos without captions
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