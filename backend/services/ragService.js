// RAG Service for YouTube Transcript Chatbot
// Handles text chunking, embedding, vector storage, and retrieval

import { ChromaClient } from 'chromadb';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const gemini = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// Initialize ChromaDB client
// NOTE: ChromaDB JavaScript client requires a server to be running
// Default to localhost:8000 if no path is specified
const chromaPath = process.env.CHROMA_DB_PATH || 'http://localhost:8000';
let chromaClient;
let chromaInitialized = false;

try {
  chromaClient = new ChromaClient({
    path: chromaPath
  });
  console.log(`📚 ChromaDB client initialized (server: ${chromaPath})`);
  console.log('⚠️  Note: ChromaDB server must be running. Start it with: docker run -d -p 8000:8000 chromadb/chroma');
  chromaInitialized = true;
} catch (error) {
  console.error('❌ Failed to initialize ChromaDB:', error.message);
  chromaInitialized = false;
  console.error('💡 To fix: Start ChromaDB server with: docker run -d -p 8000:8000 chromadb/chroma');
}

// In-memory store for collections (videoId -> collection)
const collectionsCache = new Map();

/**
 * Split text into chunks with overlap for better context
 * @param {string} text - Text to split
 * @param {number} chunkSize - Size of each chunk in characters
 * @param {number} overlap - Overlap between chunks in characters
 * @returns {Array<{text: string, index: number}>} - Array of text chunks
 */
function splitTextIntoChunks(text, chunkSize = 1000, overlap = 200) {
  if (!text || text.length === 0) {
    return [];
  }

  const chunks = [];
  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < text.length) {
    let endIndex = startIndex + chunkSize;

    // If not the last chunk, try to break at a sentence boundary
    if (endIndex < text.length) {
      // Look for sentence endings within the last 100 characters
      const searchStart = Math.max(startIndex, endIndex - 100);
      const searchText = text.substring(searchStart, endIndex);
      const sentenceEnd = searchText.search(/[.!?]\s+/);
      
      if (sentenceEnd !== -1) {
        endIndex = searchStart + sentenceEnd + 1;
      } else {
        // If no sentence boundary, try word boundary
        const wordBoundary = text.substring(Math.max(startIndex, endIndex - 50), endIndex).search(/\s+/);
        if (wordBoundary !== -1) {
          endIndex = Math.max(startIndex, endIndex - 50) + wordBoundary;
        }
      }
    }

    const chunk = text.substring(startIndex, endIndex).trim();
    if (chunk.length > 0) {
      chunks.push({
        text: chunk,
        index: chunkIndex
      });
    }

    // Move start index forward with overlap
    startIndex = endIndex - overlap;
    chunkIndex++;
  }

  return chunks;
}

/**
 * Create embeddings for text chunks using OpenAI
 * @param {Array<string>} texts - Array of text chunks
 * @returns {Promise<Array<Array<number>>>} - Array of embedding vectors
 */
async function createEmbeddings(texts) {
  try {
    console.log(`🔮 Creating embeddings for ${texts.length} chunks...`);
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }
    
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts
    });

    const embeddings = response.data.map(item => item.embedding);
    console.log(`✅ Created ${embeddings.length} embeddings`);
    
    return embeddings;
  } catch (error) {
    console.error('❌ Error creating embeddings:', error.message);
    const errorMsg = error.message || 'Unknown error';
    
    if (errorMsg.includes('API key') || errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
      throw new Error('OpenAI API key is invalid or missing. Please check your OPENAI_API_KEY in the .env file.');
    } else if (errorMsg.includes('rate limit') || errorMsg.includes('429')) {
      throw new Error('OpenAI API rate limit exceeded. Please wait a moment and try again.');
    } else if (errorMsg.includes('network') || errorMsg.includes('ECONNREFUSED')) {
      throw new Error('Failed to connect to OpenAI API. Please check your internet connection.');
    }
    
    throw new Error(`Failed to create embeddings: ${errorMsg}`);
  }
}

/**
 * Get or create a ChromaDB collection for a video
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Object>} - ChromaDB collection
 */
