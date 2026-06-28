/* AI Chat Logbook - shared defaults
 * SPDX-License-Identifier: MIT
 */
(function exposeDefaults(global) {
  const DEFAULT_PROFILES = [
    {
      id: "chatgpt",
      displayName: "ChatGPT",
      enabled: true,
      hostContains: ["chatgpt.com", "chat.openai.com"],
      adapter: "chatgpt",
      assistantLabel: "ChatGPT"
    },
    {
      id: "grok",
      displayName: "Grok",
      enabled: true,
      hostContains: ["grok.com", "x.ai"],
      adapter: "generic",
      assistantLabel: "Grok"
    },
    {
      id: "gemini",
      displayName: "Gemini",
      enabled: true,
      hostContains: ["gemini.google.com"],
      adapter: "generic",
      assistantLabel: "Gemini"
    },
    {
      id: "deepseek",
      displayName: "DeepSeek",
      enabled: true,
      hostContains: ["chat.deepseek.com"],
      adapter: "generic",
      assistantLabel: "DeepSeek"
    },
    {
      id: "mistral",
      displayName: "Mistral Le Chat",
      enabled: true,
      hostContains: ["chat.mistral.ai"],
      adapter: "generic",
      assistantLabel: "Mistral"
    },
    {
      id: "qwen",
      displayName: "Qwen Chat",
      enabled: true,
      hostContains: ["chat.qwen.ai", "qwen.ai"],
      adapter: "generic",
      assistantLabel: "Qwen"
    },
    {
      id: "claude",
      displayName: "Claude",
      enabled: true,
      hostContains: ["claude.ai"],
      adapter: "generic",
      assistantLabel: "Claude"
    },
    {
      id: "perplexity",
      displayName: "Perplexity",
      enabled: true,
      hostContains: ["perplexity.ai"],
      adapter: "generic",
      assistantLabel: "Perplexity"
    },
    {
      id: "ollama-local",
      displayName: "Local Ollama / WebUI",
      enabled: false,
      hostContains: ["localhost", "127.0.0.1"],
      adapter: "generic",
      assistantLabel: "Local model"
    }
  ];

  const DEFAULT_SETTINGS = {
    schemaVersion: 1,
    enabled: true,
    language: "en",
    theme: "dark",
    recordingByDefault: true,
    showOverlay: true,
    autoCapture: true,
    autoExportOnAssistantTurn: false,
    minTextLength: 4,
    maxMessageChars: 120000,
    downloadRoot: "AI_Chat_Logs",
    saveMode: "downloads",
    nativeHostName: "ai_chat_logbook_native",
    nativeRootPath: "",
    profiles: DEFAULT_PROFILES,
    redact: {
      enabled: false,
      emails: true,
      phoneNumbers: false,
      apiKeys: true
    }
  };

  const EXPORTER_INFO = {
    id: "ai-chat-logbook",
    displayName: "AI Chat Logbook",
    version: "0.1.0-mvp"
  };

  global.AI_LOGBOOK_DEFAULT_SETTINGS = DEFAULT_SETTINGS;
  global.AI_LOGBOOK_DEFAULT_PROFILES = DEFAULT_PROFILES;
  global.AI_LOGBOOK_EXPORTER_INFO = EXPORTER_INFO;
})(typeof globalThis !== "undefined" ? globalThis : window);
