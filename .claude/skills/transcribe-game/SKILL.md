---
name: transcribe-game
description: Turn a photograph of a scoresheet into a PGN, including how to repair a transcription that stops replaying. Use when the captain sends a photo of a scoresheet, asks to extract or fix the moves of a game, or says a PGN does not load.
---

# Reading a game off a scoresheet

A scoresheet is somebody's handwriting, in a hurry, in a hall. Most of it reads
straight off. The last few moves rarely do, and the whole job is telling the
difference between a move you have read and a move you have guessed.

**The rule the rest of this hangs off: never write down a move you have not
seen.** A plausible wrong game is worse than half a game, because half a game is
honest about being half a game.

## Where things live

```
games/<period>/<club>/team-<letter>/<fixture>/board-<n>/    photos, gitignored
games/.../board-<n>/extracted.pgn                           the working record
content/seasons/.../matches.json                            what the site ships
```

`games/` is in `.gitignore` and stays there. A scoresheet carries an opponent's
full name in their own handwriting and they have not been asked, so the photos
are never committed. What gets committed is movetext.

**`extracted.pgn` is the audit trail.** Tags, then a `{ ... }` comment saying
what was read, what was corrected and why, then the moves. Anybody arguing about
a move later reads this.

Braces, not `;`. A rest-of-line comment is legal PGN and chess.js refuses it, so
a file written with semicolons cannot be replayed by the one tool that checks
it. An incomplete transcription also takes `[Termination "unfinished
transcription"]`, so the real result in the `Result` tag does not read as a
contradiction of the `*` the moves end on.

Its tags are the initialisms the site exports, not names. The file is gitignored
and stays local, but a record that is safe wherever it ends up is worth more
than one that depends on a `.gitignore` line.

**`matches.json` gets the bare movetext and nothing else.** No inline `{}`
comments: the site builds the tags itself, and it anonymises them, so the
exported file names nobody. Do not put names in the movetext.

## Doing it

1. **Transcribe first, correct never.** Write out every row exactly as it looks,
   including the moves you think are wrong. A reading you have already "fixed"
   is a reading you cannot check.
2. **Replay through chess.js, move by move.** Never simulate a position in your
   head; you will be wrong about a pin or a pawn four moves later and rebuild
   the rest of the game on it. A twenty-line script that feeds SAN into
   `new Chess()` and reports the first move that throws is the whole tool.
3. **When a move is refused, print the legal moves from that position.** The
   answer is usually in that list and one character away from what is written.
4. Keep going to the end of the sheet. Then write it up.

## When it stops replaying

An illegal move is information, not a wall. In order of how often it is the
answer:

- **Case.** `bxc6` and `Bxc6` are different moves, and a lowercase b is a pawn
  on the b-file. Board 1 of the first fixture was certified by a comparison that
  lowercased both, which passed a game nobody had played. Compare
  case-sensitively, always.
- **The move before it.** An illegal move most often means the _previous_ move
  was misread and this one is fine. Back up one before you start editing this one.
- **Letters that look alike in handwriting:** c/e, b/d, a/d, g/q, f/t.
- **Digits that look alike:** 4/9, 1/7, 3/8, 5/S, 0/6.
- **A missing or invented `x`.** `Nf4` and `Nxf4` differ by whether anything was
  standing there, which the position answers for you.
- **`+` written for `#`, or a mate mark on a move that is only check.** Trust the
  board over the pen.
- **A piece letter read as a file letter**, or the reverse. This is the same
  trap as case, one level up.
- **That player's own notation.** People are consistently strange in their own
  way: one of ours writes a bishop move as the piece, its source file, then the
  target square, so `Ca6` is the bishop on the c-file going to a6. Work the
  quirk out from the moves that do replay, then apply it to the ones that do not.

### A plainly written move that is illegal is evidence, not an error

When a cell is unambiguous on the page and impossible on the board, do not
rewrite it. Something earlier was misread, and this move is the witness that
tells you so. Board 2 of the first fixture read `18...Rxf6` in clear ink with no
rook anywhere near f6, and the answer was six moves back: `12...Ra6`, read as
`Qa6` on two separate sheets, puts a rook on the sixth rank and makes every
later move on the page legal exactly as written.

The way to find it: hold the clear cells fixed, and for each doubtful earlier
cell try every legal move there and count how many of the later cells then
replay. The doubtful cell whose alternative makes the most of the page legal is
the one that was misread. Twenty lines of chess.js does it; guessing does not.

The same search settles a cell nobody can read. `16.?3` on that sheet looked
like f3 to two people, and f3 blocks the bishop's diagonal that `20...Bxe2`
needs four rows later. Of every legal move ending in 3, only b3 let the rest of
the page stand. The board reads better than either of us.

### The search, and what it costs

Where several readings are legal, prefer the one that assumes the fewest
misreadings. Count them: each character you change from what is written is one
assumption. A reading that needs one or two is a correction. A reading that
needs eight is a composition.

**Stop at about two consecutive assumptions.** Board 4 of the first fixture was
abandoned at move 26 because the cheapest legal reading of the remaining eleven
moves needed eight assumed errors, which is not a record of anything.

### Before searching at all, ask for a better photograph

Board 4 is the case study for this too. The abandoned reading came from a blurry
photo; a clear one arrived two days later and **all 64 plies replayed exactly as
written, with nothing assumed.** The corrections the search had been hunting for
did not exist. Two moves had been misread early, `17...e4` and `20.f4`, and
every guess after them was built on the wreckage.

A second photograph is minutes. A search is an hour and can still be wrong.

### Two sheets are much better than one

Both players keep a scoresheet. Where the captain has both, read them against
each other: board 3 of the first fixture got eleven moves further because the
other sheet wrote the pawn capture where ours was ambiguous. Where they
disagree, the position decides.

### What the league can tell you

The fixture's page on the LMS gives the result, the board order and both sides'
ratings on the night. It does **not** give colours. Colours follow the league's
rule, home on Black at board one and alternating, which is what `expectedColour`
computes.

## Writing it up

- `extracted.pgn` gets the full tags, the `;` provenance and the moves.
- `matches.json` gets the movetext alone, ending in the result for a game that
  finished and `*` for one that does not.
- Say where an incomplete transcription stops, and why, in `extracted.pgn`.
- Then replay every stored PGN. `make check` will not do this for you: the
  repo's PGN test deliberately covers only the prototype season, so the real
  games have nothing guarding them but this step.

## What you must never do

- Reconstruct a move from the result, from the engine's preference, or from what
  would have been best. The engine is not a witness.
- Fill a gap to make the game reach the recorded result.
- Commit a photograph.
