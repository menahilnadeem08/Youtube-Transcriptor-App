// Error handling utilities for user-friendly error messages
// Maps technical errors to user-friendly messages while logging detailed information

/**
 * Maps technical errors to user-friendly messages
 * Logs detailed error information to console for debugging
 * @param {Error} error - The error object
 * @returns {Object} Object with userMessage and technicalMessage
 */
export function getUserFriendlyError(error) {
  // Extract error message from various error formats
  let errorMessage = error.message || error.toString();
  let errorStack = error.stack || '';
  
  // FIRST: Handle status code + JSON in error message (e.g., "429 {...}")
  // This is the format Groq SDK sometimes uses - parse this FIRST before anything else
  if (typeof errorMessage === 'string') {
    const trimmed = errorMessage.trim();
    
    // Check for pattern like "429 {...}" or "429{...}"
    if (/^\d+\s*\{/.test(trimmed)) {
      const statusMatch = trimmed.match(/^(\d+)/);
      if (statusMatch) {
        const statusCodeNum = parseInt(statusMatch[1]);
        if (!error.statusCode && !error.status) {
          error.statusCode = statusCodeNum;
          error.status = statusCodeNum;
        }
      }
      
      // Extract and parse JSON part - use non-greedy match to get the full JSON object
      const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.error && parsed.error.message) {
            errorMessage = parsed.error.message;
            // Preserve the error object for later checks
            if (!error.error) {
              error.error = parsed.error;
            }
            // Set status code from parsed error if available
            if (parsed.error.code === 'rate_limit_exceeded' && !error.statusCode) {
              error.statusCode = 429;
              error.status = 429;
            }
          } else if (parsed.message) {
            errorMessage = parsed.message;
          }
        } catch (e) {
          // Keep original message if parsing fails
          console.error('[ERROR_HANDLER] Failed to parse JSON from error message:', e.message);
        }
      }
    }
  }
  
  // Handle Groq API errors - they have nested error structure
  // Groq errors can be in format: { error: { message: "...", code: "...", type: "..." } }
  if (error.error && typeof error.error === 'object') {
    if (error.error.message) {
      errorMessage = error.error.message;
    }
    if (error.error.code && !errorMessage.includes(error.error.code)) {
      // Don't prepend code if message already contains it
      if (!errorMessage.toLowerCase().includes(error.error.code.toLowerCase())) {
        errorMessage = `${error.error.code}: ${errorMessage}`;
      }
    }
  }
  
  // Handle stringified JSON errors (sometimes errors come as JSON strings)
  if (typeof errorMessage === 'string' && errorMessage.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(errorMessage);
      if (parsed.error && parsed.error.message) {
        errorMessage = parsed.error.message;
        if (!error.error) {
          error.error = parsed.error;
        }
      } else if (parsed.message) {
        errorMessage = parsed.message;
      }
    } catch (e) {
      // Not JSON, continue with original message
    }
  }
  
  // Handle HTTP response errors
  if (error.response) {
    if (error.response.data) {
      if (error.response.data.error && error.response.data.error.message) {
        errorMessage = error.response.data.error.message;
        if (!error.error) {
          error.error = error.response.data.error;
        }
      } else if (typeof error.response.data === 'string') {
        // Try to parse if it's JSON string
        try {
          const parsed = JSON.parse(error.response.data);
          if (parsed.error && parsed.error.message) {
            errorMessage = parsed.error.message;
            if (!error.error) {
              error.error = parsed.error;
            }
          }
        } catch (e) {
          errorMessage = error.response.data;
        }
      } else if (error.response.data.message) {
        errorMessage = error.response.data.message;
      }
    }
  }
  
  // Also check originalError if it exists (from translateWithGroq wrapper)
  if (error.originalError) {
    const origError = error.originalError;
    
    // Check if original error message has the format "429 {...}"
    if (typeof origError.message === 'string' && /^\d+\s*\{/.test(origError.message.trim())) {
      const jsonMatch = origError.message.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.error && parsed.error.message) {
            errorMessage = parsed.error.message;
            if (!error.error) {
              error.error = parsed.error;
            }
          }
        } catch (e) {
          // Keep current errorMessage
        }
      }
    }
    
    if (origError.error && typeof origError.error === 'object' && origError.error.message) {
      errorMessage = origError.error.message;
      if (!error.error) {
        error.error = origError.error;
      }
    }
    if (origError.response?.data?.error?.message) {
      errorMessage = origError.response.data.error.message;
      if (!error.error) {
        error.error = origError.response.data.error;
      }
    }
  }
  
  // Log detailed error information for debugging
  console.error('='.repeat(80));
  console.error('❌ ERROR DETAILS:');
  console.error('='.repeat(80));
  console.error('Error Message:', errorMessage);
  console.error('Error Type:', error.constructor.name);
  console.error('Error Stack:', errorStack);
  if (error.response) {
    console.error('API Response Status:', error.response.status);
    console.error('API Response Data:', JSON.stringify(error.response.data, null, 2));
  }
  if (error.status) {
    console.error('HTTP Status:', error.status);
  }
  if (error.statusCode) {
    console.error('HTTP Status Code:', error.statusCode);
  }
  if (error.code) {
    console.error('Error Code:', error.code);
  }
  if (error.error && typeof error.error === 'object') {
    console.error('Nested Error Object:', JSON.stringify(error.error, null, 2));
  }
  console.error('Full Error Object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
  console.error('Timestamp:', new Date().toISOString());
  console.error('='.repeat(80));
  
  // Map technical errors to user-friendly messages
  const lowerError = errorMessage.toLowerCase();
  
  // YouTube/Video related errors
  if (lowerError.includes('invalid youtube url') || lowerError.includes('invalid url')) {
    return {
      userMessage: 'Please enter a valid YouTube video URL',
      technicalMessage: errorMessage
    };
  }
  
  if (lowerError.includes('private') || lowerError.includes('sign in to confirm')) {
    return {
      userMessage: 'This video is private or requires sign-in. Please use a public video.',
      technicalMessage: errorMessage
    };
  }
  
  if (lowerError.includes('unavailable') || lowerError.includes('removed') || lowerError.includes('deleted')) {
    return {
      userMessage: 'This video is unavailable or has been removed. Please try a different video.',
      technicalMessage: errorMessage
    };
  }
  
  if (lowerError.includes('age-restricted')) {
    return {
      userMessage: 'This video is age-restricted and cannot be processed. Please try a different video.',
      technicalMessage: errorMessage
    };
  }
  
  if (lowerError.includes('rate limit') || lowerError.includes('429')) {
    return {
      userMessage: 'Too many requests. Please wait a moment and try again.',
      technicalMessage: errorMessage
    };
  }
  
  if (lowerError.includes('could not download') || lowerError.includes('download failed')) {
    return {
      userMessage: 'Unable to download video. The video might be unavailable or restricted.',
      technicalMessage: errorMessage
    };
  }
  
  // OpenAI/Whisper related errors
  if (lowerError.includes('openai') || lowerError.includes('whisper')) {
    if (lowerError.includes('connection') || lowerError.includes('econnrefused') || lowerError.includes('timeout')) {
      return {
        userMessage: 'Unable to connect to transcription service. Please check your internet connection and try again.',
        technicalMessage: errorMessage
      };
    }
    
    if (lowerError.includes('401') || lowerError.includes('unauthorized') || lowerError.includes('api key')) {
      return {
        userMessage: 'Transcription service authentication failed. Please contact support.',
        technicalMessage: errorMessage
      };
    }
    
    if (lowerError.includes('429') || lowerError.includes('rate limit')) {
      return {
        userMessage: 'Transcription service is busy. Please try again in a few moments.',
        technicalMessage: errorMessage
      };
    }
    
    if (lowerError.includes('too large') || lowerError.includes('25mb')) {
      return {
        userMessage: 'This video is too long to process. Please try a shorter video (under 25 minutes).',
        technicalMessage: errorMessage
      };
    }
    
    if (lowerError.includes('empty text') || lowerError.includes('no transcript')) {
      return {
        userMessage: 'No transcript could be generated from this video. The video might not have audio or captions.',
        technicalMessage: errorMessage
      };
    }
  }
  
  // Groq/Translation related errors - Check for rate limit errors FIRST
  // Groq API returns 429 with nested error structure
  // Check status codes first
  const statusCode = error.statusCode || error.status || error.response?.status;
  const isRateLimitByStatus = statusCode === 429;
  
  // Check error message/content for rate limit indicators
  const isRateLimitByMessage = lowerError.includes('rate limit') || 
                                lowerError.includes('rate_limit_exceeded') ||
                                lowerError.includes('rate limit reached') ||
                                (error.error && (error.error.code === 'rate_limit_exceeded' || error.error.type === 'tokens'));
  
  if (isRateLimitByStatus || isRateLimitByMessage) {
    // Extract retry time if available (format: "Please try again in 57m1.44s")
    const retryMatch = errorMessage.match(/try again in ([\d\w\s.]+)/i);
    if (retryMatch) {
      const retryTime = retryMatch[1].trim();
      return {
        userMessage: `Translation service rate limit reached. Please try again in ${retryTime}.`,
        technicalMessage: errorMessage
      };
    }
    
    // Try to extract time from different formats (e.g., "57m1.44s", "1h30m")
    const timeMatch = errorMessage.match(/(\d+[hm]\d*[sm]?\.?\d*[sm]?)/i);
    if (timeMatch) {
      return {
        userMessage: `Translation service rate limit reached. Please try again in ${timeMatch[1]}.`,
        technicalMessage: errorMessage
      };
    }
    
    return {
      userMessage: 'Translation service rate limit reached. Please try again in about an hour.',
      technicalMessage: errorMessage
    };
  }
  
  if (lowerError.includes('groq') || lowerError.includes('translation') || lowerError.includes('llama')) {
    if (lowerError.includes('connection') || lowerError.includes('timeout')) {
      return {
        userMessage: 'Unable to connect to translation service. Please check your internet connection and try again.',
        technicalMessage: errorMessage
      };
    }
    
    if (lowerError.includes('401') || lowerError.includes('unauthorized') || lowerError.includes('api key')) {
      return {
        userMessage: 'Translation service authentication failed. Please contact support.',
        technicalMessage: errorMessage
      };
    }
    
    if (lowerError.includes('token') || lowerError.includes('max_tokens') || 
        lowerError.includes('tokens per day') || lowerError.includes('tpd')) {
      return {
        userMessage: 'Translation service quota exceeded. Please try again later or contact support.',
        technicalMessage: errorMessage
      };
    }
  }
  
  // Network/Connection errors
  if (lowerError.includes('network') || lowerError.includes('econnrefused') || lowerError.includes('enotfound')) {
    return {
      userMessage: 'Network connection error. Please check your internet connection and try again.',
      technicalMessage: errorMessage
    };
  }
  
  if (lowerError.includes('timeout') || lowerError.includes('etimedout')) {
    return {
      userMessage: 'Request timed out. The video might be too long or the service is slow. Please try again.',
      technicalMessage: errorMessage
    };
  }
  
  // Stripe/Payment related errors
  if (lowerError.includes('stripe') || lowerError.includes('payment')) {
    if (lowerError.includes('card') || lowerError.includes('declined')) {
      return {
        userMessage: 'Your payment was declined. Please check your card details and try again.',
        technicalMessage: errorMessage
      };
    }
    
    if (lowerError.includes('insufficient')) {
      return {
        userMessage: 'Insufficient funds. Please use a different payment method.',
        technicalMessage: errorMessage
      };
    }
    
    return {
      userMessage: 'Payment processing error. Please check your payment details and try again.',
      technicalMessage: errorMessage
    };
  }
  
  // Generic fallback
  return {
    userMessage: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
    technicalMessage: errorMessage
  };
}

