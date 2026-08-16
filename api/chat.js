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
          stream: true,
          temperature: 0.3,
          max_tokens: 220,

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

    if (!response.ok) {
      const data = await response.json().catch(() => null);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "OpenRouter request failed."
      });
    }

    if (!response.body) {
      return res.status(502).json({
        error: "No streaming response received."
      });
    }

    res.statusCode = 200;

    res.setHeader(
      "Content-Type",
      "text/event-stream; charset=utf-8"
    );

    res.setHeader(
      "Cache-Control",
      "no-cache, no-transform"
    );

    res.setHeader(
      "Connection",
      "keep-alive"
    );

    res.setHeader(
      "X-Accel-Buffering",
      "no"
    );

    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    const reader =
      response.body.getReader();

    const decoder =
      new TextDecoder("utf-8");

    let buffer = "";

    const sendEvent = (payload) => {
      res.write(
        `data: ${JSON.stringify(payload)}\n\n`
      );
    };

    while (true) {
      const { value, done } =
        await reader.read();

      if (done) {
        break;
      }

      buffer +=
        decoder.decode(
          value,
          { stream: true }
        );

      const events =
        buffer.split(/\r?\n\r?\n/);

      buffer =
        events.pop() || "";

      for (const event of events) {
        const dataLine =
          event
            .split(/\r?\n/)
            .find((line) =>
              line.startsWith("data:")
            );

        if (!dataLine) {
          continue;
        }

        const raw =
          dataLine
            .slice(5)
            .trim();

        if (!raw) {
          continue;
        }

        if (raw === "[DONE]") {
          continue;
        }

        try {
          const chunk =
            JSON.parse(raw);

          if (chunk.error) {
            sendEvent({
              error:
                chunk.error?.message ||
                "OpenRouter streaming error."
            });

            res.end();
            return;
          }

          const token =
            chunk?.choices?.[0]?.delta?.content;

          if (typeof token === "string" && token) {
            sendEvent({
              token
            });
          }
        } catch (_) {
          // Ignore malformed/non-JSON SSE frames.
        }
      }
    }

    sendEvent({
      done: true
    });

    res.end();

  } catch (error) {
    console.error(
      "ARTIVO chat error:",
      error
    );

    if (!res.headersSent) {
      return res.status(500).json({
        error: "Server error.",
        details: error?.message || "Unknown error."
      });
    }

    try {
      res.write(
        `data: ${JSON.stringify({
          error:
            error?.message ||
            "Server error."
        })}\n\n`
      );
      res.end();
    } catch (_) {}
  }
}
