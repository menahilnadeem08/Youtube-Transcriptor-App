import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export const downloadTxt = async (text, filename) => {
  try {
    const fileUri = FileSystem.documentDirectory + filename;
    await FileSystem.writeAsStringAsync(fileUri, text);
    
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    } else {
      alert('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error saving file:', error);
    alert('Failed to save file');
  }
};

export const downloadPdf = async (text, filename, videoId) => {
  try {
    const pdfContent = generatePdfContent(text, videoId);
    const fileUri = FileSystem.documentDirectory + filename.replace('.pdf', '.txt');
    await FileSystem.writeAsStringAsync(fileUri, pdfContent);
    
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    } else {
      alert('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Sharing as text file instead.');
    await downloadTxt(text, filename.replace('.pdf', '.txt'));
  }
};

export const downloadDocx = async (text, filename, videoId) => {
  try {
    const docxContent = generateDocxContent(text, videoId);
    const fileUri = FileSystem.documentDirectory + filename.replace('.docx', '.txt');
    await FileSystem.writeAsStringAsync(fileUri, docxContent);
    
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    } else {
      alert('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error generating DOCX:', error);
    alert('Failed to generate DOCX. Sharing as text file instead.');
    await downloadTxt(text, filename.replace('.docx', '.txt'));
  }
};

const generatePdfContent = (text, videoId) => {
  const header = `YouTube Transcript\nVideo ID: ${videoId}\nGenerated: ${new Date().toLocaleString()}\n\n`;
  return header + text;
};

const generateDocxContent = (text, videoId) => {
  const header = `YouTube Transcript\nVideo ID: ${videoId}\nGenerated: ${new Date().toLocaleString()}\n\n`;
  return header + text;
};

