import React from 'react';
import { FileText, Globe, Download, Zap, CheckCircle, Video } from 'lucide-react';

export default function HomePage() {
  const features = [
    {
      icon: <Video size={32} />,
      title: 'Extract Transcripts',
      description: 'Get accurate transcripts from any YouTube video instantly'
    },
    {
      icon: <Globe size={32} />,
      title: 'Multi-Language Support',
      description: 'Translate to 8 languages: English, Spanish, French, Arabic, Hindi, Chinese, Urdu'
    },
    {
      icon: <Zap size={32} />,
      title: 'AI-Powered',
      description: 'Uses advanced AI for transcription and translation with high accuracy'
    },
    {
      icon: <Download size={32} />,
      title: 'Multiple Formats',
      description: 'Export your transcripts as TXT, PDF, or DOCX files'
    },
    {
      icon: <FileText size={32} />,
      title: 'Smart Processing',
      description: 'Automatically detects captions or uses AI transcription when needed'
    },
    {
      icon: <CheckCircle size={32} />,
      title: 'Fast & Reliable',
      description: 'Get results in seconds with our optimized processing pipeline'
    }
  ];

  const howItWorks = [
    {
      step: '1',
      title: 'Enter YouTube URL',
      description: 'Paste any YouTube video URL you want to transcribe'
    },
    {
      step: '2',
      title: 'Choose Language',
      description: 'Select your target language for translation'
    },
    {
      step: '3',
      title: 'Get Transcript',
      description: 'Receive your translated transcript in seconds'
    },
    {
      step: '4',
      title: 'Download',
      description: 'Export in your preferred format (TXT, PDF, DOCX)'
    }
  ];

  return (
    <div style={{ padding: '20px 0' }}>
      {/* Hero Section */}
      <div style={{
        textAlign: 'center',
        color: 'white',
        marginBottom: '60px'
      }}>
        <h1 style={{
          fontSize: '3rem',
          fontWeight: 'bold',
          marginBottom: '20px',
          textShadow: '2px 2px 4px rgba(0,0,0,0.2)'
        }}>
          🎥 YouTube Transcript Generator
        </h1>
        <p style={{
          fontSize: '1.3rem',
          opacity: 0.95,
          marginBottom: '30px',
          maxWidth: '600px',
          margin: '0 auto 30px'
        }}>
          Transform YouTube videos into readable transcripts and translate them to your preferred language
        </p>
        <div style={{
          display: 'inline-flex',
          gap: '12px',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          <div style={{
            padding: '8px 16px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: '20px',
            fontSize: '0.9rem',
            backdropFilter: 'blur(10px)'
          }}>
            ⚡ Fast Processing
          </div>
          <div style={{
            padding: '8px 16px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: '20px',
            fontSize: '0.9rem',
            backdropFilter: 'blur(10px)'
          }}>
            🌐 8 Languages
          </div>
          <div style={{
            padding: '8px 16px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: '20px',
            fontSize: '0.9rem',
            backdropFilter: 'blur(10px)'
          }}>
            📄 Multiple Formats
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '20px',
        padding: '40px',
        marginBottom: '40px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <h2 style={{
          textAlign: 'center',
          fontSize: '2rem',
          fontWeight: 'bold',
          marginBottom: '40px',
          color: '#333'
        }}>
          Key Features
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px'
        }}>
          {features.map((feature, index) => (
            <div
              key={index}
              style={{
                padding: '24px',
                borderRadius: '12px',
                backgroundColor: '#f9fafb',
                border: '2px solid #e5e7eb',
                transition: 'all 0.3s',
                textAlign: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#667eea';
                e.currentTarget.style.backgroundColor = '#f0f4ff';
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb';
                e.currentTarget.style.backgroundColor = '#f9fafb';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{
                color: '#667eea',
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'center'
              }}>
                {feature.icon}
              </div>
              <h3 style={{
                fontSize: '1.2rem',
                fontWeight: '600',
                marginBottom: '8px',
                color: '#333'
              }}>
                {feature.title}
              </h3>
              <p style={{
                fontSize: '0.9rem',
                color: '#666',
                lineHeight: '1.6'
              }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '20px',
        padding: '40px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <h2 style={{
          textAlign: 'center',
          fontSize: '2rem',
          fontWeight: 'bold',
          marginBottom: '40px',
          color: '#333'
        }}>
          How It Works
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '24px'
        }}>
          {howItWorks.map((item, index) => (
            <div
              key={index}
              style={{
                textAlign: 'center',
                padding: '20px'
              }}
            >
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: '#667eea',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                fontWeight: 'bold',
                margin: '0 auto 16px',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
              }}>
                {item.step}
              </div>
              <h3 style={{
                fontSize: '1.1rem',
                fontWeight: '600',
                marginBottom: '8px',
                color: '#333'
              }}>
                {item.title}
              </h3>
              <p style={{
                fontSize: '0.9rem',
                color: '#666',
                lineHeight: '1.6'
              }}>
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

