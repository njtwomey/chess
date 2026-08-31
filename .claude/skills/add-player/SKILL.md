---
name: add-player
description: Add someone to a season roster, or update a player's rating or junior status. Use when a new member joins, when new ECF or FIDE grades are published, or when a player turns 16.
---

# Adding and updating players

Rosters live in `content/seasons/<season>/players.json` and are per-season on
purpose: the team changes each year, and a player who did not play last season
should not appear in last season's tables.

## Adding

```json
{
  "id": "gwen-tsai",
  "name": "Gwen Tsai",
  "role": "member",
  "junior": true,
  "ratings": [{ "date": "2026-01-01", "rating": 1290, "source": "ecf" }],
  "note": "Optional, only for something a captain would otherwise have to remember."
}
```

- **`id` is the slug of the name**, and permanent once a match has been played.
  `Alex` is `alex`; `Ada Mercer` is `ada-mercer`. A test enforces it. The id is
  referenced by every availability entry and every recorded game, and it feeds
  the tiebreak hash, so changing one after a result re-decides past ties.
- **Never use a placeholder.** If somebody's name is not known yet, ask before
  adding them: `player-a` with a display name of "A" is a person nobody has
  checked on, and it will still be there in October. Two people whose names
  collide need distinguishing names, not invented ids: `alexandra` and `alex`
  are two different members, and neither is a placeholder.

**Keep it to the minimum.** A first name and, where they have one, a rating. No
surnames unless the captain asks for them, and never an email address, a phone
number or a home address: this repository is public and the site is a team sheet,
not a contact list.

- **`ratings: []` means unrated**, which is a normal state for a new member and
  is displayed as "Unrated". Never substitute a zero or an invented estimate; if
  you have a genuine estimate, record it with `"source": "estimated"` so the site
  can label it as one.
- **`junior: true`** if they are under the league's junior age. It shortens the
  clock on whichever board they play, for both players.

## Updating a rating

**Append**, never overwrite:

```json
"ratings": [
  { "date": "2026-01-01", "rating": 1290, "source": "ecf" },
  { "date": "2026-06-01", "rating": 1325, "source": "ecf" }
]
```

Ascending by date, no duplicate dates; the loader checks both. Keeping the series
is what lets a past match card show the rating that was true at the time, and
what the trend arrow on the team page reads.

## A player turning 16

Change `junior` to `false`. Do not edit past matches: the clock that was used on
the night was the right one, and the recorded games hold their own
`opponentJunior` flag.

## What you must never do

- Invent a rating, a grade or an age.
- Delete a player who has played. Their games are referenced by results, and the
  loader will refuse to start. If somebody has left, leave them on the roster;
  they simply never appear as available.
- Add a real person to `demo`, which is invented data.
