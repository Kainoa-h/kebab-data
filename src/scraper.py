"""
Telegram group scraper for DVC pipeline stage 1.

Reads config from params.yaml and credentials from .env.
Outputs JSONL files to raw/ and updates raw/cursors.json for incremental runs.
"""

import asyncio
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import yaml
from dotenv import load_dotenv
from telethon import TelegramClient
from telethon.tl.functions.channels import GetFullChannelRequest
from telethon.tl.types import (
    Channel,
    ChannelParticipantAdmin,
    ChannelParticipantBanned,
    ChannelParticipantCreator,
    ChannelParticipantSelf,
    Chat,
    ChatParticipantAdmin,
    ChatParticipantCreator,
    InputMessagesFilterEmpty,
    MessageMediaDocument,
    MessageMediaPhoto,
    MessageMediaUnsupported,
    PeerChannel,
    PeerChat,
    PeerUser,
    ReactionEmoji,
    TypeMessageReactions,
    User,
)

RAW = Path("raw")
CURSORS_PATH = RAW / "cursors.json"


# ---------------------------------------------------------------------------
# Config / setup
# ---------------------------------------------------------------------------

def load_config() -> dict:
    with open("params.yaml") as f:
        return yaml.safe_load(f)["scraper"]


def ensure_dirs(media_types: list[str]) -> None:
    for d in [RAW / "messages", RAW / "members", RAW / "invite_links"]:
        d.mkdir(parents=True, exist_ok=True)
    for mt in media_types:
        (RAW / "media" / mt).mkdir(parents=True, exist_ok=True)


def read_cursors() -> dict:
    if CURSORS_PATH.exists():
        with open(CURSORS_PATH) as f:
            return json.load(f)
    return {"last_message_id": 0, "last_member_sync": None}


def write_cursors(cursors: dict) -> None:
    """Atomic write via temp file to survive mid-run interruptions."""
    tmp = CURSORS_PATH.with_suffix(".tmp")
    with open(tmp, "w") as f:
        json.dump(cursors, f, indent=2)
    tmp.replace(CURSORS_PATH)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _user_display_name(user) -> str:
    if user is None:
        return ""
    parts = [user.first_name or "", user.last_name or ""]
    return " ".join(p for p in parts if p).strip()


def get_forward_origin(msg) -> dict | None:
    fwd = msg.forward
    if fwd is None:
        return None
    origin: dict = {}
    if fwd.from_id is not None:
        peer = fwd.from_id
        if isinstance(peer, PeerUser):
            origin["type"] = "user"
            origin["user_id"] = peer.user_id
        elif isinstance(peer, PeerChannel):
            origin["type"] = "channel"
            origin["channel_id"] = peer.channel_id
            if fwd.channel_post is not None:
                origin["post_id"] = fwd.channel_post
        elif isinstance(peer, PeerChat):
            origin["type"] = "chat"
            origin["chat_id"] = peer.chat_id
    elif fwd.from_name:
        origin["type"] = "hidden_user"
        origin["name"] = fwd.from_name
    return origin or None


def get_media_type(msg) -> str | None:
    if msg.photo:
        return "photo"
    if msg.video_note:
        return "video_note"
    if msg.video:
        return "video"
    if msg.sticker:
        return "sticker"
    if msg.document:
        return "document"
    return None


async def download_media_file(
    client: TelegramClient,
    msg,
    media_type: str,
    allowed_types: list[str],
) -> str | None:
    if media_type not in allowed_types:
        return None

    media_dir = RAW / "media" / media_type

    # Determine extension
    if media_type == "photo":
        ext = "jpg"
    elif media_type == "video":
        ext = getattr(msg.video, "mime_type", "video/mp4").split("/")[-1]
    elif media_type == "video_note":
        ext = "mp4"
    elif media_type == "sticker":
        ext = "webp"
    else:
        # document — pull from mime_type or attributes
        doc = msg.document
        if doc and doc.mime_type:
            ext = doc.mime_type.split("/")[-1]
        else:
            ext = "bin"

    dest = media_dir / f"{msg.id}.{ext}"
    if dest.exists():
        return str(dest)

    try:
        await client.download_media(msg, file=str(dest))
        return str(dest)
    except Exception as exc:
        print(f"  [warn] failed to download media for msg {msg.id}: {exc}")
        return None


async def get_reactions(client: TelegramClient, group, msg) -> list[dict]:
    """Return list of {emoji, count, user_ids} dicts."""
    if not msg.reactions:
        return []

    results = []
    for r in msg.reactions.results:
        emoji = r.reaction.emoticon if isinstance(r.reaction, ReactionEmoji) else str(r.reaction)
        entry: dict = {"emoji": emoji, "count": r.count, "user_ids": []}

        # Fetch individual reactors (best-effort; may be empty for large counts)
        try:
            resp = await client.get_message_reactions(group, msg.id, reaction=r.reaction)
            entry["user_ids"] = [
                u.peer_id.user_id if hasattr(u, "peer_id") else getattr(u, "user_id", None)
                for u in (resp.reactions if resp and resp.reactions else [])
            ]
            entry["user_ids"] = [uid for uid in entry["user_ids"] if uid is not None]
        except Exception:
            pass  # reactions list not always accessible

        results.append(entry)
    return results


