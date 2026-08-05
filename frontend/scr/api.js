import axios from 'axios';
import { Platform } from 'react-native';

const BASE_URL = "http://10.0.0.126:8000";

const api = axios.create({
  baseURL: BASE_URL,
});

export const analyzeImage = async (imageUri) => {
  const formData = new FormData();

  const filename = imageUri.split('/').pop() || 'retinal_image.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';

  formData.append('file', {
    uri: Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri,
    name: filename,
    type
  });

  try {
    const response = await api.post('/api/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
      console.log("SUCCESS:", response.data);
    return response.data;
  } catch (error) {
    console.error('API Error /analyze:', error?.response?.data || error);
    throw error;
  }
};

export const chatWithAssistant = async (question) => {
  try {
    const response = await api.get('/api/chat/ask', {
      params: { question }
    });
    return response.data;
  } catch (error) {
    console.error('API Error /chat/ask:', error?.response?.data || error);
    throw error;
  }
};
