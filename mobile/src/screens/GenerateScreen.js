import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../config/api';
import { SUPPORTED_LANGUAGES } from '../utils/languages';
import { downloadTxt, downloadPdf, downloadDocx } from '../utils/fileExport';
import * as Clipboard from 'expo-clipboard';
import LanguageSelector from '../components/LanguageSelector';

const { width } = Dimensions.get('window');

export default function GenerateScreen() {
  const [videoUrl, setVideoUrl] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [backendConnected, setBackendConnected] = useState(null);
  const [checkingBackend, setCheckingBackend] = useState(true);
  const [paymentSessionId, setPaymentSessionId] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('free');
  const [activeMode, setActiveMode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    checkBackendHealth();
    const healthCheckInterval = setInterval(checkBackendHealth, 30000);
    return () => clearInterval(healthCheckInterval);
  }, []);

  useEffect(() => {
    setCopied(false);
    setSearchQuery('');
  }, [result]);

  const checkBackendHealth = async () => {
    setCheckingBackend(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      console.log('🔍 Checking backend health at:', `${API_URL}/health`);
      
      const response = await fetch(`${API_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      console.log('📡 Response status:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Backend connected:', data);
        setBackendConnected(data.status === 'ok');
      } else {
        const errorText = await response.text();
        console.error('❌ Backend health check failed:', response.status, errorText);
        setBackendConnected(false);
      }
    } catch (err) {
      console.error('❌ Backend connection error:', err);
      console.error('❌ Error name:', err.name);
      console.error('❌ Error message:', err.message);
      if (err.message) {
        console.error('❌ Full error:', JSON.stringify(err, null, 2));
      }
      setBackendConnected(false);
    } finally {
      setCheckingBackend(false);
    }
  };

  const extractVideoId = (url) => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=)([^&\n?#]+)/,
      /(?:youtu\.be\/)([^&\n?#]+)/,
      /(?:youtube\.com\/embed\/)([^&\n?#]+)/,
      /(?:youtube\.com\/shorts\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/,
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

    if (backendConnected === false) {
      setError('Backend server is not connected. Please ensure the backend is running and try again.');
      setProcessingPayment(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: videoUrl,
          targetLanguage: SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage)?.name,
          planId: selectedPlan,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create payment session');
      }

      const data = await response.json();
      
      if (data.isFree && data.sessionId) {
        setPaymentSessionId(data.sessionId);
        setProcessingPayment(false);
        setTimeout(() => {
          handleSubmit(data.sessionId);
        }, 500);
        return;
      }
      
      Alert.alert('Payment', 'Please complete payment in the browser');
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

    const sessionIdToUse = sessionIdOverride || paymentSessionId;
    const languageToUse = languageCodeOverride || targetLanguage;
    const mode = modeOverride || (languageToUse && languageToUse !== 'en' ? 'translate' : 'transcribe');
    setActiveMode(mode);
    
    const requestBody = {
      videoUrl: videoUrl,
      sessionId: sessionIdToUse,
    };
    
    if (mode === 'translate') {
      const languageName = SUPPORTED_LANGUAGES.find(l => l.code === languageToUse)?.name;
      if (languageName) {
        requestBody.targetLanguage = languageName;
      }
    }
    
    // Use XMLHttpRequest for SSE streaming in React Native
    const xhr = new XMLHttpRequest();
    let buffer = '';
    let hasCompleted = false;

    xhr.open('POST', `${API_URL}/transcript`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream');

    xhr.onprogress = () => {
      if (xhr.readyState === 3 || xhr.readyState === 4) {
        const newData = xhr.responseText.substring(buffer.length);
        buffer = xhr.responseText;
        
        const lines = newData.split('\n');
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
                  const resultMode = data.translated ? 'translate' : 'transcribe';
                  if (resultMode === 'transcribe') {
                    setResult({
                      text: data.transcript || data.original,
                      words: data.wordCount,
                      readingTime: data.readingTime,
                      videoId: data.videoId,
                      mode: 'transcribe',
                      method: data.transcriptionMethod,
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
                      method: data.transcriptionMethod,
                    });
                  }
                  setTimeout(() => setLoading(false), 500);
                }, 500);
              } else if (data.error) {
                hasCompleted = true;
                let errorMessage = data.error || 'Failed to process video';
                
                if (typeof errorMessage === 'string' && /^\d+\s*\{/.test(errorMessage.trim())) {
                  try {
                    const jsonMatch = errorMessage.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                      const parsed = JSON.parse(jsonMatch[0]);
                      if (parsed.error && parsed.error.message) {
                        const groqMessage = parsed.error.message;
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
                
                setError(errorMessage);
                
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
    };

    xhr.onload = () => {
      // Process any remaining data in the buffer before checking completion
      if (!hasCompleted && xhr.responseText) {
        const newData = xhr.responseText.substring(buffer.length);
        if (newData.trim()) {
          const lines = newData.split('\n');
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
                    const resultMode = data.translated ? 'translate' : 'transcribe';
                    if (resultMode === 'transcribe') {
                      setResult({
                        text: data.transcript || data.original,
                        words: data.wordCount,
                        readingTime: data.readingTime,
                        videoId: data.videoId,
                        mode: 'transcribe',
                        method: data.transcriptionMethod,
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
                        method: data.transcriptionMethod,
                      });
                    }
                    setTimeout(() => setLoading(false), 500);
                  }, 500);
                } else if (data.error) {
                  hasCompleted = true;
                  let errorMessage = data.error || 'Failed to process video';
                  
                  if (typeof errorMessage === 'string' && /^\d+\s*\{/.test(errorMessage.trim())) {
                    try {
                      const jsonMatch = errorMessage.match(/\{[\s\S]*\}/);
                      if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        if (parsed.error && parsed.error.message) {
                          const groqMessage = parsed.error.message;
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
                  
                  setError(errorMessage);
                  
                  if (data.requiresPayment) {
                    setPaymentSessionId(null);
                  }
                  
                  setLoading(false);
                  setProgress(0);
                }
              } catch (e) {
                console.error('Error parsing SSE data in onload:', e);
              }
            }
          }
        }
      }
      
      // Only show error if we still haven't completed after processing remaining data
      if (!hasCompleted) {
        console.error('Connection error: Stream closed unexpectedly');
        setError('Connection was interrupted. Please try again.');
        setLoading(false);
        setProgress(0);
      }
    };

    xhr.onerror = () => {
      console.error('Network error details:', xhr);
      setError('Unable to connect to the server. Please check your internet connection and ensure the backend is running.');
      setLoading(false);
      setProgress(0);
    };

    xhr.send(JSON.stringify(requestBody));
  };

  const copyToClipboard = async () => {
    if (!result || !result.text) return;
    
    try {
      await Clipboard.setStringAsync(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      Alert.alert('Error', 'Failed to copy text to clipboard');
    }
  };

  const handleDownload = async (format) => {
    if (!result || !result.text) return;

    const filename = `transcript_${result.videoId}.${format}`;
    
    try {
      if (format === 'txt') {
        await downloadTxt(result.text, filename);
      } else if (format === 'pdf') {
        await downloadPdf(result.text, filename, result.videoId);
      } else if (format === 'docx') {
        await downloadDocx(result.text, filename, result.videoId);
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download file');
    }
  };

  const highlightText = (text, query) => {
    if (!query.trim()) return text;

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => {
      const testRegex = new RegExp(`^${escapedQuery}$`, 'i');
      const isMatch = testRegex.test(part);
      
      if (isMatch) {
        return (
          <Text key={index} style={styles.highlightedText}>
            {part}
          </Text>
        );
      }
      return <Text key={index}>{part}</Text>;
    });
  };

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>🎥 Generate Transcript</Text>
            <Text style={styles.headerSubtitle}>
              Extract and translate YouTube captions instantly
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>YouTube URL</Text>
            <TextInput
              style={styles.input}
              value={videoUrl}
              onChangeText={setVideoUrl}
              placeholder="https://www.youtube.com/watch?v=..."
              placeholderTextColor="#999"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {!paymentSessionId ? (
              <>
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      styles.transcribeButton,
                      (loading || processingPayment || backendConnected === false || checkingBackend) && styles.buttonDisabled,
                    ]}
                    onPress={() => {
                      setShowLanguageSelector(false);
                      const planToUse = selectedPlan || 'free';
                      if (planToUse === 'free') {
                        handleSubmit(null, 'transcribe');
                      } else {
                        handlePayment();
                      }
                    }}
                    disabled={loading || processingPayment || backendConnected === false || checkingBackend}
                  >
                    {loading && activeMode === 'transcribe' ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <Ionicons name="document-text" size={20} color="white" />
                        <Text style={styles.buttonText}>Transcribe</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      styles.translateButton,
                      showLanguageSelector && styles.translateButtonActive,
                      (loading || processingPayment || backendConnected === false || checkingBackend) && styles.buttonDisabled,
                    ]}
                    onPress={() => setShowLanguageSelector(!showLanguageSelector)}
                    disabled={loading || processingPayment || backendConnected === false || checkingBackend}
                  >
                    {loading && activeMode === 'translate' ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <Ionicons name="language" size={20} color="white" />
                        <Text style={styles.buttonText}>Translate</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                <LanguageSelector
                  visible={showLanguageSelector}
                  onClose={() => setShowLanguageSelector(false)}
                  selectedLanguage={targetLanguage}
                  onSelectLanguage={(langCode) => {
                    setTargetLanguage(langCode);
                    const planToUse = selectedPlan || 'free';
                    if (planToUse === 'free') {
                      handleSubmit(null, 'translate', langCode);
                    } else {
                      handlePayment();
                    }
                  }}
                />

                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={() => {
                    setVideoUrl('');
                    setResult(null);
                    setError('');
                    setShowLanguageSelector(false);
                    setSearchQuery('');
                    setCopied(false);
                  }}
                  disabled={loading || processingPayment}
                >
                  <Ionicons name="refresh" size={18} color="#4b5563" />
                  <Text style={styles.resetButtonText}>Reset Form</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.transcribeButton]}
                    onPress={() => {
                      setShowLanguageSelector(false);
                      handleSubmit(null, 'transcribe');
                    }}
                    disabled={loading || backendConnected === false || checkingBackend}
                  >
                    {loading && activeMode === 'transcribe' ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <Ionicons name="document-text" size={20} color="white" />
                        <Text style={styles.buttonText}>Transcribe</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      styles.translateButton,
                      showLanguageSelector && styles.translateButtonActive,
                    ]}
                    onPress={() => setShowLanguageSelector(!showLanguageSelector)}
                    disabled={loading || backendConnected === false || checkingBackend}
                  >
                    {loading && activeMode === 'translate' ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <Ionicons name="language" size={20} color="white" />
                        <Text style={styles.buttonText}>Translate</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                <LanguageSelector
                  visible={showLanguageSelector}
                  onClose={() => setShowLanguageSelector(false)}
                  selectedLanguage={targetLanguage}
                  onSelectLanguage={(langCode) => {
                    setTargetLanguage(langCode);
                    handleSubmit(null, 'translate', langCode);
                  }}
                />
              </>
            )}

            {loading && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[styles.progressFill, { width: `${progress}%` }]}
                  />
                </View>
                <Text style={styles.progressText}>{progress}%</Text>
              </View>
            )}
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={24} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {result && (
            <View style={styles.resultCard}>
              <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                  <Ionicons name="document-text" size={24} color="#667eea" />
                  <Text style={styles.statValue}>{result.words}</Text>
                  <Text style={styles.statLabel}>Words</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="time" size={24} color="#667eea" />
                  <Text style={styles.statValue}>{result.readingTime} min</Text>
                  <Text style={styles.statLabel}>Reading Time</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statEmoji}>
                    {result.mode === 'transcribe' ? '📝' : '🌐'}
                  </Text>
                  <Text style={styles.statValue}>Done</Text>
                  <Text style={styles.statLabel}>
                    {result.mode === 'transcribe' ? 'Transcribed' : 'Translated'}
                  </Text>
                </View>
              </View>

              <View style={styles.resultHeader}>
                <Text style={styles.resultTitle}>
                  {result.mode === 'transcribe' ? 'Transcription' : 'Translation'} Output
                </Text>
                <TouchableOpacity
                  style={[styles.copyButton, copied && styles.copyButtonActive]}
                  onPress={copyToClipboard}
                >
                  <Ionicons
                    name={copied ? 'checkmark' : 'copy'}
                    size={18}
                    color={copied ? '#10b981' : '#667eea'}
                  />
                  <Text
                    style={[
                      styles.copyButtonText,
                      copied && styles.copyButtonTextActive,
                    ]}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.searchContainer}>
                <Ionicons
                  name="search"
                  size={18}
                  color="#9ca3af"
                  style={styles.searchIcon}
                />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search in transcript..."
                  placeholderTextColor="#9ca3af"
                />
                {searchQuery ? (
                  <TouchableOpacity
                    onPress={() => setSearchQuery('')}
                    style={styles.clearButton}
                  >
                    <Ionicons name="close" size={18} color="#9ca3af" />
                  </TouchableOpacity>
                ) : null}
              </View>

              <ScrollView
                style={styles.textContainer}
                nestedScrollEnabled={true}
              >
                <Text style={styles.resultText}>
                  {searchQuery ? highlightText(result.text, searchQuery) : result.text}
                </Text>
              </ScrollView>

              <View style={styles.downloadContainer}>
                <TouchableOpacity
                  style={[styles.downloadButton, styles.txtButton]}
                  onPress={() => handleDownload('txt')}
                >
                  <Ionicons name="document-text" size={18} color="white" />
                  <Text style={styles.downloadButtonText}>TXT</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.downloadButton, styles.pdfButton]}
                  onPress={() => handleDownload('pdf')}
                >
                  <Ionicons name="document" size={18} color="white" />
                  <Text style={styles.downloadButtonText}>PDF</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.downloadButton, styles.docxButton]}
                  onPress={() => handleDownload('docx')}
                >
                  <Ionicons name="download" size={18} color="white" />
                  <Text style={styles.downloadButtonText}>DOCX</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    width: '100%',
    padding: 12,
    fontSize: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    marginBottom: 16,
    color: '#333',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  transcribeButton: {
    backgroundColor: '#10b981',
  },
  translateButton: {
    backgroundColor: '#667eea',
  },
  translateButtonActive: {
    backgroundColor: '#764ba2',
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resetButton: {
    width: '100%',
    padding: 14,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
  },
  progressContainer: {
    marginTop: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#667eea',
    borderRadius: 4,
  },
  progressText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#fee2e2',
    borderWidth: 2,
    borderColor: '#ef4444',
    borderRadius: 10,
    marginBottom: 20,
  },
  errorText: {
    flex: 1,
    color: '#991b1b',
    fontSize: 14,
  },
  resultCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#667eea',
    backgroundColor: 'white',
  },
  copyButtonActive: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
  copyButtonTextActive: {
    color: '#10b981',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: 'white',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    padding: 10,
    fontSize: 14,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  textContainer: {
    maxHeight: 300,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    marginBottom: 16,
  },
  resultText: {
    fontSize: 14,
    lineHeight: 24,
    color: '#333',
  },
  highlightedText: {
    backgroundColor: '#fef08a',
    color: '#333',
  },
  downloadContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  downloadButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  txtButton: {
    backgroundColor: '#10b981',
  },
  pdfButton: {
    backgroundColor: '#f59e0b',
  },
  docxButton: {
    backgroundColor: '#3b82f6',
  },
  downloadButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

