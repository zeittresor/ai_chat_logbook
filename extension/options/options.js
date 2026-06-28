/* AI Chat Logbook - options page
 * SPDX-License-Identifier: MIT
 */
(function () {
  "use strict";
  const api = typeof browser !== "undefined" ? browser : chrome;
  const DEFAULTS = globalThis.AI_LOGBOOK_DEFAULT_SETTINGS || {};
  const template = document.getElementById("profileTemplate");
  const profilesEl = document.getElementById("profiles");
  const statusEl = document.getElementById("status");
  let settings = null;

  function storageGet(defaults) {
    if (api.storage.local.get.length === 1) return api.storage.local.get(defaults);
    return new Promise((resolve) => api.storage.local.get(defaults, resolve));
  }

  function storageSet(values) {
    const result = api.storage.local.set(values);
    if (result && typeof result.then === "function") return result;
    return new Promise((resolve) => api.storage.local.set(values, resolve));
  }

  function $(id) { return document.getElementById(id); }

  function showStatus(text) {
    statusEl.textContent = text;
    clearTimeout(showStatus._timer);
    showStatus._timer = setTimeout(() => { statusEl.textContent = ""; }, 3500);
  }

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }

  function renderProfile(profile) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector('[data-field="enabled"]').checked = profile.enabled !== false;
    node.querySelector('[data-field="id"]').value = profile.id || "";
    node.querySelector('[data-field="displayName"]').value = profile.displayName || "";
    node.querySelector('[data-field="adapter"]').value = profile.adapter || "generic";
    node.querySelector('[data-field="assistantLabel"]').value = profile.assistantLabel || "";
    node.querySelector('[data-field="hostContains"]').value = (profile.hostContains || []).join(", ");
    node.querySelector('[data-action="remove"]').addEventListener("click", () => node.remove());
    profilesEl.appendChild(node);
  }

  function render() {
    $("enabled").checked = settings.enabled !== false;
    $("recordingByDefault").checked = settings.recordingByDefault !== false;
    $("showOverlay").checked = settings.showOverlay !== false;
    $("autoCapture").checked = settings.autoCapture !== false;
    $("autoExportOnAssistantTurn").checked = Boolean(settings.autoExportOnAssistantTurn);
    $("language").value = settings.language || "en";
    $("theme").value = settings.theme || "dark";
    $("saveMode").value = settings.saveMode || "downloads";
    $("downloadRoot").value = settings.downloadRoot || "AI_Chat_Logs";
    $("nativeRootPath").value = settings.nativeRootPath || "";
    $("redactEnabled").checked = Boolean(settings.redact && settings.redact.enabled);
    $("redactEmails").checked = settings.redact ? settings.redact.emails !== false : true;
    $("redactPhones").checked = Boolean(settings.redact && settings.redact.phoneNumbers);
    $("redactApiKeys").checked = settings.redact ? settings.redact.apiKeys !== false : true;
    profilesEl.textContent = "";
    (settings.profiles || []).forEach(renderProfile);
  }

  function readProfile(node) {
    return {
      enabled: node.querySelector('[data-field="enabled"]').checked,
      id: node.querySelector('[data-field="id"]').value.trim() || "custom",
      displayName: node.querySelector('[data-field="displayName"]').value.trim() || "Custom AI",
      adapter: node.querySelector('[data-field="adapter"]').value || "generic",
      assistantLabel: node.querySelector('[data-field="assistantLabel"]').value.trim() || "Assistant",
      hostContains: node.querySelector('[data-field="hostContains"]').value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    };
  }

  function collect() {
    return {
      schemaVersion: 1,
      enabled: $("enabled").checked,
      recordingByDefault: $("recordingByDefault").checked,
      showOverlay: $("showOverlay").checked,
      autoCapture: $("autoCapture").checked,
      autoExportOnAssistantTurn: $("autoExportOnAssistantTurn").checked,
      language: $("language").value,
      theme: $("theme").value,
      saveMode: $("saveMode").value,
      downloadRoot: $("downloadRoot").value.trim() || "AI_Chat_Logs",
      nativeHostName: settings.nativeHostName || "ai_chat_logbook_native",
      nativeRootPath: $("nativeRootPath").value.trim(),
      minTextLength: Number(settings.minTextLength || 4),
      maxMessageChars: Number(settings.maxMessageChars || 120000),
      redact: {
        enabled: $("redactEnabled").checked,
        emails: $("redactEmails").checked,
        phoneNumbers: $("redactPhones").checked,
        apiKeys: $("redactApiKeys").checked
      },
      profiles: Array.from(profilesEl.querySelectorAll(".profile")).map(readProfile)
    };
  }

  async function save() {
    settings = collect();
    await storageSet(settings);
    showStatus("Saved.");
  }

  async function init() {
    settings = await storageGet(cloneDefaults());
    render();
    $("saveTop").addEventListener("click", save);
    $("saveBottom").addEventListener("click", save);
    $("restoreDefaults").addEventListener("click", async () => {
      settings = cloneDefaults();
      await storageSet(settings);
      render();
      showStatus("Defaults restored.");
    });
    $("addProfile").addEventListener("click", () => renderProfile({
      id: "custom-ai",
      displayName: "Custom AI",
      enabled: true,
      adapter: "generic",
      assistantLabel: "Assistant",
      hostContains: ["example.com"]
    }));
  }

  init().catch((err) => showStatus("Error: " + err.message));
})();
