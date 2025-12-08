// AI Summary Service
// Handles text summarization using Groq and OpenAI with fallback support

import Groq from 'groq-sdk';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize AI clients
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Summarize text using OpenAI (fallback)
 * @param {string} text - Text to summarize
 * @param {string} summaryLength - Length of summary: 'short', 'medium', or 'long'
 * @returns {Promise<string>} - Summary text
 */
async function summarizeWithOpenAI(text, summaryLength = 'medium') {
  console.log('📝 Fallback to OpenAI for summarization...');
  console.log('🤖 Using Model: OpenAI GPT-4o-mini');
  console.log('📊 Summary Length:', summaryLength);
  console.log('⚙️ Summarization Config: temperature=0.5, max_tokens=4096');

  // Determine word count target based on summary length
  let lengthGuidance = '';
  switch (summaryLength) {
    case 'short':
      lengthGuidance = 'Keep the summary concise, around 100-150 words.';
      break;
    case 'long':
      lengthGuidance = 'Provide a detailed summary, around 400-500 words.';
      break;
    case 'medium':
    default:
      lengthGuidance = 'Provide a balanced summary, around 200-300 words.';
      break;
  }

  const summaryPrompt = `You are an expert content summarizer. Create a comprehensive summary of the following transcript.

Requirements:
- Capture the main points, key ideas, and important details
- Organize the summary with clear sections if the content covers multiple topics
- Use bullet points or numbered lists for better readability when appropriate
- Maintain the original context and meaning
- ${lengthGuidance}
- Write in a clear, professional, and engaging style
- Do not add any information not present in the original text
- Only output the summary, no preamble or additional commentary

Transcript to summarize:
${text}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: summaryPrompt
        }
      ],
      temperature: 0.5,
      max_tokens: 4096,
    });

    const summary = completion.choices[0].message.content.trim();
    console.log('✅ Summarization completed using OpenAI GPT-4o-mini!');
    console.log('📄 Summary length:', summary.length, 'characters');
    
    return summary;
  } catch (openaiError) {
    console.error('❌ OpenAI summarization failed:', openaiError.message);
    throw new Error(`Both Groq and OpenAI summarization failed: ${openaiError.message}`);
  }
}

/**
 * Summarize text using Groq with OpenAI fallback
 * @param {string} text - Text to summarize
 * @param {string} summaryLength - Length of summary: 'short', 'medium', or 'long'
 * @returns {Promise<string>} - Summary text
 */
async function summarizeWithGroq(text, summaryLength = 'medium') {
  console.log('📝 Starting summarization...');
  console.log('🤖 Using Model: Groq Llama-3.3-70b-versatile');
  console.log('📊 Summary Length:', summaryLength);
  console.log('⚙️ Summarization Config: temperature=0.5, max_tokens=8192');

  // Determine word count target based on summary length
  let lengthGuidance = '';
  switch (summaryLength) {
    case 'short':
      lengthGuidance = 'Keep the summary concise, around 100-150 words.';
      break;
    case 'long':
      lengthGuidance = 'Provide a detailed summary, around 400-500 words.';
      break;
    case 'medium':
    default:
      lengthGuidance = 'Provide a balanced summary, around 200-300 words.';
      break;
  }

  const summaryPrompt = `You are an expert content summarizer. Create a comprehensive summary of the following transcript.

Requirements:
- Capture the main points, key ideas, and important details
- Organize the summary with clear sections if the content covers multiple topics
- Use bullet points or numbered lists for better readability when appropriate
- Maintain the original context and meaning
- ${lengthGuidance}
- Write in a clear, professional, and engaging style
- Do not add any information not present in the original text
- Only output the summary, no preamble or additional commentary

Transcript to summarize:
${text}`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: summaryPrompt
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
      max_tokens: 8192,
    });

    const summary = completion.choices[0].message.content.trim();
    console.log('✅ Summarization completed using Groq Llama-3.3-70b-versatile!');
    console.log('📄 Summary length:', summary.length, 'characters');
    
    return summary;
  } catch (groqError) {
    // Groq SDK errors can come in different formats
    let errorMessage = groqError.message || groqError.toString();
    let errorObj = groqError.error;
    let statusCode = groqError.statusCode || groqError.status;
    let errorCode = null;
    
    // Check if error message contains "429 {...}" format
    if (typeof errorMessage === 'string' && /^\d+\s*\{/.test(errorMessage.trim())) {
      const jsonMatch = errorMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.error) {
            errorObj = parsed.error;
            errorMessage = parsed.error.message || errorMessage;
            errorCode = parsed.error.code;
            statusCode = statusCode || 429;
          }
        } catch (e) {
          // Keep original message
        }
      }
    }
    
    // Extract error code from nested structure
    if (!errorCode && errorObj) {
      errorCode = errorObj.code || (errorObj.error && errorObj.error.code);
    }
    
    // Check if it's a rate limit error (multiple conditions for reliability)
    const isRateLimitError = statusCode === 429 || 
                             errorMessage.toLowerCase().includes('rate limit') ||
                             errorCode === 'rate_limit_exceeded' ||
                             (errorObj && (errorObj.code === 'rate_limit_exceeded' || 
                              (errorObj.error && errorObj.error.code === 'rate_limit_exceeded')));
    
    if (isRateLimitError) {
      console.log('⚠️ Groq rate limit reached, falling back to OpenAI...');
      try {
        return await summarizeWithOpenAI(text, summaryLength);
      } catch (fallbackError) {
        console.error('❌ OpenAI fallback also failed:', fallbackError.message);
        // Re-throw original Groq error with fallback info
        const enhancedError = new Error(`${errorMessage} (OpenAI fallback also failed)`);
        enhancedError.statusCode = statusCode;
        enhancedError.status = statusCode;
        enhancedError.error = errorObj;
        throw enhancedError;
      }
    }
    
    // Re-throw with better error structure for non-rate-limit errors
    const enhancedError = new Error(errorMessage);
    enhancedError.statusCode = statusCode;
    enhancedError.status = statusCode;
    enhancedError.error = errorObj || groqError.error || groqError.response?.data || groqError.body;
    enhancedError.response = groqError.response;
    enhancedError.originalError = groqError;
    throw enhancedError;
  }
}

/**
 * Main function to generate summary
 * Uses Groq as primary provider with OpenAI fallback
 * @param {string} text - Text to summarize
 * @param {string} summaryLength - Length of summary: 'short', 'medium', or 'long'
 * @returns {Promise<string>} - Summary text
 */
export async function generateSummary(text, summaryLength = 'medium') {
  if (!text || text.trim().length === 0) {
    throw new Error('No text provided for summarization');
  }

  return await summarizeWithGroq(text, summaryLength);
}
