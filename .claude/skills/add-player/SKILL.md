---
name: add-player
description: Add someone to a season roster, or update a player's rating or junior status. Use when a new member joins, when new ECF or FIDE grades are published, or when a player turns 16.
---

# Adding and updating players

Rosters live in `content/seasons/<period>/<club>-<team>/teams.json`, inside the
`players` array of the team they turn out for. They are per season on purpose:
the team changes each year, and a player who did not play last season should not
appear in last season's tables.

Both sides of the board are the same shape. Our squad and an opponent's are
entries in the same file, differing only in which team holds them.

## Adding

```json
{
  "playerId": "gwen",
  "name": "Gwen",
  "fullName": "Gwen Tsai",
  "role": "member",
  "junior": true,
  "ratings": [{ "date": "2026-01-01", "rating": 1290, "source": "ecf" }],
  "ecfCode": "364477H",
  "note": "Optional, only for something a captain would otherwise have to remember."
}
```

- **`playerId` is the slug of `name`**, and permanent once a fixture has been
  played. `Alex` is `alex`; `Ada Mercer` is `ada-mercer`. The loader enforces it.
- **It is stored bare and read as a path.** The team around it supplies the
  rest, so `gwen` in Team G's roster is `bristol-clifton/team-g/gwen` everywhere
  else: in an availability entry, in a shortlist, in a game. Write the bare
  segment here and the whole path there.
- **That path feeds the tiebreak hash**, so changing it after a result
  re-decides past ties. Change `name`, never `playerId`.
- **`name` is what we call them; `fullName` is what the league prints.** Alfie
  is Alfred Holton-Stoppani on the LMS, and neither can be derived from the
  other. `fullName` is null where nobody has needed it.
- **Never use a placeholder.** If somebody's name is not known yet, ask before
  adding them: `player-a` with a display name of "A" is a person nobody has
  checked on, and it will still be there in October. Two people whose names
  collide need distinguishing names, not invented ids: `alexandra` and `alex`
  are two different members, and neither is a placeholder.

**Keep it to the minimum.** Never an email address, a phone number or a home
address: this repository is public and the site is a team sheet, not a contact
list.

- **`ratings: []` means unrated**, which is a normal state for a new member and
  is displayed as "Unrated". Never substitute a zero or an invented estimate; if
  you have a genuine estimate, record it with `"source": "estimated"` so the site
  can label it as one.
- **`junior: true`** if they are under the league's junior age on the season's
  cut-off date. It shortens the clock on whichever board they play, for both
  players.

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

Change `junior` to `false` in the next season's roster. Do not edit a past
season: the clock that was used on the night was the right one, and each season
holds its own roster precisely so that last year's facts stay last year's.

## What you must never do

- Invent a rating, a grade or an age.
- Delete a player who has played. Their games are referenced by results, and the
  loader will refuse to start. If somebody has left, leave them on the roster;
  they simply never appear as available.
- Add a real person to the prototype season, which is invented data in an
  invented league.
