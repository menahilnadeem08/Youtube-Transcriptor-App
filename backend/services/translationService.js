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
    max_tokens: 32000 // Increased for long texts
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
  
  console.log(`📏 Total text length: ${fullText.length} characters`);
  
  // Split text into chunks if too long (max ~15000 chars per chunk to stay within token limits)
  const MAX_CHUNK_SIZE = 15000;
  const chunks = [];
  
  if (fullText.length > MAX_CHUNK_SIZE) {
    console.log(`⚠️  Text too long, splitting into chunks...`);
    
    // Split by sentences to maintain context
    const sentences = fullText.match(/[^.!?]+[.!?]+/g) || [fullText];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > MAX_CHUNK_SIZE) {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }
    
    if (currentChunk) chunks.push(currentChunk.trim());
    console.log(`📦 Split into ${chunks.length} chunks`);
  } else {
    chunks.push(fullText);
  }
  
  // Translate each chunk
  const translatedChunks = [];
  for (let i = 0; i < chunks.length; i++) {
    console.log(`🔄 Translating chunk ${i + 1}/${chunks.length}...`);
    const translated = await translateText(chunks[i], targetLanguage);
    translatedChunks.push(translated);
  }
  
  // Combine translated chunks
  const translatedFullText = translatedChunks.join(' ');
  
  console.log(`✅ Translation completed (${translatedFullText.length} characters)`);
  
  return {
    translatedText: translatedFullText,
    originalSegments: captionSegments,
    method: 'captions-translation'
  };
}
