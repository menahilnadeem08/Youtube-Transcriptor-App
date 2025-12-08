// Debug utility to test EC2 backend connection
// Use this in your app to see detailed error information

export const testConnection = async () => {
  const API_URL = 'http://18.217.107.170:3000/api';
  
  console.log('🔍 Testing connection to:', API_URL);
  
  try {
    // Test 1: Simple fetch
    console.log('📡 Test 1: Fetching /health endpoint...');
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('✅ Response status:', response.status);
    console.log('✅ Response ok:', response.ok);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Response data:', data);
      return { success: true, data };
    } else {
      const text = await response.text();
      console.log('❌ Response error:', text);
      return { success: false, error: `Status ${response.status}: ${text}` };
    }
  } catch (error) {
    console.error('❌ Connection error:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    // Check for specific error types
    if (error.message.includes('Network request failed')) {
      return { 
        success: false, 
        error: 'Network request failed - Check internet connection and EC2 security group',
        details: error.message 
      };
    }
    
    if (error.message.includes('cleartext') || error.message.includes('HTTP')) {
      return { 
        success: false, 
        error: 'Cleartext HTTP blocked - Need development build or HTTPS',
        details: error.message 
      };
    }
    
    return { 
      success: false, 
      error: error.message || 'Unknown error',
      details: error.toString()
    };
  }
};

