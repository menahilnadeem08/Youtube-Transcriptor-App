// Update these URLs to match your backend server
// For development: Use your computer's IP address (not localhost) when testing on physical devices
// For production: Use your deployed backend URL

// IMPORTANT: When building APK, the app runs in production mode (__DEV__ = false)
// Make sure to update the production URL below with your actual backend URL

export const API_URL = __DEV__ 
  ? 'http://18.217.107.170/api'  // Development: EC2 backend (port 80)
  : 'http://18.217.107.170/api'; // Production: EC2 backend (port 80)

