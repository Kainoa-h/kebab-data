# Kebab Chat Data Pipeline

Telegram group scraper + LLM-based store status classifier. Tracks contributions for whether a kebab street stall is open or closed, based on messages in a Telegram group.

Mini project vibe coded with Sonnet 4.6 and Gemini 3.1 Pro

Checkout the visualisations for the data collected in this pipeline on [the website](https://kebab.kainoaho.com/)

Read what this repo is about it in my [blog post](https://www.kainoaho.com/blog/kebab-data-pipeline/)

## Pipeline

Built on top of DVC with manual support for incremental data processing

```
scrape  →  analyze_store_status  →  prepare_web_data
```

| Stage | Script | Purpose |
|---|---|---|
| `scrape` | `src/scraper.py` | Fetch messages, members, media from Telegram |
| `analyze_store_status` | `src/analyze_store_status.py` | Regex based filter -> LLM-classify open/closed status from messages |
| `prepare_web_data` | `src/prepare_web_data.py` | Transform processed data into static JSON for the web UI |

Run all stages: `dvc repro -f`.

## Setup

1. Copy `.env.example` to `.env` and fill in Telegram API credentials.
2. Run ./src/auth.py once to setup your telegram auth
3. Run `make download` to download Qwen3.5-9B, used for labeling
4. Run `make server` to run the llama.cpp inference server
5. Add `ANON_SALT` to `.env`:

   ```
   # Use this to create the salt
   python -c "import secrets; print(secrets.token_hex(16))"
   ```

   Set this **once before the first run** and never change it — it controls alias stability. Since `.env` is gitignored, the salt stays out of version control.

---

## Web Data Output Reference

> This section documents all JSON files produced by the `prepare_web_data` stage in `processed/web_data/`.

### Privacy notes

- `anon_map.json` maps real Telegram user IDs to aliases. **Do not serve this file.**
- All other files use only anonymous aliases — safe to serve publicly.
- `ANON_SALT` lives in `.env` (gitignored) — never committed to version control.

---

### `users.json`

**Source:** `raw/members/snapshots.jsonl` + `processed/store_status/user_attributions.json`

**Schema:**

```json
[
  {
    "alias": "FierceOtter",
    "join_date": "2025-10-07",
    "join_method": "admin",
    "total_attributions": 5,
    "open_attributions": 5,
    "closed_attributions": 0,
    "total_reactions_earned": 42
  }
]
```

| Field | Type | Description |
|---|---|---|
| `alias` | string | Stable anonymous two-word alias (e.g. `FierceOtter`) |
| `join_date` | string \| null | Date the user joined the group (`YYYY-MM-DD`), null if unknown |
| `join_method` | string \| null | How they joined: `admin`, `invite_link`, `self`, `creator`, `unknown`, or null |
| `total_attributions` | int | Total number of store status reports contributed |
| `open_attributions` | int | Reports confirming the store was open |
| `closed_attributions` | int | Reports confirming the store was closed |
| `total_reactions_earned` | int | Sum of all reaction counts received on this user's messages |

**Sorted:** by `join_date` ascending (nulls last)
---

### `calendar/YYYY-MM.json`

One file per calendar month. Files are named `2025-04.json`, `2025-05.json`, etc.

**Source:** `processed/store_status/daily_status.jsonl`

**Schema:**

```json
{
  "2025-04-23": {
    "status": "open",
    "contributors": ["FierceOtter", "SlowBear"]
  },
  "2025-04-24": {
    "status": "unknown",
    "contributors": []
  }
}
```

| Field | Type | Description |
|---|---|---|
| key (date) | string | `YYYY-MM-DD` |
| `status` | string | `"open"`, `"closed"`, `"conflicted"`, or `"unknown"` |
| `contributors` | string[] | Sorted aliases of members who provided evidence for this day |

**Status meanings:**

- `open` — at least one message confirmed open, none confirmed closed
- `closed` — at least one message confirmed closed, none confirmed open
- `conflicted` — messages conflict (some say open, some say closed)
- `unknown` — no evidence for this day

---

### `member_joins.json`

**Source:** `raw/members/snapshots.jsonl`

**Schema:**

```json
[
  {
    "date": "2025-10-07",
    "count": 3,
    "members": ["FierceOtter", "SlowBear", "TinyMoose"]
  }
]
```

| Field | Type | Description |
|---|---|---|
| `date` | string | `YYYY-MM-DD` |
| `count` | int | Number of members who joined on this date |
| `members` | string[] | Sorted aliases of members who joined |

Only includes dates where at least one member joined. Members with unknown join dates are excluded
---

### `member_growth.json`

**Source:** `raw/members/snapshots.jsonl`

**Schema:**

```json
[
  {"date": "2025-04-23", "count": 1},
  {"date": "2025-05-01", "count": 4},
  {"date": "2025-05-03", "count": 6}
]
```

| Field | Type | Description |
|---|---|---|
| `date` | string | `YYYY-MM-DD` — date when the cumulative count changed |
| `count` | int | Cumulative total members as of this date |

Only emits a row when the count changes (i.e. someone joined). Use as a step-function line chart — the count stays flat between rows.

Members without a `join_date` use their earliest `snapshot_date` as a proxy, which may slightly overstate growth on that date
---

### `message_volume.json`

**Source:** `raw/messages/*.jsonl` + `processed/store_status/daily_status.jsonl`

**Schema:**

```json
[
  {"date": "2025-04-23", "total": 12, "attributed": 3}
]
```

| Field | Type | Description |
|---|---|---|
| `date` | string | `YYYY-MM-DD` |
| `total` | int | Total messages sent on this day |
| `attributed` | int | Messages that generated a store status attribution |

---

### `monthly_stats.json`

**Source:** all upstream data

**Schema:**

```json
[
  {
    "month": "2025-04",
    "new_members": 5,
    "total_messages": 87,
    "attributed_messages": 12,
    "open_days": 8,
    "closed_days": 2,
    "unknown_days": 20,
    "conflicted_days": 0
  }
]
```

| Field | Type | Description |
|---|---|---|
| `month` | string | `YYYY-MM` |
| `new_members` | int | Members who joined this month |
| `total_messages` | int | Total messages sent |
| `attributed_messages` | int | Messages that contributed a store status |
| `open_days` | int | Days confirmed open |
| `closed_days` | int | Days confirmed closed |
| `unknown_days` | int | Days with no evidence |
| `conflicted_days` | int | Days with contradictory evidence |

---

### `reaction_stats.json`

**Source:** `raw/messages/*.jsonl`

**Schema:**

```json
[
  {"emoji": "🔥", "total_count": 127, "unique_users": 34, "most_active_day": "2025-06-15"},
  {"emoji": "😢", "total_count": 43,  "unique_users": 18, "most_active_day": "2025-07-02"}
]
```

Sorted by `total_count` descending.

| Field | Type | Description |
|---|---|---|
| `emoji` | string | The reaction emoji |
| `total_count` | int | Sum of all uses of this emoji across all messages |
| `unique_users` | int | Number of distinct users who used this emoji (may be 0 if Telegram didn't return individual user IDs) |
| `most_active_day` | string \| null | Date with the highest single-day count for this emoji |

---

### `dow_patterns.json`

**Source:** `processed/store_status/daily_status.jsonl` + `raw/messages/*.jsonl`

**Schema:**

```json
[
  {"dow": 0, "label": "Mon", "open": 12, "closed": 3, "unknown": 18, "conflicted": 0, "avg_messages": 8.4},
  {"dow": 1, "label": "Tue", "open": 10, "closed": 2, "unknown": 20, "conflicted": 1, "avg_messages": 6.1},
  ...
  {"dow": 6, "label": "Sun", "open": 2,  "closed": 8, "unknown": 22, "conflicted": 0, "avg_messages": 3.2}
]
```

Always 7 entries, `dow` 0–6 (Monday–Sunday).

| Field | Type | Description |
|---|---|---|
| `dow` | int | Day of week: 0=Monday, 6=Sunday |
| `label` | string | Short label: `Mon`–`Sun` |
| `open` | int | Number of days with `status=open` on this weekday |
| `closed` | int | Number of days with `status=closed` on this weekday |
| `unknown` | int | Number of days with `status=unknown` on this weekday |
| `conflicted` | int | Number of days with `status=conflicted` on this weekday |
| `avg_messages` | float | Average number of messages sent on this weekday |

---

### `media_breakdown.json`

**Source:** `raw/messages/*.jsonl` + `processed/store_status/daily_status.jsonl`

**Schema:**

```json
[
  {"type": "text",       "total": 820, "attributed": 52},
  {"type": "photo",      "total": 340, "attributed": 41},
  {"type": "video_note", "total": 95,  "attributed": 38},
  {"type": "video",      "total": 12,  "attributed": 4},
  {"type": "sticker",    "total": 180, "attributed": 0}
]
```

Sorted by `total` descending. `type` is `"text"` for messages with no media.

| Field | Type | Description |
|---|---|---|
| `type` | string | Message type: `text`, `photo`, `video`, `video_note`, `sticker`, `document` |
| `total` | int | Total messages of this type |
| `attributed` | int | Messages of this type that generated a store status attribution |