async function getOrCreateCollection(videoId) {
  if (!chromaInitialized || !chromaClient) {
    throw new Error('ChromaDB is not initialized. Please start ChromaDB server with: docker run -d -p 8000:8000 chromadb/chroma');
  }

  const collectionName = `video_${videoId}`;

  // Check cache first
  if (collectionsCache.has(videoId)) {
    return collectionsCache.get(videoId);
  }

  try {
    // Try to get existing collection
    let collection;
    try {
      collection = await chromaClient.getCollection({ name: collectionName });
      console.log(`📚 Found existing collection for video: ${videoId}`);
    } catch (error) {
      // Collection doesn't exist, create it
      try {
        collection = await chromaClient.createCollection({
          name: collectionName,
          metadata: {
            videoId: videoId,
            createdAt: new Date().toISOString()
          }
        });
        console.log(`📚 Created new collection for video: ${videoId}`);
      } catch (createError) {
        // If creation fails, it might be a connection issue
        console.error('❌ Failed to create collection:', createError.message);
        const errorMsg = createError.message || 'Unknown error';
        if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('connect') || errorMsg.includes('server is running')) {
          throw new Error('ChromaDB server is not running. Please start it with: docker run -d -p 8000:8000 chromadb/chroma');
        }
        throw new Error(`ChromaDB error: ${errorMsg}`);
      }
    }

    collectionsCache.set(videoId, collection);
    return collection;
  } catch (error) {
    console.error('❌ Error getting/creating collection:', error.message);
    throw error;
  }
}

/**
 * Initialize RAG system with transcript text
 * @param {string} videoId - YouTube video ID
 * @param {string} transcriptText - Full transcript text
 * @returns {Promise<Object>} - Initialization result
 */
export async function initializeRAG(videoId, transcriptText) {
  try {
    console.log(`🚀 Initializing RAG for video: ${videoId}`);
    console.log(`📄 Transcript length: ${transcriptText.length} characters`);

    if (!transcriptText || transcriptText.trim().length === 0) {
      throw new Error('Transcript text is empty');
    }

    // Get or create collection
    const collection = await getOrCreateCollection(videoId);

    // Check if collection already has data
    const count = await collection.count();
    if (count > 0) {
      console.log(`ℹ️ Collection already has ${count} chunks. Clearing and re-initializing...`);
      // Delete and recreate collection to avoid duplicates
      await chromaClient.deleteCollection({ name: collection.name });
      const newCollection = await chromaClient.createCollection({
        name: collection.name,
        metadata: {
          videoId: videoId,
          createdAt: new Date().toISOString()
        }
      });
      collectionsCache.set(videoId, newCollection);
    }

    // Split text into chunks
    console.log('✂️ Splitting text into chunks...');
    const chunks = splitTextIntoChunks(transcriptText, 1000, 200);
    console.log(`✅ Created ${chunks.length} chunks`);

    if (chunks.length === 0) {
      throw new Error('No chunks created from transcript');
    }

    // Create embeddings
    const texts = chunks.map(chunk => chunk.text);
    const embeddings = await createEmbeddings(texts);

    // Prepare data for ChromaDB
    const ids = chunks.map((_, index) => `chunk_${index}`);
    const metadatas = chunks.map((chunk, index) => ({
      chunkIndex: chunk.index,
      videoId: videoId
    }));

    // Add to ChromaDB
    console.log('💾 Storing chunks in vector database...');
    await collection.add({
      ids: ids,
      embeddings: embeddings,
      documents: texts,
      metadatas: metadatas
    });

    console.log(`✅ RAG initialized successfully with ${chunks.length} chunks`);

    return {
      success: true,
      videoId: videoId,
      chunkCount: chunks.length,
      message: 'RAG system initialized successfully'
    };
  } catch (error) {
    console.error('❌ Error initializing RAG:', error.message);
    throw error;
  }
}

/**
 * Query RAG system to get answer based on transcript
 * @param {string} videoId - YouTube video ID
 * @param {string} question - User's question
 * @param {number} topK - Number of relevant chunks to retrieve
 * @returns {Promise<string>} - Answer from LLM
 */
