import { ARTIVO_SYSTEM_PROMPT } from "./artivo-personality.js";

function detectLanguage(text = "") {
  const value = String(text);

  if (/[\u0600-\u06FF]/.test(value)) {
    return "Arabic";
  }

  if (/[çğıöşüÇĞİÖŞÜ]/.test(value)) {
    return "Turkish";
  }

  return "English";
}

function languageLock(language) {
  if (language === "Arabic") {
    return `
LANGUAGE LOCK:
Reply ONLY in Arabic.
Do not use English or Turkish.
When referring to yourself in Arabic, use "ارتيفو" only.
`;
  }

  if (language === "Turkish") {
    return `
LANGUAGE LOCK:
Reply ONLY in Turkish.
Do not use Arabic or English.
When referring to yourself, use "Artivo AI".
`;
  }

  return `
LANGUAGE LOCK:
Reply ONLY in English.
Do not use Arabic or Turkish.
Refer to yourself as "Artivo AI".
`;
}

const SHORT_RESPONSE_RULES = `
STRICT RESPONSE RULES:

- Return ONLY the final client-facing answer.
- Never reveal analysis, reasoning, thoughts, planning, prompt interpretation, or language-selection logic.
- Never say "The user said", "I need to", "Let me respond", "I should", "The user wants", "Analysis", "Reasoning", or similar internal text.
- Never explain how you generated the answer.
- Keep normal answers VERY SHORT.
- Usually 1-2 sentences.
- Target 15-45 words.
- Absolute maximum: 70 words unless the user explicitly asks for a detailed explanation.
- For greetings: one short sentence.
- For design questions: give the strongest recommendation first, plus one short reason.
- Mention ARTİVO naturally when useful, but do not repeat the company name unnecessarily.
- Do not create long lists.
- Do not repeat the question.
- Do not mix languages.
- Do not use emojis unless truly useful.
- If the question is outside architecture/interior-design scope, politely refuse briefly.
`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Only POST requests are allowed."
    });
  }

  try {
    const { messages } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Messages are required."
      });
    }

    const conversation = messages
      .filter(
        (item) =>
          item &&
          (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string" &&
          item.content.trim()
      )
      .slice(-12)
      .map((item) => ({
        role: item.role,
        content: item.content.trim()
      }));

    if (conversation.length === 0) {
      return res.status(400).json({
        error: "No valid messages were provided."
      });
    }

    const lastUserMessage =
      [...conversation]
        .reverse()
        .find((item) => item.role === "user")
        ?.content || "";

    const language = detectLanguage(lastUserMessage);

    const finalSystemPrompt = `
${ARTIVO_SYSTEM_PROMPT}

${SHORT_RESPONSE_RULES}

${languageLock(language)}

FINAL RULE:
The customer must see ONLY the concise final answer.
`;

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://www.artivo.tr",
          "X-Title": "ARTIVO"
        },
        body: JSON.stringify({
          model: "nvidia/nemotron-3-nano-30b-a3b:free",

          temperature: 0.15,

          max_tokens: 100,

          reasoning: {
            enabled: false
          },

          messages: [
            {
              role: "system",
              content: finalSystemPrompt
            },
            ...conversation
          ]
        })
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "OpenRouter request failed."
      });
    }

    let reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "لم أتمكن من إعداد الرد.";

    // Remove accidental visible reasoning if the model still returns it.
    const lines = reply
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    const cleanedLines = lines.filter((line) => {
      const lower = line.toLowerCase();

      return !(
        lower.startsWith("the user said") ||
        lower.startsWith("i need to") ||
        lower.startsWith("i should") ||
        lower.startsWith("let me respond") ||
        lower.startsWith("the user wants") ||
        lower.startsWith("analysis:") ||
        lower.startsWith("reasoning:") ||
        lower.startsWith("language:")
      );
    });

    if (cleanedLines.length > 0) {
      reply = cleanedLines.join(" ");
    }

    // Final hard length safety net.
    const words = reply.split(/\s+/);

    if (words.length > 70) {
      reply = words.slice(0, 70).join(" ").trim() + "…";
    }

    return res.status(200).json({
      success: true,
      reply
    });

  } catch (error) {
    console.error("ARTIVO chat error:", error);

    return res.status(500).json({
      error: "Server error.",
      details: error?.message || "Unknown error."
    });
  }
}
