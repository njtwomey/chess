---
name: add-player
description: Add someone to a season roster, or update a player's rating or junior status. Use when a new member joins, when new ECF or FIDE grades are published, or when a player turns 16.
---

# Adding and updating players

A player is two records in two files, and which one you are editing matters.

**The person** lives on their club, `content/clubs/<club>.json`, and outlives
every season: one name, one ECF code, one rating history, whether they play for
G this year and F the next. Opponents live here too, on their own club, for the
same reason: somebody we meet twice is one man.

**The pick** lives on a team in `content/seasons/<period>/<club>-<team>/teams.json`
and is only about that season.

## Adding

In `content/clubs/bristol-clifton.json`, under `players`:

```json
{
  "playerId": "gwen-tsai",
  "name": "Gwen",
  "fullName": "Gwen Tsai",
  "ratings": [{ "date": "2026-01-01", "rating": 1290, "source": "ecf" }],
  "ecfCode": "364477H",
  "note": "Optional, only for something a captain would otherwise have to remember."
}
```

Then in the season's `teams.json`, on the team that picked them:

```json
{ "playerId": "gwen-tsai", "junior": true, "role": "member" }
```

**`junior` and `role` belong to the season, not to the person.** Age is taken
once, on the league's cut-off date, so somebody is a junior for a whole season
and then is not; and a captain captains one side. Both default, so an ordinary
squad member is `{ "playerId": "gwen-tsai" }` and nothing else.

- **`playerId` is the slug of the fullest name held**, so `fullName` where there
  is one and `name` otherwise, and permanent once a fixture has been played.
  `Gwen Tsai` is `gwen-tsai`; a member whose surname nobody has given is `alex`.
  The loader enforces it, and it is the same rule on both sides of the board: an
  opponent is `sean-hubble` for exactly the same reason.
- **It is stored bare and read as a path.** The club around it supplies the
  rest, so `gwen-tsai` at Bristol & Clifton is `bristol-clifton/gwen-tsai`
  everywhere else: in an availability entry, in a shortlist, in a game. Write
  the bare segment in both files and the whole path in a reference. The club and
  not the team, so an id survives a move from G to F.
- **That path feeds the tiebreak hash**, so changing it after a result
  re-decides past ties. Change `name`, never `playerId`.
- **`name` is what we call them; `fullName` is what the league prints.** Alfie
  is Alfred Holton-Stoppani on the LMS, and neither can be derived from the
  other. The site says Alfie everywhere; the id follows the LMS. `fullName` is
  null where nobody has asked, and then the id follows `name`.
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
- **`junior: true`**, on the season's team entry, if they are under the
  league's junior age on the cut-off date. It shortens the clock on whichever
  board they play, for both players.

## Updating a rating

**Append**, never overwrite:

```json
"ratings": [
  { "date": "2026-01-01", "rating": 1290, "source": "ecf" },
  { "date": "2026-06-01", "rating": 1325, "source": "ecf" }
]
```

On the person, in `content/clubs/<club>.json`. Ascending by date, no duplicate
dates; the loader checks both. Keeping the series is what lets a past match card
show the rating that was true at the time, and what the trend arrow on the team
page reads, and holding it once means two seasons cannot disagree about it.

## A player turning 16

Leave `junior` off the next season's team entry. Do not edit a past season: the
clock that was used on the night was the right one, and the flag sits on the
season precisely so that last year's facts stay last year's.

## What you must never do

- Invent a rating, a grade or an age.
- Delete a person who has played. Their games are referenced by results, and the
  loader will refuse to start. If somebody has left, drop them from next
  season's team and leave the person on the club.
- Add a real person to the prototype season, which is invented data in an
  invented league.
