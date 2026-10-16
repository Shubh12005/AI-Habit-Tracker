import { GoogleGenAI } from "@google/genai";

let client = null;

function getClient() {
  if (client) return client;

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing in .env");
  }

  client = new GoogleGenAI({
    apiKey,
  });

  return client;
}

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
console.log("Using Gemini model:", MODEL);
export const isAIEnabled = () => {
  return Boolean(process.env.GEMINI_API_KEY);
};

export function parseJSON(text) {
  let cleaned = (text || "").trim();

  if (cleaned.startsWith("```json")) {
    cleaned = cleaned
      .replace(/^```json\s*/i, "")
      .replace(/```$/i, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "");
  }

  return JSON.parse(cleaned.trim());
}

export async function chatCompletion({
  system,
  user,
  temperature = 0.7,
}) {
  try {
    const ai = getClient();

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: user,
      config: {
        systemInstruction: system,
        temperature,
      },
    });

    return {
      ok: true,
      content: response.text?.trim() || "",
    };
  } catch (err) {
    console.error("Gemini Error:");

    if (err?.message) {
      console.error(err.message);
    }

    if (err?.error) {
      console.error(JSON.stringify(err.error, null, 2));
    }

    return {
      ok: false,
      content: "AI request failed. Please try again later.",
    };
  }
}

export const SYSTEM_PROMPTS = {
  weekly: `
You are an expert habit coach.

Analyze the user's last 7 days of habit data.

Return:
1. Overall performance
2. What went well
3. What needs improvement
4. Three actionable suggestions

Keep the response under 200 words.
`,

  suggestion: `
You are a habit coach.

Suggest exactly 3 personalized habits.

Each suggestion should contain:
- name
- description
- category
- frequency
- reason

Respond ONLY in JSON.
`,

  recovery: `
You are a supportive habit coach.

The user missed one or more days.

Create a practical 3-day recovery plan.

Be encouraging and avoid guilt.
`,

  chat: `
You are an AI assistant for a habit tracker.

Answer ONLY using the provided habit data.

If the answer cannot be determined,
say you don't have enough information.
`,

  morning: `
Write one short motivational morning message.

Mention today's progress.

Keep it between 30 and 60 words.
`,
};