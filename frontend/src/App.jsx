import React, { useState, useEffect } from 'react';
import { Download, Loader2, AlertCircle, Clock, FileText, File, CheckCircle, XCircle, Home, DollarSign, Play, Languages, FileType, Copy, CopyCheck, Search, ChevronUp, ChevronDown, X, RotateCcw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph } from 'docx';
import LoadingOverlay from './LoadingOverlay';
import HomePage from './HomePage';
import PricingPage from './PricingPage';
import SummarySection from './SummarySection';
import { SUPPORTED_LANGUAGES } from './languages';


export default function App() {
  const [activeTab, setActiveTab] = useState('home'); // 'home', 'pricing', 'generate'
  const [videoUrl, setVideoUrl] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [focusedInput, setFocusedInput] = useState(false);
  const [backendConnected, setBackendConnected] = useState(null);
  const [checkingBackend, setCheckingBackend] = useState(true);
  const [paymentSessionId, setPaymentSessionId] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [activeMode, setActiveMode] = useState(null); // 'transcribe' or 'translate'
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [matchIndices, setMatchIndices] = useState([]);
  const textContainerRef = React.useRef(null);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);

  // Handle plan selection from Pricing page
  const handlePlanSelect = (planId, autoSwitch = false) => {
    setSelectedPlan(planId);
    // Switch to generate tab only if autoSwitch is true
    if (autoSwitch) {
      setActiveTab('generate');
    }
  };

  // Check for payment success on mount (from redirect)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const videoUrlParam = urlParams.get('videoUrl');
    const targetLanguageParam = urlParams.get('targetLanguage');
    
    if (sessionId && videoUrlParam && targetLanguageParam) {
      setPaymentSessionId(sessionId);
      setVideoUrl(videoUrlParam);
      setTargetLanguage(targetLanguageParam);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // Auto-start transcript generation after payment
      setTimeout(() => {
        handleSubmit(sessionId);
      }, 500);
    }
  }, []);

  // Check backend health
  useEffect(() => {
    const checkBackendHealth = async () => {
      setCheckingBackend(true);
      const API_URL = import.meta.env.VITE_API_URL || '/api';
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${API_URL}/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          setBackendConnected(data.status === 'ok');
        } else {
          setBackendConnected(false);
        }
      } catch (err) {
        setBackendConnected(false);
      } finally {
        setCheckingBackend(false);
      }
    };

    checkBackendHealth();
    const healthCheckInterval = setInterval(checkBackendHealth, 30000);
    return () => clearInterval(healthCheckInterval);
  }, []);

  // Reset copied state when result changes
  useEffect(() => {
    setCopied(false);
    setSearchQuery('');
    setCurrentMatchIndex(-1);
    setMatchIndices([]);
    setShowLanguageSelector(false);
  }, [result]);

  // Find matches when search query changes
  useEffect(() => {
    if (!result || !result.text || !searchQuery.trim()) {
      setMatchIndices([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const text = result.text;
    const query = searchQuery.trim();
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      matches.push(match.index);
    }

    setMatchIndices(matches);
    if (matches.length > 0) {
      setCurrentMatchIndex(0);
    } else {
      setCurrentMatchIndex(-1);
    }
  }, [searchQuery, result]);

  // Scroll to current match
  useEffect(() => {
    if (currentMatchIndex >= 0 && matchIndices.length > 0 && textContainerRef.current) {
      const matchId = `match-${currentMatchIndex}`;
      const matchElement = textContainerRef.current.querySelector(`[data-match-id="${matchId}"]`);
      if (matchElement) {
        matchElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }
    }
  }, [currentMatchIndex, matchIndices]);

  const extractVideoId = (url) => {
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
  };

  const isValidYouTubeUrl = (url) => {
    return extractVideoId(url) !== null;
  };

  // Handle payment initiation from pricing page (without video URL)
  const handlePaymentFromPricing = async (planId) => {
    if (backendConnected === false) {
      setError('Backend server is not connected. Please ensure the backend is running and try again.');
      throw new Error('Backend not connected');
    }

    try {
      const API_URL = import.meta.env.VITE_API_URL || '/api';
      // Use a placeholder video URL - user will enter real URL after payment
      const response = await fetch(`${API_URL}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Placeholder
          targetLanguage: SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage)?.name || 'Spanish',
          planId: planId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create payment session');
      }

      const data = await response.json();
      
      // Redirect to Stripe Checkout for paid plans
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message || 'Failed to initiate payment. Please try again.');
      throw err;
    }
  };

  const handlePayment = async () => {
    setError('');
    setProcessingPayment(true);

    if (!videoUrl.trim()) {
      setError('Please enter a YouTube URL first');
      setProcessingPayment(false);
      return;
    }

    if (!isValidYouTubeUrl(videoUrl)) {
      setError('Please enter a valid YouTube URL');
      setProcessingPayment(false);
      return;
    }

    if (!selectedPlan) {
      setError('Please select a plan');
      setProcessingPayment(false);
      return;
    }

    if (backendConnected === false) {
      setError('Backend server is not connected. Please ensure the backend is running and try again.');
      setProcessingPayment(false);
      return;
    }

    try {
      const API_URL = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${API_URL}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: videoUrl,
          targetLanguage: SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage)?.name,
          planId: selectedPlan
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create payment session');
      }

      const data = await response.json();
      
      // Handle free plan - no redirect needed
      if (data.isFree && data.sessionId) {
        setPaymentSessionId(data.sessionId);
        setProcessingPayment(false);
        // Auto-start transcript generation for free plan
        setTimeout(() => {
          handleSubmit(data.sessionId);
        }, 500);
        return;
      }
      
      // Redirect to Stripe Checkout for paid plans
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message || 'Failed to initiate payment. Please try again.');
      setProcessingPayment(false);
    }
  };

  const handleSubmit = (sessionIdOverride = null, modeOverride = null, languageCodeOverride = null) => {
    setError('');
    setResult(null);
    setProgress(0);

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

    const API_URL = import.meta.env.VITE_API_URL || '/api';
    
    // Use the provided sessionId or the stored one
    const sessionIdToUse = sessionIdOverride || paymentSessionId;
    
    // Use the provided language code or the current state
    const languageToUse = languageCodeOverride || targetLanguage;
    
    // Determine mode - use override if provided, otherwise based on targetLanguage
    const mode = modeOverride || (languageToUse && languageToUse !== 'en' ? 'translate' : 'transcribe');
    setActiveMode(mode);
    
    // Use fetch with ReadableStream to receive SSE progress updates
    // For transcribe mode, don't send targetLanguage; for translate mode, send it
    const requestBody = {
      videoUrl: videoUrl,
      sessionId: sessionIdToUse
    };
    
    if (mode === 'translate') {
      const languageName = SUPPORTED_LANGUAGES.find(l => l.code === languageToUse)?.name;
      if (languageName) {
        requestBody.targetLanguage = languageName;
      }
    }
    
    fetch(`${API_URL}/transcript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
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
                  hasCompleted = true;
                  setProgress(100);
                  setTimeout(() => {
                    // Determine mode from data response - if translated exists, it's a translation
                    const resultMode = data.translated ? 'translate' : 'transcribe';
                    if (resultMode === 'transcribe') {
                      setResult({
                        text: data.transcript || data.original, // Fallback to original if transcript not present
                        words: data.wordCount,
                        readingTime: data.readingTime,
                        videoId: data.videoId,
                        mode: 'transcribe',
                        method: data.transcriptionMethod
                      });
                    } else {
                      setResult({
                        original: data.original,
                        text: data.translated,
                        words: data.wordCount,
                        readingTime: data.readingTime,
                        videoId: data.videoId,
                        mode: 'translate',
                        targetLanguage: data.targetLanguage,
                        method: data.transcriptionMethod
                      });
                    }
                    setTimeout(() => setLoading(false), 500);
                  }, 500);
                } else if (data.error) {
                  hasCompleted = true;
                  // Use user-friendly error message, log technical details to console
                  let errorMessage = data.error || 'Failed to process video';
                  
                  // Fallback: If error is still in raw format "429 {...}", parse it
                  if (typeof errorMessage === 'string' && /^\d+\s*\{/.test(errorMessage.trim())) {
                    try {
                      const jsonMatch = errorMessage.match(/\{[\s\S]*\}/);
                      if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        if (parsed.error && parsed.error.message) {
                          const groqMessage = parsed.error.message;
                          // Check if it's a rate limit error
                          if (parsed.error.code === 'rate_limit_exceeded' || groqMessage.toLowerCase().includes('rate limit')) {
                            const retryMatch = groqMessage.match(/try again in ([\d\w\s.]+)/i);
                            if (retryMatch) {
                              errorMessage = `Translation service rate limit reached. Please try again in ${retryMatch[1]}.`;
                            } else {
                              errorMessage = 'Translation service rate limit reached. Please try again in about an hour.';
                            }
                          } else {
                            errorMessage = groqMessage;
                          }
                        }
                      }
                    } catch (e) {
                      console.error('Failed to parse error message:', e);
                    }
                  }
                  
                  if (data.technicalError) {
                    console.error('Technical error details:', {
                      userMessage: errorMessage,
                      technicalError: data.technicalError,
                      errorType: data.errorType
                    });
                  }
                  setError(errorMessage);
                  
                  // If payment is required, show payment button
                  if (data.requiresPayment) {
                    setPaymentSessionId(null);
                  }
                  
                  setLoading(false);
                  setProgress(0);
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }
        
        if (!hasCompleted) {
          console.error('Connection error: Stream closed unexpectedly');
          setError('Connection was interrupted. Please try again.');
          setLoading(false);
          setProgress(0);
        }
      })
      .catch(err => {
        console.error('Network error details:', {
          message: err.message,
          stack: err.stack,
          name: err.name
        });
        setError('Unable to connect to the server. Please check your internet connection and ensure the backend is running.');
        setLoading(false);
        setProgress(0);
      });
  };

  const downloadTxt = () => {
    const element = document.createElement('a');
    const file = new Blob([result.text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `transcript_${result.videoId}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

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

    pdf.setFontSize(16);
    pdf.text('YouTube Transcript', margin, margin);

    pdf.setFontSize(10);
    pdf.text(`Video ID: ${result.videoId}`, margin, margin + 10);
    pdf.text(`Mode: ${result.mode === 'transcribe' ? 'Transcription' : 'Translation'}`, margin, margin + 16);
    pdf.text(`Word Count: ${result.words} | Reading Time: ${result.readingTime} min`, margin, margin + 22);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, margin + 28);

    pdf.setFontSize(11);
    const splitText = pdf.splitTextToSize(result.text, maxWidth);
    
    let yPosition = margin + 40;
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

  const downloadWord = async () => {
    const sections = [];

    sections.push(
      new Paragraph({
        text: 'YouTube Transcript',
        heading: 'Heading1',
        spacing: { after: 200 }
      })
    );

    sections.push(
      new Paragraph({
        text: `Video ID: ${result.videoId}`,
        spacing: { after: 100 }
      }),
      new Paragraph({
        text: `Mode: ${result.mode === 'transcribe' ? 'Transcription' : 'Translation'}`,
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

    sections.push(
      new Paragraph({
        text: result.text,
        spacing: { line: 360 }
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

  const copyToClipboard = async () => {
    if (!result || !result.text) return;
    
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = result.text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        console.error('Fallback copy failed:', e);
      }
      document.body.removeChild(textArea);
    }
  };

  const highlightText = (text, query) => {
    if (!query.trim()) return text;

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);
    let matchCounter = 0;
    
    return parts.map((part, index) => {
      // Check if this part matches the query (case-insensitive)
      const testRegex = new RegExp(`^${escapedQuery}$`, 'i');
      const isMatch = testRegex.test(part);
      
      if (isMatch) {
        const matchId = matchCounter;
        matchCounter++;
        const isCurrentMatch = matchId === currentMatchIndex;
        return (
          <mark
            key={index}
            data-match-id={`match-${matchId}`}
            style={{
              backgroundColor: isCurrentMatch ? '#fbbf24' : '#fef08a',
              color: '#333',
              padding: '2px 0',
              borderRadius: '3px',
              transition: 'background-color 0.2s'
            }}
          >
            {part}
          </mark>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const goToNextMatch = () => {
    if (matchIndices.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % matchIndices.length);
  };

  const goToPreviousMatch = () => {
    if (matchIndices.length === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + matchIndices.length) % matchIndices.length);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setCurrentMatchIndex(-1);
    setMatchIndices([]);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <LoadingOverlay isVisible={loading} progress={progress} />

      {/* Navigation Tabs */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        padding: '0 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          gap: '8px',
          padding: '16px 0'
        }}>
          <button
            onClick={() => setActiveTab('home')}
            style={{
              padding: '12px 24px',
              fontSize: '1rem',
              fontWeight: '600',
              color: activeTab === 'home' ? '#667eea' : 'white',
              backgroundColor: activeTab === 'home' ? 'white' : 'transparent',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'home') {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'home') {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <Home size={20} />
            Home
          </button>
          <button
            onClick={() => setActiveTab('pricing')}
            style={{
              padding: '12px 24px',
              fontSize: '1rem',
              fontWeight: '600',
              color: activeTab === 'pricing' ? '#667eea' : 'white',
              backgroundColor: activeTab === 'pricing' ? 'white' : 'transparent',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'pricing') {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'pricing') {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <DollarSign size={20} />
            Pricing
          </button>
          <button
            onClick={() => setActiveTab('generate')}
            style={{
              padding: '12px 24px',
              fontSize: '1rem',
              fontWeight: '600',
              color: activeTab === 'generate' ? '#667eea' : 'white',
              backgroundColor: activeTab === 'generate' ? 'white' : 'transparent',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'generate') {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'generate') {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <Play size={20} />
            Generate
          </button>
        </div>
      </div>

      <div style={{
        padding: '40px 20px',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Home Tab */}
        {activeTab === 'home' && <HomePage />}

        {/* Pricing Tab */}
        {activeTab === 'pricing' && (
          <PricingPage
            onPlanSelect={handlePlanSelect}
            selectedPlan={selectedPlan}
            onPaymentInitiate={handlePaymentFromPricing}
          />
        )}

        {/* Generate Tab */}
        {activeTab === 'generate' && (
          <div>
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
                🎥 Generate Transcript
              </h1>
              <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>
                Extract and translate YouTube captions instantly
              </p>
            </div>

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


          {/* Backend Connection Status */}
          {/* <div style={{
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
          </div> */}

          {!paymentSessionId ? (
            <>
              {/* Two Buttons: Transcribe and Translate */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginBottom: '12px'
              }}>
                <button
                  onClick={() => {
                    setShowLanguageSelector(false);
                    // If no plan selected, use free plan by default
                    const planToUse = selectedPlan || 'free';
                    if (planToUse === 'free') {
                      // For free plan, directly process
                      handleSubmit(null, 'transcribe');
                    } else {
                      // For paid plans, need payment first
                      handlePayment();
                    }
                  }}
                  disabled={loading || processingPayment || backendConnected === false || checkingBackend}
                  style={{
                    padding: '14px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: 'white',
                    background: (loading || processingPayment || backendConnected === false || checkingBackend) 
                      ? '#9ca3af' 
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: (loading || processingPayment || backendConnected === false || checkingBackend) 
                      ? 'not-allowed' 
                      : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'transform 0.2s'
                  }}
                >
                  {loading && activeMode === 'transcribe' ? (
                    <>
                      <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FileType size={20} />
                      Transcribe
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    // Show language selector when translate is clicked
                    setShowLanguageSelector(true);
                  }}
                  disabled={loading || processingPayment || backendConnected === false || checkingBackend}
                  style={{
                    padding: '14px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: 'white',
                    background: (loading || processingPayment || backendConnected === false || checkingBackend) 
                      ? '#9ca3af' 
                      : showLanguageSelector
                        ? 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)'
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: (loading || processingPayment || backendConnected === false || checkingBackend) 
                      ? 'not-allowed' 
                      : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'transform 0.2s'
                  }}
                >
                  {loading && activeMode === 'translate' ? (
                    <>
                      <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Languages size={20} />
                      Translate
                    </>
                  )}
                </button>
              </div>

              {/* Reset Button */}
              <div style={{ marginBottom: '12px' }}>
                <button
                  onClick={() => {
                    setVideoUrl('');
                    setResult(null);
                    setError('');
                    setShowLanguageSelector(false);
                    setSearchQuery('');
                    setCurrentMatchIndex(-1);
                    setMatchIndices([]);
                    setCopied(false);
                  }}
                  disabled={loading || processingPayment}
                  style={{
                    width: '100%',
                    padding: '14px',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    color: (loading || processingPayment) ? '#9ca3af' : '#4b5563',
                    background: (loading || processingPayment) 
                      ? '#f3f4f6' 
                      : 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                    border: '2px solid #d1d5db',
                    borderRadius: '10px',
                    cursor: (loading || processingPayment) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    transition: 'all 0.3s ease',
                    boxShadow: (loading || processingPayment) 
                      ? 'none' 
                      : '0 2px 4px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading && !processingPayment) {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)';
                      e.currentTarget.style.borderColor = '#fca5a5';
                      e.currentTarget.style.color = '#dc2626';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.15), 0 2px 4px rgba(239, 68, 68, 0.1)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading && !processingPayment) {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)';
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.color = '#4b5563';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                  onMouseDown={(e) => {
                    if (!loading && !processingPayment) {
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                  onMouseUp={(e) => {
                    if (!loading && !processingPayment) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                >
                  <RotateCcw 
                    size={18} 
                    className="reset-icon"
                    style={{
                      transition: 'transform 0.3s ease'
                    }}
                  />
                  Reset Form
                </button>
              </div>

              {/* Language Selector - Only shown when translation is needed, appears below buttons */}
              {showLanguageSelector && (
                <div style={{ 
                  marginBottom: '12px',
                  padding: '16px',
                  backgroundColor: '#f0f4ff',
                  borderRadius: '10px',
                  border: '2px solid #667eea'
                }}>
                  <label style={{
                    display: 'block',
                    fontWeight: '600',
                    marginBottom: '8px',
                    color: '#333',
                    fontSize: '0.9rem'
                  }}>
                    Select Target Language
                  </label>
                  <select
                    value={targetLanguage}
                    onChange={(e) => {
                      const selectedLangCode = e.target.value;
                      setTargetLanguage(selectedLangCode);
                      // Automatically trigger translation when language is selected
                      const planToUse = selectedPlan || 'free';
                      if (planToUse === 'free') {
                        handleSubmit(null, 'translate', selectedLangCode);
                      } else {
                        handlePayment();
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '1rem',
                      border: '2px solid #667eea',
                      borderRadius: '8px',
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
              )}

              <div style={{
                fontSize: '0.85rem',
                color: '#666',
                textAlign: 'center'
              }}>
                💡 <strong>Transcribe</strong>: Get text in original language | <strong>Translate</strong>: Convert to selected language
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                <button
                  onClick={() => {
                    setShowLanguageSelector(false);
                    handleSubmit(null, 'transcribe');
                  }}
                  disabled={loading || backendConnected === false || checkingBackend}
                  style={{
                    flex: 1,
                    padding: '14px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: 'white',
                    background: (loading || backendConnected === false || checkingBackend) 
                      ? '#9ca3af' 
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
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
                  {loading && activeMode === 'transcribe' ? (
                    <>
                      <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FileType size={20} />
                      Transcribe
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowLanguageSelector(true);
                  }}
                  disabled={loading || backendConnected === false || checkingBackend}
                  style={{
                    flex: 1,
                    padding: '14px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: 'white',
                    background: (loading || backendConnected === false || checkingBackend) 
                      ? '#9ca3af' 
                      : showLanguageSelector
                        ? 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)'
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
                  {loading && activeMode === 'translate' ? (
                    <>
                      <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Languages size={20} />
                      Translate
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setPaymentSessionId(null);
                    setResult(null);
                    setError('');
                    setShowLanguageSelector(false);
                  }}
                  style={{
                    padding: '14px 20px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: '#666',
                    background: '#f3f4f6',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#e5e7eb'}
                  onMouseLeave={(e) => e.target.style.background = '#f3f4f6'}
                >
                  Reset
                </button>
              </div>

              {/* Language Selector - Only shown when translation is needed, appears below buttons */}
              {showLanguageSelector && (
                <div style={{ 
                  marginBottom: '12px',
                  padding: '16px',
                  backgroundColor: '#f0f4ff',
                  borderRadius: '10px',
                  border: '2px solid #667eea'
                }}>
                  <label style={{
                    display: 'block',
                    fontWeight: '600',
                    marginBottom: '8px',
                    color: '#333',
                    fontSize: '0.9rem'
                  }}>
                    Select Target Language
                  </label>
                  <select
                    value={targetLanguage}
                    onChange={(e) => {
                      const selectedLangCode = e.target.value;
                      setTargetLanguage(selectedLangCode);
                      // Automatically trigger translation when language is selected
                      handleSubmit(null, 'translate', selectedLangCode);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '1rem',
                      border: '2px solid #667eea',
                      borderRadius: '8px',
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
              )}
            </>
          )}
        </div>

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

          {result && (
          <div style={{
            marginTop: '30px',
            backgroundColor: 'white',
            borderRadius: '20px',
            padding: '30px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
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
                <div style={{ fontSize: '1.5rem', margin: '0 auto 8px' }}>
                  {result.mode === 'transcribe' ? '📝' : '🌐'}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#333' }}>Done</div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>
                  {result.mode === 'transcribe' ? 'Transcribed' : 'Translated'}
                </div>
              </div>
            </div>

            <div style={{
              marginBottom: '20px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
                padding: '0 4px'
              }}>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#333',
                  margin: 0
                }}>
                  {result.mode === 'transcribe' ? 'Transcription' : 'Translation'} Output
                </h3>
                <button
                  onClick={copyToClipboard}
                  style={{
                    padding: '8px 12px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: copied ? '#10b981' : '#667eea',
                    backgroundColor: copied ? '#f0fdf4' : 'white',
                    border: `2px solid ${copied ? '#10b981' : '#667eea'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!copied) {
                      e.currentTarget.style.backgroundColor = '#f0f4ff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!copied) {
                      e.currentTarget.style.backgroundColor = 'white';
                    }
                  }}
                >
                  {copied ? (
                    <>
                      <CopyCheck size={18} />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={18} />
                      Copy
                    </>
                  )}
                </button>
              </div>

              {/* Search Bar */}
              <div style={{
                marginBottom: '10px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }}>
                <div style={{
                  position: 'relative',
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <Search size={18} style={{
                    position: 'absolute',
                    left: '12px',
                    color: '#9ca3af',
                    pointerEvents: 'none'
                  }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && matchIndices.length > 0) {
                        e.preventDefault();
                        goToNextMatch();
                      } else if (e.key === 'Enter' && e.shiftKey && matchIndices.length > 0) {
                        e.preventDefault();
                        goToPreviousMatch();
                      }
                    }}
                    placeholder="Search in transcript... (Enter: next, Shift+Enter: previous)"
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 40px',
                      fontSize: '0.9rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      outline: 'none',
                      transition: 'border 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                  />
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        padding: '4px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        color: '#9ca3af'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#667eea'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
                {searchQuery && matchIndices.length > 0 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '0 8px',
                    fontSize: '0.875rem',
                    color: '#666'
                  }}>
                    <span>
                      {currentMatchIndex + 1} / {matchIndices.length}
                    </span>
                    <button
                      onClick={goToPreviousMatch}
                      disabled={matchIndices.length === 0}
                      style={{
                        padding: '6px',
                        background: 'white',
                        border: '2px solid #e5e7eb',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        color: '#667eea',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f0f4ff';
                        e.currentTarget.style.borderColor = '#667eea';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }}
                    >
                      <ChevronUp size={18} />
                    </button>
                    <button
                      onClick={goToNextMatch}
                      disabled={matchIndices.length === 0}
                      style={{
                        padding: '6px',
                        background: 'white',
                        border: '2px solid #e5e7eb',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        color: '#667eea',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f0f4ff';
                        e.currentTarget.style.borderColor = '#667eea';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }}
                    >
                      <ChevronDown size={18} />
                    </button>
                  </div>
                )}
                {searchQuery && matchIndices.length === 0 && (
                  <div style={{
                    padding: '0 8px',
                    fontSize: '0.875rem',
                    color: '#ef4444'
                  }}>
                    No matches found
                  </div>
                )}
              </div>

              <div
                ref={textContainerRef}
                data-text-content
                style={{
                  padding: '20px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '10px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  lineHeight: '1.8',
                  color: '#333'
                }}
              >
                {searchQuery ? highlightText(result.text, searchQuery) : result.text}
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px'
            }}>
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
                  gap: '6px'
                }}
              >
                <FileText size={18} />
                TXT
              </button>

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
                  gap: '6px'
                }}
              >
                <File size={18} />
                PDF
              </button>

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
                  gap: '6px'
                }}
              >
                <Download size={18} />
                DOCX
              </button>
            </div>

            <SummarySection result={result} />
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
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .reset-icon {
          transition: transform 0.3s ease;
        }
        button:hover .reset-icon {
          transform: rotate(-180deg);
        }
        button:disabled .reset-icon {
          transform: none;
        }
      `}</style>
    </div>
  );
}