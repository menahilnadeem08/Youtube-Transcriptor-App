import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, AlertCircle, Copy, CopyCheck, RotateCcw, FileText, File, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph } from 'docx';

export default function SummarySection({ result }) {
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryLength, setSummaryLength] = useState('medium');
  const [summaryError, setSummaryError] = useState('');
  const [copiedSummary, setCopiedSummary] = useState(false);

  const generateSummary = async (length = 'medium') => {
    if (!result || !result.text) {
      setSummaryError('No transcript available to summarize');
      return;
    }

    setSummaryLoading(true);
    setSummaryError('');
    setSummary(null);
    setSummaryLength(length);

    try {
      const API_URL = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${API_URL}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: result.text,
          summaryLength: length
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate summary');
      }

      const data = await response.json();
      
      if (data.success && data.summary) {
        setSummary({
          text: data.summary,
          wordCount: data.wordCount,
          readingTime: data.readingTime,
          compressionRatio: data.compressionRatio,
          length: length
        });
      } else {
        throw new Error('Invalid summary response');
      }
    } catch (err) {
      console.error('Summary generation error:', err);
      setSummaryError(err.message || 'Failed to generate summary. Please try again.');
    } finally {
      setSummaryLoading(false);
    }
  };

  const copyToClipboardSummary = async () => {
    if (!summary || !summary.text) return;
    
    try {
      await navigator.clipboard.writeText(summary.text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch (err) {
      console.error('Failed to copy summary:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = summary.text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedSummary(true);
        setTimeout(() => setCopiedSummary(false), 2000);
      } catch (e) {
        console.error('Fallback copy failed:', e);
      }
      document.body.removeChild(textArea);
    }
  };

  const downloadSummaryTxt = () => {
    if (!summary || !summary.text) return;
    const element = document.createElement('a');
    const file = new Blob([summary.text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `summary_${result.videoId}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const downloadSummaryPdf = () => {
    if (!summary || !summary.text) return;
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
    pdf.text('Video Summary', margin, margin);

    pdf.setFontSize(10);
    pdf.text(`Video ID: ${result.videoId}`, margin, margin + 10);
    pdf.text(`Summary Length: ${summary.length}`, margin, margin + 16);
    pdf.text(`Word Count: ${summary.wordCount} | Reading Time: ${summary.readingTime} min`, margin, margin + 22);
    pdf.text(`Compression: ${summary.compressionRatio}`, margin, margin + 28);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, margin + 34);

    pdf.setFontSize(11);
    const splitText = pdf.splitTextToSize(summary.text, maxWidth);
    
    let yPosition = margin + 46;
    splitText.forEach((line) => {
      if (yPosition > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.text(line, margin, yPosition);
      yPosition += 5;
    });

    pdf.save(`summary_${result.videoId}.pdf`);
  };

  const downloadSummaryWord = async () => {
    if (!summary || !summary.text) return;
    const sections = [];

    sections.push(
      new Paragraph({
        text: 'Video Summary',
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
        text: `Summary Length: ${summary.length}`,
        spacing: { after: 100 }
      }),
      new Paragraph({
        text: `Word Count: ${summary.wordCount} | Reading Time: ${summary.readingTime} min`,
        spacing: { after: 100 }
      }),
      new Paragraph({
        text: `Compression: ${summary.compressionRatio}`,
        spacing: { after: 100 }
      }),
      new Paragraph({
        text: `Generated: ${new Date().toLocaleString()}`,
        spacing: { after: 300 }
      })
    );

    sections.push(
      new Paragraph({
        text: summary.text,
        spacing: { line: 360 }
      })
    );

    const doc = new Document({ sections: [{ children: sections }] });
    const blob = await Packer.toBlob(doc);
    
    const element = document.createElement('a');
    element.href = URL.createObjectURL(blob);
    element.download = `summary_${result.videoId}.docx`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleNewSummary = () => {
    setSummary(null);
    setSummaryError('');
  };

  // Reset summary when result changes
  useEffect(() => {
    setSummary(null);
    setSummaryError('');
    setCopiedSummary(false);
  }, [result]);

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
          <Sparkles size={24} style={{ color: '#f59e0b' }} />
          AI Summary
        </h3>
      </div>

      {!summary && !summaryLoading && (
        <div>
          <p style={{
            fontSize: '0.95rem',
            color: '#666',
            marginBottom: '16px'
          }}>
            Generate an AI-powered summary of the transcript in your preferred length
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px'
          }}>
            <button
              onClick={() => generateSummary('short')}
              disabled={summaryLoading}
              style={{
                padding: '14px',
                fontSize: '0.9rem',
                fontWeight: '600',
                color: 'white',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <Sparkles size={20} />
              <span>Short</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>~100-150 words</span>
            </button>

            <button
              onClick={() => generateSummary('medium')}
              disabled={summaryLoading}
              style={{
                padding: '14px',
                fontSize: '0.9rem',
                fontWeight: '600',
                color: 'white',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <Sparkles size={20} />
              <span>Medium</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>~200-300 words</span>
            </button>

            <button
              onClick={() => generateSummary('long')}
              disabled={summaryLoading}
              style={{
                padding: '14px',
                fontSize: '0.9rem',
                fontWeight: '600',
                color: 'white',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <Sparkles size={20} />
              <span>Long</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>~400-500 words</span>
            </button>
          </div>
        </div>
      )}

      {summaryLoading && (
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
            Generating AI summary...
          </p>
        </div>
      )}

      {summaryError && (
        <div style={{
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
          <span>{summaryError}</span>
        </div>
      )}

      {summary && (
        <div>
          {/* Summary Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
            marginBottom: '20px'
          }}>
            <div style={{
              padding: '12px',
              backgroundColor: '#fef3c7',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#92400e' }}>
                {summary.wordCount}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#78350f' }}>Words</div>
            </div>
            <div style={{
              padding: '12px',
              backgroundColor: '#dbeafe',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e40af' }}>
                {summary.readingTime} min
              </div>
              <div style={{ fontSize: '0.75rem', color: '#1e3a8a' }}>Reading</div>
            </div>
            <div style={{
              padding: '12px',
              backgroundColor: '#d1fae5',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#065f46' }}>
                {summary.compressionRatio}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#064e3b' }}>Compressed</div>
            </div>
            <div style={{
              padding: '12px',
              backgroundColor: '#e0e7ff',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#4338ca', textTransform: 'capitalize' }}>
                {summary.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#3730a3' }}>Length</div>
            </div>
          </div>

          {/* Summary Text */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
              padding: '0 4px'
            }}>
              <h4 style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: '#333',
                margin: 0
              }}>
                Summary Content
              </h4>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={copyToClipboardSummary}
                  style={{
                    padding: '8px 12px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: copiedSummary ? '#10b981' : '#667eea',
                    backgroundColor: copiedSummary ? '#f0fdf4' : 'white',
                    border: `2px solid ${copiedSummary ? '#10b981' : '#667eea'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!copiedSummary) {
                      e.currentTarget.style.backgroundColor = '#f0f4ff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!copiedSummary) {
                      e.currentTarget.style.backgroundColor = 'white';
                    }
                  }}
                >
                  {copiedSummary ? (
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
                <button
                  onClick={handleNewSummary}
                  style={{
                    padding: '8px 12px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#ef4444',
                    backgroundColor: 'white',
                    border: '2px solid #ef4444',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#fef2f2';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  <RotateCcw size={18} />
                  New Summary
                </button>
              </div>
            </div>

            <div style={{
              padding: '20px',
              backgroundColor: '#fffbeb',
              borderRadius: '10px',
              maxHeight: '400px',
              overflowY: 'auto',
              lineHeight: '1.8',
              color: '#333',
              border: '2px solid #fbbf24',
              whiteSpace: 'pre-wrap'
            }}>
              {summary.text}
            </div>
          </div>

          {/* Download Buttons */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px'
          }}>
            <button
              onClick={downloadSummaryTxt}
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
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <FileText size={18} />
              TXT
            </button>

            <button
              onClick={downloadSummaryPdf}
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
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <File size={18} />
              PDF
            </button>

            <button
              onClick={downloadSummaryWord}
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
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <Download size={18} />
              DOCX
            </button>
          </div>
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

