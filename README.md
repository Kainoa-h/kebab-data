# datapipeline

Telegram group scraper + LLM-based store status classifier. Tracks whether a kebab street stall is open or closed, based on messages in a Telegram group.

## Pipeline

```
scrape  →  analyze_store_status  →  prepare_web_data
```

| Stage | Script | Purpose |
|---|---|---|
| `scrape` | `src/scraper.py` | Fetch messages, members, media from Telegram |
| `analyze_store_status` | `src/analyze_store_status.py` | LLM-classify open/closed status from messages |
| `prepare_web_data` | `src/prepare_web_data.py` | Transform processed data into static JSON for the web UI |

Run all stages: `dvc repro`

## Setup

1. Copy `.env.example` to `.env` and fill in Telegram API credentials.
2. Add `ANON_SALT` to `.env`:
   ```
   python -c "import secrets; print(secrets.token_hex(16))"
   ```
   Set this **once before the first run** and never change it — it controls alias stability. Since `.env` is gitignored, the salt stays out of version control.

---

## Web Data Output Reference

> This section documents all JSON files produced by the `prepare_web_data` stage in `processed/web_data/`.
> It is intended to be readable by an LLM tasked with building the static web UI without access to this codebase.

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
    "closed_attributions": 0
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

**Sorted:** by `join_date` ascending (nulls last).

**Web UI use cases:**
- Contributor ranking table (sort by `total_attributions` desc)
- Member list with join date

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

**Web UI use cases:**
- Monthly calendar grid: colour each cell by status, hover to show contributor aliases
- Days not present in the file are `unknown`

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

Only includes dates where at least one member joined. Members with unknown join dates are excluded.

**Web UI use cases:**
- Overlay on the calendar view showing join events
- Tooltip listing who joined on a given day

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

Members without a `join_date` use their earliest `snapshot_date` as a proxy, which may slightly overstate growth on that date.

**Web UI use cases:**
- Line chart of total group size over time
- Milestone annotations ("reached 50 members")

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

**Web UI use cases:**
- Segment/stacked bar chart: ratio of useful (attributed) to total messages per day/week/month
- Activity heatmap background layer

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

**Web UI use cases:**
- Monthly growth rate bar chart (`new_members` per month)
- Monthly activity trend lines
- Monthly open/closed/unknown breakdown stacked bar

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

**Web UI use cases:**
- Reaction leaderboard / fun stats panel
- Community engagement indicator

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

**Web UI use cases:**
- "When is the store usually open?" bar chart — most actionable for group members
- Activity heatmap by day-of-week

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

**Web UI use cases:**
- Segment bar chart: total vs useful messages by type
- Pipeline health metric — shows which content type is most informative (high attributed/total ratio)

---

## Suggested Web UI Components

| Component | Data files | Description |
|---|---|---|
| Calendar view | `calendar/YYYY-MM.json` | Monthly grid; cell colour by status; hover shows contributor aliases |
| Contributor rankings | `users.json` | Table sorted by `total_attributions`; includes join date |
| Member growth chart | `member_growth.json` | Step-function line chart of cumulative member count |
| Monthly growth rate | `monthly_stats.json` | Bar chart of `new_members` per month |
| Message ratio bar | `message_volume.json`, `monthly_stats.json` | Stacked/segment bar: total vs attributed messages per day/week/month |
| Day-of-week open/close | `dow_patterns.json` | Bar chart answering "when is it usually open?" |
| Activity heatmap | `dow_patterns.json`, `message_volume.json` | Heatmap of message volume by day-of-week × week |
| Reaction leaderboard | `reaction_stats.json` | Top emojis by usage |
| Media type efficiency | `media_breakdown.json` | Which content type generates the most useful reports |
| Join events overlay | `member_joins.json` | Overlay on calendar or growth chart; tooltip with who joined |
