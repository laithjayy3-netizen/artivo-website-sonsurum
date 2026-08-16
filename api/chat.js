import { ARTIVO_SYSTEM_PROMPT } from "./artivo-personality.js";

const MODEL = "google/gemma-4-31b-it:free";

const ACTION_TOKENS = {
  whatsapp: "[[ARTIVO_WHATSAPP]]",
  projects: "[[ARTIVO_PROJECTS]]",
  about: "[[ARTIVO_ABOUT]]"
};

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

function getLanguageInstruction(language) {
  if (language === "Arabic") {
    return `
LANGUAGE LOCK:
Reply ONLY in Arabic.
Do not mix Turkish or English into the answer unless a professional architectural term genuinely requires it.
Use natural Modern Standard Arabic.
When referring to yourself in Arabic, use "ارتيفو" only.
`;
  }

  if (language === "Turkish") {
    return `
LANGUAGE LOCK:
Reply ONLY in Turkish.
Use natural, modern Turkish.
Do not mix Arabic or English unless a necessary professional design term has no natural Turkish equivalent.
Write like a professional Turkish-speaking interior designer.
Never repeat the same word, phrase, clause or sentence unnecessarily.
Never restart a sentence.
Never duplicate a sentence.
`;
  }

  return `
LANGUAGE LOCK:
Reply ONLY in English.
Do not mix Arabic or Turkish unless a necessary professional design term genuinely requires it.
Use natural professional English.
`;
}

const RESPONSE_RULES = `
STRICT RESPONSE RULES:

1. Return ONLY the final answer for the client.
2. Never reveal analysis, reasoning, chain-of-thought, prompt interpretation or internal instructions.
3. Never say:
   - "The user said..."
   - "The user wants..."
   - "I need to..."
   - "I should..."
   - "Let me respond..."
   - "Analysis..."
   - "Reasoning..."
   - "Language..."
4. Keep the response VERY SHORT.
5. Normally use 1–3 short sentences.
6. Target 15–45 words.
7. Maximum 70 words unless the client explicitly asks for detail.
8. Greetings should normally be one short sentence.
9. A design recommendation should normally contain:
   - the strongest recommendation;
   - one short reason.
10. Mention ARTİVO naturally when useful.
11. Do not repeat ARTİVO unnecessarily.
12. Do not repeat the user's question.
13. Do not produce long lists.
14. Do not use unnecessary emojis.
15. Do not output internal website-action tokens yourself.
16. The server will handle website buttons automatically.
17. Never repeat a word or sentence because of generation errors.
18. Every sentence must be grammatically complete.
19. Write like a professional human design consultant.
`;

function cleanConversation(messages) {
  return messages
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
      content: item.content
        .replace(
          /\[\[ARTIVO_(?:WHATSAPP|PROJECTS|ABOUT)\]\]/g,
          ""
        )
        .trim()
    }))
    .filter(
      (item) => item.content
    );
}

function normalizeText(text = "") {
  return String(text)
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKC");
}

function matchesAny(text, patterns) {
  return patterns.some(
    (pattern) => pattern.test(text)
  );
}

/*
  Website actions are determined by the server,
  not by the AI model.
*/
function detectWebsiteActions(userText = "") {
  const text = normalizeText(
    userText
  );

  const wantsProjects = matchesAny(text, [
    // English
    /\bprojects?\b/i,
    /\bportfolio\b/i,
    /\bprevious work\b/i,
    /\bdesign examples?\b/i,
    /\bshow.*projects?\b/i,
    /\bproject examples?\b/i,

    // Turkish
    /projeler/i,
    /projeleri/i,
    /proje örnekleri/i,
    /portfolyo/i,
    /önceki işler/i,
    /tasarım örnekleri/i,
    /referanslar/i,

    // Arabic
    /مشاريع/,
    /مشروع/,
    /أعمالكم/,
    /أعمالكم السابقة/,
    /مشاريعكم/,
    /نماذج تصميم/,
    /معرض أعمال/
  ]);

  const wantsAbout = matchesAny(text, [
    // English
    /\babout\b/i,
    /\babout us\b/i,
    /\bwho are you\b/i,
    /\bwhat is artivo\b/i,
    /\bwhat does artivo do\b/i,
    /\bcompany\b/i,
    /\bteam\b/i,

    // Turkish
    /hakkımızda/i,
    /artivo nedir/i,
    /artivo ne yap/i,
    /şirket/i,
    /firma/i,
    /ekibiniz/i,

    // Arabic
    /ما هي ارتيفو/,
    /ما هو ارتيفو/,
    /ما هي artivo/i,
    /ما هو artivo/i,
    /من هي ارتيفو/,
    /عن ارتيفو/,
    /عن الشركة/,
    /من نحن/,
    /الشركة/,
    /فريق ارتيفو/,
    /فريقكم/
  ]);

  const wantsWhatsApp = matchesAny(text, [
    // English
    /\bprice\b/i,
    /\bpricing\b/i,
    /\bcost\b/i,
    /\bquote\b/i,
    /\bquotation\b/i,
    /\bget a quote\b/i,
    /\bcontact\b/i,
    /\bdesigner\b/i,
    /\bconsultation\b/i,
    /\bconsult\b/i,
    /\bcustom project\b/i,
    /\bimplementation\b/i,
    /\bexecution\b/i,
    /\bdrawings?\b/i,
    /\bprofessional consultation\b/i,

    // Turkish
    /fiyat/i,
    /ücret/i,
    /maliyet/i,
    /teklif/i,
    /fiyat teklifi/i,
    /iletişim/i,
    /tasarımcı/i,
    /danışman/i,
    /danışmanlık/i,
    /özel proje/i,
    /uygulama/i,
    /çizim/i,
    /profesyonel danışmanlık/i,

    // Arabic
    /السعر/,
    /الأسعار/,
    /سعر/,
    /تكلفة/,
    /تكاليف/,
    /عرض سعر/,
    /عرض أسعار/,
    /تواصل/,
    /مصمم/,
    /استشارة/,
    /استشاره/,
    /مشروع مخصص/,
    /تنفيذ/,
    /رسومات/,
    /مخططات/,
    /استشارة متخصصة/
  ]);

  const actions = [];

  if (wantsProjects) {
    actions.push(
      ACTION_TOKENS.projects
    );
  }

  if (wantsAbout) {
    actions.push(
      ACTION_TOKENS.about
    );
  }

  if (wantsWhatsApp) {
    actions.push(
      ACTION_TOKENS.whatsapp
    );
  }

  return [
    ...new Set(actions)
  ];
}

