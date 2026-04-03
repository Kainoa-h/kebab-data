#!/usr/bin/env python3
"""
Stage 3: Transform processed data into static JSON files for the web UI.

Reads from:
  raw/members/snapshots.jsonl
  raw/messages/*.jsonl
  processed/store_status/daily_status.jsonl
  processed/store_status/user_attributions.json

Outputs (in processed/web_data/):
  anon_map.json        – user_id → alias mapping  (PRIVATE: do not serve)
  users.json           – anonymised users + join date + attribution counts
  calendar/YYYY-MM.json – per-day status + contributor aliases
  member_joins.json    – days with ≥1 new member, with aliases
  member_growth.json   – cumulative member count by date
  message_volume.json  – daily total vs attributed message counts
  monthly_stats.json   – per-month aggregation
  reaction_stats.json  – emoji reaction counts
  dow_patterns.json    – open/close/message counts by day-of-week
  media_breakdown.json – message type vs attributed count
"""

import hashlib
import json
import logging
import os
from collections import defaultdict
from pathlib import Path

from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
log = logging.getLogger(__name__)

# ── Paths ──────────────────────────────────────────────────────────────────────

RAW_MESSAGES_DIR  = Path("raw/messages")
RAW_MEMBERS_FILE  = Path("raw/members/snapshots.jsonl")
DAILY_STATUS_FILE = Path("processed/store_status/daily_status.jsonl")
USER_ATTR_FILE    = Path("processed/store_status/user_attributions.json")
OUT_DIR           = Path("processed/web_data")
CALENDAR_DIR      = OUT_DIR / "calendar"
STATE_FILE        = OUT_DIR / "state.json"
ANON_MAP_FILE     = OUT_DIR / "anon_map.json"

# ── Wordlists ──────────────────────────────────────────────────────────────────

ADJECTIVES = [
    "Ancient", "Bold", "Brave", "Bright", "Calm",
    "Clever", "Crisp", "Dark", "Daring", "Dusty",
    "Early", "Eager", "Fancy", "Fierce", "Fluffy",
    "Gentle", "Giant", "Golden", "Grand", "Grumpy",
    "Happy", "Hidden", "Humble", "Icy", "Jolly",
    "Keen", "Kind", "Lively", "Lonely", "Lucky",
    "Mighty", "Misty", "Modest", "Noble", "Odd",
    "Plucky", "Proud", "Quick", "Quiet", "Rapid",
    "Rusty", "Sassy", "Serene", "Shiny", "Silent",
    "Sleepy", "Slick", "Spicy", "Swift", "Tiny",
]

ANIMALS = [
    "Badger", "Bear", "Bison", "Buffalo", "Crane",
    "Crow", "Deer", "Dingo", "Drake", "Eagle",
    "Falcon", "Ferret", "Finch", "Fox", "Gecko",
    "Goose", "Hawk", "Heron", "Ibis", "Jackal",
    "Jaguar", "Jay", "Koala", "Lemur", "Lynx",
    "Marten", "Mink", "Moose", "Moth", "Newt",
    "Okapi", "Otter", "Owl", "Panda", "Parrot",
    "Puffin", "Quail", "Raven", "Robin", "Salamander",
    "Seal", "Shark", "Shrew", "Skunk", "Snipe",
    "Stoat", "Swift", "Toad", "Vole", "Weasel",
]

# ── Anonymisation ──────────────────────────────────────────────────────────────


def _derive_alias_indices(salt: str, user_id: int) -> tuple[int, int]:
    digest = hashlib.sha256(f"{salt}:{user_id}".encode()).digest()
    adj_idx  = int.from_bytes(digest[0:4], "big") % len(ADJECTIVES)
    anim_idx = int.from_bytes(digest[4:8], "big") % len(ANIMALS)
    return adj_idx, anim_idx


