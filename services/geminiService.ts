import { GoogleGenAI, Type } from "@google/genai";
import { CategoryL1, Season } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// Helper to strip base64 prefix
const cleanBase64 = (data: string) => {
  return data.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
};

interface AutoTagResult {
  categoryL1: string;
  categoryL2: string;
  color: string;
  season: string;
}

export const analyzeClothingImage = async (base64Image: string): Promise<AutoTagResult | null> => {
  if (!process.env.API_KEY) {
    console.warn("No API Key found. Skipping AI analysis.");
    return null;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: cleanBase64(base64Image)
            }
          },
          {
            text: `Analyze this clothing item. 
            Identify the main category (Top, Bottom, Shoes, Dress, Hat).
            Identify the specific sub-category (e.g. T-Shirt, Jeans, Sneakers).
            Identify the primary color.
            Identify the season (Warm, Cold, All).
            Return JSON.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            categoryL1: { type: Type.STRING, enum: [CategoryL1.TOP, CategoryL1.BOTTOM, CategoryL1.SHOES, CategoryL1.DRESS, CategoryL1.HAT] },
            categoryL2: { type: Type.STRING },
            color: { type: Type.STRING },
            season: { type: Type.STRING, enum: [Season.WARM, Season.COLD, Season.ALL] }
          },
          required: ["categoryL1", "categoryL2", "color", "season"]
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as AutoTagResult;
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    return null;
  }
};

export const removeBackground = async (base64Image: string): Promise<string | null> => {
  if (!process.env.API_KEY) {
    return null;
  }

  try {
    // Using gemini-2.5-flash-image for image editing/generation tasks
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: cleanBase64(base64Image)
            }
          },
          {
            text: 'Isolate the clothing item in this image. Keep the item exactly as it is, but replace the background with pure white color.'
          }
        ]
      }
    });

    // Extract the image part from the response
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini Background Removal Failed:", error);
    return null;
  }
};
