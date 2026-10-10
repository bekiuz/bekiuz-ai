(function () {
  "use strict";
  const CHAT_KEY = "bekiuz-ai-chats-v1";
  const MODE_KEY = "bekiuz-ai-mode-v1";
  const state = { chats: [], activeId: null, mode: "general", busy: false, toastTimer: null };
  const $ = (id) => document.getElementById(id);
  const el = {
    sidebar: $("sidebar"), newChatBtn: $("newChatBtn"), chatList: $("chatList"),
    statusDot: $("statusDot"), statusText: $("statusText"), clearChatBtn: $("clearChatBtn"),
    mobileMenuBtn: $("mobileMenuBtn"), mobileOverlay: $("mobileOverlay"), welcome: $("welcome"),
    welcomeTitle: $("welcomeTitle"), welcomeText: $("welcomeText"), suggestionGrid: $("suggestionGrid"),
    messages: $("messages"), chatArea: $("chatArea"), chatForm: $("chatForm"),
    messageInput: $("messageInput"), sendBtn: $("sendBtn"), charCount: $("charCount"),
    composerHint: $("composerHint"), toast: $("toast")
  };
  function safeJson(value, fallback) { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } }
  function toast(message) {
    el.toast.textContent = message; el.toast.classList.add("visible");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => el.toast.classList.remove("visible"), 3400);
  }
  function id() { return window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }
  function current() { return state.chats.find((c) => c.id === state.activeId) || null; }
  function save() {
    try {
      state.chats.sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      localStorage.setItem(CHAT_KEY, JSON.stringify(state.chats.slice(0, 40)));
      localStorage.setItem(MODE_KEY, state.mode);
    } catch { toast("Brauzer xotirasi to‘ldi. Eski suhbatlarni o‘chiring."); }
  }
  function status(ok, text) {
    el.statusDot.classList.toggle("online", !!ok);
    el.statusDot.classList.toggle("offline", ok === false);
    el.statusText.textContent = text;
  }
  async function checkHealth() {
    try {
      const response = await fetch("/api/health", { headers: { Accept: "application/json" } });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error("offline");
      status(true, data.configured ? "AI xizmati tayyor" : "API kaliti sozlanmagan");
      if (!data.configured) toast("AI ishlashi uchun serverga OPENROUTER_API_KEY secretini qo‘shish kerak.");
    } catch { status(false, "AI serveriga ulanilmadi"); }
  }
  function setMode(mode, repaint) {
    state.mode = mode === "business" ? "business" : "general";
    document.querySelectorAll(".mode-btn").forEach((button) => {
      const active = button.dataset.mode === state.mode;
      button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
    });
    const business = state.mode === "business";
    el.welcomeTitle.innerHTML = business ? "Biznesingizni <span>rivojlantiring.</span>" : "Fikringizni <span>amalga oshiring.</span>";
    el.welcomeText.textContent = business
      ? "Reklama matni, kontent rejasi, mijozlar javobi va ish jarayonlarini yengillashtiring."
      : "Savol bering, g‘oya yarating yoki murakkab vazifani birgalikda hal qilaylik.";
    el.composerHint.textContent = business ? "Business AI · Kontent, mijozlar va avtomatlashtirish" : "Universal AI · Fikrlash, yozish va kod";
    el.suggestionGrid.classList.toggle("business-mode", business);
    const chat = current();
    if (chat && repaint) { chat.mode = state.mode; chat.updatedAt = Date.now(); save(); drawHistory(); }
    if (repaint && (!chat || !chat.messages.length)) showWelcome();
    save();
  }
  function showWelcome() { el.welcome.classList.remove("hidden"); el.messages.replaceChildren(); el.chatArea.scrollTop = 0; }
  function makeChat() {
    if (state.busy) return toast("Javob tugashini kuting.");
    const chat = { id: id(), title: "Yangi suhbat", mode: state.mode, messages: [], createdAt: Date.now(), updatedAt: Date.now() };
    state.chats.unshift(chat); state.activeId = chat.id; save(); drawHistory(); showWelcome(); closeMenu(); el.messageInput.focus();
  }
  function deleteChat(chatId) {
    if (state.busy && chatId === state.activeId) return toast("Javob tayyorlanayotganda bu suhbatni o‘chira olmaysiz.");
    state.chats = state.chats.filter((chat) => chat.id !== chatId);
    if (state.activeId === chatId) state.activeId = state.chats[0]?.id || null;
    save(); drawHistory();
    if (current() && current().messages.length) drawMessages(); else showWelcome();
  }
  function drawHistory() {
    el.chatList.replaceChildren();
    const chats = state.chats.filter((c) => c.messages && c.messages.length).sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (!chats.length) {
      const hint = document.createElement("div"); hint.className = "empty-chats"; hint.textContent = "Hali suhbat yo‘q. Birinchi savolingizni yuboring!"; el.chatList.append(hint); return;
    }
    chats.forEach((chat) => {
      const row = document.createElement("div"); row.className = "history-item" + (chat.id === state.activeId ? " active" : "");
      row.tabIndex = 0; row.setAttribute("role", "button");
      const icon = document.createElement("span"); icon.className = "history-icon"; icon.textContent = chat.mode === "business" ? "▦" : "✳";
      const title = document.createElement("span"); title.className = "history-title"; title.textContent = chat.title || "Suhbat";
      const del = document.createElement("button"); del.className = "delete-chat"; del.type = "button"; del.textContent = "×"; del.title = "Suhbatni o‘chirish"; del.setAttribute("aria-label", "Suhbatni o‘chirish");
      function open() { if (state.busy) return; state.activeId = chat.id; setMode(chat.mode, false); drawHistory(); drawMessages(); closeMenu(); }
      row.addEventListener("click", (event) => { if (!event.target.closest("button")) open(); });
      row.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
      del.addEventListener("click", (event) => { event.stopPropagation(); deleteChat(chat.id); });
      row.append(icon, title, del); el.chatList.append(row);
    });
  }
  function timeLabel(timestamp) { try { return new Intl.DateTimeFormat("uz-UZ", { hour:"2-digit", minute:"2-digit" }).format(new Date(timestamp || Date.now())); } catch { return ""; } }
  function appendInline(parent, text) {
    const pattern = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let last = 0, match;
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > last) parent.append(document.createTextNode(text.slice(last, match.index)));
      if (match[1]) { const node = document.createElement("strong"); node.textContent = match[1]; parent.append(node); }
      else if (match[2]) { const node = document.createElement("code"); node.className = "inline-code"; node.textContent = match[2]; parent.append(node); }
      else { const a = document.createElement("a"); a.href = match[4]; a.textContent = match[3]; a.target = "_blank"; a.rel = "noopener noreferrer"; parent.append(a); }
      last = pattern.lastIndex;
    }
    if (last < text.length) parent.append(document.createTextNode(text.slice(last)));
  }
  function renderText(container, text) {
    const lines = text.replace(/\r/g, "").split("\n"); let paragraph = [], list = null;
    const flush = () => { if (!paragraph.length) return; const p = document.createElement("p"); appendInline(p, paragraph.join(" ")); container.append(p); paragraph = []; };
    const closeList = () => { if (list) { container.append(list); list = null; } };
    lines.forEach((line) => {
      const heading = line.match(/^(#{1,3})\s+(.+)$/), bullet = line.match(/^\s*[-*]\s+(.+)$/), numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (!line.trim()) { flush(); closeList(); return; }
      if (heading) { flush(); closeList(); const h = document.createElement(heading[1].length < 3 ? "h2" : "h3"); appendInline(h, heading[2]); container.append(h); return; }
      if (bullet || numbered) {
        flush(); const tag = bullet ? "ul" : "ol";
        if (!list || list.tagName.toLowerCase() !== tag) { closeList(); list = document.createElement(tag); }
        const item = document.createElement("li"); appendInline(item, (bullet || numbered)[1]); list.append(item); return;
      }
      closeList(); paragraph.push(line.trim());
    });
    flush(); closeList();
  }
  function renderContent(container, source) {
    const parts = String(source || "").split(/```([^\n`]*\n[\s\S]*?)```/g);
    parts.forEach((part) => {
      if (part.startsWith("```")) return;
    });
    const regex = /```([^\n`]*)\n([\s\S]*?)```/g; let cursor = 0, match;
    while ((match = regex.exec(String(source || ""))) !== null) {
      if (match.index > cursor) renderText(container, String(source).slice(cursor, match.index));
      const wrap = document.createElement("div"); wrap.className = "code-wrap";
      const head = document.createElement("div"); head.className = "code-head";
      const label = document.createElement("span"); label.textContent = (match[1] || "code").trim().toUpperCase();
      const copy = document.createElement("button"); copy.className = "copy-code"; copy.type = "button"; copy.textContent = "Nusxalash";
      copy.addEventListener("click", () => copyText(match[2]).then((ok) => toast(ok ? "Kod nusxalandi." : "Nusxalash ishlamadi.")));
      head.append(label, copy); const pre = document.createElement("pre"); const code = document.createElement("code"); code.textContent = match[2]; pre.append(code); wrap.append(head, pre); container.append(wrap); cursor = regex.lastIndex;
    }
    if (cursor < String(source || "").length) renderText(container, String(source).slice(cursor));
  }
  function typingNode() {
    const row = document.createElement("article"); row.className = "message-row assistant";
    const avatar = document.createElement("div"); avatar.className = "message-avatar"; avatar.textContent = "B";
    const body = document.createElement("div"); body.className = "message-body";
    const meta = document.createElement("div"); meta.className = "message-meta";
    const name = document.createElement("strong"); name.textContent = "Bekiuz AI";
    const time = document.createElement("time"); time.textContent = "Javob yozmoqda…"; meta.append(name, time);
    const content = document.createElement("div"); content.className = "message-content";
    const dots = document.createElement("span"); dots.className = "typing-dots"; dots.append(document.createElement("i"), document.createElement("i"), document.createElement("i"));
    content.append(dots); body.append(meta, content); row.append(avatar, body); return row;
  }
  function messageNode(message) {
    const user = message.role === "user";
    const row = document.createElement("article"); row.className = "message-row " + (user ? "user" : "assistant");
    const avatar = document.createElement("div"); avatar.className = "message-avatar"; avatar.textContent = user ? "S" : "B";
    const body = document.createElement("div"); body.className = "message-body";
    const meta = document.createElement("div"); meta.className = "message-meta";
    const name = document.createElement("strong"); name.textContent = user ? "Siz" : "Bekiuz AI";
    const time = document.createElement("time"); time.textContent = timeLabel(message.createdAt); meta.append(name, time);
    const content = document.createElement("div"); content.className = "message-content"; renderContent(content, message.content); body.append(meta, content);
    if (!user) { const tools = document.createElement("div"); tools.className = "message-tools"; const copy = document.createElement("button"); copy.type = "button"; copy.textContent = "Javobni nusxalash"; copy.addEventListener("click", () => copyText(message.content).then((ok) => toast(ok ? "Javob nusxalandi." : "Nusxalash ishlamadi."))); tools.append(copy); body.append(tools); }
    row.append(avatar, body); return row;
  }
  function drawMessages() {
    const chat = current(); el.messages.replaceChildren();
    if (!chat || !chat.messages.length) { el.welcome.classList.remove("hidden"); return; }
    el.welcome.classList.add("hidden");
    chat.messages.forEach((m) => el.messages.append(m.pending ? typingNode() : messageNode(m)));
    el.chatArea.scrollTop = el.chatArea.scrollHeight;
  }
  function composerBusy(busy) { el.sendBtn.disabled = busy; el.messageInput.disabled = busy; el.sendBtn.querySelector("span").textContent = busy ? "Kutilmoqda" : "Yuborish"; }
  async function copyText(value) {
    try { await navigator.clipboard.writeText(String(value)); return true; }
    catch { try { const field = document.createElement("textarea"); field.value = String(value); field.style.position = "fixed"; field.style.opacity = "0"; document.body.append(field); field.select(); const ok = document.execCommand("copy"); field.remove(); return ok; } catch { return false; } }
  }
  function updateComposer() {
    el.charCount.textContent = el.messageInput.value.length.toLocaleString("en-US") + " / 12000";
    el.messageInput.style.height = "auto"; el.messageInput.style.height = Math.min(el.messageInput.scrollHeight, 175) + "px";
  }
  function closeMenu() { el.sidebar.classList.remove("open"); el.mobileOverlay.classList.remove("open"); el.mobileMenuBtn.setAttribute("aria-expanded", "false"); }
  function openMenu() { el.sidebar.classList.add("open"); el.mobileOverlay.classList.add("open"); el.mobileMenuBtn.setAttribute("aria-expanded", "true"); }
  function addMessage(role, content) {
    const chat = current(); if (!chat) return;
    chat.messages.push({ id:id(), role, content, createdAt:Date.now() }); chat.updatedAt = Date.now();
    if (role === "user" && (!chat.title || chat.title === "Yangi suhbat")) chat.title = content.replace(/\s+/g, " ").slice(0,36);
    save(); drawHistory();
  }
  async function sendMessage(raw) {
    const text = String(raw || "").trim(); if (!text || state.busy) return;
    if (!current()) { const chat = { id:id(), title:"Yangi suhbat", mode:state.mode, messages:[], createdAt:Date.now(), updatedAt:Date.now() }; state.chats.unshift(chat); state.activeId = chat.id; }
    const chat = current(); chat.mode = state.mode; addMessage("user", text);
    const pending = { id:id(), role:"assistant", content:"", createdAt:Date.now(), pending:true }; chat.messages.push(pending);
    state.busy = true; composerBusy(true); save(); drawHistory(); drawMessages();
    try {
      const messages = chat.messages.filter((m) => !m.pending && (m.role === "user" || m.role === "assistant")).slice(-12).map((m) => ({ role:m.role, content:String(m.content).slice(0,12000) }));
      const response = await fetch("/api/chat", { method:"POST", headers:{"Content-Type":"application/json", "Accept":"application/json"}, body:JSON.stringify({mode:chat.mode, messages}) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { const error = new Error(data.error || "AI javob bera olmadi."); error.code = data.code; throw error; }
      const pos = chat.messages.findIndex((m) => m.id === pending.id);
      if (pos >= 0) chat.messages[pos] = { id:pending.id, role:"assistant", content:String(data.reply || "Bo‘sh javob qaytdi."), createdAt:Date.now() };
      status(true, "AI javobi olindi");
    } catch (error) {
      const pos = chat.messages.findIndex((m) => m.id === pending.id);
      const message = error.code === "API_NOT_CONFIGURED" ? "AI hali sozlanmagan. Serverga OPENROUTER_API_KEY secretini qo‘shish kerak." : error.code === "RATE_LIMITED" ? "Bepul AI limiti vaqtincha to‘ldi. Keyinroq urinib ko‘ring." : error.code === "UPSTREAM_ERROR" ? "AI provayderi hozir javob bermadi. Keyinroq urinib ko‘ring." : "Ulanishda xatolik bo‘ldi. Server sozlamalarini tekshiring.";
      if (pos >= 0) chat.messages[pos] = { id:pending.id, role:"assistant", content:"⚠️ " + message, createdAt:Date.now(), failed:true };
      status(false, "AI so‘rovida xatolik");
    } finally {
      state.busy = false; chat.updatedAt = Date.now(); save(); composerBusy(false); drawHistory(); drawMessages(); el.messageInput.focus();
    }
  }
  function load() {
    const saved = safeJson(localStorage.getItem(CHAT_KEY), []);
    state.chats = Array.isArray(saved) ? saved.filter((c) => c && typeof c.id === "string" && Array.isArray(c.messages)).slice(0,40) : [];
    state.mode = localStorage.getItem(MODE_KEY) === "business" ? "business" : "general";
    state.chats.sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    state.activeId = state.chats[0]?.id || null;
    setMode(state.mode, false); drawHistory(); drawMessages();
  }

  el.newChatBtn.addEventListener("click", makeChat);
  el.clearChatBtn.addEventListener("click", () => { const chat = current(); if (!chat || state.busy) return toast("Tozalash uchun tugayotgan javobni kuting."); chat.messages = []; chat.title = "Yangi suhbat"; chat.updatedAt = Date.now(); save(); drawHistory(); showWelcome(); toast("Suhbat tozalandi."); });
  document.querySelectorAll(".mode-btn").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode, true)));
  el.suggestionGrid.addEventListener("click", (event) => { const button = event.target.closest("button[data-prompt]"); if (!button) return; el.messageInput.value = button.dataset.prompt; updateComposer(); el.messageInput.focus(); });
  el.messageInput.addEventListener("input", updateComposer);
  el.messageInput.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); el.chatForm.requestSubmit(); } });
  el.chatForm.addEventListener("submit", (event) => { event.preventDefault(); const text = el.messageInput.value; if (!text.trim()) return; el.messageInput.value = ""; updateComposer(); sendMessage(text); });
  el.mobileMenuBtn.addEventListener("click", () => el.sidebar.classList.contains("open") ? closeMenu() : openMenu());
  el.mobileOverlay.addEventListener("click", closeMenu);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenu(); });

  load(); updateComposer(); checkHealth();
})();
