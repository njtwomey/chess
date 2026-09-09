---
name: new-season
description: Create a new season directory from a pasted league fixture list. Use when the captain starts a new season, shares a fixture table from the LMS, or asks to set up next year's team.
---

# Starting a season

A season is a directory under `content/seasons/<period>/<club>-<team>/` holding
three files. Adding one is all it takes; the site discovers seasons by glob, so
nothing needs registering anywhere.

```
content/seasons/autumn-2026/bristol-clifton-g/
  season.json    the season itself: dates, seed, boards, clocks, division
  teams.json     both sides: ours with its squad, and everybody we play
  matches.json   the fixtures
```

The directory is not the id. The id is the path the season's own fields spell
out, `bristol-district/bristol-clifton/team-g/autumn-2026`, and it is what the
URL uses. The directory only has to be unique and short enough to type, so it is
the period and then the team: the loader checks the two agree.

## season.json

```json
{
  "leagueId": "bristol-district",
  "clubId": "bristol-clifton",
  "teamId": "g",
  "period": "autumn-2026",
  "name": "Autumn 2026",
  "division": 6,
  "start": "2026-09-01",
  "end": "2026-12-31",
  "seed": "bristol-clifton-g-2026-autumn",
  "boards": 4,
  "reserves": 2,
  "active": true,
  "prototype": false
}
```

- **`leagueId`** must be in `content/leagues.json`, which carries the rules and
  handbook links every team in that league shares.
- **`period`** is the stretch of the calendar, slugified: `autumn-2026`.
- **`division`** is an attribute, not part of the id, because it moves with
  promotion and relegation and an id built on it would take every shared link
  with it.
- **`seed`** — the tiebreak seed. Any stable string; include the season so it
  differs from every other. **Once a fixture has been played, it is immutable**:
  changing it re-decides every tie in the season's history.
- **`active`** — exactly one season across the whole site. This is the one `/`
  opens on.
- **`prototype`** — true only for invented data. It badges the season in the UI
  and is what keeps made-up players away from real team sheets.
- **`timeControl`** — the league's clocks, defaulted to 80+10 and 55+10 on a
  board with anyone under 16. Set `juniorOn` to the date the league takes age on.

## teams.json

Ours first, then a record for every side we are drawn against.

```json
[
  {
    "clubId": "bristol-clifton",
    "teamId": "g",
    "name": "Bristol & Clifton G",
    "links": { "fixtures": "https://lms.englishchess.org.uk/lms/team/30209/fixtures" },
    "players": [{ "playerId": "niall-twomey", "role": "captain" }, { "playerId": "theo-wright" }]
  },
  { "clubId": "south-bristol", "teamId": "d", "name": "South Bristol D", "players": [] }
]
```

- **`links.fixtures` on our team is required in practice**: it is the league's
  own record, and every fixture page points back at it, because this site is a
  convenience built on top of the league's list and has to say where its facts
  came from.
- **A squad entry is a reference**, into the club's own list of people in
  `content/clubs/<club>.json`, plus `junior` and `role` where they apply. Ask
  for the roster; do not carry the previous season's over on your own.
- **An opponent starts with an empty squad.** That is honest: it is a record of
  who turned up, filled in as we meet them, not a claim to know their team.
- **Every `clubId` must be a club under `content/clubs/`.** A new opponent means
  adding the club first, with its venue: see the `venue-details` skill. The
  address must come from the league site or the club, never from a guess.

## matches.json from a pasted fixture list

The league publishes a table like `Bristol & Clifton G | 0 - 0 | South Bristol D
| Tue 8 Sep 26 | 19:30`. For each row:

```json
{
  "id": "fixture-1",
  "opponentTeamId": "south-bristol/team-d",
  "home": true,
  "date": "2026-09-08",
  "time": "19:30",
  "status": "scheduled",
  "availability": [],
  "settled": false,
  "recordUrl": null,
  "result": null
}
```

- **`id` is `fixture-<n>`**, its position in the list counting from one, unique
  within the season. There is no separate round number: the id is the number.
- **`home` is whether we are named first.** That is all the venue needs, because
  the venue is the home club's and is never written down.
- **`opponentTeamId`** is the team's whole path, `<clubId>/team-<letter>`, and
  must match a record in `teams.json`.
- `date` must fall inside the season's `start` and `end`.

**Check the weekdays.** The league writes "Tue 8 Sep 26"; if your date does not
land on that weekday you have the wrong year or transcribed a digit. The site
prints the weekday it computed, so compare.

## Roster

Ask; do not carry the previous season's players over on your own. Membership
changes each season and that is the reason seasons exist as separate
directories.

## Finally

Run `make check` and report the fixture count, the places on offer
(fixtures × boards) and what that comes to per player, which is the number the
captain actually cares about.
