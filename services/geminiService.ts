
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeVideoFrames = async (base64Frames: string[]): Promise<AnalysisResult> => {
  const model = 'gemini-3-pro-preview';
  
  const parts = base64Frames.map(data => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data: data.split(',')[1] // Remove prefix if exists
    }
  }));

  const prompt = `Analyze this sequence of video frames and provide a structured JSON response. 
  Describe the key events, identify any significant objects or people, and assess if there's any unusual activity.
  The output MUST follow this JSON schema:
  {
    "summary": "Short concise summary",
    "objects": ["object1", "object2"],
    "threatLevel": "Low" | "Medium" | "High",
    "detailedLog": "Detailed description of actions"
  }`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [...parts, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            objects: { type: Type.ARRAY, items: { type: Type.STRING } },
            threatLevel: { type: Type.STRING },
            detailedLog: { type: Type.STRING }
          },
          required: ["summary", "objects", "threatLevel", "detailedLog"]
        }
      }
    });

    const resultText = response.text || '';
    return {
      ...JSON.parse(resultText),
      timestamp: Date.now()
    };
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
