/* AI Chat Logbook - content script
 * SPDX-License-Identifier: MIT
 */
(function () {
  "use strict";

  if (window.__AI_CHAT_LOGBOOK_LOADED__) return;
  window.__AI_CHAT_LOGBOOK_LOADED__ = true;

  const api = typeof browser !== "undefined" ? browser : chrome;
  const DEFAULTS = globalThis.AI_LOGBOOK_DEFAULT_SETTINGS || {};
  const EXPORTER = globalThis.AI_LOGBOOK_EXPORTER_INFO || { displayName: "AI Chat Logbook", version: "dev" };
  const i18n = globalThis.AI_LOGBOOK_I18N || { t: (_lang, key) => key };

  const state = {
    settings: null,
    profile: null,
    recording: false,
    messages: [],
    lastExportHash: "",
    observer: null,
    debounceTimer: null,
    overlay: null,
    preview: null,
    initialized: false
  };

  function storageGet(defaults) {
    if (api.storage.local.get.length === 1) return api.storage.local.get(defaults);
    return new Promise((resolve) => api.storage.local.get(defaults, resolve));
  }

  function sendMessage(message) {
    const result = api.runtime.sendMessage(message);
    if (result && typeof result.then === "function") return result;
    return new Promise((resolve, reject) => {
      api.runtime.sendMessage(message, (response) => {
        const err = api.runtime.lastError;
        if (err) reject(new Error(err.message));
        else resolve(response);
      });
    });
  }

  function t(key) {
    return i18n.t(state.settings && state.settings.language, key);
  }

  function cleanText(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim();
  }

  function hashString(input) {
    let h = 2166136261;
    const s = String(input || "");
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function isElementVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return false;
    return true;
  }

  function profileMatchesHost(profile, href, host) {
    if (!profile || profile.enabled === false) return false;
    const tokens = Array.isArray(profile.hostContains) ? profile.hostContains : [];
    const lowerHref = href.toLowerCase();
    const lowerHost = host.toLowerCase();
    return tokens.some((token) => {
      const raw = String(token || "").trim().toLowerCase();
      if (!raw) return false;
      if (raw.includes("://") || raw.includes("/")) return lowerHref.includes(raw.replace(/^\*:\/\//, ""));
      return lowerHost === raw || lowerHost.endsWith("." + raw) || lowerHref.includes(raw);
    });
  }

  function findProfile(settings) {
    const href = location.href;
    const host = location.hostname || "";
    return (settings.profiles || []).find((profile) => profileMatchesHost(profile, href, host));
  }

  function looksLikeLoginPage() {
    return Boolean(document.querySelector('input[type="password"]')) && !document.querySelector("main, [role='main']");
  }

  function inferRoleFromElement(el, index) {
    const attrs = [
      el.getAttribute("data-message-author-role"),
      el.getAttribute("data-author"),
      el.getAttribute("data-role"),
      el.getAttribute("aria-label"),
      el.getAttribute("class"),
      el.id
    ].filter(Boolean).join(" ").toLowerCase();

    if (/\b(user|human|you|me|prompt|question|request|frage|benutzer)\b/.test(attrs)) return "user";
    if (/\b(assistant|bot|model|ai|grok|gemini|chatgpt|claude|deepseek|mistral|qwen|response|answer|antwort)\b/.test(attrs)) return "assistant";

    const labelText = cleanText(el.querySelector("[aria-label], [data-testid], strong, b")?.textContent || "").toLowerCase();
    if (/^(you|du|user|human)\b/.test(labelText)) return "user";
    if (/^(assistant|grok|gemini|chatgpt|claude|deepseek|mistral|qwen)\b/.test(labelText)) return "assistant";

    return index % 2 === 0 ? "user" : "assistant";
  }

  function normalizeRole(role) {
    const r = String(role || "").toLowerCase();
    if (r.includes("user") || r.includes("human") || r.includes("you")) return "user";
    if (r.includes("assistant") || r.includes("model") || r.includes("bot") || r.includes("ai")) return "assistant";
    return r || "unknown";
  }

  function makeMessage(role, text, source, index) {
    const maxChars = Number(state.settings.maxMessageChars || 120000);
    const redacted = applyRedaction(String(text || ""));
    const clipped = redacted.length > maxChars ? redacted.slice(0, maxChars) + "\n\n[...clipped by AI Chat Logbook...]" : redacted;
    return {
      role: normalizeRole(role),
      text: clipped,
      source,
      index,
      capturedAt: new Date().toISOString(),
      hash: hashString(normalizeRole(role) + "\n" + clipped)
    };
  }

  function extractChatGPTMessages() {
    const nodes = Array.from(document.querySelectorAll("[data-message-author-role]"));
    if (!nodes.length) return [];
    return nodes
      .filter(isElementVisible)
      .map((el, index) => {
        const role = el.getAttribute("data-message-author-role") || inferRoleFromElement(el, index);
        const text = cleanText(el.innerText || el.textContent || "");
        return text ? makeMessage(role, text, "chatgpt:data-message-author-role", index) : null;
      })
      .filter(Boolean);
  }

  function chooseBestCandidateSelector() {
    const selectors = [
      "article",
      "[role='article']",
      "[data-testid*='conversation']",
      "[data-testid*='message']",
      "[data-test-id*='conversation']",
      "[data-test-id*='message']",
      "[data-message-id]",
      "[class*='message']",
      "[class*='Message']",
      "[class*='conversation']",
      "[class*='response']",
      "[class*='prompt']"
    ];

    const scored = selectors.map((selector) => {
      const nodes = Array.from(document.querySelectorAll(selector)).filter(isElementVisible);
      const useful = nodes.filter((el) => cleanText(el.innerText || el.textContent || "").length >= Number(state.settings.minTextLength || 4));
      return { selector, nodes: useful, score: useful.length };
    }).filter((item) => item.score >= 2);

    scored.sort((a, b) => b.score - a.score);
    return scored.length ? scored[0] : null;
  }

  function isUiNoise(text) {
    const lower = text.toLowerCase();
    if (lower.includes("ai chat logbook") && lower.length < 500) return true;
    if (/^(new chat|settings|upgrade|log in|sign in|send message|ask anything|message chatgpt)$/i.test(text)) return true;
    if (text.length < Number(state.settings.minTextLength || 4)) return true;
    return false;
  }

  function extractGenericMessages() {
    const best = chooseBestCandidateSelector();
    if (!best) return [];

    const seenText = new Set();
    const candidateNodes = best.nodes
      .filter((el) => !el.closest("#ai-chat-logbook-overlay, #ai-chat-logbook-preview"))
      .map((el) => ({ el, text: cleanText(el.innerText || el.textContent || "") }))
      .filter((item) => item.text && !isUiNoise(item.text));

    // Remove obvious parent duplicates: when a candidate contains another candidate with the same or nearly same text,
    // keep the smaller/inner node so full page containers don't become one giant message.
    const filtered = candidateNodes.filter((item) => {
      for (const other of candidateNodes) {
        if (item === other) continue;
        if (item.el.contains(other.el) && item.text.length > other.text.length && item.text.includes(other.text)) {
          const diff = item.text.length - other.text.length;
          if (diff < 400 || item.text.length > 5000) return false;
        }
      }
      return true;
    });

    return filtered.map((item, index) => {
      const text = item.text;
      if (seenText.has(text)) return null;
      seenText.add(text);
      return makeMessage(inferRoleFromElement(item.el, index), text, "generic:" + best.selector, index);
    }).filter(Boolean);
  }

  function applyRedaction(text) {
    const settings = state.settings || {};
    if (!settings.redact || !settings.redact.enabled) return text;
    let output = String(text || "");
    if (settings.redact.emails) {
      output = output.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]");
    }
    if (settings.redact.phoneNumbers) {
      output = output.replace(/(?<!\w)(?:\+?\d[\d ()\-/]{6,}\d)(?!\w)/g, "[redacted-phone]");
    }
    if (settings.redact.apiKeys) {
      output = output
        .replace(/\b(sk-[A-Za-z0-9_\-]{20,})\b/g, "[redacted-api-key]")
        .replace(/\b(xai-[A-Za-z0-9_\-]{20,})\b/g, "[redacted-api-key]")
        .replace(/\bAIza[0-9A-Za-z_\-]{20,}\b/g, "[redacted-api-key]");
    }
    return output;
  }

  function extractMessages() {
    if (!state.profile) return [];
    let messages = [];
    if (state.profile.adapter === "chatgpt") messages = extractChatGPTMessages();
    if (!messages.length) messages = extractGenericMessages();

    const unique = [];
    const seen = new Set();
    for (const msg of messages) {
      const key = msg.hash;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(msg);
    }
    return unique;
  }

  function updateMessages() {
    if (!state.recording || !state.settings || !state.profile) return;
    const nextMessages = extractMessages();
    if (!nextMessages.length) {
      updateOverlay();
      return;
    }

    const oldHash = state.messages.map((m) => m.hash).join("|");
    const newHash = nextMessages.map((m) => m.hash).join("|");
    if (oldHash !== newHash) {
      state.messages = nextMessages;
      saveSessionState();
      updateOverlay();
      maybeAutoExport();
    }
  }

  function saveSessionState() {
    try {
      const key = "ai-chat-logbook:" + location.origin + location.pathname;
      sessionStorage.setItem(key, JSON.stringify({ messages: state.messages, url: location.href, savedAt: new Date().toISOString() }));
    } catch (_err) {
      // Session storage may be blocked. Recording still works in memory.
    }
  }

  function restoreSessionState() {
    try {
      const key = "ai-chat-logbook:" + location.origin + location.pathname;
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.messages)) state.messages = parsed.messages;
    } catch (_err) {
      // Ignore invalid session state.
    }
  }

  function maybeAutoExport() {
    if (!state.settings.autoExportOnAssistantTurn) return;
    const last = state.messages[state.messages.length - 1];
    if (!last || last.role !== "assistant") return;
    const currentHash = state.messages.map((m) => m.hash).join("|");
    if (currentHash === state.lastExportHash) return;
    state.lastExportHash = currentHash;
    exportMarkdown(false).catch((err) => showToast(t("saveFailed") + ": " + err.message));
  }

  function yamlValue(value) {
    return JSON.stringify(String(value == null ? "" : value));
  }

  function roleHeading(role) {
    if (role === "user") return "User";
    if (role === "assistant") return state.profile.assistantLabel || state.profile.displayName || "Assistant";
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  function buildMarkdown() {
    const now = new Date();
    const title = document.title || "Untitled conversation";
    const profile = state.profile || { id: "unknown", displayName: "Unknown" };
    const lines = [];
    lines.push("---");
    lines.push("source: " + yamlValue(profile.id));
    lines.push("source_display_name: " + yamlValue(profile.displayName || profile.id));
    lines.push("url: " + yamlValue(location.href));
    lines.push("page_title: " + yamlValue(title));
    lines.push("captured_at: " + yamlValue(now.toISOString()));
    lines.push("exporter: " + yamlValue(EXPORTER.displayName || "AI Chat Logbook"));
    lines.push("exporter_version: " + yamlValue(EXPORTER.version || "dev"));
    lines.push("message_count: " + state.messages.length);
    lines.push("---");
    lines.push("");
    lines.push("# " + (profile.displayName || profile.id || "AI") + " Chat Export");
    lines.push("");
    lines.push("- Source: " + (profile.displayName || profile.id || "Unknown"));
    lines.push("- Captured: " + now.toLocaleString());
    lines.push("- URL: " + location.href);
    lines.push("- Page title: " + title);
    lines.push("");

    if (!state.messages.length) {
      lines.push("> " + t("noMessages"));
      lines.push("");
      return lines.join("\n");
    }

    state.messages.forEach((msg, idx) => {
      lines.push("## " + roleHeading(msg.role));
      lines.push("");
      lines.push(cleanText(msg.text));
      lines.push("");
      lines.push("<!-- message_index: " + idx + "; role: " + msg.role + "; source: " + msg.source + " -->");
      lines.push("");
    });

    return lines.join("\n");
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function slugify(text) {
    return String(text || "chat")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-")
      .slice(0, 80)
      .toLowerCase() || "chat";
  }

  function makeRelativePath() {
    const d = new Date();
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const time = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const profileId = slugify((state.profile && state.profile.id) || location.hostname || "ai");
    const firstUser = state.messages.find((m) => m.role === "user")?.text || document.title || location.hostname;
    const slug = slugify(firstUser);
    const root = String(state.settings.downloadRoot || "AI_Chat_Logs").replace(/^\/+|\/+$/g, "") || "AI_Chat_Logs";
    return `${root}/${date}/${profileId}/${date}_${time}_${profileId}_${slug}.md`;
  }

  async function exportMarkdown(showSuccess) {
    updateMessages();
    const content = buildMarkdown();
    const relativePath = makeRelativePath();
    const result = await sendMessage({
      type: "AI_LOGBOOK_SAVE_MARKDOWN",
      allowFallbackToDownloads: true,
      payload: { content, relativePath, saveAs: false }
    });
    if (!result || result.ok !== true) throw new Error(result && result.error ? result.error : "Unknown save error");
    if (showSuccess !== false) showToast(t("saved") + ": " + (result.path || result.filename || relativePath));
    return result;
  }

  function openOptions() {
    if (api.runtime.openOptionsPage) {
      api.runtime.openOptionsPage();
    } else {
      window.open(api.runtime.getURL("options/options.html"));
    }
  }

  function createButton(label, onClick, className) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.className = className || "";
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      onClick();
    });
    return btn;
  }

  function createOverlay() {
    if (!state.settings.showOverlay || state.overlay) return;
    const box = document.createElement("div");
    box.id = "ai-chat-logbook-overlay";
    box.setAttribute("role", "status");
    box.innerHTML = `
      <div class="ailb-head">
        <span class="ailb-title">AI Chat Logbook</span>
        <span class="ailb-pill" data-role="status"></span>
      </div>
      <div class="ailb-meta" data-role="meta"></div>
      <div class="ailb-actions" data-role="actions"></div>
      <div class="ailb-toast" data-role="toast" hidden></div>
    `;

    const actions = box.querySelector("[data-role='actions']");
    actions.appendChild(createButton(t("capture"), () => { updateMessages(); showToast(t("statusReady")); }, "ailb-secondary"));
    actions.appendChild(createButton(t("preview"), () => showPreview(), "ailb-secondary"));
    actions.appendChild(createButton(t("export"), () => exportMarkdown(true).catch((err) => showToast(t("saveFailed") + ": " + err.message)), "ailb-primary"));
    actions.appendChild(createButton(state.recording ? t("pause") : t("resume"), () => {
      state.recording = !state.recording;
      updateMessages();
      updateOverlay();
    }, "ailb-secondary ailb-toggle"));
    actions.appendChild(createButton("⚙", () => openOptions(), "ailb-icon"));

    document.documentElement.appendChild(box);
    state.overlay = box;
    updateOverlay();
  }

  function updateOverlay() {
    if (!state.overlay) return;
    const status = state.overlay.querySelector("[data-role='status']");
    const meta = state.overlay.querySelector("[data-role='meta']");
    const toggle = state.overlay.querySelector(".ailb-toggle");
    const profileName = state.profile ? state.profile.displayName : "Unknown";
    status.textContent = state.recording ? t("recording") : t("paused");
    status.className = "ailb-pill " + (state.recording ? "is-recording" : "is-paused");
    meta.textContent = `${profileName} · ${state.messages.length} ${t("messages")}`;
    if (toggle) toggle.textContent = state.recording ? t("pause") : t("resume");
  }

  function showToast(text) {
    if (!state.overlay) return;
    const toast = state.overlay.querySelector("[data-role='toast']");
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => { toast.hidden = true; }, 4200);
  }

  function showPreview() {
    updateMessages();
    if (!state.preview) {
      const preview = document.createElement("div");
      preview.id = "ai-chat-logbook-preview";
      preview.innerHTML = `
        <div class="ailb-preview-dialog" role="dialog" aria-modal="true">
          <div class="ailb-preview-head">
            <strong>${t("preview")}</strong>
            <button type="button" data-role="close">${t("close")}</button>
          </div>
          <textarea spellcheck="false"></textarea>
          <div class="ailb-preview-actions">
            <button type="button" data-role="copy">${t("copy")}</button>
            <button type="button" data-role="export">${t("export")}</button>
          </div>
        </div>
      `;
      preview.querySelector("[data-role='close']").addEventListener("click", () => { preview.hidden = true; });
      preview.querySelector("[data-role='copy']").addEventListener("click", async () => {
        await navigator.clipboard.writeText(preview.querySelector("textarea").value);
        showToast(t("copied"));
      });
      preview.querySelector("[data-role='export']").addEventListener("click", () => exportMarkdown(true).catch((err) => showToast(t("saveFailed") + ": " + err.message)));
      document.documentElement.appendChild(preview);
      state.preview = preview;
    }
    state.preview.querySelector("textarea").value = buildMarkdown();
    state.preview.hidden = false;
  }

  function startObserver() {
    if (state.observer) state.observer.disconnect();
    state.observer = new MutationObserver(() => {
      if (!state.settings.autoCapture) return;
      clearTimeout(state.debounceTimer);
      state.debounceTimer = setTimeout(updateMessages, 1200);
    });
    state.observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }

  async function init() {
    if (!/^https?:$/.test(location.protocol)) return;
    const settings = await storageGet(DEFAULTS);
    state.settings = settings;
    if (!settings.enabled) return;

    const profile = findProfile(settings);
    if (!profile) return;
    if (looksLikeLoginPage()) return;

    state.profile = profile;
    state.recording = Boolean(settings.recordingByDefault);
    restoreSessionState();
    createOverlay();
    startObserver();
    updateMessages();
    state.initialized = true;
  }

  init().catch((err) => {
    // Keep failure quiet on arbitrary web pages; log for debugging only.
    console.warn("AI Chat Logbook init failed:", err);
  });
})();
