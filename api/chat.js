export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Only POST requests are allowed."
    });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://artivo.tr",
        "X-Title": "Artivo"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.2-3b-instruct:free",
        messages: [
          {
            role: "system",
            content: "You are Artivo AI, an AI assistant specialized in interior design and architecture."
          },
          {
            role: "user",
            content: "Hello Artivo"
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "OpenRouter request failed."
      });
    }

    return res.status(200).json({
      success: true,
      reply: data.choices?.[0]?.message?.content || "No response received."
    });

  } catch (error) {
    return res.status(500).json({
      error: "Server error.",
      details: error.message
    });
  }
}
