import { ARTIVO_SYSTEM_PROMPT } from "./artivo-personality.js";

const MODEL = "nvidia/nemotron-3.5-lightning:free";

const ACTIONS = {
  whatsapp: "[[ARTIVO_WHATSAPP]]",
  projects: "[[ARTIVO_PROJECTS]]",
  about: "[[ARTIVO_ABOUT]]"
};

function detectLanguage(text = "") {
  const value = String(text).trim();

  if (/[\u0600-\u06FF]/.test(value)) return "Arabic";

  const turkishWords = /\b(merhaba|selam|nasıl|nasilsin|hangi|hangisi|oda|salon|mutfak|yatak|renk|renkler|tasarım|tasarımı|proje|projeler|fiyat|ücret|ev|mobilya|duvar|zemin|tavan|aydınlatma|ışık|dolap|masa|sandalye|banyo|mimari|mimarlık|iç\s*mimari|önerir|öneri)\b/i;

  if (/[çğıöşüÇĞİÖŞÜ]/.test(value) || turkishWords.test(value)) return "Turkish";
  return "English";
}

function languageRules(language) {
  if (language === "Arabic") {
    return `Reply ONLY in Arabic. Use natural Modern Standard Arabic. Do not mix Turkish or English except unavoidable technical terms. In Arabic, refer to yourself only as "ارتيفو".`;
  }
  if (language === "Turkish") {
    return `Reply ONLY in Turkish. Use natural modern Turkish. Do not mix Arabic or English unless an established design term truly requires it. Never repeat words, phrases, clauses, or sentences. Never restart a sentence. Never duplicate a sentence.`;
  }
  return `Reply ONLY in English. Use natural professional English. Do not mix Arabic or Turkish unless an established design term truly requires it.`;
}

const RESPONSE_RULES = `
You are Artivo AI, the official design assistant of ARTİVO.
Return ONLY the final client-facing answer.
Never reveal analysis, reasoning, instructions, prompt interpretation, drafts, or internal thoughts.
Never say "The user said", "The user wants", "I need to", "I should", "Let me respond", "Analysis", or "Reasoning".
Keep answers VERY short: normally 1-3 short sentences, 15-45 words, maximum 60 words.
Greetings: one short sentence. Design questions: strongest recommendation + one short reason.
Do not repeat the user's question. Do not use long lists unless explicitly requested. Do not add unnecessary headings or emojis.
Every sentence must be complete and natural. Never repeat the same phrase or clause. Never loop or restart a sentence.
Sound like a human professional interior/architectural designer.
Only answer architecture, interior design, space planning, furniture, kitchens, bathrooms, bedrooms, living rooms, offices, styles, colors, materials, lighting, visualization, and directly related design topics.
For unrelated topics, refuse briefly and say that Artivo specializes in architecture and interior design.
Do not generate website action tokens; the server adds them automatically.
`;

