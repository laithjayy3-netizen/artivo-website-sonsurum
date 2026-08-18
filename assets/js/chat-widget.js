/* =========================================================
   ARTIVO CHAT WIDGET
   Shared widget + ARTIVO /api/chat integration
   ========================================================= */

(function () {
  "use strict";

  const ARTIVO_CHAT_CONFIG = {
    apiEndpoint: "/api/chat",
    storageKey: "artivo_chat_history_v1",
    maxStoredMessages: 20,
    welcomeMessage: "Welcome. How can I assist you today?"
  };

  let chatToggle;
  let chatPanel;
  let chatMessages;
  let chatForm;
  let chatInput;
  let chatSend;
  let chatHistory = [];
  let isSending = false;

  function createChatWidget() {
    if (document.getElementById("artivoChatWidget")) return;

    const widget = document.createElement("div");
    widget.id = "artivoChatWidget";
    widget.className = "artivo-chat-widget";

    widget.innerHTML = `
      <button class="artivo-chat-toggle" id="artivoChatToggle" type="button" aria-label="Open Artivo Assistant" aria-expanded="false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      <div class="artivo-chat-panel" id="artivoChatPanel" aria-hidden="true">
        <div class="artivo-chat-header">
          <div class="artivo-chat-avatar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M5 20v-2a7 7 0 0 1 14 0v2" />
            </svg>
            <span class="artivo-chat-online"></span>
          </div>
          <div>
            <div class="artivo-chat-name">Artivo-Bot</div>
            <div class="artivo-chat-status">Online</div>
          </div>
        </div>

        <div class="artivo-chat-messages" id="artivoChatMessages" aria-live="polite"></div>

        <form class="artivo-chat-input-area" id="artivoChatForm">
          <input
            type="text"
            class="artivo-chat-input"
            id="artivoChatInput"
            placeholder="Type your message..."
            autocomplete="off"
            maxlength="2000"
            aria-label="Type your message"
          />
          <button type="submit" class="artivo-chat-send" id="artivoChatSend" aria-label="Send message">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(widget);
  }

  function getElements() {
    chatToggle = document.getElementById("artivoChatToggle");
    chatPanel = document.getElementById("artivoChatPanel");
    chatMessages = document.getElementById("artivoChatMessages");
    chatForm = document.getElementById("artivoChatForm");
    chatInput = document.getElementById("artivoChatInput");
    chatSend = document.getElementById("artivoChatSend");
  }

  function loadChatHistory() {
    try {
      const saved = sessionStorage.getItem(ARTIVO_CHAT_CONFIG.storageKey);
      if (!saved) return [];
      const history = JSON.parse(saved);
      if (!Array.isArray(history)) return [];
      return history.filter(
        (item) =>
          item &&
          (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string" &&
          item.content.trim()
      );
    } catch (error) {
      console.error("Artivo Chat: Failed to load history.", error);
      return [];
    }
  }

  function saveChatHistory() {
    try {
      chatHistory = chatHistory.slice(-ARTIVO_CHAT_CONFIG.maxStoredMessages);
      sessionStorage.setItem(
        ARTIVO_CHAT_CONFIG.storageKey,
        JSON.stringify(chatHistory)
      );
    } catch (error) {
      console.error("Artivo Chat: Failed to save history.", error);
    }
  }

  function initializeConversation() {
    chatHistory = loadChatHistory();

    if (chatHistory.length === 0) {
      chatHistory.push({
        role: "assistant",
        content: ARTIVO_CHAT_CONFIG.welcomeMessage,
        time: new Date().toISOString()
      });
      saveChatHistory();
    }

    renderAllMessages();
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = String(text || "");
    return div.innerHTML;
  }

  function detectArabic(text) {
    return /[\u0600-\u06FF]/.test(String(text || ""));
  }

  function getAssistantDisplayName(text) {
    return detectArabic(text) ? "ارتيفو" : "Artivo AI";
  }

  function formatInlineMarkdown(text) {
    let html = escapeHtml(text);
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    return html;
  }

  function renderAssistantMarkdown(text) {
    const source = String(text || "").replace(/\r\n/g, "\n");
    const lines = source.split("\n");
    const output = [];
    let paragraph = [];
    let listType = null;

    const closeList = () => {
      if (listType) {
        output.push(listType === "ul" ? "</ul>" : "</ol>");
        listType = null;
      }
    };

    const flushParagraph = () => {
      if (paragraph.length) {
        output.push(`<p>${paragraph.join("<br>")}</p>`);
        paragraph = [];
      }
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line) {
        flushParagraph();
        closeList();
        continue;
      }

      let match = line.match(/^###\s+(.+)$/);
      if (match) {
        flushParagraph();
        closeList();
        output.push(`<h4>${formatInlineMarkdown(match[1])}</h4>`);
        continue;
      }

      match = line.match(/^##\s+(.+)$/);
      if (match) {
        flushParagraph();
        closeList();
        output.push(`<h3>${formatInlineMarkdown(match[1])}</h3>`);
        continue;
      }

      match = line.match(/^#\s+(.+)$/);
      if (match) {
        flushParagraph();
        closeList();
        output.push(`<h2>${formatInlineMarkdown(match[1])}</h2>`);
        continue;
      }

      match = line.match(/^[-*]\s+(.+)$/);
      if (match) {
        flushParagraph();
        if (listType !== "ul") {
          closeList();
          output.push("<ul>");
          listType = "ul";
        }
        output.push(`<li>${formatInlineMarkdown(match[1])}</li>`);
        continue;
      }

      match = line.match(/^\d+[.)]\s+(.+)$/);
      if (match) {
        flushParagraph();
        if (listType !== "ol") {
          closeList();
          output.push("<ol>");
          listType = "ol";
        }
        output.push(`<li>${formatInlineMarkdown(match[1])}</li>`);
        continue;
      }

      closeList();
      paragraph.push(formatInlineMarkdown(line));
    }

    flushParagraph();
    closeList();
    return output.join("");
  }

  function parseAssistantContent(rawText) {
    const original = String(rawText || "");
    const hasWhatsApp = original.includes("[[ARTIVO_WHATSAPP]]");
    const hasProjects = original.includes("[[ARTIVO_PROJECTS]]");
    const hasAbout = original.includes("[[ARTIVO_ABOUT]]");

    const cleanText = original
      .replace(/\[\[ARTIVO_WHATSAPP\]\]/g, "")
      .replace(/\[\[ARTIVO_PROJECTS\]\]/g, "")
      .replace(/\[\[ARTIVO_ABOUT\]\]/g, "")
      .trim();

    const arabic = detectArabic(cleanText);
    const actions = [];

    if (hasWhatsApp) {
      actions.push({
        href: "https://wa.me/905424318166",
        label: arabic
          ? "للتواصل مع مصممي ARTİVO — اضغط هنا"
          : "Talk to an ARTİVO Designer — Click Here",
        primary: true,
        external: true
      });
    }

    if (hasProjects) {
      actions.push({
        href: "projects.html",
        label: arabic ? "استكشف مشاريع ARTİVO" : "Explore ARTİVO Projects",
        primary: false,
        external: false
      });
    }

    if (hasAbout) {
      actions.push({
        href: "about.html",
        label: arabic ? "تعرف أكثر على ARTİVO" : "Discover ARTİVO",
        primary: false,
        external: false
      });
    }

    return {
      cleanText,
      html: renderAssistantMarkdown(cleanText),
      actions
    };
  }

  function addActions(bubble, actions) {
    if (!actions.length) return;

    const actionWrap = document.createElement("div");
    actionWrap.className = "artivo-actions";

    actions.forEach((action) => {
      const link = document.createElement("a");
      link.className = action.primary
        ? "artivo-action-btn primary"
        : "artivo-action-btn";
      link.href = action.href;

      if (action.external) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }

      link.textContent = action.label;
      actionWrap.appendChild(link);
    });

    bubble.appendChild(actionWrap);
  }

  function getTime(time) {
    return new Date(time || Date.now()).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function addMessageToUI(role, text, time, shouldScroll = true) {
    const row = document.createElement("div");
    row.className = `artivo-chat-message ${role === "user" ? "user" : "bot"}`;

    const bubble = document.createElement("div");
    bubble.className = "artivo-chat-bubble";
    bubble.dir = "auto";

    if (role === "assistant") {
      const rendered = parseAssistantContent(text);
      bubble.innerHTML = rendered.html;
      addActions(bubble, rendered.actions);
    } else {
      bubble.textContent = text;
    }

    const timeElement = document.createElement("div");
    timeElement.className = "artivo-chat-time";
    timeElement.textContent = getTime(time);

    row.appendChild(bubble);
    row.appendChild(timeElement);
    chatMessages.appendChild(row);

    if (shouldScroll) scrollToBottom();
  }

  function renderAllMessages() {
    chatMessages.innerHTML = "";
    chatHistory.forEach((message) => {
      addMessageToUI(
        message.role,
        message.content,
        message.time,
        false
      );
    });
    scrollToBottom();
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  function showTypingIndicator() {
    removeTypingIndicator();

    const wrapper = document.createElement("div");
    wrapper.id = "artivoTypingIndicator";
    wrapper.className = "artivo-chat-message bot";

    wrapper.innerHTML = `
      <div class="artivo-chat-typing">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;

    chatMessages.appendChild(wrapper);
    scrollToBottom();
  }

  function removeTypingIndicator() {
    document.getElementById("artivoTypingIndicator")?.remove();
  }

  function setLoading(state) {
    isSending = state;
    chatSend.disabled = state;
    chatInput.disabled = state;
  }

  function addUserMessage(text) {
    const message = {
      role: "user",
      content: text,
      time: new Date().toISOString()
    };

    chatHistory.push(message);
    saveChatHistory();
    addMessageToUI(message.role, message.content, message.time);
  }

  function addAssistantMessage(text) {
    const message = {
      role: "assistant",
      content: text,
      time: new Date().toISOString()
    };

    chatHistory.push(message);
    saveChatHistory();
    addMessageToUI(message.role, message.content, message.time);
  }

  async function sendMessage(text) {
    if (isSending) return;

    const cleanText = String(text || "").trim();
    if (!cleanText) return;

    addUserMessage(cleanText);
    chatInput.value = "";
    setLoading(true);
    showTypingIndicator();

    try {
      const apiMessages = chatHistory
        .slice(-ARTIVO_CHAT_CONFIG.maxStoredMessages)
        .map((message) => ({
          role: message.role,
          content: message.content
        }));

      const response = await fetch(
        ARTIVO_CHAT_CONFIG.apiEndpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messages: apiMessages
          })
        }
      );

      const data = await response.json().catch(() => null);
      removeTypingIndicator();

      if (!response.ok || !data || !data.success) {
        chatHistory.pop();
        saveChatHistory();
        throw new Error(
          data?.error || "Unable to get a response from Artivo AI."
        );
      }

      const reply =
        typeof data.reply === "string" && data.reply.trim()
          ? data.reply.trim()
          : "No response received.";

      addAssistantMessage(reply);
    } catch (error) {
      removeTypingIndicator();
      console.error("Artivo Chat API Error:", error);

      addAssistantMessage(
        "I'm having trouble connecting right now. Please try again in a moment."
      );
    } finally {
      setLoading(false);
      chatInput.focus();
    }
  }

  function openChat() {
    chatPanel.classList.add("active");
    chatPanel.setAttribute("aria-hidden", "false");
    chatToggle.setAttribute("aria-expanded", "true");

    setTimeout(() => {
      chatInput.focus();
      scrollToBottom();
    }, 100);
  }

  function closeChat() {
    chatPanel.classList.remove("active");
    chatPanel.setAttribute("aria-hidden", "true");
    chatToggle.setAttribute("aria-expanded", "false");
  }

  function toggleChat() {
    if (chatPanel.classList.contains("active")) closeChat();
    else openChat();
  }

  function setupEvents() {
    chatToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleChat();
    });

    chatPanel.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest("#artivoChatWidget")) {
        closeChat();
      }
    });

    chatForm.addEventListener("submit", (event) => {
      event.preventDefault();
      sendMessage(chatInput.value);
    });

    chatInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        chatForm.requestSubmit();
      }
    });
  }

  function initArtivoChat() {
    createChatWidget();
    getElements();
    initializeConversation();
    setupEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initArtivoChat);
  } else {
    initArtivoChat();
  }
})();
