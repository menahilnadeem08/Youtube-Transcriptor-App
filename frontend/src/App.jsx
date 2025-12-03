import React, { useState, useEffect } from 'react';
import { Download, Loader2, AlertCircle, Clock, FileText, File, CheckCircle, XCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import LoadingOverlay from './LoadingOverlay';

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ur', name: 'Urdu' },
];

export default function App() {
  const [videoUrl, setVideoUrl] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [focusedInput, setFocusedInput] = useState(false);
  const [backendConnected, setBackendConnected] = useState(null); // null = checking, true = connected, false = disconnected
  const [checkingBackend, setCheckingBackend] = useState(true);

  // Check backend health on component mount
  useEffect(() => {
    const checkBackendHealth = async () => {
      setCheckingBackend(true);
      const API_URL = import.meta.env.VITE_API_URL || '/api';
      
      try {
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch(`${API_URL}/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'ok') {
            setBackendConnected(true);
          } else {
            setBackendConnected(false);
          }
        } else {
          setBackendConnected(false);
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          console.error('Backend health check timed out');
        } else {
          console.error('Backend health check failed:', err);
        }
        setBackendConnected(false);
      } finally {
        setCheckingBackend(false);
      }
    };

    checkBackendHealth();
    
    // Optionally recheck every 30 seconds
    const healthCheckInterval = setInterval(checkBackendHealth, 30000);
    
    return () => clearInterval(healthCheckInterval);
  }, []);

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
    setProgress(0);

    // Check backend connection before proceeding
    if (backendConnected === false) {
      setError('Backend server is not connected. Please ensure the backend is running and try again.');
      return;
    }

    if (!videoUrl.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    if (!isValidYouTubeUrl(videoUrl)) {
      setError('Please enter a valid YouTube URL');
      return;
    }

    setLoading(true);
    setProgress(0);
    setError('');

    // Use environment variable or default to relative path for production
    const API_URL = import.meta.env.VITE_API_URL || '/api';
    
    // Use fetch with ReadableStream to receive SSE progress updates
    fetch(`${API_URL}/transcript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrl: videoUrl,
        targetLanguage: SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage)?.name
      })
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Failed to connect to server');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let hasCompleted = false;

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.progress !== undefined) {
                  setProgress(data.progress);
                }
                
                if (data.success) {
                  // Final result received
                  hasCompleted = true;
                  setProgress(100);
                  setTimeout(() => {
                    setResult({
                      original: data.original,
                      translated: data.translated,
                      words: data.wordCount,
                      readingTime: data.readingTime,
                      videoId: data.videoId
                    });
                    setTimeout(() => {
                      setLoading(false);
                    }, 500);
                  }, 500);
                } else if (data.error) {
                  hasCompleted = true;
                  setError(data.error || 'Failed to process video');
                  setLoading(false);
                  setProgress(0);
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }
        
        // Stream ended - if we haven't received success or error, something went wrong
        if (!hasCompleted) {
          setError('Connection closed unexpectedly');
          setLoading(false);
          setProgress(0);
        }
      })
      .catch(err => {
        console.error('Error:', err);
        setError('Failed to connect to server. Make sure backend is running.');
        setLoading(false);
        setProgress(0);
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
      {/* Loading Overlay with Progress */}
      <LoadingOverlay isVisible={loading} progress={progress} />

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

          {/* Backend Connection Status */}
          <div style={{
            marginBottom: '20px',
            padding: '12px 16px',
            borderRadius: '10px',
            backgroundColor: checkingBackend 
              ? '#fef3c7' 
              : backendConnected 
                ? '#d1fae5' 
                : '#fee2e2',
            border: `2px solid ${
              checkingBackend 
                ? '#fbbf24' 
                : backendConnected 
                  ? '#10b981' 
                  : '#ef4444'
            }`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.9rem'
          }}>
            {checkingBackend ? (
              <>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: '#f59e0b' }} />
                <span style={{ color: '#92400e', fontWeight: '600' }}>
                  Checking backend connection...
                </span>
              </>
            ) : backendConnected ? (
              <>
                <CheckCircle size={18} style={{ color: '#059669' }} />
                <span style={{ color: '#065f46', fontWeight: '600' }}>
                  Backend connected ✓
                </span>
              </>
            ) : (
              <>
                <XCircle size={18} style={{ color: '#dc2626' }} />
                <span style={{ color: '#991b1b', fontWeight: '600' }}>
                  Backend disconnected - Please ensure backend server is running
                </span>
              </>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || backendConnected === false || checkingBackend}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '1.1rem',
              fontWeight: '600',
              color: 'white',
              background: (loading || backendConnected === false || checkingBackend) 
                ? '#9ca3af' 
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '10px',
              cursor: (loading || backendConnected === false || checkingBackend) 
                ? 'not-allowed' 
                : 'pointer',
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
            ) : checkingBackend ? (
              'Checking Connection...'
            ) : backendConnected === false ? (
              'Backend Disconnected'
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