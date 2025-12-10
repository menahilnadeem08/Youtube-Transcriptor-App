import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Loader2, AlertCircle, Bot, User, Sparkles } from 'lucide-react';

export default function ChatSection({ result }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Initialize RAG system when result is available
  useEffect(() => {
    if (result && result.videoId && result.text && !isInitialized) {
      initializeRAG();
    }
  }, [result]);

  // Reset chat when result changes
  useEffect(() => {
    setMessages([]);
    setIsInitialized(false);
    setError('');
    setInputValue('');
  }, [result]);

  const initializeRAG = async () => {
    if (!result || !result.videoId || !result.text) {
      setError('No transcript available for chat');
      return;
    }

    setIsInitializing(true);
    setError('');

    try {
      const API_URL = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${API_URL}/chat/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: result.videoId,
          transcriptText: result.text
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to initialize chat');
      }

      const data = await response.json();
      
      if (data.success) {
        setIsInitialized(true);
        // Add welcome message
        setMessages([{
          id: Date.now(),
          role: 'assistant',
          content: `Hello! I'm ready to answer questions about this video transcript. What would you like to know?`,
          timestamp: new Date()
        }]);
      } else {
        throw new Error('Failed to initialize chat system');
      }
    } catch (err) {
      console.error('RAG initialization error:', err);
      
      // Provide more specific error messages
      let errorMessage = err.message || 'Failed to initialize chat. Please try again.';
      
      // Check for common error patterns
      if (errorMessage.includes('ChromaDB') || errorMessage.includes('connection') || errorMessage.includes('server is not running')) {
        errorMessage = 'ChromaDB server is not running. Please start it with: docker run -d -p 8000:8000 chromadb/chroma';
      } else if (errorMessage.includes('API key') || errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        errorMessage = 'API key error. Please check your OPENAI_API_KEY in the backend .env file.';
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        errorMessage = 'API rate limit exceeded. Please wait a moment and try again.';
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and ensure the backend server is running.';
      } else if (errorMessage.includes('empty') || errorMessage.includes('No transcript')) {
        errorMessage = 'No transcript available. Please generate a transcript first.';
      }
      
      setError(errorMessage);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputValue.trim() || isLoading || !isInitialized) {
      return;
    }

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError('');

    try {
      const API_URL = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${API_URL}/chat/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: result.videoId,
          question: userMessage.content
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get answer');
      }

      const data = await response.json();
      
      if (data.success && data.answer) {
        const assistantMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: data.answer,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Chat query error:', err);
      setError(err.message || 'Failed to get answer. Please try again.');
      
      // Add error message to chat
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err.message}`,
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  return (
    <div style={{
      marginTop: '30px',
      paddingTop: '30px',
      borderTop: '2px solid #e5e7eb'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: '700',
          color: '#333',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <MessageCircle size={24} style={{ color: '#667eea' }} />
          Chat with Transcript
        </h3>
        {!isInitialized && !isInitializing && result && (
          <button
            onClick={initializeRAG}
            style={{
              padding: '8px 16px',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: 'white',
              backgroundColor: '#667eea',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5568d3'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#667eea'}
          >
            <Sparkles size={16} />
            Initialize Chat
          </button>
        )}
      </div>

      {isInitializing && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f9fafb',
          borderRadius: '10px'
        }}>
          <Loader2 size={40} style={{ 
            animation: 'spin 1s linear infinite',
            color: '#667eea',
            margin: '0 auto 16px'
          }} />
          <p style={{ fontSize: '1rem', color: '#666', margin: 0 }}>
            Initializing RAG system... This may take a moment for long videos.
          </p>
        </div>
      )}

      {error && !isInitializing && (
        <div style={{
          padding: '16px',
          backgroundColor: '#fee2e2',
          border: '2px solid #ef4444',
          borderRadius: '10px',
          color: '#991b1b',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '16px'
        }}>
          <AlertCircle size={24} />
          <span>{error}</span>
        </div>
      )}

      {isInitialized && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '10px',
          border: '2px solid #e5e7eb',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '500px'
        }}>
          {/* Messages Container */}
          <div
            ref={chatContainerRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              backgroundColor: '#f9fafb'
            }}
          >
            {messages.length === 0 && (
              <div style={{
                textAlign: 'center',
                color: '#666',
                padding: '40px 20px'
              }}>
                <MessageCircle size={48} style={{ 
                  margin: '0 auto 16px',
                  color: '#9ca3af',
                  opacity: 0.5
                }} />
                <p style={{ margin: 0, fontSize: '0.95rem' }}>
                  Start a conversation by asking a question about the video transcript
                </p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  flexDirection: message.role === 'user' ? 'row-reverse' : 'row'
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  backgroundColor: message.role === 'user' ? '#667eea' : '#10b981',
                  color: 'white'
                }}>
                  {message.role === 'user' ? (
                    <User size={20} />
                  ) : (
                    <Bot size={20} />
                  )}
                </div>

                {/* Message Content */}
                <div style={{
                  maxWidth: '70%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  backgroundColor: message.role === 'user' ? '#667eea' : 'white',
                  color: message.role === 'user' ? 'white' : '#333',
                  border: message.role === 'assistant' ? '1px solid #e5e7eb' : 'none',
                  boxShadow: message.role === 'assistant' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word'
                }}>
                  {message.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  backgroundColor: '#10b981',
                  color: 'white'
                }}>
                  <Bot size={20} />
                </div>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Loader2 size={16} style={{ 
                    animation: 'spin 1s linear infinite',
                    color: '#667eea'
                  }} />
                  <span style={{ color: '#666', fontSize: '0.9rem' }}>Thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form
            onSubmit={handleSendMessage}
            style={{
              borderTop: '2px solid #e5e7eb',
              padding: '16px',
              backgroundColor: 'white',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-end'
            }}
          >
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about the video transcript..."
              disabled={isLoading || !isInitialized}
              style={{
                flex: 1,
                padding: '12px 16px',
                fontSize: '0.95rem',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                outline: 'none',
                resize: 'none',
                minHeight: '50px',
                maxHeight: '120px',
                fontFamily: 'inherit',
                lineHeight: '1.5',
                transition: 'border 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading || !isInitialized}
              style={{
                padding: '12px 20px',
                fontSize: '1rem',
                fontWeight: '600',
                color: 'white',
                backgroundColor: (!inputValue.trim() || isLoading || !isInitialized) 
                  ? '#9ca3af' 
                  : '#667eea',
                border: 'none',
                borderRadius: '10px',
                cursor: (!inputValue.trim() || isLoading || !isInitialized) 
                  ? 'not-allowed' 
                  : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                if (!(!inputValue.trim() || isLoading || !isInitialized)) {
                  e.currentTarget.style.backgroundColor = '#5568d3';
                }
              }}
              onMouseLeave={(e) => {
                if (!(!inputValue.trim() || isLoading || !isInitialized)) {
                  e.currentTarget.style.backgroundColor = '#667eea';
                }
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={20} />
                  Send
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {!isInitialized && !isInitializing && result && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f0f4ff',
          borderRadius: '10px',
          border: '2px dashed #667eea'
        }}>
          <MessageCircle size={48} style={{ 
            margin: '0 auto 16px',
            color: '#667eea',
            opacity: 0.7
          }} />
          <p style={{ 
            margin: '0 0 20px 0', 
            fontSize: '1rem',
            color: '#333'
          }}>
            Click "Initialize Chat" to start asking questions about this video transcript
          </p>
          <p style={{ 
            margin: 0, 
            fontSize: '0.875rem',
            color: '#666'
          }}>
            The RAG system will process the transcript and enable intelligent Q&A
          </p>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

