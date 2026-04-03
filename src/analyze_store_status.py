#!/usr/bin/env python3
"""
Stage 2: Analyze kebab store open/closed status from Telegram messages.

Pre-filters messages with regex, then uses Qwen 3.5 9B (llama.cpp on
localhost:8080) to verify and extract specific dates. Multimodal media
(photos/videos) are also classified for store visibility and status.

Outputs (in processed/store_status/):
  daily_status.json      – per-day status + attributions
  user_attributions.json – per-user attribution counts
  summary.json           – headline stats
"""

import base64
import json
import logging
import re
import subprocess
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
log = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
LLM_URL = "http://localhost:8080/v1/chat/completions"
RAW_MESSAGES_DIR = Path("raw/messages")
OUT_DIR = Path("processed/store_status")
STATE_FILE = OUT_DIR / "state.json"
ATTRIBUTIONS_FILE = OUT_DIR / "attributions.jsonl"
DAILY_STATUS_FILE = OUT_DIR / "daily_status.jsonl"
MEDIA_VISION_TYPES = {"photo", "video", "video_note"}

# Set to an int to cap how many *new* messages are processed per run (for testing).
# Set to None for production.
TEST_LIMIT: Optional[int] = None

# Broad regex: high recall, minimal precision – LLM does the real work.
# Erring on the side of too many candidates is fine; false positives just cost
# an extra LLM call which will correctly return relevant: false.
CANDIDATE_RE = re.compile(
    r"\b("
    # store status verbs
    r"open(?:ing|ed|s)?"
    r"|reopen(?:ing|ed|s)?"
    r"|clos(?:e|ed|ing|es|ure)"
    r"|shut(?:ting|s)?"
    r"|available"
    r"|unavailable"
    r"|sold[\s-]*out"
    # time references used in this chat
    r"|today|tdy"
    r"|tmr|tml|tomorrow"
    r"|tonight"
    r"|holiday"
    r"|break"
    # "is she here?" style reports
    r"|here"
    r")\b",
    re.IGNORECASE,
)


# ── Incremental state & attribution log ───────────────────────────────────────


def load_state() -> dict:
    """Return persisted state, or defaults if none exists yet."""
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return {"last_processed_message_id": 0}


def save_state(last_id: int) -> None:
    STATE_FILE.write_text(json.dumps({"last_processed_message_id": last_id}, indent=2))


def append_attributions(records: list[tuple[str, str, dict]]) -> None:
    """Append new (date, status, attribution) records to the JSONL log."""
    with open(ATTRIBUTIONS_FILE, "a") as f:
        for d, status, attrib in records:
            line = {"date": d, "status": status, **attrib}
            f.write(json.dumps(line, default=str) + "\n")


def load_all_attributions() -> list[dict]:
    """Read the full attributions.jsonl log."""
    if not ATTRIBUTIONS_FILE.exists():
        return []
    rows = []
    with open(ATTRIBUTIONS_FILE) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    rows.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return rows


# ── Data loading ──────────────────────────────────────────────────────────────


def load_all_messages() -> list[dict]:
    """Load all messages from raw/messages/*.jsonl, sorted by filename (date)."""
    messages = []
    for path in sorted(RAW_MESSAGES_DIR.glob("*.jsonl")):
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        messages.append(json.loads(line))
                    except json.JSONDecodeError:
                        log.warning("Skipping bad JSON line in %s", path.name)
    log.info("Loaded %d total messages", len(messages))
    return messages


# ── LLM helpers ───────────────────────────────────────────────────────────────


def llm_chat(
    messages_payload: list[dict],
    *,
    force_json: bool = True,
    timeout: int = 90,
) -> Optional[str]:
    """POST to llama.cpp chat completions endpoint, return response text or None."""
    body: dict = {
        "model": "qwen",
        "messages": messages_payload,
        "temperature": 0.0,
        "max_tokens": 1024,
    }
    if force_json:
        body["response_format"] = {"type": "json_object"}

    payload = json.dumps(body).encode()
    req = urllib.request.Request(
        LLM_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read())
            return data["choices"][0]["message"]["content"]
    except urllib.error.URLError as e:
        log.warning("LLM unreachable: %s", e)
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        log.warning("LLM response parse error: %s", e)
    return None


