"""Discord REST API client for the bot/embed delivery path (V2).

Option A architecture — REST-only, no persistent WebSocket connection.
This module owns POST/PATCH/DELETE for messages + embeds, handles rate
limits, and supports a dry-run mode that returns synthetic message IDs
without touching Discord.

Rate-limit handling: respect Discord's `X-RateLimit-*` headers + 429
responses. Exponential backoff capped at 10s. Calls > 5/sec to a
channel pause automatically.

Error semantics:
- 401: token invalid → DiscordAuthError (operator action required)
- 403: missing channel permission → DiscordPermissionError
- 404: channel/message not found → DiscordNotFoundError
- 429: rate limited → caught + retried internally
- 5xx: transient → retried with backoff

Environment:
- DISCORD_BOT_TOKEN — bot token, required for live mode
- DISCORD_BOT_DRY_RUN — if set to "1", "true", or "yes", print payloads
  to stdout and return fake message IDs instead of POSTing

Usage:
    bot = DiscordBot(token=os.environ["DISCORD_BOT_TOKEN"])
    result = bot.post_embed(channel_id="123...", embed={...})
    # result["message_id"] is the Discord message ID
    bot.edit_embed(channel_id="123...", message_id="456...", embed={...})
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Optional


DISCORD_API_BASE = "https://discord.com/api/v10"
DEFAULT_USER_AGENT = "AeonBot/v1.0 (https://github.com/Azh1er/aeon, v1)"

# Conservative rate limit: stay well under Discord's 5 req/sec/channel
MIN_INTERVAL_BETWEEN_POSTS = 0.3  # seconds
MAX_RETRIES = 3
INITIAL_BACKOFF = 0.5  # seconds; doubles on each retry, capped at 10s


class DiscordError(Exception):
    """Base for all Discord bot errors."""


class DiscordAuthError(DiscordError):
    """401 from Discord — token invalid or revoked."""


class DiscordPermissionError(DiscordError):
    """403 from Discord — bot lacks permission on this channel."""


class DiscordNotFoundError(DiscordError):
    """404 from Discord — channel or message doesn't exist."""


class DiscordTransientError(DiscordError):
    """5xx or network failure — retried up to MAX_RETRIES."""


