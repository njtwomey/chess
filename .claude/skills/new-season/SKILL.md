---
name: new-season
description: Create a new season directory from a pasted league fixture list. Use when the captain starts a new season, shares a fixture table from the LMS, or asks to set up next year's team.
---

# Starting a season

A season is a directory under `content/seasons/<id>/` holding three files. Adding
one is all it takes; the site discovers seasons by glob, so nothing needs
registering anywhere.

```
content/seasons/2027-jan-apr/
  season.json    the season itself: dates, seed, boards, clocks, links
  players.json   the roster, which changes every season
  matches.json   the fixtures
```

## Naming

Use `<year>-<start month>-<end month>`, lowercase: `2026-autumn-g`,
`2027-jan-apr`. The directory name and the `id` inside `season.json` must match,
and the loader fails if they do not.

## season.json

Copy an existing one and change what differs. The fields worth thinking about:

- **`seed`** — the tiebreak seed. Any stable string; include the season so it
  differs from every other. **Once a match has been played, it is immutable**:
  changing it re-decides every tie in the season's history.
- **`active`** — exactly one season across the whole site. This is the one `/`
  opens on.
- **`prototype`** — true only for invented data. It badges the season in the UI
  and is what keeps made-up players away from real team sheets.
- **`timeControl`** — the league's clocks. Currently 80+10, and 55+10 on a board
  with anyone under 16.

## matches.json from a pasted fixture list

The league publishes a table like `Bristol & Clifton G | 0 - 0 | South Bristol D
| Tue 8 Sep 26 | 19:30`. For each row:

- **`home` is whether we are named first.** That decides the venue: home
  fixtures are at `bristol-clifton`, away ones at the opponent club's venue.
- `venueId` must exist in `content/venues.json`. **A new opponent club means
  adding a venue first**, and its address must come from the league site or the
  club, never from a guess. A venue with a null address still works: the map link
  searches by name.
- `round` is the position in the list, 1 upward, and must be unique.
- `date` must fall inside the season's `start` and `end`.
- Ids must be unique across every season, so prefix them: `2027-jan-apr-r1`.
- Start with `status: "scheduled"`, empty `availability`, null `confirmed` and
  null `result`.

**Check the weekdays.** The league writes "Tue 8 Sep 26"; if your date does not
land on that weekday you have the wrong year or transcribed a digit. The site
prints the weekday it computed, so compare.

## Roster

Ask; do not carry the previous season's players over on your own. Membership
changes each season and that is the reason seasons exist as separate
directories. Each player needs `id` (kebab-case), `name`, and `junior`. Ratings
can be empty, which means unrated and is normal for a new member.

## Finally

Run `make check` and report the fixture count, the places on offer
(fixtures × boards) and what that comes to per player, which is the number the
captain actually cares about.
