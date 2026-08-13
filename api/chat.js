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

    // Keep only user/assistant messages and limit conversation size.
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

    const systemMessage = {
      role: "system",
      content:
        "You are Artivo AI, the official AI assistant of Artivo, a platform focused on interior design, architecture, furniture, materials, lighting, spatial planning, and architectural visualization. Respond professionally, clearly, and helpfully. Maintain the context of the current conversation and use previous user and assistant messages when answering."
    };

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://artivo.tr",
          "X-Title": "Artivo"
        },

        body: JSON.stringify({
          model: "nvidia/nemotron-3.5-lightning:free",

          messages: [
            systemMessage,
            ...conversation
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "OpenRouter request failed."
      });
    }

    return res.status(200).json({
      success: true,
      reply:
        data?.choices?.[0]?.message?.content ||
        "No response received."
    });

  } catch (error) {
    return res.status(500).json({
      error: "Server error.",
      details: error.message
    });
  }
}
