import React, { useState } from 'react';
import { Clock, FileText, Copy, CopyCheck } from 'lucide-react';

export default function CaptionViewer({ captions, fullText }) {
  const [viewMode, setViewMode] = useState('captions'); // 'captions' or 'text'
  const [copied, setCopied] = useState(false);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!captions || captions.length === 0) {
    return null;
  }

  return (
    <div style={{
      width: '100%',
      maxWidth: '1200px',
      margin: '24px auto 0',
      backgroundColor: 'white',
      border: '2px solid #e5e7eb',
      borderRadius: '16px',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
      overflow: 'hidden'
    }}>
      {/* Header with Mode Toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 24px',
        borderBottom: '2px solid #e5e7eb',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Clock style={{ width: '24px', height: '24px', color: 'white' }} />
          <h3 style={{ 
            fontSize: '1.25rem', 
            fontWeight: '700', 
            color: 'white',
            margin: 0
          }}>
            Video Transcript
          </h3>
          <span style={{ 
            fontSize: '0.875rem', 
            color: 'rgba(255, 255, 255, 0.9)',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            padding: '4px 12px',
            borderRadius: '20px',
            fontWeight: '600'
          }}>
            {captions.length} segments
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* View Mode Toggle */}
          <div style={{
            display: 'flex',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '10px',
            padding: '4px'
          }}>
            <button
              onClick={() => setViewMode('captions')}
              style={{
                padding: '8px 16px',
                fontSize: '0.875rem',
                fontWeight: '600',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
                backgroundColor: viewMode === 'captions' ? 'white' : 'transparent',
                color: viewMode === 'captions' ? '#667eea' : 'white',
                boxShadow: viewMode === 'captions' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <Clock style={{ width: '16px', height: '16px' }} />
              Timestamps
            </button>
            <button
              onClick={() => setViewMode('text')}
              style={{
                padding: '8px 16px',
                fontSize: '0.875rem',
                fontWeight: '600',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
                backgroundColor: viewMode === 'text' ? 'white' : 'transparent',
                color: viewMode === 'text' ? '#667eea' : 'white',
                boxShadow: viewMode === 'text' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <FileText style={{ width: '16px', height: '16px' }} />
              Full Text
            </button>
          </div>

          {/* Copy Button */}
          <button
            onClick={() => handleCopy(viewMode === 'captions' 
              ? captions.map(c => `[${c.timestamp}] ${c.text}`).join('\n')
              : fullText
            )}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: copied ? '#10b981' : 'white',
              backgroundColor: copied ? 'white' : 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {copied ? (
              <>
                <CopyCheck style={{ width: '16px', height: '16px' }} />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy style={{ width: '16px', height: '16px' }} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{
        padding: '24px',
        maxHeight: '600px',
        overflowY: 'auto',
        backgroundColor: '#fafafa'
      }}>
        {viewMode === 'captions' ? (
          /* Captions with Timestamps */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {captions.map((caption, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  gap: '16px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  transition: 'all 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f4ff';
                  e.currentTarget.style.borderColor = '#667eea';
                  e.currentTarget.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.transform = 'translateX(0)';
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '6px 12px',
                    fontSize: '0.875rem',
                    fontFamily: 'monospace',
                    fontWeight: '600',
                    color: '#667eea',
                    backgroundColor: '#e0e7ff',
                    borderRadius: '8px'
                  }}>
                    {caption.timestamp}
                  </span>
                </div>
                <p style={{
                  flex: 1,
                  color: '#374151',
                  lineHeight: '1.6',
                  margin: 0,
                  fontSize: '1rem'
                }}>
                  {caption.text}
                </p>
              </div>
            ))}
          </div>
        ) : (
          /* Full Text */
          <div style={{
            padding: '20px',
            backgroundColor: 'white',
            borderRadius: '10px',
            border: '1px solid #e5e7eb'
          }}>
            <p style={{
              color: '#374151',
              lineHeight: '1.8',
              whiteSpace: 'pre-wrap',
              margin: 0,
              fontSize: '1rem'
            }}>
              {fullText}
            </p>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        backgroundColor: '#f9fafb',
        borderTop: '2px solid #e5e7eb',
        fontSize: '0.875rem',
        color: '#6b7280'
      }}>
        <div style={{ display: 'flex', gap: '20px' }}>
          <span style={{ fontWeight: '600' }}>📊 {captions.length} segments</span>
          <span style={{ fontWeight: '600' }}>📄 {fullText?.length || 0} characters</span>
          <span style={{ fontWeight: '600' }}>📝 {fullText?.split(/\s+/).length || 0} words</span>
        </div>
        <div style={{
          color: '#10b981',
          fontWeight: '700',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span>✨</span>
          <span>Instant & Free</span>
        </div>
      </div>
    </div>
  );
}