def extract_json(text: Optional[str]) -> Optional[dict]:
    """Parse JSON from LLM output, stripping any surrounding prose."""
    if not text:
        return None
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass
    # Fallback: grab first {...} block
    m = re.search(r"\{.*?\}", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            pass
    return None


# ── Text classification ───────────────────────────────────────────────────────

_TEXT_SYSTEM = (
    "You extract specific open/closed status reports about a kebab street stall from chat messages. "
    "Always respond with valid JSON only."
)

_TEXT_TEMPLATE = """\
/no_think
Message date: {msg_date}
Sender: {sender}
Message: {text}

Does this message CONFIRM (not ask) that the kebab stall is open or closed on specific dates?

Rules:
- Questions like "is she open today?" are NOT confirmations → relevant: false
- Statements like "she's open!", "closed today", "not open tmr" ARE confirmations
- Resolve relative expressions using the message date as reference:
    today → {msg_date}
    tmr/tml/tomorrow → next calendar day
    "next N days" → the N days starting from tomorrow
    "till end of the week" → remaining days of that ISO week
    "till end of the month" → remaining days of that calendar month
    "closed from 16/10 to 21/10" → inclusive date range, assume same year as message
    "closed until 初七 (23rd)" → use the explicit date given in parentheses
    "reopening on Monday" → find the next Monday after the message date
- General patterns ("she closes on Sundays") → NOT a specific confirmation → relevant: false
- Real-time reports ("she's open", "SHES OPEN", "open!") refer to today ({msg_date})

Return JSON only:
  If confirming: {{"relevant": true, "entries": [{{"status": "open" or "closed", "dates": ["YYYY-MM-DD", ...]}}]}}
  Otherwise:     {{"relevant": false}}
"""


def classify_text(msg: dict) -> list[tuple[str, str]]:
    """
    Return list of (status, 'YYYY-MM-DD') pairs from a candidate text message.
    status is 'open' or 'closed'.
    """
    msg_date = msg["date"][:10]
    text = msg.get("text") or ""
    sender = msg.get("sender_display_name") or msg.get("sender_username") or "unknown"

    prompt = _TEXT_TEMPLATE.format(msg_date=msg_date, sender=sender, text=text)

    content = llm_chat(
        [
            {"role": "system", "content": _TEXT_SYSTEM},
            {"role": "user", "content": prompt},
        ]
    )
    result = extract_json(content)
    if not result or not result.get("relevant"):
        return []

    pairs: list[tuple[str, str]] = []
    for entry in result.get("entries", []):
        status = str(entry.get("status", "")).lower()
        if status not in ("open", "closed"):
            continue
        for d in entry.get("dates", []):
            if isinstance(d, str) and re.match(r"\d{4}-\d{2}-\d{2}$", d):
                pairs.append((status, d))
            else:
                log.debug("Skipping malformed date %r from msg %d", d, msg["id"])
    return pairs


# ── Media classification ──────────────────────────────────────────────────────


def _encode_image(path: Path) -> Optional[str]:
    """Base64-encode an image file into a data URL."""
    ext = path.suffix.lower().lstrip(".")
    mime = {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
    }.get(ext, "image/jpeg")
    try:
        data = path.read_bytes()
        return f"data:{mime};base64,{base64.b64encode(data).decode()}"
    except OSError as e:
        log.warning("Cannot read image %s: %s", path, e)
        return None


def _video_duration(video_path: Path) -> Optional[float]:
    """Return video duration in seconds via ffprobe, or None on failure."""
    try:
        r = subprocess.run(
            [
                "ffprobe",
                "-v",
                "quiet",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(video_path),
            ],
            capture_output=True,
            timeout=10,
        )
        if r.returncode == 0:
            return float(r.stdout.decode().strip())
    except (FileNotFoundError, ValueError, subprocess.TimeoutExpired):
        pass
    return None


def _extract_video_frames(video_path: Path, max_frames: int = 6) -> list[str]:
    """
    Sample up to max_frames evenly-spaced frames from a video.
    Returns a list of base64-encoded JPEG strings (empty on failure).
    Uses ffprobe for duration then makes one ffmpeg call per frame seek.
    """
    duration = _video_duration(video_path)
    if not duration or duration <= 0:
        log.warning("Could not determine duration for %s", video_path)
        return []

    frames: list[str] = []
    for i in range(max_frames):
        t = duration * (i + 0.5) / max_frames  # centre of each segment
        try:
            r = subprocess.run(
                [
                    "ffmpeg",
                    "-ss",
                    f"{t:.3f}",
                    "-i",
                    str(video_path),
                    "-vframes",
                    "1",
                    "-q:v",
                    "3",
                    "-f",
                    "image2pipe",
                    "-vcodec",
                    "mjpeg",
                    "pipe:1",
                ],
                capture_output=True,
                timeout=15,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired) as e:
            log.warning("ffmpeg error extracting frame from %s: %s", video_path, e)
            break
        if r.returncode == 0 and r.stdout:
            frames.append(base64.b64encode(r.stdout).decode())

    log.debug(
        "Extracted %d/%d frames from %s (%.1fs)",
        len(frames),
        max_frames,
        video_path,
        duration,
    )
    return frames


_MEDIA_SYSTEM = (
    "You analyse images to identify kebab stores and their operational status. "
    "Respond with valid JSON only."
)

_MEDIA_QUESTION = (
    "/no_think\n"
    "Is there a kebab store or kebab food stall clearly visible in this image?\n"
    "If yes, is it open (staff present, lights on, serving customers) or "
    "closed (shutters down, empty, dark)?\n"
    'Respond with JSON only: {"has_store": true or false, "status": "open" or "closed" or "unknown"}'
)


def classify_media(msg: dict) -> Optional[tuple[str, str]]:
    """
    Returns (status, 'YYYY-MM-DD') if image/video shows a kebab store with known status.
    Photos are sent as a single frame; videos/video_notes sample up to 6 evenly-spaced frames.
    """
    media_type = msg.get("media_type")
    media_path = msg.get("media_path")
    if media_type not in MEDIA_VISION_TYPES or not media_path:
        return None

    path = Path(media_path)
    if not path.exists():
        log.warning("Media file missing: %s", path)
        return None

    # Build list of data URLs to send
    if media_type == "photo":
        data_url = _encode_image(path)
        if not data_url:
            return None
        image_parts = [{"type": "image_url", "image_url": {"url": data_url}}]
    else:
        frames = _extract_video_frames(path)
        if not frames:
            log.warning("No frames extracted for msg %d (%s)", msg["id"], media_type)
            return None
        image_parts = [
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{f}"}}
            for f in frames
        ]

    content = llm_chat(
        [
            {"role": "system", "content": _MEDIA_SYSTEM},
            {
                "role": "user",
                "content": image_parts + [{"type": "text", "text": _MEDIA_QUESTION}],
            },
        ],
        force_json=False,
        timeout=120,
    )
    result = extract_json(content)
    if not result or not result.get("has_store"):
        return None
    status = str(result.get("status", "")).lower()
    if status not in ("open", "closed"):
        return None
    return (status, msg["date"][:10])


# ── Attribution helpers ───────────────────────────────────────────────────────


def make_attribution(msg: dict, evidence_type: str) -> dict:
    return {
        "user_id": msg.get("sender_id"),
        "username": msg.get("sender_username"),
        "display_name": msg.get("sender_display_name"),
        "message_id": msg["id"],
        "message_date": msg["date"],
        "source_text": (msg.get("text") or "")[:300],
        "media_path": msg.get("media_path"),
        "evidence_type": evidence_type,
    }


# ── Main pipeline ─────────────────────────────────────────────────────────────


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # ── Incremental state ─────────────────────────────────────────────────────
    state = load_state()
    last_id = state.get("last_processed_message_id", 0)

    all_messages = load_all_messages()
    if not all_messages:
        log.error("No messages found in %s", RAW_MESSAGES_DIR)
        return

    new_messages = [m for m in all_messages if m["id"] > last_id]
    if TEST_LIMIT is not None:
        new_messages = new_messages[:TEST_LIMIT]
        log.info(
            "TEST_LIMIT=%d: capped to %d new messages", TEST_LIMIT, len(new_messages)
        )

    if not new_messages:
        log.info(
            "No new messages since last run (last_processed_message_id=%d)", last_id
        )
    else:
        log.info(
            "Processing %d new messages (id %d → %d)",
            len(new_messages),
            new_messages[0]["id"],
            new_messages[-1]["id"],
        )

    # ── Process new messages ───────────────────────────────────────────────────
    new_records: list[tuple[str, str, dict]] = []
    text_candidates = media_candidates = 0

    for i, msg in enumerate(new_messages, 1):
        text = msg.get("text") or ""
        media_type = msg.get("media_type")

        if CANDIDATE_RE.search(text):
            text_candidates += 1
            log.info(
                "[%d/%d] Text candidate msg %d: %s",
                i,
                len(new_messages),
                msg["id"],
                text[:80].replace("\n", " "),
            )
            pairs = classify_text(msg)
            if pairs:
                attrib = make_attribution(msg, "text")
                for status, d in pairs:
                    new_records.append((d, status, attrib))
                    log.info("  → %s on %s", status, d)

        if media_type in MEDIA_VISION_TYPES:
            media_candidates += 1
            log.info(
                "[%d/%d] Media candidate msg %d (%s)",
                i,
                len(new_messages),
                msg["id"],
                media_type,
            )
            result = classify_media(msg)
            if result:
                status, d = result
                new_records.append(
                    (d, status, make_attribution(msg, f"media:{media_type}"))
                )
                log.info("  → store %s on %s (from media)", status, d)

    log.info(
        "This run: %d text candidates, %d media candidates → %d new attribution records",
        text_candidates,
        media_candidates,
        len(new_records),
    )

    # ── Persist new attributions & advance cursor ─────────────────────────────
    if new_records:
        append_attributions(new_records)
    if new_messages:
        save_state(max(m["id"] for m in new_messages))

    # ── Aggregate full attribution log → derived JSON outputs ─────────────────
    all_attributions = load_all_attributions()

    # day_str → {"open": [row, ...], "closed": [row, ...]}
    daily: dict[str, dict[str, list]] = defaultdict(lambda: {"open": [], "closed": []})
    user_stats: dict[str, dict] = {}

    for row in all_attributions:
        d = row["date"]
        status = row["status"]
        daily[d][status].append(row)

        uid = str(row.get("user_id")) if row.get("user_id") is not None else "unknown"
        if uid not in user_stats:
            user_stats[uid] = {
                "username": row.get("username"),
                "display_name": row.get("display_name"),
                "total_attributions": 0,
                "open_attributions": 0,
                "closed_attributions": 0,
            }
        user_stats[uid]["total_attributions"] += 1
        user_stats[uid][f"{status}_attributions"] += 1

    # ── Date range (always over ALL messages, not just new ones) ──────────────
    msg_dates = [m["date"][:10] for m in all_messages if m.get("date")]
    date_start = date.fromisoformat(min(msg_dates))
    date_end = date.fromisoformat(max(msg_dates))
    total_days = (date_end - date_start).days + 1
    all_days = {str(date_start + timedelta(days=n)) for n in range(total_days)}

    unaccounted_count = len(all_days - set(daily.keys()))
    pct_unaccounted = (
        round(100.0 * unaccounted_count / total_days, 1) if total_days else 0.0
    )

    # ── Build daily_status.json ────────────────────────────────────────────────
    daily_out: dict[str, dict] = {}
    for d in sorted(all_days):
        info = daily.get(d, {"open": [], "closed": []})
        n_open, n_closed = len(info["open"]), len(info["closed"])
        if n_open > 0 and n_closed == 0:
            consensus = "open"
        elif n_closed > 0 and n_open == 0:
            consensus = "closed"
        elif n_open > 0 and n_closed > 0:
            consensus = "conflicted"
        else:
            consensus = "unknown"
        daily_out[d] = {
            "status": consensus,
            "open_attributions": info["open"],
            "closed_attributions": info["closed"],
        }

    # ── Summary ───────────────────────────────────────────────────────────────
    summary = {
        "date_range": {"start": str(date_start), "end": str(date_end)},
        "total_days_in_range": total_days,
        "days_confirmed_open": sum(
            1 for v in daily_out.values() if v["status"] == "open"
        ),
        "days_confirmed_closed": sum(
            1 for v in daily_out.values() if v["status"] == "closed"
        ),
        "days_conflicted": sum(
            1 for v in daily_out.values() if v["status"] == "conflicted"
        ),
        "days_unaccounted": unaccounted_count,
        "pct_unaccounted": pct_unaccounted,
        "total_attributions": len(all_attributions),
        "users_with_attributions": len(user_stats),
    }

    # ── Write derived outputs ──────────────────────────────────────────────────
    with open(DAILY_STATUS_FILE, "w") as f:
        for d in sorted(daily_out):
            f.write(json.dumps({"date": d, **daily_out[d]}, default=str) + "\n")

    (OUT_DIR / "user_attributions.json").write_text(
        json.dumps(user_stats, indent=2, default=str)
    )
    (OUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2))

    log.info("=== SUMMARY ===")
    for k, v in summary.items():
        log.info("  %s: %s", k, v)
    log.info("Outputs written to %s/", OUT_DIR)


if __name__ == "__main__":
    main()
