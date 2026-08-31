---
name: record-result
description: Record the outcome of a played match — boards, colours, opponents, results and PGNs. Use after a fixture when the captain reports a score, sends a team sheet or scoresheet, pastes PGN moves, or says a match is done.
---

# Recording a result

Turns a played fixture into a `result` on its match. This is the entry that
feeds every game count in the season, so getting the players right matters more
than getting the moves right.

## What you are editing

`content/seasons/<season>/matches.json`, one match:

- `status` becomes `"played"`.
- `result` gains `ourScore`, `theirScore` and one `games` entry per board.

```json
{
  "board": 1,
  "playerId": "ada-mercer",
  "colour": "white",
  "opponent": "R. Whitlock",
  "opponentRating": 1544,
  "opponentJunior": false,
  "result": "win",
  "pgn": "1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0"
}
```

`result` is from **our** player's point of view: `win`, `draw`, `loss`,
`default-win`, `default-loss`. The PGN's own result tag is from White's side, so
our win with Black is `0-1` in the movetext. `lib/links.ts` handles that
conversion; do not pre-convert.

## Rules the loader enforces, so get them right first time

- `ourScore` must equal the games added up: win and default-win 1, draw 0.5,
  otherwise 0.
- `ourScore + theirScore` must equal the number of games.
- Board numbers unique, no player playing twice, every `playerId` on the roster.
- A match with `status: "played"` must have a result, and one without must not.

## Things that are easy to get wrong

- **Record who actually played, not who was selected.** If a reserve stepped in,
  the reserve is in `games`. Their game count follows from this entry, so
  crediting the wrong person quietly corrupts every later selection.
- **`opponentJunior` matters** even when our player is an adult: one junior on
  either side makes that board the shorter clock.
- **PGN is optional.** `null` is the honest value for a game nobody wrote up.
  Never reconstruct moves from memory or from a result.

## Verifying

`make check` runs a test that loads every recorded PGN through chess.js. An
illegal or mistyped move fails the build with the board it is on, which is the
point: a game that cannot be replayed is worse than one that was never recorded.

Then report the score, the updated games-played spread, and who is now top of
the order for the next fixture.

## Ratings

A result is often when new grades appear. Those go in `players.json` as a new
`{ date, rating, source }` **appended** to the player's list, never as an edit to
the existing entry. The history is the point.
