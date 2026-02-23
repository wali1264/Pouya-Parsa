import { GoogleGenAI, Type } from "@google/genai";

// This file runs on the server (Vercel Serverless Function), so process.env is secure.
// Ensure API_KEY is set in Vercel's Environment Variables settings.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Vercel's magic automatically handles routing any request to /api/recognize-image to this function.
// We use a generic handler signature to be framework-agnostic.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // Vercel automatically parses the JSON body for us
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ message: 'No image data provided in the request body.' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: image,
            },
          },
          { text: 'Identify the stationery items in this image. Respond with a JSON array of objects, where each object has a "name" key containing the product name. For example: [{"name": "Blue Ballpoint Pen"}, {"name": "A4 Notebook"}].' }
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: {
                type: Type.STRING,
                description: 'The full name of the stationery product.',
              },
            },
            required: ["name"],
          },
        },
      },
    });
    
    // The response.text from Gemini should be a valid JSON string due to our schema
    const parsedResponse = JSON.parse(response.text);
    return res.status(200).json(parsedResponse);

  } catch (error) {
    console.error('Error in API proxy function:', error);
    // Send a generic error message to the client for security
    return res.status(500).json({ message: 'An internal server error occurred.' });
  }
}
