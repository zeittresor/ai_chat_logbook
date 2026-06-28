#!/usr/bin/env python3
"""AI Chat Logbook native helper.

Native Messaging protocol helper for Firefox WebExtensions.
It receives JSON messages via stdin/stdout and writes Markdown exports to a user-chosen root directory.

SPDX-License-Identifier: MIT
"""
from __future__ import annotations

import json
import os
import struct
import sys
from pathlib import Path, PurePath
from typing import Any, Dict

HOST_NAME = "ai_chat_logbook_native"
DEFAULT_ROOT = Path.home() / "Documents" / "AI_Chat_Logs"


def read_exact(num_bytes: int) -> bytes:
    data = sys.stdin.buffer.read(num_bytes)
    if len(data) != num_bytes:
        raise EOFError("stdin closed")
    return data


def read_message() -> Dict[str, Any]:
    raw_length = read_exact(4)
    message_length = struct.unpack("<I", raw_length)[0]
    if message_length > 64 * 1024 * 1024:
        raise ValueError("message too large")
    payload = read_exact(message_length)
    return json.loads(payload.decode("utf-8"))


def send_message(message: Dict[str, Any]) -> None:
    payload = json.dumps(message, ensure_ascii=False).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(payload)))
    sys.stdout.buffer.write(payload)
    sys.stdout.buffer.flush()


def sanitize_relative_path(relative_path: str) -> Path:
    raw = str(relative_path or "export.md").replace("\\", "/").strip()
    pure = PurePath(raw)
    if pure.is_absolute():
        raise ValueError("relativePath must not be absolute")
    parts = []
    for part in pure.parts:
        if part in ("", "."):
            continue
        if part == "..":
            raise ValueError("relativePath must not contain '..'")
        clean = "".join("_" if ch in '<>:"|?*\x00\r\n' else ch for ch in part).strip()
        clean = clean.strip(". ") or "_"
        parts.append(clean[:160])
    if not parts:
        parts = ["export.md"]
    if not parts[-1].lower().endswith(".md"):
        parts[-1] += ".md"
    return Path(*parts)


def resolve_output_path(root_path: str, relative_path: str) -> Path:
    root = Path(root_path).expanduser() if root_path else DEFAULT_ROOT
    root = root.resolve()
    rel = sanitize_relative_path(relative_path)
    output = (root / rel).resolve()
    try:
        output.relative_to(root)
    except ValueError as exc:
        raise ValueError("output path escapes root") from exc
    return output


def save_markdown(message: Dict[str, Any]) -> Dict[str, Any]:
    output = resolve_output_path(message.get("rootPath", ""), message.get("relativePath", ""))
    content = str(message.get("content", ""))
    if not content:
        raise ValueError("content is empty")
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists() and not message.get("overwrite", False):
        stem = output.stem
        suffix = output.suffix
        parent = output.parent
        idx = 1
        while True:
            candidate = parent / f"{stem}_{idx:03d}{suffix}"
            if not candidate.exists():
                output = candidate
                break
            idx += 1
    output.write_text(content, encoding="utf-8", newline="\n")
    return {"ok": True, "path": str(output)}


def handle(message: Dict[str, Any]) -> Dict[str, Any]:
    action = message.get("action")
    if action == "ping":
        return {"ok": True, "host": HOST_NAME}
    if action == "save_markdown":
        return save_markdown(message)
    return {"ok": False, "error": f"unknown action: {action}"}


def main() -> int:
    while True:
        try:
            incoming = read_message()
        except EOFError:
            return 0
        except Exception as exc:  # noqa: BLE001 - native host should return errors as JSON when possible.
            try:
                send_message({"ok": False, "error": str(exc)})
            finally:
                return 1
        try:
            send_message(handle(incoming))
        except Exception as exc:  # noqa: BLE001
            send_message({"ok": False, "error": str(exc)})


if __name__ == "__main__":
    os.environ.setdefault("PYTHONUTF8", "1")
    raise SystemExit(main())