def _build_alias(salt: str, user_id: int, existing: set[str]) -> str:
    adj_i, anim_i = _derive_alias_indices(salt, user_id)
    base = ADJECTIVES[adj_i] + ANIMALS[anim_i]
    if base not in existing:
        return base
    n = 2
    while f"{base}{n}" in existing:
        n += 1
    return f"{base}{n}"


def load_anon_map() -> dict[str, dict]:
    """
    Load aliases from disk. The file format is:
      { "AliasName": { "id": 123, "username": "foo" } }
    Returns an in-memory map: { "123": { "alias": "AliasName", "username": "foo" } }
    """
    if ANON_MAP_FILE.exists():
        try:
            data = json.loads(ANON_MAP_FILE.read_text())
            mem_map = {}
            for alias, info in data.items():
                uid_str = str(info.get("id"))
                mem_map[uid_str] = {
                    "alias": alias,
                    "username": info.get("username")
                }
            return mem_map
        except (json.JSONDecodeError, OSError, AttributeError):
            pass
    return {}


def save_anon_map(anon_map: dict[str, dict]) -> None:
    """
    Save the anon map. Converts the in-memory map back to:
      { "AliasName": { "id": 123, "username": "foo" } }
    """
    out_data = {}
    for uid_str, info in anon_map.items():
        try:
            uid = int(uid_str)
        except ValueError:
            continue
        out_data[info["alias"]] = {
            "id": uid,
            "username": info.get("username")
        }
    
    tmp = ANON_MAP_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(out_data, indent=2))
    tmp.replace(ANON_MAP_FILE)


def get_or_create_alias(anon_map: dict[str, dict], salt: str, user_id: int, username: str | None = None) -> str:
    """Return existing alias or create a stable new one, mutating anon_map."""
    key = str(user_id)
    if key not in anon_map:
        existing_aliases = {info["alias"] for info in anon_map.values()}
        alias = _build_alias(salt, user_id, existing_aliases)
        anon_map[key] = {"alias": alias, "username": username}
    else:
        # Update username if it wasn't set or has changed, provided we have one
        if username and anon_map[key].get("username") != username:
            anon_map[key]["username"] = username

    return anon_map[key]["alias"]


# ── Config ─────────────────────────────────────────────────────────────────────


def load_anon_salt() -> str:
    load_dotenv()
    salt = os.environ.get("ANON_SALT", "")
    if not salt:
        raise ValueError(
            "ANON_SALT must be set in .env before running this stage.\n"
            "Generate one with: python -c \"import secrets; print(secrets.token_hex(16))\""
        )
    return salt


# ── State ──────────────────────────────────────────────────────────────────────

_DEFAULT_STATE: dict = {
    "last_processed_message_id": 0,
    "last_member_snapshot_date": None,
    "last_daily_status_date": None,
}


def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            stored = json.loads(STATE_FILE.read_text())
            return {**_DEFAULT_STATE, **stored}
        except (json.JSONDecodeError, OSError):
            pass
    return dict(_DEFAULT_STATE)


def save_state(state: dict) -> None:
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2))
    tmp.replace(STATE_FILE)


# ── Atomic writer ──────────────────────────────────────────────────────────────


def write_json_atomic(path: Path, data, indent: int = 2) -> None:
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=indent, default=str))
    tmp.replace(path)


# ── Data loaders ───────────────────────────────────────────────────────────────


def load_members() -> list[dict]:
    """Load all snapshot records from snapshots.jsonl."""
    records = []
    if not RAW_MEMBERS_FILE.exists():
        return records
    with open(RAW_MEMBERS_FILE) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    log.warning("Skipping bad JSON in snapshots.jsonl")
    return records


def get_canonical_members(snapshots: list[dict]) -> dict[int, dict]:
    """
    Deduplicate snapshots by user_id.
    For each user, keep the record with the earliest join_date.
    Falls back to snapshot_date if join_date is null.
    """
    best: dict[int, dict] = {}
    for s in snapshots:
        uid = s.get("user_id")
        if uid is None:
            continue
        if uid not in best:
            best[uid] = s
        else:
            # Compare effective dates
            def _eff_date(rec: dict) -> str:
                return rec.get("join_date") or rec.get("snapshot_date") or ""
            if _eff_date(s) < _eff_date(best[uid]):
                best[uid] = s
    return best


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
                        log.warning("Skipping bad JSON in %s", path.name)
    log.info("Loaded %d messages", len(messages))
    return messages


