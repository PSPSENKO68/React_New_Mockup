import axios from 'axios';

// API key is directly imported from environment variable through Vite
// In production, this should be handled server-side to protect the key
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// Define response type for DALL-E image generation
interface DallEResponse {
  data: {
    url: string;
  }[];
}

/**
 * Generate an image using OpenAI's DALL-E model based on a text prompt
 * @param prompt The text description of the image to generate
 * @returns Promise resolving to the URL of the generated image
 */
export async function generateImage(prompt: string): Promise<string> {
  try {
    console.log('Making API request to OpenAI DALL-E...');
    console.log('API Key available:', !!OPENAI_API_KEY);

    const response = await axios.post<DallEResponse>(
      'https://api.openai.com/v1/images/generations',
      {
        model: "dall-e-3", // Use dall-e-3 for the latest model
        prompt,
        n: 1, // Number of images to generate
        size: "1024x1024", // Image size
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
      }
    );

    console.log('API response received:', response.status);

    // Return the URL of the generated image
    return response.data.data[0].url;
  } catch (error: any) {
    console.error('Error generating image with DALL-E:', error);
    
    // More detailed error message for debugging
    if (error.response) {
      console.error('API Error Response:', {
        status: error.response.status,
        data: error.response.data
      });

      // Check for billing limit error
      if (error.response.data?.error?.code === 'billing_hard_limit_reached') {
        throw new Error('The AI image generation service has reached its usage limit. Please try again later.');
      }

      throw new Error(`OpenAI API error: ${error.response.data?.error?.message || 'Unknown API error'}`);
    } else if (error.request) {
      console.error('No response received from API');
      throw new Error('No response received from OpenAI API. Please check your internet connection.');
    } else {
      console.error('Error message:', error.message);
      throw new Error(`Failed to generate image: ${error.message}`);
    }
  }
}

/**
 * Alternative function to use free model from Hugging Face
 * Note: To use this, you'll need to:
 * 1. Sign up at huggingface.co 
 * 2. Get a free token from your profile settings
 * 3. Add VITE_HUGGING_FACE_TOKEN to your .env file
 * 4. Replace calls to generateImage() with generateImageWithHuggingFace()
 */
export async function generateImageWithHuggingFace(prompt: string): Promise<string> {
  const HUGGING_FACE_TOKEN = import.meta.env.VITE_HUGGING_FACE_TOKEN;
  
  if (!HUGGING_FACE_TOKEN) {
    throw new Error('Hugging Face token is not set. Please add VITE_HUGGING_FACE_TOKEN to your .env file.');
  }
  
  try {
    console.log('Making API request to Hugging Face...');
    
    // Using Stability AI's Stable Diffusion model
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
      { inputs: prompt },
      {
        headers: {
          'Authorization': `Bearer ${HUGGING_FACE_TOKEN}`
        },
        responseType: 'arraybuffer'
      }
    );
    
    console.log('Hugging Face response received');
    
    // Convert the array buffer to base64 using browser APIs
    const arrayBuffer = response.data;
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Image = `data:image/jpeg;base64,${btoa(binary)}`;
    
    return base64Image;
  } catch (error: any) {
    console.error('Error generating image with Hugging Face:', error);
    throw new Error('Failed to generate image with Hugging Face. Check your token and connection.');
  }
} 