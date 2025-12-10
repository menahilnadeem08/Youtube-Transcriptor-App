// Test script to verify RAG setup
import dotenv from 'dotenv';
import { ChromaClient } from 'chromadb';
import OpenAI from 'openai';

dotenv.config();

console.log('🔍 Testing RAG Setup...\n');

// Test 1: Environment Variables
console.log('1. Checking Environment Variables:');
const openaiKey = process.env.OPENAI_API_KEY;
const groqKey = process.env.GROQ_API_KEY;
const chromaPath = process.env.CHROMA_DB_PATH;

console.log(`   OPENAI_API_KEY: ${openaiKey ? '✅ Set' : '❌ Missing'}`);
console.log(`   GROQ_API_KEY: ${groqKey ? '✅ Set' : '⚠️  Missing (optional, will use OpenAI fallback)'}`);
console.log(`   CHROMA_DB_PATH: ${chromaPath ? `✅ Set (${chromaPath})` : '✅ Using in-memory mode'}\n`);

// Test 2: ChromaDB Connection
console.log('2. Testing ChromaDB Connection:');
try {
  let chromaClient;
  if (chromaPath) {
    chromaClient = new ChromaClient({ path: chromaPath });
    console.log(`   ✅ ChromaDB client created (server mode: ${chromaPath})`);
  } else {
    chromaClient = new ChromaClient();
    console.log('   ✅ ChromaDB client created (in-memory mode)');
  }
  
  // Try to create a test collection
  const testCollectionName = 'test_collection_' + Date.now();
  try {
    const testCollection = await chromaClient.createCollection({
      name: testCollectionName,
      metadata: { test: true }
    });
    console.log('   ✅ ChromaDB collection creation: SUCCESS');
    
    // Clean up
    await chromaClient.deleteCollection({ name: testCollectionName });
    console.log('   ✅ ChromaDB cleanup: SUCCESS');
  } catch (error) {
    console.log(`   ❌ ChromaDB collection creation: FAILED - ${error.message}`);
  }
} catch (error) {
  console.log(`   ❌ ChromaDB initialization: FAILED - ${error.message}`);
}
console.log('');

// Test 3: OpenAI API
console.log('3. Testing OpenAI API:');
if (openaiKey) {
  try {
    const openai = new OpenAI({ apiKey: openaiKey });
    // Test with a simple embedding
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: ['test']
    });
    console.log('   ✅ OpenAI embeddings API: SUCCESS');
  } catch (error) {
    const errorMsg = error.message || 'Unknown error';
    if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
      console.log('   ❌ OpenAI API: INVALID API KEY');
    } else if (errorMsg.includes('rate limit') || errorMsg.includes('429')) {
      console.log('   ⚠️  OpenAI API: RATE LIMIT (but API key is valid)');
    } else {
      console.log(`   ❌ OpenAI API: ERROR - ${errorMsg}`);
    }
  }
} else {
  console.log('   ⚠️  Skipped (OPENAI_API_KEY not set)');
}
console.log('');

// Test 4: Groq API (optional)
console.log('4. Testing Groq API (optional):');
if (groqKey) {
  try {
    const Groq = (await import('groq-sdk')).default;
    const groq = new Groq({ apiKey: groqKey });
    // Just test that we can create the client
    console.log('   ✅ Groq client: CREATED');
  } catch (error) {
    console.log(`   ⚠️  Groq client: ${error.message}`);
  }
} else {
  console.log('   ℹ️  Skipped (GROQ_API_KEY not set, will use OpenAI fallback)');
}
console.log('');

console.log('✅ Setup test complete!');
console.log('\n📝 Next steps:');
if (!openaiKey) {
  console.log('   - Set OPENAI_API_KEY in .env file');
}
if (!groqKey) {
  console.log('   - (Optional) Set GROQ_API_KEY in .env file for better performance');
}
if (chromaPath) {
  console.log(`   - Ensure ChromaDB server is running at ${chromaPath}`);
} else {
  console.log('   - (Optional) Set CHROMA_DB_PATH in .env for persistent storage');
}

