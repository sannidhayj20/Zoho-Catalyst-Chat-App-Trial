/* Paste this into a <script> tag or your browser console on any page.
   It renders a fully client-side chat UI with modern styling and animations.
   No external libraries. It talks to /server/app_function/execute, but will not throw if the API is missing. */
(() => {
  "use strict";

  // -------------------------------
  // Config
  // -------------------------------
  const API_BASE = "/server/app_function/execute";

  // -------------------------------
  // Utilities
  // -------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const createEl = (tag, opts = {}) => {
    const el = document.createElement(tag);
    if (opts.class) el.className = opts.class;
    if (opts.text != null) el.textContent = opts.text;
    if (opts.html != null) el.innerHTML = opts.html;
    if (opts.attrs) Object.entries(opts.attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };

  const parseApiPayload = async (res) => {
    // Graceful parsing; never throws.
    let text = "";
    try {
      text = await res.text();
      const base = JSON.parse(text);
      if (base && typeof base === "object" && "output" in base) {
        try {
          return JSON.parse(base.output);
        } catch {
          return base.output; // not JSON, return as-is
        }
      }
      return base;
    } catch {
      // Not JSON, return empty
      return {};
    }
  };

  const safeFetch = async (url, options = {}) => {
    try {
      const res = await fetch(url, options);
      const data = await parseApiPayload(res);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err };
    }
  };

  // -------------------------------
  // Simple Toast
  // -------------------------------
  const Toast = (() => {
    let container;
    const ensure = () => {
      if (!container) {
        container = createEl("div", { class: "ca-toast-container" });
        document.body.appendChild(container);
      }
    };
    const show = (msg) => {
      ensure();
      const item = createEl("div", { class: "ca-toast", text: msg });
      container.appendChild(item);
      requestAnimationFrame(() => item.classList.add("show"));
      setTimeout(() => {
        item.classList.remove("show");
        setTimeout(() => item.remove(), 250);
      }, 2000);
    };
    return { show };
  })();

  // -------------------------------
  // State
  // -------------------------------
  const state = {
    chats: [],
    selectedChatId: null,
    messages: [],
    chatTitle: "",
    messageInput: "",
    loadingChats: false,
    sending: false,
    polling: null,
  };

  // -------------------------------
  // Styles (CSS-in-JS)
  // Only 5 colors total (design guideline): bg, surface, text, primary, accent
  // -------------------------------
  const injectStyles = () => {
    if ($("#ca-styles")) return;
    const style = createEl("style", { attrs: { id: "ca-styles" } });
    style.textContent = `
:root {
  --bg: #0b1220;         /* background (neutral) */
  --surface: #111827;    /* card surface (neutral) */
  --text: #e5e7eb;       /* text (neutral) */
  --primary: #2563eb;    /* primary */
  --accent: #10b981;     /* accent */
  --radius: 14px;
  --shadow: 0 10px 25px rgba(0,0,0,0.35);
  --shadow-soft: 0 8px 20px rgba(0,0,0,0.22);
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font: 14px/1.55 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji; }

.ca-root {
  position: relative;
  max-width: 1200px;
  height: 90vh;
  margin: 24px auto;
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 16px;
  padding: 0 12px;
}

@media (max-width: 860px) {
  .ca-root { grid-template-columns: 1fr; height: auto; }
}

.ca-card {
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  min-height: 0;
  animation: ca-pop 320ms cubic-bezier(.2,.8,.2,1);
}

.ca-header {
  padding: 16px 16px 8px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ca-title {
  font-weight: 700;
  letter-spacing: 0.2px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.ca-spin {
  display: inline-block;
  width: 16px; height: 16px;
  border: 2px solid rgba(229,231,235,0.25);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: ca-spin 880ms linear infinite;
}

.ca-body { padding: 12px 16px 16px 16px; display: flex; flex-direction: column; min-height: 0; }

.ca-scroll {
  overflow: auto;
  min-height: 0;
  max-height: 99999px;
  scrollbar-gutter: stable both-edges;
}
.ca-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
.ca-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 999px; }
.ca-scroll:hover::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.16); }

.ca-sidebar-list { display: flex; flex-direction: column; gap: 8px; padding-right: 4px; }

.ca-chat-item {
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  background: rgba(255,255,255,0.02);
  transition: transform 120ms ease, background 150ms ease, border-color 150ms ease;
  border: 1px solid rgba(229,231,235,0.06);
  will-change: transform;
}
.ca-chat-item:hover { transform: translateY(-1px); background: rgba(255,255,255,0.04); }
.ca-chat-item.is-active {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary) inset, var(--shadow-soft);
}

.ca-actions { display: grid; grid-template-columns: 1fr; gap: 8px; margin-top: 12px; }

.ca-input, .ca-text {
  width: 100%;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(229,231,235,0.08);
  background: rgba(255,255,255,0.02);
  color: var(--text);
  outline: none;
  transition: border-color 150ms ease, background 150ms ease, box-shadow 150ms ease;
}
.ca-input:focus, .ca-text:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(37,99,235,0.25);
  background: rgba(255,255,255,0.04);
}

.ca-btn {
  appearance: none;
  border: none;
  user-select: none;
  cursor: pointer;
  border-radius: 12px;
  padding: 10px 14px;
  font-weight: 600;
  color: var(--text);
  background: rgba(255,255,255,0.06);
  transition: transform 120ms ease, background 150ms ease, box-shadow 150ms ease, opacity 150ms ease;
  will-change: transform;
}
.ca-btn:hover { transform: translateY(-1px); background: rgba(255,255,255,0.10); box-shadow: var(--shadow-soft); }
.ca-btn:active { transform: translateY(0); }
.ca-btn[disabled] { opacity: 0.55; cursor: not-allowed; box-shadow: none; transform: none; }

.ca-btn.primary { background: var(--primary); color: white; }
.ca-btn.primary:hover { background: #1e53c9; }

.ca-btn.accent { background: var(--accent); color: black; }
.ca-btn.accent:hover { background: #0ea371; }

.ca-divider { height: 1px; background: rgba(229,231,235,0.06); margin: 10px 0 6px; }

.ca-main {
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 8px;
  min-height: 0;
}

.ca-message-list {
  display: flex; flex-direction: column; gap: 10px;
  padding-right: 6px;
}

.ca-bubble {
  max-width: 72%;
  padding: 10px 12px;
  border-radius: 14px;
  line-height: 1.45;
  animation: ca-fade-up 220ms ease both;
  word-wrap: break-word;
  white-space: pre-wrap;
}
.ca-bubble.bot {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(229,231,235,0.08);
  align-self: flex-start;
}
.ca-bubble.user {
  background: var(--primary);
  color: #ffffff;
  align-self: flex-end;
}

.ca-composer { display: grid; grid-template-columns: 1fr auto; gap: 8px; }

.ca-empty {
  opacity: 0.75;
  text-align: center;
  padding: 24px 0;
}

.ca-header-actions { display: inline-flex; gap: 8px; align-items: center; }

.ca-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(229,231,235,0.08);
  font-weight: 600;
}

.ca-toast-container {
  position: fixed; top: 14px; right: 14px;
  display: flex; flex-direction: column; gap: 8px; z-index: 9999999;
}
.ca-toast {
  background: rgba(17,24,39,0.92);
  color: var(--text);
  border: 1px solid rgba(229,231,235,0.12);
  padding: 10px 12px;
  border-radius: 12px;
  transform: translateY(-10px);
  opacity: 0;
  transition: transform 180ms ease, opacity 180ms ease;
  box-shadow: var(--shadow);
}
.ca-toast.show { transform: translateY(0); opacity: 1; }

@keyframes ca-spin { to { transform: rotate(360deg); } }
@keyframes ca-fade-up {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ca-pop {
  0% { transform: scale(.98); opacity: .0; }
  60% { transform: scale(1.01); opacity: 1; }
  100% { transform: scale(1); }
}
`;
    document.head.appendChild(style);
  };

  // -------------------------------
  // DOM Structure
  // -------------------------------
  const els = {
    root: null,
    // Sidebar
    sidebarCard: null,
    chatsHeader: null,
    chatsSpinner: null,
    chatsList: null,
    newChatInput: null,
    newChatBtn: null,
    deleteBtn: null,
    // Main
    mainCard: null,
    messagesHeader: null,
    messagesList: null,
    messageInput: null,
    sendBtn: null,
  };

  const buildUI = () => {
    // Root container
    els.root = createEl("div", { class: "ca-root" });

    // Sidebar card
    els.sidebarCard = createEl("div", { class: "ca-card" });
    const sHeader = createEl("div", { class: "ca-header" });
    els.chatsHeader = createEl("div", { class: "ca-title", html: "📋 Chats" });
    els.chatsSpinner = createEl("span", { class: "ca-spin", attrs: { "aria-hidden": "true" } });
    // Spinner inserted dynamically when loading
    const sHeaderActions = createEl("div", { class: "ca-header-actions" });
    sHeader.appendChild(els.chatsHeader);
    sHeader.appendChild(sHeaderActions);

    const sBody = createEl("div", { class: "ca-body" });
    const sScroll = createEl("div", { class: "ca-scroll" });
    els.chatsList = createEl("div", { class: "ca-sidebar-list" });
    sScroll.appendChild(els.chatsList);

    const sActions = createEl("div", { class: "ca-actions" });
    els.newChatInput = createEl("input", { class: "ca-input", attrs: { placeholder: "New chat title" } });
    els.newChatBtn = createEl("button", { class: "ca-btn accent", html: "＋ New Chat" });
    els.deleteBtn = createEl("button", { class: "ca-btn", html: "🗑️ Delete Chat" });
    sActions.appendChild(els.newChatInput);
    sActions.appendChild(els.newChatBtn);
    sActions.appendChild(els.deleteBtn);

    sBody.appendChild(sScroll);
    sBody.appendChild(createEl("div", { class: "ca-divider" }));
    sBody.appendChild(sActions);

    els.sidebarCard.appendChild(sHeader);
    els.sidebarCard.appendChild(sBody);

    // Main card
    els.mainCard = createEl("div", { class: "ca-card ca-main" });
    const mHeader = createEl("div", { class: "ca-header" });
    els.messagesHeader = createEl("div", { class: "ca-title", html: "💬 Messages" });
    const mHeaderRight = createEl("div", { class: "ca-header-actions" });
    mHeader.appendChild(els.messagesHeader);
    mHeader.appendChild(mHeaderRight);

    const mBody = createEl("div", { class: "ca-body", attrs: { style: "gap:8px;" } });
    const mScroll = createEl("div", { class: "ca-scroll" });
    els.messagesList = createEl("div", { class: "ca-message-list" });
    mScroll.appendChild(els.messagesList);

    const composer = createEl("div", { class: "ca-composer" });
    els.messageInput = createEl("input", { class: "ca-input", attrs: { placeholder: "Type a message..." } });
    els.sendBtn = createEl("button", { class: "ca-btn primary", html: "Send ➤" });
    composer.appendChild(els.messageInput);
    composer.appendChild(els.sendBtn);

    mBody.appendChild(mScroll);
    mBody.appendChild(composer);

    els.mainCard.appendChild(mHeader);
    els.mainCard.appendChild(mBody);

    // Attach to root
    els.root.appendChild(els.sidebarCard);
    els.root.appendChild(els.mainCard);

    // Add to DOM
    document.body.appendChild(els.root);

    // Events
    els.newChatBtn.addEventListener("click", () => createChat());
    els.newChatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") createChat();
    });
    els.deleteBtn.addEventListener("click", () => deleteChat());
    els.sendBtn.addEventListener("click", () => sendMessage());
    els.messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMessage();
    });

    // Accessibility: focus primary input on start
    setTimeout(() => els.newChatInput.focus(), 50);
  };

  // -------------------------------
  // Rendering
  // -------------------------------
  const renderChats = () => {
    els.chatsList.innerHTML = "";
    if (state.loadingChats) {
      // Show spinner in header
      if (!els.chatsHeader.contains(els.chatsSpinner)) {
        els.chatsHeader.appendChild(els.chatsSpinner);
      }
    } else {
      // Hide spinner when not loading
      if (els.chatsHeader.contains(els.chatsSpinner)) {
        els.chatsSpinner.remove();
      }
    }

    if (!state.chats.length) {
      const empty = createEl("div", { class: "ca-empty", text: "No chats yet. Create one to get started." });
      els.chatsList.appendChild(empty);
      return;
    }

    for (const chat of state.chats) {
      const item = createEl("div", { class: "ca-chat-item", text: chat.title || `Chat ${chat.ROWID}` });
      if (chat.ROWID === state.selectedChatId) item.classList.add("is-active");
      item.addEventListener("click", () => selectChat(chat.ROWID));
      els.chatsList.appendChild(item);
    }
  };

  const renderMessages = () => {
    els.messagesList.innerHTML = "";

    if (!state.selectedChatId) {
      const empty = createEl("div", { class: "ca-empty", text: "Select a chat from the left, or create a new one." });
      els.messagesList.appendChild(empty);
      return;
    }

    if (!state.messages.length) {
      const empty = createEl("div", { class: "ca-empty", text: "No messages yet. Say hello 👋" });
      els.messagesList.appendChild(empty);
      return;
    }

    for (const msg of state.messages) {
      const bubble = createEl("div", { class: "ca-bubble " + (msg.is_bot ? "bot" : "user") });
      bubble.textContent = msg.content || "";
      els.messagesList.appendChild(bubble);
    }

    // Auto-scroll to bottom
    const scroller = els.messagesList.parentElement;
    scroller.scrollTop = scroller.scrollHeight;
  };

  const renderComposerState = () => {
    const canSend = !!state.messageInput.trim() && !!state.selectedChatId;
    els.sendBtn.disabled = !canSend;
  };

  // -------------------------------
  // State Setters
  // -------------------------------
  const setChats = (chats) => {
    state.chats = Array.isArray(chats) ? chats : [];
    renderChats();
  };

  const setMessages = (messages) => {
    state.messages = Array.isArray(messages) ? messages : [];
    renderMessages();
  };

  const setLoadingChats = (loading) => {
    state.loadingChats = !!loading;
    renderChats();
  };

  const selectChat = (chatId) => {
    if (state.polling) clearInterval(state.polling);
    state.selectedChatId = chatId;
    setMessages([]);
    renderMessages();
    fetchMessages(chatId);
    state.polling = setInterval(() => fetchMessages(chatId), 800);
  };

  // -------------------------------
  // API Calls
  // -------------------------------
  const fetchChats = async () => {
    setLoadingChats(true);
    const { ok, data } = await safeFetch(`${API_BASE}?mode=list_chats`);
    setLoadingChats(false);
    if (!ok) {
      setChats([]);
      Toast.show("Failed to load chats");
      return;
    }
    setChats(Array.isArray(data) ? data : []);
  };

  const fetchMessages = async (chatId) => {
    if (!chatId) return;
    const { ok, data } = await safeFetch(`${API_BASE}?mode=get_messages&chat_id=${encodeURIComponent(chatId)}`);
    if (!ok) {
      Toast.show("Failed to load messages");
      return;
    }
    setMessages((data && data.messages) || []);
  };

  const createChat = async () => {
    const title = (els.newChatInput.value || "").trim();
    if (!title) return;
    if (state.sending) return;
    state.sending = true;
    els.newChatBtn.disabled = true;

    const { ok, data } = await safeFetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "create_chat", title }),
    });

    state.sending = false;
    els.newChatBtn.disabled = false;

    if (!ok || !data) {
      Toast.show("Failed to create chat");
      return;
    }

    // data could be the chat object or wrapper
    const newChat = data;
    const arr = state.chats.slice();
    arr.push(newChat);
    setChats(arr);
    els.newChatInput.value = "";
    selectChat(newChat.ROWID);
    Toast.show("Chat created");
  };

  const deleteChat = async () => {
    if (!state.selectedChatId) return;
    const confirmDel = window.confirm("Delete this chat?");
    if (!confirmDel) return;

    const { ok } = await safeFetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "delete_chat", chat_id: state.selectedChatId }),
    });

    if (!ok) {
      Toast.show("Failed to delete chat");
      return;
    }

    setChats(state.chats.filter((c) => c.ROWID !== state.selectedChatId));
    state.selectedChatId = null;
    setMessages([]);
    Toast.show("Chat deleted");
  };

  const sendMessage = async () => {
    const content = (els.messageInput.value || "").trim();
    if (!content || !state.selectedChatId) return;

    // optimistic UI
    const tempId = `temp-${Date.now()}`;
    const tempMsg = {
      id: tempId,
      chat_id: state.selectedChatId,
      content,
      is_bot: false,
      created_time: new Date().toISOString(),
    };
    setMessages([...state.messages, tempMsg]);
    els.messageInput.value = "";
    state.messageInput = "";
    renderComposerState();

    const { ok, data } = await safeFetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "send_message",
        chat_id: state.selectedChatId,
        content: tempMsg.content,
        is_bot: false,
      }),
    });

    if (!ok || !data) {
      // rollback temp
      setMessages(state.messages.filter((m) => m.id !== tempId));
      Toast.show("Failed to send message");
      return;
    }

    // replace temp with server message
    const serverMsg = (data && data.message) || data;
    const replaced = state.messages.map((m) => (m.id === tempId ? serverMsg : m));
    setMessages(replaced);
  };

  // -------------------------------
  // Init
  // -------------------------------
  const init = () => {
    injectStyles();
    buildUI();

    // Bind inputs to state
    els.messageInput.addEventListener("input", (e) => {
      state.messageInput = e.target.value;
      renderComposerState();
    });

    // initial load
    fetchChats();

    // cleanup on unload
    window.addEventListener("beforeunload", () => {
      if (state.polling) clearInterval(state.polling);
    });
  };

  // Kick off
  init();
})();