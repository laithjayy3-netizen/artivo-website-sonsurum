import { ARTIVO_SYSTEM_PROMPT } from "./artivo-personality.js";

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

    // Keep only valid user/assistant messages.
    // The frontend also keeps its own short history.
    const conversation = messages
      .filter(
        (item) =>
          item &&
          (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string" &&
          item.content.trim()
      )
      .slice(-20)
      .map((item) => ({
        role: item.role,
        content: item.content.trim()
      }));

    if (conversation.length === 0) {
      return res.status(400).json({
        error: "No valid messages were provided."
      });
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://www.artivo.tr",
          "X-Title": "ARTİVO"
        },

        body: JSON.stringify({
          model: "nvidia/nemotron-3.5-lightning:free",

          // Low temperature keeps Artivo concise,
          // stable and professional.
          temperature: 0.25,

          // Intentionally limited because Artivo should
          // normally answer briefly.
          max_tokens: 180,

          messages: [
            {
              role: "system",
              content: ARTIVO_SYSTEM_PROMPT
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

    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "No response received.";

    return res.status(200).json({
      success: true,
      reply
    });

  } catch (error) {
    console.error("ARTIVO chat error:", error);

    return res.status(500).json({
      error: "Server error.",
      details:
        error?.message ||
        "Unknown error."
    });
  }
}
