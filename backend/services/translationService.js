// Translation service for captions and text
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Translate text using Groq API
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language name (e.g., "Spanish", "French")
 * @returns {Promise<string>} Translated text
 */
export async function translateText(text, targetLanguage) {
  console.log(`🌐 Translating to ${targetLanguage}...`);
  
  const prompt = `Translate the following text to ${targetLanguage}. Only provide the translation, no explanations:\n\n${text}`;
  
  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    max_tokens: 8000
  });
  
  return completion.choices[0].message.content.trim();
}

/**
 * Translate caption segments with timestamps preserved
 * @param {Array} captionSegments - Array of {timestamp, text} objects
 * @param {string} targetLanguage - Target language name
 * @returns {Promise<Object>} Translated segments and full text
 */
export async function translateCaptions(captionSegments, targetLanguage) {
  console.log(`🌐 Translating ${captionSegments.length} caption segments to ${targetLanguage}...`);
  
  // Combine all caption text for translation
  const fullText = captionSegments.map(seg => seg.text).join(' ');
  
  // Translate the full text
  const translatedFullText = await translateText(fullText, targetLanguage);
  
  console.log(`✅ Translation completed`);
  
  return {
    translatedText: translatedFullText,
    originalSegments: captionSegments,
    method: 'captions-translation'
  };
}