export async function queryRAG(videoId, question, topK = 5) {
  try {
    console.log(`🔍 Querying RAG for video: ${videoId}`);
    console.log(`❓ Question: ${question}`);

    // Get collection
    const collection = await getOrCreateCollection(videoId);

    // Check if collection has data
    const count = await collection.count();
    if (count === 0) {
      throw new Error('RAG system not initialized for this video. Please initialize it first.');
    }

    // Create embedding for the question
    const questionEmbedding = await createEmbeddings([question]);
    
    // Query ChromaDB for similar chunks
    console.log(`🔎 Retrieving top ${topK} relevant chunks...`);
    const results = await collection.query({
      queryEmbeddings: questionEmbedding,
      nResults: topK
    });

    // Debug: Print retrieved documents
    console.log('📄 Retrieved documents:');
    console.log(results['documents']);

    if (!results.documents || results.documents.length === 0 || results.documents[0].length === 0) {
      throw new Error('No relevant chunks found');
    }

    // Combine retrieved chunks into context
    const relevantChunks = results.documents[0];
    const context = relevantChunks.join('\n\n---\n\n');
    
    console.log(`✅ Retrieved ${relevantChunks.length} relevant chunks`);
    console.log(`📝 Context length: ${context.length} characters`);

    // Generate answer using LLM with retrieved context
    const answer = await generateAnswerWithLLM(question, context, videoId);

    return answer;
  } catch (error) {
    console.error('❌ Error querying RAG:', error.message);
    throw error;
  }
}

/**
 * Generate answer using LLM with retrieved context
 * @param {string} question - User's question
 * @param {string} context - Retrieved transcript chunks
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<string>} - Generated answer
 */
async function generateAnswerWithLLM(question, context, videoId) {
  const systemPrompt = `You are a helpful assistant that answers questions based on YouTube video transcripts. 
Your answers should be:
- Accurate and based ONLY on the provided transcript context
- Clear and well-structured
- If the answer is not in the transcript, say so honestly
- Provide specific examples or quotes from the transcript when relevant
- Be concise but comprehensive`;

  const userPrompt = `Based on the following transcript from a YouTube video, answer this question: "${question}"

Transcript context:
${context}

Please provide a helpful answer based on the transcript above. If the question cannot be answered from the provided context, please say so.`;

  // Priority 1: Try OpenAI GPT first
  try {
    console.log('🤖 Generating answer with OpenAI GPT-4o-mini...');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2048
    });

    const rawAnswer = completion.choices[0].message.content;
    
    if (!rawAnswer || typeof rawAnswer !== 'string') {
      throw new Error('Invalid response format from OpenAI');
    }
    
    const answer = rawAnswer.trim();
    
    if (answer.length === 0) {
      throw new Error('Empty response from OpenAI');
    }
    
    console.log('✅ Answer generated successfully with OpenAI');
    console.log(`📝 Answer length: ${answer.length} characters`);
    
    return answer;
  } catch (openaiError) {
    // Priority 2: Fallback to Gemini if OpenAI fails
    const errorMsg = openaiError.message || 'Unknown error';
    console.log(`⚠️ OpenAI failed (${errorMsg}), falling back to Gemini...`);
    
    if (!gemini) {
      throw new Error('OpenAI failed and GEMINI_API_KEY is not set. Please set GEMINI_API_KEY in .env file.');
    }
    
    try {
      console.log('🤖 Generating answer with Google Gemini...');
      
      const model = gemini.getGenerativeModel({ model: 'gemini-pro' });
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
      
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const answer = response.text().trim();
      
      if (!answer || answer.length === 0) {
        throw new Error('Empty response from Gemini');
      }
      
      console.log('✅ Answer generated successfully with Gemini');
      console.log(`📝 Answer length: ${answer.length} characters`);
      
      return answer;
    } catch (geminiError) {
      console.error('❌ Both OpenAI and Gemini failed');
      const geminiMsg = geminiError.message || 'Unknown error';
      throw new Error(`Failed to generate answer. OpenAI error: ${errorMsg}. Gemini error: ${geminiMsg}`);
    }
  }
}

/**
 * Delete RAG data for a video
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Object>} - Deletion result
 */
export async function deleteRAGData(videoId) {
  try {
    const collectionName = `video_${videoId}`;
    
    try {
      await chromaClient.deleteCollection({ name: collectionName });
      collectionsCache.delete(videoId);
      console.log(`✅ Deleted RAG data for video: ${videoId}`);
      
      return {
        success: true,
        message: 'RAG data deleted successfully'
      };
    } catch (error) {
      // Collection might not exist
      console.log(`ℹ️ Collection not found for video: ${videoId}`);
      return {
        success: true,
        message: 'RAG data not found (may have been already deleted)'
      };
    }
  } catch (error) {
    console.error('❌ Error deleting RAG data:', error.message);
    throw error;
  }
}