def load_daily_status() -> list[dict]:
    """Load all records from daily_status.jsonl, sorted by date."""
    records = []
    if not DAILY_STATUS_FILE.exists():
        return records
    with open(DAILY_STATUS_FILE) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    log.warning("Skipping bad JSON in daily_status.jsonl")
    return sorted(records, key=lambda r: r["date"])


def load_user_attributions() -> dict:
    if not USER_ATTR_FILE.exists():
        return {}
    try:
        return json.loads(USER_ATTR_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return {}


# ── Transforms ─────────────────────────────────────────────────────────────────


def build_users_json(
    canonical_members: dict[int, dict],
    user_attributions: dict,
    anon_map: dict[str, dict],
    salt: str,
    all_messages: list[dict],
) -> list[dict]:
    """
    Build anonymised user list.
    Includes all members AND any users in user_attributions not in member snapshots
    (they may have left the group).
    """
    # Collect all known user IDs
    all_user_ids: set[int] = set(canonical_members.keys())
    for uid_str in user_attributions:
        if uid_str == "unknown":
            continue
        try:
            all_user_ids.add(int(uid_str))
        except ValueError:
            pass

    user_reactions_earned: dict[int, int] = defaultdict(int)
    msg_usernames: dict[int, str] = {}
    for msg in all_messages:
        sender = msg.get("sender_id")
        if sender is not None:
            all_user_ids.add(sender)
            username = msg.get("sender_username")
            if username:
                msg_usernames[sender] = username
            for r in msg.get("reactions", []):
                user_reactions_earned[sender] += r.get("count", 0)

    rows = []
    for uid in all_user_ids:
        member = canonical_members.get(uid)
        uid_str = str(uid)
        attr = user_attributions.get(uid_str, {})

        username = None
        if member and member.get("username"):
            username = member.get("username")
        elif uid in msg_usernames:
            username = msg_usernames[uid]

        alias = get_or_create_alias(anon_map, salt, uid, username)
        join_date = None
        join_method = None
        if member:
            raw_jd = member.get("join_date")
            join_date = raw_jd[:10] if raw_jd else None
            join_method = member.get("join_method")

        rows.append({
            "alias": alias,
            "join_date": join_date,
            "join_method": join_method,
            "total_attributions": attr.get("total_attributions", 0),
            "open_attributions": attr.get("open_attributions", 0),
            "closed_attributions": attr.get("closed_attributions", 0),
            "total_reactions_earned": user_reactions_earned.get(uid, 0),
        })

    # Sort by join_date ascending, nulls last
    rows.sort(key=lambda r: (r["join_date"] is None, r["join_date"] or ""))
    return rows


def build_calendar_month(
    rows: list[dict],
    anon_map: dict,
) -> dict[str, dict]:
    """Build {date: {status, contributors}} for a set of daily_status rows."""
    result: dict[str, dict] = {}
    for row in rows:
        d = row["date"]
        contributor_ids: set[int] = set()
        for attrib in row.get("open_attributions", []) + row.get("closed_attributions", []):
            uid = attrib.get("user_id")
            if uid is not None:
                contributor_ids.add(uid)
        aliases = sorted(anon_map.get(str(uid), {}).get("alias", f"User{uid}") for uid in contributor_ids)
        result[d] = {
            "status": row["status"],
            "contributors": aliases,
        }
    return result


def write_calendar_files(daily_status: list[dict], anon_map: dict) -> None:
    CALENDAR_DIR.mkdir(parents=True, exist_ok=True)
    months: dict[str, list[dict]] = {}
    for row in daily_status:
        ym = row["date"][:7]
        months.setdefault(ym, []).append(row)

    for ym, rows in months.items():
        cal_path = CALENDAR_DIR / f"{ym}.json"
        existing: dict = {}
        if cal_path.exists():
            try:
                existing = json.loads(cal_path.read_text())
            except (json.JSONDecodeError, OSError):
                pass
        new_data = build_calendar_month(rows, anon_map)
        existing.update(new_data)
        write_json_atomic(cal_path, existing)

    log.info("Wrote %d calendar files", len(months))


def build_member_joins(
    canonical_members: dict[int, dict],
    anon_map: dict,
) -> list[dict]:
    """Days where ≥1 member joined (only members with a known join_date)."""
    by_date: dict[str, list[str]] = defaultdict(list)
    for uid, member in canonical_members.items():
        jd = member.get("join_date")
        if not jd:
            continue
        date_str = jd[:10]
        alias = anon_map.get(str(uid), {}).get("alias", f"User{uid}")
        by_date[date_str].append(alias)

    rows = []
    for date_str in sorted(by_date):
        aliases = sorted(by_date[date_str])
        rows.append({"date": date_str, "count": len(aliases), "members": aliases})
    return rows


def build_member_growth(canonical_members: dict[int, dict]) -> list[dict]:
    """
    Cumulative member count by date.
    Uses join_date when available, falls back to earliest snapshot_date.
    Members without any date are counted on the latest available snapshot_date.
    """
    date_counts: dict[str, int] = defaultdict(int)
    fallback_date = None
    for member in canonical_members.values():
        jd = member.get("join_date") or member.get("snapshot_date")
        if jd:
            d = jd[:10]
            date_counts[d] += 1
            if fallback_date is None or d > fallback_date:
                fallback_date = d

    if not date_counts:
        return []

    running = 0
    rows = []
    for d in sorted(date_counts):
        running += date_counts[d]
        rows.append({"date": d, "count": running})
    return rows


def build_message_volume(
    all_messages: list[dict],
    daily_status: list[dict],
) -> list[dict]:
    """Daily total message count vs how many generated a status attribution."""
    # Build set of attributed message IDs
    attributed_ids: set[int] = set()
    for row in daily_status:
        for attrib in row.get("open_attributions", []) + row.get("closed_attributions", []):
            mid = attrib.get("message_id")
            if mid is not None:
                attributed_ids.add(mid)

    daily_total: dict[str, int] = defaultdict(int)
    daily_attr: dict[str, int] = defaultdict(int)
    for msg in all_messages:
        d = msg.get("date")
        if not d:
            continue
        date_str = d[:10]
        daily_total[date_str] += 1
        if msg.get("id") in attributed_ids:
            daily_attr[date_str] += 1

    rows = []
    for d in sorted(daily_total):
        rows.append({
            "date": d,
            "total": daily_total[d],
            "attributed": daily_attr.get(d, 0),
        })
    return rows


def build_monthly_stats(
    all_messages: list[dict],
    daily_status: list[dict],
    canonical_members: dict[int, dict],
) -> list[dict]:
    """Per-month aggregation."""
    # Message counts
    msg_total: dict[str, int] = defaultdict(int)
    msg_attr: dict[str, int] = defaultdict(int)
    attributed_ids: set[int] = set()
    for row in daily_status:
        for attrib in row.get("open_attributions", []) + row.get("closed_attributions", []):
            mid = attrib.get("message_id")
            if mid is not None:
                attributed_ids.add(mid)

    for msg in all_messages:
        d = msg.get("date")
        if not d:
            continue
        ym = d[:7]
        msg_total[ym] += 1
        if msg.get("id") in attributed_ids:
            msg_attr[ym] += 1

    # New members per month
    member_joins_by_month: dict[str, int] = defaultdict(int)
    for member in canonical_members.values():
        jd = member.get("join_date") or member.get("snapshot_date")
        if jd:
            member_joins_by_month[jd[:7]] += 1

    # Status counts per month
    status_by_month: dict[str, dict[str, int]] = defaultdict(
        lambda: {"open": 0, "closed": 0, "unknown": 0, "conflicted": 0}
    )
    for row in daily_status:
        ym = row["date"][:7]
        status = row.get("status", "unknown")
        status_by_month[ym][status] = status_by_month[ym].get(status, 0) + 1

    all_months = set(msg_total) | set(member_joins_by_month) | set(status_by_month)
    rows = []
    for ym in sorted(all_months):
        sc = status_by_month.get(ym, {})
        rows.append({
            "month": ym,
            "new_members": member_joins_by_month.get(ym, 0),
            "total_messages": msg_total.get(ym, 0),
            "attributed_messages": msg_attr.get(ym, 0),
            "open_days": sc.get("open", 0),
            "closed_days": sc.get("closed", 0),
            "unknown_days": sc.get("unknown", 0),
            "conflicted_days": sc.get("conflicted", 0),
        })
    return rows


def build_reaction_stats(all_messages: list[dict]) -> list[dict]:
    """Aggregate emoji reactions across all messages."""
    emoji_total: dict[str, int] = defaultdict(int)
    emoji_users: dict[str, set] = defaultdict(set)
    emoji_days: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    for msg in all_messages:
        d = (msg.get("date") or "")[:10]
        for reaction in msg.get("reactions", []):
            emoji = reaction.get("emoji")
            count = reaction.get("count", 0)
            if not emoji or not count:
                continue
            emoji_total[emoji] += count
            emoji_days[emoji][d] += count
            for uid in reaction.get("user_ids", []):
                emoji_users[emoji].add(uid)

    rows = []
    for emoji, total in sorted(emoji_total.items(), key=lambda x: -x[1]):
        best_day = max(emoji_days[emoji], key=lambda d: emoji_days[emoji][d], default=None)
        rows.append({
            "emoji": emoji,
            "total_count": total,
            "unique_users": len(emoji_users[emoji]),
            "most_active_day": best_day,
        })
    return rows


def build_dow_patterns(
    all_messages: list[dict],
    daily_status: list[dict],
) -> list[dict]:
    """Open/close/unknown counts + avg message volume per day-of-week (0=Mon, 6=Sun)."""
    DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    status_counts: dict[int, dict[str, int]] = {
        i: {"open": 0, "closed": 0, "unknown": 0, "conflicted": 0} for i in range(7)
    }
    msg_by_dow: dict[int, int] = defaultdict(int)
    days_by_dow: dict[int, set] = defaultdict(set)

    for row in daily_status:
        try:
            from datetime import date as _date
            d = _date.fromisoformat(row["date"])
            dow = d.weekday()
            status = row.get("status", "unknown")
            status_counts[dow][status] = status_counts[dow].get(status, 0) + 1
            days_by_dow[dow].add(row["date"])
        except (ValueError, KeyError):
            pass

    for msg in all_messages:
        d_str = (msg.get("date") or "")[:10]
        if not d_str:
            continue
        try:
            from datetime import date as _date
            dow = _date.fromisoformat(d_str).weekday()
            msg_by_dow[dow] += 1
        except ValueError:
            pass

    rows = []
    for i in range(7):
        sc = status_counts[i]
        total_days = len(days_by_dow[i]) or 1
        rows.append({
            "dow": i,
            "label": DOW_LABELS[i],
            "open": sc.get("open", 0),
            "closed": sc.get("closed", 0),
            "unknown": sc.get("unknown", 0),
            "conflicted": sc.get("conflicted", 0),
            "avg_messages": round(msg_by_dow[i] / total_days, 1),
        })
    return rows


def build_media_breakdown(
    all_messages: list[dict],
    daily_status: list[dict],
) -> list[dict]:
    """Count messages by media_type and how many were attributed."""
    attributed_ids: set[int] = set()
    for row in daily_status:
        for attrib in row.get("open_attributions", []) + row.get("closed_attributions", []):
            mid = attrib.get("message_id")
            if mid is not None:
                attributed_ids.add(mid)

    type_total: dict[str, int] = defaultdict(int)
    type_attr: dict[str, int] = defaultdict(int)

    for msg in all_messages:
        media_type = msg.get("media_type") or "text"
        type_total[media_type] += 1
        if msg.get("id") in attributed_ids:
            type_attr[media_type] += 1

    rows = []
    for t in sorted(type_total, key=lambda x: -type_total[x]):
        rows.append({
            "type": t,
            "total": type_total[t],
            "attributed": type_attr.get(t, 0),
        })
    return rows


# ── Main ───────────────────────────────────────────────────────────────────────


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    CALENDAR_DIR.mkdir(parents=True, exist_ok=True)

    salt = load_anon_salt()

    state    = load_state()
    anon_map = load_anon_map()

    # ── Load upstream data ───────────────────────────────────────────────────
    snapshots         = load_members()
    canonical_members = get_canonical_members(snapshots)
    all_messages      = load_all_messages()
    daily_status      = load_daily_status()
    user_attributions = load_user_attributions()

    # ── Early-exit if nothing changed ────────────────────────────────────────
    max_msg_id      = max((m["id"] for m in all_messages if m.get("id")), default=0)
    max_snap_date   = max((s.get("snapshot_date", "") for s in snapshots), default=None)
    max_status_date = max((r["date"] for r in daily_status), default=None)

    nothing_new = (
        max_msg_id      == state.get("last_processed_message_id", 0)
        and max_snap_date   == state.get("last_member_snapshot_date")
        and max_status_date == state.get("last_daily_status_date")
    )
    if nothing_new:
        log.info("No new data since last run. Exiting.")
        return

    log.info(
        "Processing: %d members, %d messages, %d status days",
        len(canonical_members), len(all_messages), len(daily_status),
    )

    # ── Build outputs ────────────────────────────────────────────────────────
    users = build_users_json(canonical_members, user_attributions, anon_map, salt, all_messages)
    write_json_atomic(OUT_DIR / "users.json", users)
    log.info("Wrote users.json (%d users)", len(users))

    write_calendar_files(daily_status, anon_map)

    member_joins = build_member_joins(canonical_members, anon_map)
    write_json_atomic(OUT_DIR / "member_joins.json", member_joins)
    log.info("Wrote member_joins.json (%d join-days)", len(member_joins))

    member_growth = build_member_growth(canonical_members)
    write_json_atomic(OUT_DIR / "member_growth.json", member_growth)
    log.info("Wrote member_growth.json (%d data points)", len(member_growth))

    msg_volume = build_message_volume(all_messages, daily_status)
    write_json_atomic(OUT_DIR / "message_volume.json", msg_volume)
    log.info("Wrote message_volume.json (%d days)", len(msg_volume))

    monthly = build_monthly_stats(all_messages, daily_status, canonical_members)
    write_json_atomic(OUT_DIR / "monthly_stats.json", monthly)
    log.info("Wrote monthly_stats.json (%d months)", len(monthly))

    reactions = build_reaction_stats(all_messages)
    write_json_atomic(OUT_DIR / "reaction_stats.json", reactions)
    log.info("Wrote reaction_stats.json (%d emoji types)", len(reactions))

    dow = build_dow_patterns(all_messages, daily_status)
    write_json_atomic(OUT_DIR / "dow_patterns.json", dow)
    log.info("Wrote dow_patterns.json")

    media = build_media_breakdown(all_messages, daily_status)
    write_json_atomic(OUT_DIR / "media_breakdown.json", media)
    log.info("Wrote media_breakdown.json (%d media types)", len(media))

    # ── Persist anon_map and state ───────────────────────────────────────────
    save_anon_map(anon_map)
    save_state({
        "last_processed_message_id": max_msg_id,
        "last_member_snapshot_date": max_snap_date,
        "last_daily_status_date":    max_status_date,
    })
    log.info("Done. Outputs in %s/", OUT_DIR)


if __name__ == "__main__":
    main()