def _open_jsonl(path: Path):
    """Open a JSONL file for appending, creating it if necessary."""
    return open(path, "a", encoding="utf-8")


# ---------------------------------------------------------------------------
# Scrape messages
# ---------------------------------------------------------------------------

async def scrape_messages(
    client: TelegramClient,
    group,
    params: dict,
    cursors: dict,
) -> int:
    """Fetch new messages, append to dated JSONL files. Returns new last_message_id."""
    min_id = cursors["last_message_id"] if params.get("incremental") else 0
    batch_size = params.get("batch_size", 200)
    allowed_media = params.get("media_types", [])

    print(f"Scraping messages (min_id={min_id})...")

    # Open files keyed by date string; flush/close at the end
    open_files: dict[str, object] = {}
    last_id = min_id

    try:
        async for msg in client.iter_messages(
            group,
            min_id=min_id,
            reverse=True,  # oldest-first so cursor advances safely
        ):
            if not hasattr(msg, "id"):
                continue

            sender = await msg.get_sender()
            media_type = get_media_type(msg)
            media_path = None
            if media_type:
                media_path = await download_media_file(client, msg, media_type, allowed_media)

            reactions = await get_reactions(client, group, msg)

            record = {
                "id": msg.id,
                "date": msg.date.isoformat() if msg.date else None,
                "sender_id": sender.id if sender else None,
                "sender_username": getattr(sender, "username", None),
                "sender_display_name": _user_display_name(sender) if isinstance(sender, User) else None,
                "text": msg.message or None,
                "reply_to_message_id": msg.reply_to.reply_to_msg_id if msg.reply_to else None,
                "forward_origin": get_forward_origin(msg),
                "media_type": media_type,
                "media_path": media_path,
                "is_edited": msg.edit_date is not None,
                "is_pinned": bool(msg.pinned),
                "reactions": reactions,
            }

            # Partition by date
            date_str = msg.date.strftime("%Y-%m-%d") if msg.date else "unknown"
            if date_str not in open_files:
                open_files[date_str] = _open_jsonl(RAW / "messages" / f"{date_str}.jsonl")

            open_files[date_str].write(json.dumps(record, ensure_ascii=False) + "\n")  # type: ignore[union-attr]

            last_id = max(last_id, msg.id)

            # Persist cursor every 500 messages so restarts don't replay everything
            if last_id % 500 == 0:
                cursors["last_message_id"] = last_id
                write_cursors(cursors)

    finally:
        for fh in open_files.values():
            fh.close()  # type: ignore[union-attr]

    print(f"  Done. last_message_id={last_id}")
    return last_id


# ---------------------------------------------------------------------------
# Scrape members
# ---------------------------------------------------------------------------

async def scrape_members(client: TelegramClient, group) -> str:
    """Fetch all participants, append snapshot to members/snapshots.jsonl."""
    snapshot_date = datetime.now(timezone.utc).isoformat()
    print("Scraping members...")

    dest = RAW / "members" / "snapshots.jsonl"
    count = 0

    with _open_jsonl(dest) as fh:
        async for participant in client.iter_participants(group, aggressive=True):
            p = participant.participant if hasattr(participant, "participant") else None

            join_date = None
            join_method = None
            invite_link_hash = None
            added_by_user_id = None

            if p is not None:
                join_date = getattr(p, "date", None)
                if join_date:
                    join_date = join_date.isoformat()

                # Determine join method from participant type
                if isinstance(p, ChannelParticipantSelf):
                    join_method = "self"
                elif isinstance(p, ChannelParticipantCreator):
                    join_method = "creator"
                elif isinstance(p, ChannelParticipantAdmin):
                    join_method = "admin"
                elif isinstance(p, ChannelParticipantBanned):
                    join_method = "banned"
                elif hasattr(p, "inviter_id") and p.inviter_id:
                    join_method = "added_by_user"
                    added_by_user_id = p.inviter_id
                else:
                    join_method = "unknown"

            record = {
                "snapshot_date": snapshot_date,
                "user_id": participant.id,
                "username": getattr(participant, "username", None),
                "display_name": _user_display_name(participant),
                "phone": getattr(participant, "phone", None),
                "join_date": join_date,
                "join_method": join_method,
                "invite_link_hash": invite_link_hash,
                "added_by_user_id": added_by_user_id,
            }
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")
            count += 1

    print(f"  Done. {count} members written.")
    return snapshot_date


