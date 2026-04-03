"""
One-time Telegram authentication. Run this manually before dvc repro:

    uv run python src/auth.py

Creates the session file (e.g. tg_session.session) so the scraper
can connect without interactive prompts.
"""

import asyncio
import os

from dotenv import load_dotenv
from telethon import TelegramClient


async def main() -> None:
    load_dotenv()

    api_id = os.environ.get("TG_API_ID")
    api_hash = os.environ.get("TG_API_HASH")
    session = os.environ.get("TG_SESSION", "tg_session")

    if not api_id or not api_hash:
        raise RuntimeError("TG_API_ID and TG_API_HASH must be set in .env")

    client = TelegramClient(session, int(api_id), api_hash)
    await client.start()  # interactive: phone → code → 2FA password

    me = await client.get_me()
    print(f"\nAuthenticated as: {me.first_name} (@{me.username})")
    print(f"Session saved to: {session}.session")
    print("You can now run: dvc repro")

    await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
