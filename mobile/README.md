# YouTube Transcript Mobile App

React Native mobile application for YouTube transcript generation and translation.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Update API URL in `src/config/api.js` to point to your backend server.

3. Start the development server:
```bash
npm start
```

4. Run on iOS:
```bash
npm run ios
```

5. Run on Android:
```bash
npm run android
```

## Features

- 🎥 Extract transcripts from YouTube videos
- 🌐 Translate to 50+ languages
- 📄 Export in multiple formats (TXT, PDF, DOCX)
- 💳 Stripe payment integration
- ⚡ Real-time progress updates
- 🔍 Search functionality in transcripts

## Backend Requirements

The mobile app requires the backend server to be running. Update the API URL in `src/config/api.js` to match your backend server address.

For local development, use your computer's IP address instead of `localhost`:
- iOS Simulator: `http://localhost:3000/api`
- Android Emulator: `http://10.0.2.2:3000/api`
- Physical Device: `http://YOUR_IP_ADDRESS:3000/api`

