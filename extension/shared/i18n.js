/* AI Chat Logbook - minimal in-extension i18n
 * SPDX-License-Identifier: MIT
 */
(function exposeI18n(global) {
  const STRINGS = {
    en: {
      title: "AI Chat Logbook",
      recording: "Recording",
      paused: "Paused",
      inactive: "Inactive",
      export: "Export MD",
      capture: "Capture now",
      pause: "Pause",
      resume: "Resume",
      options: "Options",
      messages: "messages",
      saved: "Saved",
      saveFailed: "Save failed",
      noMessages: "No chat messages detected yet.",
      siteNotAllowed: "This site is not enabled in AI Chat Logbook.",
      preview: "Preview",
      close: "Close",
      copy: "Copy",
      copied: "Copied",
      openOptions: "Open options",
      statusReady: "Ready"
    },
    de: {
      title: "AI Chat Logbook",
      recording: "Aufnahme",
      paused: "Pausiert",
      inactive: "Inaktiv",
      export: "MD exportieren",
      capture: "Jetzt erfassen",
      pause: "Pausieren",
      resume: "Fortsetzen",
      options: "Optionen",
      messages: "Nachrichten",
      saved: "Gespeichert",
      saveFailed: "Speichern fehlgeschlagen",
      noMessages: "Noch keine Chat-Nachrichten erkannt.",
      siteNotAllowed: "Diese Seite ist in AI Chat Logbook nicht aktiviert.",
      preview: "Vorschau",
      close: "Schließen",
      copy: "Kopieren",
      copied: "Kopiert",
      openOptions: "Optionen öffnen",
      statusReady: "Bereit"
    }
  };

  function t(lang, key) {
    const selected = STRINGS[lang] || STRINGS.en;
    return selected[key] || STRINGS.en[key] || key;
  }

  global.AI_LOGBOOK_I18N = { STRINGS, t };
})(typeof globalThis !== "undefined" ? globalThis : window);