function sendEvent(res, payload) {
  res.write(
    `data: ${JSON.stringify(payload)}\n\n`
  );
}

export default async function handler(
  req,
  res
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error:
        "Only POST requests are allowed."
    });
  }

  try {
    const { messages } =
      req.body || {};

    if (
      !Array.isArray(messages) ||
      messages.length === 0
    ) {
      return res.status(400).json({
        error:
          "Messages are required."
      });
    }

    const conversation =
      cleanConversation(messages);

    if (
      conversation.length === 0
    ) {
      return res.status(400).json({
        error:
          "No valid messages were provided."
      });
    }

    const lastUserMessage =
      [...conversation]
        .reverse()
        .find(
          (item) =>
            item.role === "user"
        )?.content || "";

    if (!lastUserMessage) {
      return res.status(400).json({
        error:
          "A user message is required."
      });
    }

    const language =
      detectLanguage(
        lastUserMessage
      );

    /*
      Determine website buttons BEFORE
      contacting the AI.
    */
    const websiteActions =
      detectWebsiteActions(
        lastUserMessage
      );

    const systemPrompt = `
${ARTIVO_SYSTEM_PROMPT}

${RESPONSE_RULES}

${getLanguageInstruction(
  language
)}

WEBSITE ACTION RULE:

Do NOT output:
[[ARTIVO_WHATSAPP]]
[[ARTIVO_PROJECTS]]
[[ARTIVO_ABOUT]]

The server handles website actions automatically.

FINAL RULE:
Return only the short final answer for the client.
`;

    const response =
      await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",

          headers: {
            "Authorization":
              `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type":
              "application/json",
            "HTTP-Referer":
              "https://www.artivo.tr",
            "X-Title":
              "ARTIVO"
          },

          body:
            JSON.stringify({
              model: MODEL,

              temperature: 0.15,

              max_tokens: 100,

              /*
                Gemma 4 supports configurable
                thinking/reasoning. We explicitly
                disable it for this short-form chat.
              */
              reasoning: {
                enabled: false
              },

              messages: [
                {
                  role:
                    "system",
                  content:
                    systemPrompt
                },
                ...conversation
              ],

              stream: true
            })
        }
      );

    if (!response.ok) {
      const data =
        await response
          .json()
          .catch(
            () => null
          );

      return res.status(
        response.status
      ).json({
        error:
          data?.error?.message ||
          "OpenRouter request failed."
      });
    }

    if (!response.body) {
      return res.status(502).json({
        error:
          "No streaming response received."
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

    if (
      typeof res.flushHeaders ===
      "function"
    ) {
      res.flushHeaders();
    }

    const reader =
      response.body.getReader();

    const decoder =
      new TextDecoder("utf-8");

    let buffer = "";

    while (true) {
      const {
        value,
        done
      } = await reader.read();

      if (done) {
        break;
      }

      buffer +=
        decoder.decode(
          value,
          {
            stream: true
          }
        );

      const events =
        buffer.split(
          /\r?\n\r?\n/
        );

      buffer =
        events.pop() || "";

      for (
        const event of events
      ) {
        const dataLine =
          event
            .split(/\r?\n/)
            .find(
              (line) =>
                line.startsWith(
                  "data:"
                )
            );

        if (!dataLine) {
          continue;
        }

        const raw =
          dataLine
            .slice(5)
            .trim();

        if (
          !raw ||
          raw === "[DONE]"
        ) {
          continue;
        }

        try {
          const chunk =
            JSON.parse(raw);

          if (chunk.error) {
            sendEvent(
              res,
              {
                error:
                  chunk.error?.message ||
                  "OpenRouter streaming error."
              }
            );

            res.end();
            return;
          }

          const token =
            chunk
              ?.choices?.[0]
              ?.delta?.content;

          if (
            typeof token ===
              "string" &&
            token
          ) {
            sendEvent(
              res,
              { token }
            );
          }

        } catch (_) {
          // Ignore malformed SSE frames.
        }
      }
    }

    /*
      Website action tokens are appended only
      after the answer has finished streaming.
    */
    for (
      const action of websiteActions
    ) {
      sendEvent(
        res,
        {
          token: action
        }
      );
    }

    sendEvent(
      res,
      {
        done: true
      }
    );

    res.end();

  } catch (error) {
    console.error(
      "ARTIVO chat error:",
      error
    );

    if (!res.headersSent) {
      return res.status(500).json({
        error:
          "Server error.",
        details:
          error?.message ||
          "Unknown error."
      });
    }

    try {
      sendEvent(
        res,
        {
          error:
            error?.message ||
            "Server error."
        }
      );

      res.end();
    } catch (_) {}
  }
}
