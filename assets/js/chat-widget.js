/* =========================================================
   ARTIVO CHAT WIDGET
   Shared Chat Component
   ========================================================= */

(function () {
  "use strict";

  /* =======================================================
     Configuration
     ======================================================= */

  const ARTIVO_CHAT_CONFIG = {

    /*
     * سنربط هذا العنوان لاحقًا بالـAPI الحقيقي
     * الخاص بالمساعد الذكي.
     *
     * لا نحتاج لتعديله الآن.
     */
    apiEndpoint: "/api/chat",

    /*
     * التخزين المؤقت للمحادثة.
     *
     * sessionStorage:
     * تبقى المحادثة أثناء جلسة المستخدم
     * وتختفي عند انتهاء جلسة المتصفح.
     */
    storageKey: "artivo_chat_history_v1",

    /*
     * الرسالة الأولى الثابتة.
     */
    welcomeMessage:
      "Welcome. How can I assist you today?"
  };


  /* =======================================================
     1. Create Widget HTML
     * ======================================================= */

  function createChatWidget() {

    if (document.getElementById("artivoChatWidget")) {
      return;
    }

    const widget = document.createElement("div");

    widget.id = "artivoChatWidget";
    widget.className = "artivo-chat-widget";

    widget.innerHTML = `

      <!-- Chat Toggle -->
      <button
        class="artivo-chat-toggle"
        id="artivoChatToggle"
        type="button"
        aria-label="Open Artivo Assistant"
        aria-expanded="false"
      >

        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
          />
        </svg>

      </button>


      <!-- Chat Panel -->
      <div
        class="artivo-chat-panel"
        id="artivoChatPanel"
        aria-hidden="true"
      >

        <!-- Header -->
        <div class="artivo-chat-header">

          <div class="artivo-chat-avatar">

            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle
                cx="12"
                cy="8"
                r="4"
              />

              <path
                d="M5 20v-2a7 7 0 0 1 14 0v2"
              />
            </svg>

            <span class="artivo-chat-online"></span>

          </div>


          <div>

            <div class="artivo-chat-name">
              Artivo-Bot
            </div>

            <div class="artivo-chat-status">
              Online
            </div>

          </div>

        </div>


        <!-- Messages -->
        <div
          class="artivo-chat-messages"
          id="artivoChatMessages"
          aria-live="polite"
        ></div>


        <!-- Input -->
        <form
          class="artivo-chat-input-area"
          id="artivoChatForm"
        >

          <input
            type="text"
            class="artivo-chat-input"
            id="artivoChatInput"
            placeholder="Type your message..."
            autocomplete="off"
            maxlength="2000"
            aria-label="Type your message"
          />

          <button
            type="submit"
            class="artivo-chat-send"
            id="artivoChatSend"
            aria-label="Send message"
          >

            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>

          </button>

        </form>

      </div>

    `;

    document.body.appendChild(widget);
  }


  /* =======================================================
     2. Elements
     ======================================================= */

  let chatToggle;
  let chatPanel;
  let chatMessages;
  let chatForm;
  let chatInput;
  let chatSend;


  function getElements() {

    chatToggle =
      document.getElementById("artivoChatToggle");

    chatPanel =
      document.getElementById("artivoChatPanel");

    chatMessages =
      document.getElementById("artivoChatMessages");

    chatForm =
      document.getElementById("artivoChatForm");

    chatInput =
      document.getElementById("artivoChatInput");

    chatSend =
      document.getElementById("artivoChatSend");
  }


  /* =======================================================
     3. Storage
     ======================================================= */

  function loadChatHistory() {

    try {

      const saved =
        sessionStorage.getItem(
          ARTIVO_CHAT_CONFIG.storageKey
        );

      if (!saved) {
        return [];
      }

      const history =
        JSON.parse(saved);

      if (!Array.isArray(history)) {
        return [];
      }

      return history;

    } catch (error) {

      console.error(
        "Artivo Chat: Failed to load history.",
        error
      );

      return [];
    }
  }


  function saveChatHistory(history) {

    try {

      sessionStorage.setItem(
        ARTIVO_CHAT_CONFIG.storageKey,
        JSON.stringify(history)
      );

    } catch (error) {

      console.error(
        "Artivo Chat: Failed to save history.",
        error
      );
    }
  }


  /* =======================================================
     4. Conversation State
     ======================================================= */

  let chatHistory = [];


  function initializeConversation() {

    chatHistory =
      loadChatHistory();

    /*
     * إذا كانت هذه أول مرة يفتح فيها المستخدم الموقع
     * نضيف رسالة الترحيب.
     */

    if (chatHistory.length === 0) {

      chatHistory.push({
        role: "assistant",
        content:
          ARTIVO_CHAT_CONFIG.welcomeMessage,
        time:
          new Date().toISOString()
      });

      saveChatHistory(chatHistory);
    }

    renderAllMessages();
  }


  /* =======================================================
     5. Render Messages
     ======================================================= */

  function renderAllMessages() {

    chatMessages.innerHTML = "";

    chatHistory.forEach(message => {

      addMessageToUI(
        message.role,
        message.content,
        message.time,
        false
      );

    });

    scrollToBottom();
  }


  function addMessageToUI(
    role,
    text,
    time,
    shouldScroll = true
  ) {

    const messageWrapper =
      document.createElement("div");

    messageWrapper.className =
      "artivo-chat-message " +
      (role === "user" ? "user" : "bot");


    const bubble =
      document.createElement("div");

    bubble.className =
      "artivo-chat-bubble";

    /*
     * textContent بدل innerHTML
     * لمنع إدخال HTML أو JavaScript
     * من رسائل المستخدم.
     */
    bubble.textContent = text;


    const timeElement =
      document.createElement("div");

    timeElement.className =
      "artivo-chat-time";

    timeElement.textContent =
      formatTime(time);


    messageWrapper.appendChild(bubble);
    messageWrapper.appendChild(timeElement);

    chatMessages.appendChild(messageWrapper);


    if (shouldScroll) {
      scrollToBottom();
    }
  }


  function formatTime(time) {

    const date =
      time
        ? new Date(time)
        : new Date();

    return date.toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    );
  }


  function scrollToBottom() {

    requestAnimationFrame(() => {

      chatMessages.scrollTop =
        chatMessages.scrollHeight;

    });
  }


  /* =======================================================
     6. Add Messages
     ======================================================= */

  function addUserMessage(text) {

    const message = {

      role: "user",

      content: text,

      time:
        new Date().toISOString()
    };

    chatHistory.push(message);

    saveChatHistory(chatHistory);

    addMessageToUI(
      message.role,
      message.content,
      message.time
    );
  }


  function addBotMessage(text) {

    const message = {

      role: "assistant",

      content: text,

      time:
        new Date().toISOString()
    };

    chatHistory.push(message);

    saveChatHistory(chatHistory);

    addMessageToUI(
      message.role,
      message.content,
      message.time
    );
  }


  /* =======================================================
     7. Typing Indicator
     ======================================================= */

  function showTypingIndicator() {

    removeTypingIndicator();

    const wrapper =
      document.createElement("div");

    wrapper.id =
      "artivoTypingIndicator";

    wrapper.className =
      "artivo-chat-message bot";


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

    const indicator =
      document.getElementById(
        "artivoTypingIndicator"
      );

    if (indicator) {
      indicator.remove();
    }
  }


  /* =======================================================
     8. Send Message
     ======================================================= */

  async function sendMessage(text) {

    const cleanText =
      text.trim();

    if (!cleanText) {
      return;
    }


    addUserMessage(cleanText);

    chatInput.value = "";

    setLoading(true);

    showTypingIndicator();


    try {

      /*
       * هنا سيتم الاتصال بالمساعد الذكي.
       *
       * سيتم ربط هذا الجزء لاحقًا
       * بالـAPI الحقيقي الموجود لديك.
       */

      const response =
        await fetch(
          ARTIVO_CHAT_CONFIG.apiEndpoint,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({

              messages:
                chatHistory.map(message => ({
                  role: message.role,
                  content: message.content
                }))

            })
          }
        );


      if (!response.ok) {

        throw new Error(
          `HTTP ${response.status}`
        );
      }


      const data =
        await response.json();


      /*
       * نحاول دعم أكثر من شكل للـAPI.
       */

      const reply =
        data.reply ||
        data.message ||
        data.content ||
        data.response ||
        data?.choices?.[0]?.message?.content;


      if (!reply) {

        throw new Error(
          "No response text returned from API."
        );
      }


      removeTypingIndicator();

      addBotMessage(reply);

    } catch (error) {

      console.error(
        "Artivo Chat API Error:",
        error
      );

      removeTypingIndicator();

      /*
       * هذه رسالة مؤقتة فقط حتى نربط
       * الـAPI الحقيقي في الخطوة التالية.
       */

      addBotMessage(
        "I'm having trouble connecting right now. Please try again in a moment."
      );

    } finally {

      setLoading(false);

      chatInput.focus();
    }
  }


  /* =======================================================
     9. Loading State
     ======================================================= */

  function setLoading(isLoading) {

    chatSend.disabled =
      isLoading;

    chatInput.disabled =
      isLoading;
  }


  /* =======================================================
     10. Open / Close Chat
     ======================================================= */

  function openChat() {

    chatPanel.classList.add("active");

    chatPanel.setAttribute(
      "aria-hidden",
      "false"
    );

    chatToggle.setAttribute(
      "aria-expanded",
      "true"
    );

    setTimeout(() => {
      chatInput.focus();
      scrollToBottom();
    }, 100);
  }


  function closeChat() {

    chatPanel.classList.remove("active");

    chatPanel.setAttribute(
      "aria-hidden",
      "true"
    );

    chatToggle.setAttribute(
      "aria-expanded",
      "false"
    );
  }


  function toggleChat() {

    if (
      chatPanel.classList.contains("active")
    ) {

      closeChat();

    } else {

      openChat();

    }
  }


  /* =======================================================
     11. Events
     ======================================================= */

  function setupEvents() {

    chatToggle.addEventListener(
      "click",
      function (event) {

        event.stopPropagation();

        toggleChat();
      }
    );


    chatPanel.addEventListener(
      "click",
      function (event) {

        event.stopPropagation();
      }
    );


    document.addEventListener(
      "click",
      function (event) {

        if (
          !event.target.closest(
            "#artivoChatWidget"
          )
        ) {

          closeChat();

        }
      }
    );


    chatForm.addEventListener(
      "submit",
      function (event) {

        event.preventDefault();

        sendMessage(
          chatInput.value
        );
      }
    );


    /*
     * Enter = إرسال
     *
     * Shift + Enter = سطر جديد
     *
     * حاليًا صندوق الإدخال input لذلك
     * Enter سيقوم بالإرسال مباشرة.
     */

    chatInput.addEventListener(
      "keydown",
      function (event) {

        if (
          event.key === "Enter"
        ) {

          event.preventDefault();

          chatForm.requestSubmit();
        }
      }
    );
  }


  /* =======================================================
     12. Start
     ======================================================= */

  function initArtivoChat() {

    createChatWidget();

    getElements();

    initializeConversation();

    setupEvents();
  }


  /*
   * انتظر حتى يتم تحميل الصفحة بالكامل.
   */

  if (
    document.readyState === "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initArtivoChat
    );

  } else {

    initArtivoChat();
  }

})();
