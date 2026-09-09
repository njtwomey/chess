---
name: record-result
description: Record the outcome of a played match — boards, colours, opponents, results and PGNs. Use after a fixture when the captain reports a score, sends a team sheet or scoresheet, pastes PGN moves, or says a match is done.
---

# Recording a result

Turns a played fixture into a `result` on its match. This is the entry that
feeds every game count in the season, so getting the players right matters more
than getting the moves right.

## What you are editing

`content/seasons/<period>/<club>/team-<letter>/matches.json`, one fixture:

- `status` becomes `"played"`.
- `result` gains `ourScore`, `theirScore` and one `games` entry per board.

```json
{
  "board": 1,
  "playerId": "bristol-clifton/team-g/theo-wright",
  "opponentId": "south-bristol/team-d/sean-hubble",
  "colour": "white",
  "result": "win",
  "pgn": "1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0"
}
```

Both sides are references. The opponent themselves goes on their **club**, in
`content/clubs/<club>.json`, in exactly the shape one of ours takes, and their
team in that season's `teams.json` gains a `{ "playerId": ... }` entry saying
they were picked:

```json
{
  "playerId": "sean-hubble",
  "name": "Sean Hubble",
  "ratings": [{ "date": "2026-09-08", "rating": 1542, "source": "ecf" }],
  "codes": [{ "source": "lms", "code": "121305" }]
}
```

The code is the number out of the page you read their rating off,
`.../lms/player/121305/view`. Do not store the address: the site builds it back
from the number. And do not file that number as an `ecf` code; it is the
league site's own, and the two are different identifiers for the same person.

`result` is from **our** player's point of view: `win`, `draw`, `loss`,
`default-win`, `default-loss`. The PGN's own result tag is from White's side, so
our win with Black is `0-1` in the movetext. `lib/links.ts` handles that
conversion; do not pre-convert.

## Rules the loader enforces, so get them right first time

- `ourScore` must equal the games added up: win and default-win 1, draw 0.5,
  otherwise 0.
- `ourScore + theirScore` must equal the number of games.
- Board numbers unique, no player playing twice, every `playerId` on our roster
  and every `opponentId` on the opposing team's.
- An opponent's ratings ascend by date and none is dated after the fixture.
- A match with `status: "played"` must have a result, and one without must not.

## Things that are easy to get wrong

- **Record who actually played, not who was selected.** If a reserve stepped in,
  the reserve is in `games`. Their game count follows from this entry, so
  crediting the wrong person quietly corrupts every later selection.
- **An opponent is a person, on their club, the same shape as ours.** Add them
  once and reference them thereafter; somebody we meet in two seasons is one man
  with one rating history, which is the whole reason they are not copied into
  each game. Their `playerId` is the slug of their name. Everything else is
  optional and usually absent: they have no ECF code we know, only the league
  site's number.
- **`junior` on the opponent matters** even when our player is an adult: one
  junior on either side makes that board the shorter clock.
- **Date an opponent's rating on or before the match.** It is the rating that
  applied on the night, and the loader rejects one dated later.
- **PGN is optional.** `null` is the honest value for a game nobody wrote up.
  Never reconstruct moves from memory or from a result.

## Verifying

`make check` runs a test that loads every recorded PGN through chess.js. An
illegal or mistyped move fails the build with the board it is on, which is the
point: a game that cannot be replayed is worse than one that was never recorded.

Then report the score, the updated games-played spread, and who is now top of
the order for the next fixture.

## Ratings

A result is often when new grades appear. Those go on the person in
`content/clubs/<club>.json` as a new
`{ date, rating, source }` **appended** to the player's list, never as an edit to
the existing entry. The history is the point.