# ---------------------------------------------------------------------------
# Scrape invite links
# ---------------------------------------------------------------------------

async def scrape_invite_links(client: TelegramClient, group) -> None:
    """Fetch all invite links (admin only), append to invite_links/links.jsonl."""
    snapshot_date = datetime.now(timezone.utc).isoformat()
    print("Scraping invite links...")

    dest = RAW / "invite_links" / "links.jsonl"
    count = 0

    try:
        async for link in client.iter_chat_invite_links(group):
            # Extract hash from URL: https://t.me/+HASH or https://t.me/joinchat/HASH
            url = link.link or ""
            link_hash = url.rstrip("/").rsplit("/", 1)[-1].lstrip("+")

            record = {
                "snapshot_date": snapshot_date,
                "hash": link_hash,
                "url": url,
                "creator_user_id": link.admin_id if hasattr(link, "admin_id") else None,
                "created_date": link.date.isoformat() if link.date else None,
                "expiry_date": link.expire_date.isoformat() if getattr(link, "expire_date", None) else None,
                "usage_count": getattr(link, "usage", None),
            }

            with _open_jsonl(dest) as fh:
                fh.write(json.dumps(record, ensure_ascii=False) + "\n")
            count += 1

    except Exception as exc:
        print(f"  [warn] could not fetch invite links (need admin): {exc}")
        return

    print(f"  Done. {count} invite links written.")


# ---------------------------------------------------------------------------
# Enrich member join-via-link from admin log
# ---------------------------------------------------------------------------

async def enrich_members_from_admin_log(client: TelegramClient, group) -> None:
    """
    Cross-reference admin join-events to attach invite_link_hash to member records.
    This rewrites the last snapshot's records where join_method is unknown and
    a matching join-via-link admin log event exists.
    """
    print("Enriching member join methods from admin log...")
    link_by_user: dict[int, str] = {}

    try:
        async for event in client.iter_admin_log(group, join=True):
            uid = event.user_id
            # event.action may carry invite link info
            action = event.action
            invite = getattr(action, "invite", None)
            if invite and hasattr(invite, "link"):
                url = invite.link or ""
                link_hash = url.rstrip("/").rsplit("/", 1)[-1].lstrip("+")
                if uid and link_hash:
                    link_by_user[uid] = link_hash
    except Exception as exc:
        print(f"  [warn] admin log unavailable: {exc}")
        return

    if not link_by_user:
        print("  No join-via-link events found.")
        return

    # Rewrite snapshots.jsonl with enriched data
    snapshot_path = RAW / "members" / "snapshots.jsonl"
    if not snapshot_path.exists():
        return

    updated = 0
    lines = []
    with open(snapshot_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            uid = rec.get("user_id")
            if uid in link_by_user and rec.get("invite_link_hash") is None:
                rec["invite_link_hash"] = link_by_user[uid]
                rec["join_method"] = "invite_link"
                updated += 1
            lines.append(json.dumps(rec, ensure_ascii=False))

    tmp = snapshot_path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    tmp.replace(snapshot_path)

    print(f"  Enriched {updated} member records with invite link hash.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main() -> None:
    load_dotenv()

    api_id = os.environ.get("TG_API_ID")
    api_hash = os.environ.get("TG_API_HASH")
    session = os.environ.get("TG_SESSION", "tg_session")

    if not api_id or not api_hash:
        raise RuntimeError("TG_API_ID and TG_API_HASH must be set in .env")

    params = load_config()
    ensure_dirs(params.get("media_types", []))
    cursors = read_cursors()

    group_id = params["group_id"]

    session_file = Path(f"{session}.session")
    if not session_file.exists():
        raise RuntimeError(
            f"No session file found at {session_file}. "
            "Run 'uv run python src/auth.py' first to authenticate."
        )

    client = TelegramClient(session, int(api_id), api_hash)
    await client.connect()

    if not await client.is_user_authorized():
        await client.disconnect()
        raise RuntimeError(
            "Session exists but is not authorized. "
            "Re-run 'uv run python src/auth.py' to re-authenticate."
        )

    try:
        # Resolve group entity once
        group = await client.get_entity(group_id)
        print(f"Connected. Group: {getattr(group, 'title', group_id)}")

        # 1. Messages (incremental)
        new_last_id = await scrape_messages(client, group, params, cursors)
        cursors["last_message_id"] = new_last_id
        write_cursors(cursors)

        # 2. Members
        snapshot_date = await scrape_members(client, group)
        cursors["last_member_sync"] = snapshot_date
        write_cursors(cursors)

        # 3. Invite links
        await scrape_invite_links(client, group)

        # 4. Enrich member join method from admin log
        await enrich_members_from_admin_log(client, group)

    finally:
        await client.disconnect()

    print("Scrape complete. Cursors updated.")


if __name__ == "__main__":
    asyncio.run(main())
