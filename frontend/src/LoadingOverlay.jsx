import React, { useState, useEffect } from 'react';

const LoadingOverlay = ({ isVisible, progress = 0 }) => {
  const [animationFrame, setAnimationFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationFrame(prev => (prev + 1) % 4);
    }, 300);
    return () => clearInterval(interval);
  }, []);

  const steps = [
    { name: 'Downloading', icon: '📥', color: '#3b82f6' },
    { name: 'Processing', icon: '⚙️', color: '#8b5cf6' },
    { name: 'Transcribing', icon: '🎤', color: '#ec4899' },
    { name: 'Translating', icon: '🌐', color: '#f59e0b' }
  ];

  const currentStep = Math.floor((progress / 25)) % steps.length;

  return (
    <>
      {isVisible && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.3s ease-in'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '30px',
            padding: '60px 40px',
            textAlign: 'center',
            boxShadow: '0 30px 80px rgba(0, 0, 0, 0.4)',
            maxWidth: '500px',
            width: '90%',
            animation: 'slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}>
            {/* Animated Cartoon Character */}
            <div style={{
              fontSize: '100px',
              marginBottom: '30px',
              animation: `bounceCharacter 1s ease-in-out infinite`,
              transformOrigin: 'center bottom'
            }}>
              🤖
            </div>

            {/* Main Loading Spinner */}
            <div style={{
              position: 'relative',
              width: '120px',
              height: '120px',
              margin: '0 auto 30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* Rotating outer circle */}
              <div style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: '6px solid transparent',
                borderTopColor: '#667eea',
                borderRightColor: '#764ba2',
                animation: 'spin 2s linear infinite',
                opacity: 0.8
              }} />

              {/* Middle pulsing circle */}
              <div style={{
                position: 'absolute',
                width: '85%',
                height: '85%',
                borderRadius: '50%',
                border: '4px solid transparent',
                borderTopColor: '#8b5cf6',
                borderLeftColor: '#ec4899',
                animation: 'spinReverse 3s linear infinite',
                opacity: 0.6
              }} />

              {/* Center percentage */}
              <div style={{
                position: 'relative',
                zIndex: 10,
                fontSize: '2.5rem',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                {Math.min(progress, 100).toFixed(2)}%
              </div>
            </div>

            {/* Progress Text */}
            <div style={{
              fontSize: '1.3rem',
              fontWeight: '700',
              color: '#333',
              marginBottom: '10px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '1.8rem' }}>
                {steps[currentStep].icon}
              </span>
              {steps[currentStep].name}
            </div>

            {/* Status Messages */}
            <div style={{
              fontSize: '0.95rem',
              color: '#666',
              marginBottom: '20px',
              height: '20px',
              minHeight: '20px',
              animation: 'fadeInOut 2s ease-in-out infinite'
            }}>
              {progress < 25 && 'Fetching your video...'}
              {progress >= 25 && progress < 50 && 'Extracting audio...'}
              {progress >= 50 && progress < 75 && 'Converting speech to text...'}
              {progress >= 75 && progress < 100 && 'Translating content...'}
              {progress >= 100 && 'Almost done!'}
            </div>

            {/* Progress Bar */}
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#e5e7eb',
              borderRadius: '10px',
              overflow: 'hidden',
              marginBottom: '20px'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(progress, 100)}%`,
                background: 'linear-gradient(90deg, #667eea 0%, #764ba2 50%, #ec4899 100%)',
                borderRadius: '10px',
                transition: 'width 0.5s ease-out',
                boxShadow: '0 0 10px rgba(102, 126, 234, 0.6)'
              }} />
            </div>

            {/* Step Indicators */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-around',
              gap: '10px',
              marginBottom: '20px'
            }}>
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: idx <= currentStep ? step.color : '#f3f4f6',
                    color: idx <= currentStep ? 'white' : '#999',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    transition: 'all 0.3s ease',
                    transform: idx === currentStep ? 'scale(1.05)' : 'scale(1)',
                    boxShadow: idx === currentStep ? `0 0 15px ${step.color}40` : 'none'
                  }}
                >
                  {step.icon}
                </div>
              ))}
            </div>

            {/* Tips */}
            <div style={{
              fontSize: '0.85rem',
              color: '#999',
              fontStyle: 'italic',
              marginTop: '20px',
              padding: '15px',
              backgroundColor: '#f9fafb',
              borderRadius: '12px',
              lineHeight: '1.5'
            }}>
              💡 Tip: Longer videos take more time. You can close this tab while we process!
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes spinReverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        @keyframes bounceCharacter {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }

        @keyframes fadeInOut {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
};

export default LoadingOverlay;