/**
 * Formats error response for API endpoints
 * @param {Error} error - The error object
 * @returns {Object} Formatted error response object
 */
export function formatErrorResponse(error) {
  const errorInfo = getUserFriendlyError(error);
  return {
    error: errorInfo.userMessage,
    technicalError: errorInfo.technicalMessage,
    errorType: error.constructor.name,
    timestamp: new Date().toISOString()
  };
}

/**
 * Logs error with context information
 * @param {string} context - Context where error occurred (e.g., 'transcript', 'payment', 'plans')
 * @param {Error} error - The error object
 */
export function logError(context, error) {
  console.error('='.repeat(80));
  console.error(`[${context.toUpperCase()}] Error occurred:`, error.message);
  console.error('='.repeat(80));
  
  // Log complete error object
  console.error('Complete Error Object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
  console.error('Error Type:', error.constructor.name);
  console.error('Error Stack:', error.stack || 'No stack trace available');
  
  // Log all error properties
  if (error.response) {
    console.error('API Response Status:', error.response.status);
    console.error('API Response Headers:', JSON.stringify(error.response.headers, null, 2));
    console.error('API Response Data:', JSON.stringify(error.response.data, null, 2));
  }
  if (error.request) {
    console.error('Request Details:', JSON.stringify(error.request, null, 2));
  }
  if (error.status) {
    console.error('HTTP Status:', error.status);
  }
  if (error.statusCode) {
    console.error('HTTP Status Code:', error.statusCode);
  }
  if (error.code) {
    console.error('Error Code:', error.code);
  }
  if (error.errno) {
    console.error('Error Number:', error.errno);
  }
  if (error.syscall) {
    console.error('System Call:', error.syscall);
  }
  if (error.error && typeof error.error === 'object') {
    console.error('Nested Error Object:', JSON.stringify(error.error, null, 2));
  }
  
  // Log all enumerable properties
  const errorProps = {};
  for (const key in error) {
    if (error.hasOwnProperty(key)) {
      try {
        errorProps[key] = error[key];
      } catch (e) {
        errorProps[key] = '[Cannot serialize]';
      }
    }
  }
  if (Object.keys(errorProps).length > 0) {
    console.error('All Error Properties:', JSON.stringify(errorProps, null, 2));
  }
  
  console.error('Timestamp:', new Date().toISOString());
  console.error('='.repeat(80));
  
  // Also call getUserFriendlyError for formatted error info
  getUserFriendlyError(error);
}

