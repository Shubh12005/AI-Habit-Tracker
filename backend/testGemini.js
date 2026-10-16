import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function test() {
  try {
    const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: "Reply with exactly: Gemini is working!",
    });

    console.log("SUCCESS:");
    console.log(response.text);
  } catch (err) {
    console.error("FAILED:");
    console.error(err);
  }
}

test();