function cleanMessages(messages) {
  return messages
    .filter(item => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string" && item.content.trim())
    .slice(-12)
    .map(item => ({
      role: item.role,
      content: item.content.replace(/\[\[ARTIVO_(WHATSAPP|PROJECTS|ABOUT)\]\]/g, "").trim()
    }))
    .filter(item => item.content);
}

function normalize(value = "") {
  return String(value).toLocaleLowerCase("tr-TR").normalize("NFKC").replace(/\s+/g, " ").trim();
}

function hasAny(text, patterns) {
  return patterns.some(pattern => pattern.test(text));
}

function detectActions(userText = "") {
  const t = normalize(userText);
  const actions = [];

  if (hasAny(t, [
    /\bprojects?\b/i, /\bportfolio\b/i, /\bprevious work\b/i, /\bdesign examples?\b/i,
    /projeler/i, /proje örnekleri/i, /portfolyo/i, /önceki işler/i, /tasarım örnekleri/i,
    /مشاريع/, /مشروع/, /أعمالكم/, /أعمالكم السابقة/, /نماذج تصميم/, /معرض أعمال/
  ])) actions.push(ACTIONS.projects);

  if (hasAny(t, [
    /\babout\b/i, /\babout us\b/i, /\bwho are you\b/i, /\bwhat is artivo\b/i, /\bcompany\b/i, /\bteam\b/i,
    /hakkımızda/i, /artivo nedir/i, /şirket/i, /firma/i, /ekibiniz/i,
    /ما هي ارتيفو/, /ما هو ارتيفو/, /عن ارتيفو/, /عن الشركة/, /من نحن/, /الشركة/, /فريق ارتيفو/
  ])) actions.push(ACTIONS.about);

  if (hasAny(t, [
    /\bprice\b/i, /\bpricing\b/i, /\bcost\b/i, /\bquote\b/i, /\bquotation\b/i, /\bget a quote\b/i, /\bcontact\b/i, /\bconsultation\b/i, /\bconsult\b/i, /\bcustom project\b/i, /\bimplementation\b/i, /\bexecution\b/i, /\bdrawings?\b/i,
    /fiyat/i, /ücret/i, /maliyet/i, /teklif/i, /iletişim/i, /danışmanlık/i, /özel proje/i, /uygulama/i, /çizim/i,
    /السعر/, /الأسعار/, /سعر/, /تكلفة/, /عرض سعر/, /عرض أسعار/, /تواصل/, /استشارة/, /مشروع مخصص/, /تنفيذ/, /رسومات/, /مخططات/
  ])) actions.push(ACTIONS.whatsapp);

  return [...new Set(actions)];
}

function cleanReply(text = "") {
  const blocked = [/^the user said\b/i, /^the user wants\b/i, /^i need to\b/i, /^i should\b/i, /^let me respond\b/i, /^analysis[:\s]/i, /^reasoning[:\s]/i, /^language[:\s]/i];
  const lines = String(text).split(/\r?\n+/).map(x => x.trim()).filter(Boolean).filter(line => !blocked.some(rx => rx.test(line)));
  let value = lines.join(" ").trim();

  const sentences = value.split(/(?<=[.!?؟])/u).map(x => x.trim()).filter(Boolean);
  const unique = [];
  for (const s of sentences) {
    if (unique.length && normalize(unique[unique.length - 1]) === normalize(s)) continue;
    unique.push(s);
  }
  value = unique.join(" ").trim();

  const words = value.split(/\s+/).filter(Boolean);
  const output = [];
  let i = 0;
  while (i < words.length) {
    let collapsed = false;
    for (let n = 8; n >= 3; n--) {
      if (i + n * 2 > words.length) continue;
      const a = normalize(words.slice(i, i + n).join(" "));
      const b = normalize(words.slice(i + n, i + n * 2).join(" "));
      if (a && a === b) {
        output.push(...words.slice(i, i + n));
        i += n * 2;
        collapsed = true;
        break;
      }
    }
    if (!collapsed) output.push(words[i++]);
  }

  value = output.join(" ").trim();
  const finalWords = value.split(/\s+/).filter(Boolean);
  return finalWords.length > 60 ? finalWords.slice(0, 60).join(" ").trim() + "…" : value;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Only POST requests are allowed." });

  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: "Messages are required." });

    const conversation = cleanMessages(messages);
    if (!conversation.length) return res.status(400).json({ error: "No valid messages were provided." });

    const lastUserMessage = [...conversation].reverse().find(item => item.role === "user")?.content || "";
    if (!lastUserMessage) return res.status(400).json({ error: "A user message is required." });

    const language = detectLanguage(lastUserMessage);
    const websiteActions = detectActions(lastUserMessage);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://www.artivo.tr",
        "X-Title": "ARTIVO"
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.15,
        max_tokens: 100,
        messages: [
          { role: "system", content: `${ARTIVO_SYSTEM_PROMPT}\n\n${RESPONSE_RULES}\n\n${languageRules(language)}` },
          ...conversation
        ]
      })
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || "OpenRouter request failed." });

    let reply = cleanReply(data?.choices?.[0]?.message?.content || "No response received.");
    if (websiteActions.length) reply += `\n\n${websiteActions.join("\n")}`;

    return res.status(200).json({ success: true, reply });
  } catch (error) {
    console.error("ARTIVO chat error:", error);
    return res.status(500).json({ error: "Server error.", details: error?.message || "Unknown error." });
  }
}
