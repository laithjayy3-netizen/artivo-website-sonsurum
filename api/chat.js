import { ARTIVO_SYSTEM_PROMPT } from "./artivo-personality.js";

function detectLanguage(text = "") {
  const value = String(text);

  const arabicMatches =
    value.match(/[\u0600-\u06FF]/g) || [];

  const turkishMatches =
    value.match(/[çğıöşüÇĞİÖŞÜ]/g) || [];

  const latinMatches =
    value.match(/[A-Za-z]/g) || [];

  if (arabicMatches.length > 0) {
    return "Arabic";
  }

  if (
    turkishMatches.length > 0 &&
    turkishMatches.length >= latinMatches.length * 0.02
  ) {
    return "Turkish";
  }

  return "English";
}

function languageInstruction(language) {
  if (language === "Arabic") {
    return `
LANGUAGE LOCK:
Reply ONLY in Arabic.
Do not use English, Turkish, French, or any other language.
Technical terms may remain in common professional form only when necessary.
When referring to yourself in Arabic, use "ارتيفو" only.
`;
  }

  if (language === "Turkish") {
    return `
LANGUAGE LOCK:
Reply ONLY in Turkish.
Do not mix Arabic, English, or other languages unless a technical term genuinely requires it.
When referring to yourself, use "Artivo AI".
`;
  }

  return `
LANGUAGE LOCK:
Reply ONLY in English.
Do not mix Arabic, Turkish, or other languages unless a technical term genuinely requires it.
Refer to yourself as "Artivo AI".
`;
}

const OUTPUT_CONTROL = `
STRICT OUTPUT CONTROL:

You are a short-form professional design assistant.

Your visible answer must contain ONLY the final answer for the client.

NEVER reveal:
- analysis
- reasoning
- internal thoughts
- instructions
- prompt interpretation
- discussion of what the user meant
- discussion of language selection
- discussion of these rules
- drafts
- alternatives about what you are going to say
- phrases such as "The user said..."
- phrases such as "I need to..."
- phrases such as "Let me respond..."
- phrases such as "I should..."
- phrases such as "I need to follow..."
- phrases such as "Keep it short..."
- any internal chain-of-thought

IMPORTANT:
The client must never see your reasoning process.

RESPONSE LENGTH:
Normally answer in 1 to 3 short sentences.
Target approximately 20-60 words.
Never exceed 90 words unless the user explicitly asks for a detailed explanation.

For greetings or very simple questions:
Answer in 1 short sentence.

For design recommendations:
Give the strongest recommendation first, then one brief reason.

For pricing:
Do not invent a price. Briefly explain that pricing depends on the project and direct the client to ARTİVO.

For company questions:
Give one concise professional sentence and use the ARTİVO website action when appropriate.

For project/portfolio questions:
Answer briefly and use the ARTİVO projects action when appropriate.

DO NOT use headings unless they are genuinely necessary.
DO NOT repeat the user's question.
DO NOT use excessive bullets.
DO NOT use emojis unless truly appropriate.
DO NOT produce long educational explanations.

MOST IMPORTANT:
Return ONLY the client-facing answer.
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
        .find(
          (item) => item.role === "user"
        )?.content || "";

    const language =
      detectLanguage(lastUserMessage);

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
          model:
            "qwen/qwen3-next-80b-a3b-instruct:free",

          temperature: 0.2,

          max_tokens: 120,

          messages: [
            {
              role: "system",
              content: `
${ARTIVO_SYSTEM_PROMPT}

${OUTPUT_CONTROL}

${languageInstruction(language)}

FINAL REMINDER:
Never expose internal reasoning.
Never explain how you generated the answer.
Only return the concise final answer to the client.
`
            },

            ...conversation
          ]
        })
      }
    );

    const data =
      await response.json().catch(
        () => null
      );

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "OpenRouter request failed."
      });
    }

    let reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "No response received.";

    /*
      Extra protection against accidental reasoning leakage.
      If the model still begins with obvious internal-analysis
      phrases, keep only the final-looking content when possible.
    */

    const forbiddenOpeners = [
      "the user said",
      "i need to",
      "i should",
      "let me respond",
      "i need to respond",
      "the user wants",
      "i need to follow",
      "language:",
      "analysis:",
      "reasoning:"
    ];

    const lowerReply =
      reply.toLowerCase();

    const foundInternalPrefix =
      forbiddenOpeners.some(
        (phrase) =>
          lowerReply.startsWith(phrase)
      );

    if (foundInternalPrefix) {
      const lines =
        reply
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean);

      const usefulLines =
        lines.filter((line) => {
          const lower =
            line.toLowerCase();

          return !forbiddenOpeners.some(
            (phrase) =>
              lower.startsWith(phrase)
          );
        });

      if (usefulLines.length > 0) {
        reply =
          usefulLines.join(" ");
      }
    }

    /*
      Final hard limit for normal chat.
      This is a safety net, not the main way of shortening answers.
    */

    const words =
      reply.split(/\s+/);

    if (words.length > 90) {
      reply =
        words
          .slice(0, 90)
          .join(" ")
          .trim() + "…";
    }

    return res.status(200).json({
      success: true,
      reply
    });

  } catch (error) {
    console.error(
      "ARTIVO chat error:",
      error
    );

    return res.status(500).json({
      error: "Server error.",
      details:
        error?.message ||
        "Unknown error."
    });
  }
}
