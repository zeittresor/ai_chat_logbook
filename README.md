# AI Chat Logbook

AI Chat Logbook is a Firefox WebExtension MVP that captures enabled AI chat pages and exports the visible dialog as Markdown files. It is meant for manual context handoff between AI systems without per-use API costs.

## What it does

- Detects configured AI chat hosts such as ChatGPT, Grok, Gemini, DeepSeek, Mistral, Qwen, Claude, Perplexity, and optionally local Ollama/WebUI hosts.
- Adds a visible recording overlay on enabled chat pages.
- Watches DOM changes and extracts visible dialog messages with a site-specific ChatGPT adapter plus a generic fallback adapter.
- Exports Markdown with YAML front matter: source, URL, page title, capture time, exporter version, and message count.
- Saves through Firefox's Downloads API by default.
- Optionally supports a local Native Messaging helper for writing to a chosen root directory such as `D:\AI_Chat_Logs`.
- Includes optional redaction for e-mail addresses, phone-like numbers, and common API-key patterns.

## Current status

Version: `0.1.0-mvp`

This is an MVP, not a polished store-ready extension. The hard part is not writing Markdown; the hard part is that every AI provider renders chat messages differently and may change its DOM at any time. The generic adapter is intentionally conservative and may need per-site tuning.

## Privacy model

The extension uses broad page access because the user can define new host patterns in the options. The content script exits immediately unless the current page matches an enabled profile. Recording is visible through an overlay and can be paused.

It does not send chat content to any remote API. Exports are written locally through Firefox downloads or, optionally, through the local native helper.

Do not enable this on pages where you do not want local transcripts. Review exported Markdown before sharing it with another AI.

## Install as temporary Firefox extension

1. Open Firefox.
2. Go to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on...**.
4. Select `extension/manifest.json` from this project.
5. Open the extension options and review the enabled profiles.

Temporary extensions are mainly for development and disappear after a browser restart. A permanent normal Firefox install requires packaging/signing through Mozilla's extension workflow.

## Default export path

Without the native helper, exported Markdown files are saved relative to Firefox's default Downloads folder, for example:

```text
Downloads/AI_Chat_Logs/2026-06-28/grok/2026-06-28_124530_grok_lora-in-gguf.md
```

The extension options contain a `Download folder prefix` setting. Keep it relative, such as `AI_Chat_Logs`.

## Optional native helper for custom paths

Use this only if you want direct writing to a path outside Firefox's Downloads folder.

1. Make sure Python 3 is installed and available as `py -3` or `python`.
2. Run `native_helper/install_native_host_windows.bat`.
3. In extension options, set **Save mode** to **Native helper, fallback to downloads**.
4. Set **Native helper root path**, for example:

```text
D:\AI_Chat_Logs
```

The helper receives JSON from Firefox via Native Messaging and writes Markdown under the configured root path. It rejects absolute or escaping relative export paths.

To remove the Native Messaging registration, run:

```text
native_helper/uninstall_native_host_windows.bat
```

## Adding or adjusting chat profiles

Open the extension options and add/edit a profile:

- `ID`: short stable ID used in file paths, e.g. `grok`.
- `Display name`: visible label, e.g. `Grok`.
- `Adapter`: `Generic` or `ChatGPT`.
- `Assistant label`: heading used in Markdown, e.g. `Grok`.
- `Host contains`: comma-separated host tokens, e.g. `grok.com, x.ai`.

For new providers, start with the `Generic` adapter. If extraction is messy, create a dedicated adapter in `content_script.js`.

## Markdown format

Example:

```markdown
---
source: "grok"
source_display_name: "Grok"
url: "https://grok.com/..."
page_title: "LoRA in GGUF"
captured_at: "2026-06-28T10:45:30.000Z"
exporter: "AI Chat Logbook"
exporter_version: "0.1.0-mvp"
message_count: 4
---

# Grok Chat Export

## User

...

## Grok

...
```

## Known limitations

- Provider DOMs are unstable; extraction may miss or duplicate messages.
- The generic adapter guesses roles when the page does not expose user/assistant metadata.
- Firefox's Downloads API cannot write to arbitrary absolute paths; use the native helper for that.
- Auto-export after assistant turns is experimental and disabled by default.
- Rich content such as images, file attachments, hidden citations, and generated UI widgets are not fully preserved.

## Recommended workflow

1. Use Grok/Gemini/DeepSeek/etc. normally.
2. Let AI Chat Logbook capture the visible dialog.
3. Export Markdown.
4. Drag the `.md` file into ChatGPT and ask for comparison, synthesis, contradiction checks, or a test plan.

## Project layout

```text
extension/
  manifest.json
  background.js
  content_script.js
  shared/
  styles/
  options/
  popup/
native_helper/
  ai_chat_logbook_helper.py
  run_native_host.cmd
  install_native_host_windows.bat
  uninstall_native_host_windows.bat
```

## License

MIT. See `LICENSE`.
