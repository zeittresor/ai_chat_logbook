/* AI Chat Logbook - background worker/page
 * SPDX-License-Identifier: MIT
 */
(function () {
  "use strict";

  const api = typeof browser !== "undefined" ? browser : chrome;

  function storageGet(defaults) {
    if (api.storage.local.get.length === 1) return api.storage.local.get(defaults);
    return new Promise((resolve) => api.storage.local.get(defaults, resolve));
  }

  function downloadFile(options) {
    const result = api.downloads.download(options);
    if (result && typeof result.then === "function") return result;
    return new Promise((resolve, reject) => {
      api.downloads.download(options, (downloadId) => {
        const err = api.runtime.lastError;
        if (err) reject(new Error(err.message));
        else resolve(downloadId);
      });
    });
  }

  function sendNativeMessage(hostName, message) {
    const result = api.runtime.sendNativeMessage(hostName, message);
    if (result && typeof result.then === "function") return result;
    return new Promise((resolve, reject) => {
      api.runtime.sendNativeMessage(hostName, message, (response) => {
        const err = api.runtime.lastError;
        if (err) reject(new Error(err.message));
        else resolve(response);
      });
    });
  }

  function sanitizeRelativeDownloadPath(relativePath) {
    let clean = String(relativePath || "").replace(/\\/g, "/").trim();
    clean = clean.replace(/^\/+/, "");
    clean = clean.split("/").filter(Boolean).map((part) => {
      return part
        .replace(/[<>:"|?*\x00-\x1F]/g, "_")
        .replace(/^\.+$/, "_")
        .replace(/^\.+/, "_")
        .replace(/\.+$/, "_")
        .slice(0, 160) || "_";
    }).join("/");
    if (!clean || clean.includes("../") || clean.includes("/..")) {
      clean = "AI_Chat_Logs/export.md";
    }
    if (!clean.toLowerCase().endsWith(".md")) clean += ".md";
    return clean;
  }

  async function saveWithDownloads({ content, relativePath, saveAs }) {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const filename = sanitizeRelativeDownloadPath(relativePath);
    try {
      const downloadId = await downloadFile({
        url,
        filename,
        conflictAction: "uniquify",
        saveAs: Boolean(saveAs)
      });
      return { ok: true, mode: "downloads", downloadId, filename };
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  }

  async function saveWithNativeHelper(settings, payload) {
    const hostName = settings.nativeHostName || "ai_chat_logbook_native";
    const response = await sendNativeMessage(hostName, {
      action: "save_markdown",
      rootPath: settings.nativeRootPath || "",
      relativePath: payload.relativePath,
      content: payload.content,
      overwrite: false
    });
    if (!response || response.ok !== true) {
      throw new Error(response && response.error ? response.error : "Native helper returned no success response.");
    }
    return { ok: true, mode: "native", path: response.path };
  }

  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== "AI_LOGBOOK_SAVE_MARKDOWN") return undefined;

    const task = (async () => {
      const settings = await storageGet(globalThis.AI_LOGBOOK_DEFAULT_SETTINGS || {});
      const payload = message.payload || {};
      if (!payload.content || !payload.relativePath) {
        throw new Error("Missing content or relativePath.");
      }

      if (settings.saveMode === "native") {
        try {
          return await saveWithNativeHelper(settings, payload);
        } catch (err) {
          if (message.allowFallbackToDownloads === false) throw err;
          const fallback = await saveWithDownloads({
            content: payload.content,
            relativePath: payload.relativePath,
            saveAs: false
          });
          fallback.warning = "Native helper failed; saved through downloads instead: " + err.message;
          return fallback;
        }
      }

      return await saveWithDownloads({
        content: payload.content,
        relativePath: payload.relativePath,
        saveAs: Boolean(payload.saveAs)
      });
    })();

    if (typeof browser !== "undefined") return task;

    task.then(
      (result) => sendResponse(result),
      (err) => sendResponse({ ok: false, error: err.message })
    );
    return true;
  });
})();