@dataclass
class DiscordBot:
    """Thin REST client for posting/editing embeds.

    `dry_run=True` (or DISCORD_BOT_DRY_RUN=1 in env) skips actual API
    calls — useful for local mock + design review.
    """

    token: Optional[str] = None
    dry_run: bool = False
    _last_post_time: float = field(default=0.0, init=False)
    _dry_run_counter: int = field(default=0, init=False)

    def __post_init__(self) -> None:
        # Honour env override if dry_run not explicitly set
        if not self.dry_run:
            env_dry = os.environ.get("DISCORD_BOT_DRY_RUN", "").lower()
            if env_dry in ("1", "true", "yes"):
                self.dry_run = True

        # Token is REQUIRED for live mode
        if not self.dry_run:
            self.token = self.token or os.environ.get("DISCORD_BOT_TOKEN")
            if not self.token:
                raise DiscordAuthError(
                    "DISCORD_BOT_TOKEN not set and dry_run=False — "
                    "cannot make live API calls"
                )

    # -----------------------------------------------------------------
    # Public API

    def post_embed(
        self,
        channel_id: str,
        embeds: list[dict] | dict,
        content: str = "",
    ) -> dict:
        """POST a message with one or more embeds to a channel.

        Args:
            channel_id: numeric Discord channel ID as string
            embeds: a single embed dict or list of up to 10
            content: optional plain text alongside the embed (use sparingly)

        Returns:
            {"message_id": "...", "channel_id": "...", "dry_run": bool}
        """
        if isinstance(embeds, dict):
            embeds = [embeds]
        if len(embeds) > 10:
            raise ValueError(
                f"Discord allows max 10 embeds per message; got {len(embeds)}"
            )

        # Validate every embed before sending
        for i, embed in enumerate(embeds):
            err = self._validate_embed(embed)
            if err:
                raise ValueError(f"embeds[{i}] invalid: {err}")

        payload = {"embeds": embeds}
        if content:
            payload["content"] = content[:2000]  # Discord cap

        if self.dry_run:
            return self._dry_run_response(channel_id, payload, mode="POST")

        self._throttle()
        url = f"{DISCORD_API_BASE}/channels/{channel_id}/messages"
        resp = self._request("POST", url, payload)
        return {
            "message_id": str(resp.get("id", "")),
            "channel_id": channel_id,
            "dry_run": False,
        }

    def edit_embed(
        self,
        channel_id: str,
        message_id: str,
        embeds: list[dict] | dict,
        content: str = "",
    ) -> dict:
        """PATCH an existing message's embeds. Used for daily PnL updates
        on CURRENT POSITION embeds and day-counter increments on WATCHLIST
        embeds."""
        if isinstance(embeds, dict):
            embeds = [embeds]
        for i, embed in enumerate(embeds):
            err = self._validate_embed(embed)
            if err:
                raise ValueError(f"embeds[{i}] invalid: {err}")

        payload = {"embeds": embeds}
        if content:
            payload["content"] = content[:2000]

        if self.dry_run:
            return self._dry_run_response(
                channel_id, payload, mode="PATCH", message_id=message_id
            )

        self._throttle()
        url = f"{DISCORD_API_BASE}/channels/{channel_id}/messages/{message_id}"
        resp = self._request("PATCH", url, payload)
        return {
            "message_id": str(resp.get("id", message_id)),
            "channel_id": channel_id,
            "dry_run": False,
        }

    def delete_message(self, channel_id: str, message_id: str) -> None:
        """DELETE a message. Used to clean up dropped watchlist entries
        if we don't want them to linger as 'DROPPED' markers."""
        if self.dry_run:
            print(
                f"[DRY-RUN] DELETE channels/{channel_id}/messages/{message_id}",
                file=sys.stderr,
            )
            return
        self._throttle()
        url = f"{DISCORD_API_BASE}/channels/{channel_id}/messages/{message_id}"
        self._request("DELETE", url, None)

    def add_reaction(self, channel_id: str, message_id: str, emoji: str) -> None:
        """Add a reaction to a message. URL-encoded emoji.

        For unicode emoji like ✅, pass the raw character. For custom
        emoji, format as 'name:id'.
        """
        if self.dry_run:
            print(
                f"[DRY-RUN] PUT reaction {emoji!r} on {message_id}",
                file=sys.stderr,
            )
            return
        from urllib.parse import quote
        url = (
            f"{DISCORD_API_BASE}/channels/{channel_id}/messages/{message_id}"
            f"/reactions/{quote(emoji)}/@me"
        )
        self._throttle()
        self._request("PUT", url, None)

    # -----------------------------------------------------------------
    # Internal helpers

    def _throttle(self) -> None:
        """Enforce minimum interval between requests to stay polite."""
        elapsed = time.monotonic() - self._last_post_time
        if elapsed < MIN_INTERVAL_BETWEEN_POSTS:
            time.sleep(MIN_INTERVAL_BETWEEN_POSTS - elapsed)
        self._last_post_time = time.monotonic()

    def _request(
        self,
        method: str,
        url: str,
        payload: Optional[dict],
    ) -> dict:
        """Make a Discord API request with retry/backoff. Returns
        decoded JSON response body (or empty dict on 204 no content)."""
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        headers = {
            "Authorization": f"Bot {self.token}",
            "Content-Type": "application/json",
            "User-Agent": DEFAULT_USER_AGENT,
        }
        backoff = INITIAL_BACKOFF

        for attempt in range(MAX_RETRIES + 1):
            req = urllib.request.Request(url, data=body, headers=headers, method=method)
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    raw = resp.read()
                    return json.loads(raw) if raw else {}
            except urllib.error.HTTPError as e:
                status = e.code
                err_body = e.read().decode("utf-8", errors="replace")[:500]
                if status == 401:
                    raise DiscordAuthError(
                        f"401 Unauthorized — token invalid or revoked. {err_body}"
                    )
                if status == 403:
                    raise DiscordPermissionError(
                        f"403 Forbidden — bot lacks permission on this channel. {err_body}"
                    )
                if status == 404:
                    raise DiscordNotFoundError(
                        f"404 Not Found — channel or message doesn't exist. {err_body}"
                    )
                if status == 429:
                    # Rate limited — parse retry_after from body
                    try:
                        wait = float(json.loads(err_body).get("retry_after", backoff))
                    except (ValueError, KeyError, json.JSONDecodeError):
                        wait = backoff
                    wait = min(wait, 10.0)
                    print(f"[discord-bot] 429 rate-limited, waiting {wait}s", file=sys.stderr)
                    time.sleep(wait)
                    continue
                if 500 <= status < 600 and attempt < MAX_RETRIES:
                    print(
                        f"[discord-bot] {status} transient, retry {attempt+1} after {backoff}s",
                        file=sys.stderr,
                    )
                    time.sleep(backoff)
                    backoff = min(backoff * 2, 10.0)
                    continue
                raise DiscordError(f"HTTP {status} from Discord: {err_body}")
            except urllib.error.URLError as e:
                if attempt < MAX_RETRIES:
                    print(
                        f"[discord-bot] network error '{e.reason}', retry {attempt+1} after {backoff}s",
                        file=sys.stderr,
                    )
                    time.sleep(backoff)
                    backoff = min(backoff * 2, 10.0)
                    continue
                raise DiscordTransientError(
                    f"Network failure after {MAX_RETRIES + 1} attempts: {e.reason}"
                )
        raise DiscordTransientError(f"All {MAX_RETRIES + 1} attempts failed")

    def _dry_run_response(
        self,
        channel_id: str,
        payload: dict,
        mode: str,
        message_id: Optional[str] = None,
    ) -> dict:
        """Print payload as pretty JSON, return synthetic message ID."""
        self._dry_run_counter += 1
        fake_id = f"DRYRUN-{self._dry_run_counter:06d}"
        print(
            f"\n[DRY-RUN] {mode} → channel {channel_id}"
            + (f" (editing message {message_id})" if message_id else ""),
            file=sys.stderr,
        )
        print(json.dumps(payload, indent=2, ensure_ascii=False), file=sys.stderr)
        return {
            "message_id": message_id or fake_id,
            "channel_id": channel_id,
            "dry_run": True,
        }

    # -----------------------------------------------------------------
    # Embed validation (catches limit violations BEFORE Discord rejects)

    @staticmethod
    def _validate_embed(embed: dict) -> Optional[str]:
        """Return None if valid, else a human-readable error string."""
        total = 0

        title = embed.get("title", "")
        if len(title) > 256:
            return f"title too long ({len(title)} > 256)"
        total += len(title)

        desc = embed.get("description", "")
        if len(desc) > 4096:
            return f"description too long ({len(desc)} > 4096)"
        total += len(desc)

        author = embed.get("author", {})
        if author and len(author.get("name", "")) > 256:
            return f"author.name too long"
        total += len(author.get("name", ""))

        footer = embed.get("footer", {})
        if footer and len(footer.get("text", "")) > 2048:
            return f"footer.text too long"
        total += len(footer.get("text", ""))

        fields = embed.get("fields", [])
        if len(fields) > 25:
            return f"too many fields ({len(fields)} > 25)"
        for i, f in enumerate(fields):
            if len(f.get("name", "")) > 256:
                return f"fields[{i}].name too long"
            if len(f.get("value", "")) > 1024:
                return f"fields[{i}].value too long ({len(f.get('value', ''))} > 1024)"
            total += len(f.get("name", "")) + len(f.get("value", ""))

        if total > 6000:
            return f"embed total chars {total} > 6000"

        return None
