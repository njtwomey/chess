# Bristol & Clifton G

Fixtures, availability and team selection for Bristol & Clifton G in the Bristol & District Chess
League.

A static React site. Everything it shows comes from the JSON files under `content/`, so running it
is just `make dev`, and changing what it says is just editing a file.

```bash
make install
make dev        # http://localhost:5173
make check      # typecheck, format, tests
```

## What it does

- **Schedule** with the venue, the start time and a map link for every fixture, plus a calendar
  download built from the same data.
- **Match pages.** When, where, and a map. Record what each player said when asked and the site
  applies the club's selection rule to propose four boards and two ordered reserves, showing its
  working. Once a match is played the results sit on top and the selection stays below it as the
  record of how that team was arrived at.
- **Team.** Games played, points and current grades, sorted by fewest games, which is the order
  selection works down.
- **Games.** Play through any recorded game on a lichess board, one click from a full analysis board
  on lichess or chess.com, with the PGN in a copyable box. Drag a piece to explore a line without
  changing the game, and switch on Stockfish, which runs in the browser and analyses only the
  position in front of you. Hovering any move, in the game, in a line, or in one of the engine's
  variations, puts that position on the board.

## The selection rule

Where more people are available than there are places, priority goes to whoever has played the
fewest games. In full, everyone who said yes or offered to reserve goes into one list, ordered by:

1. **Games played, fewest first.** This beats everything below it.
2. **`yes` ahead of `reserve`**, but only between players on the same game count.
3. **A seeded coin toss**, derived from the season seed, the match and the player's id. It is not
   random at run time: the same data always gives the same answer.
4. **Player id**, so the order is total and never depends on the order the data is in.

The first four play, the next two are reserves, **in that order**: reserve one fills the first
vacancy. Nobody who answered "not sure" is picked, however few games they have played; a board with
nobody available is reported as unfilled instead.

If somebody drops out, the rule is not run again. That one person comes out of the list and
everybody below moves up a place, so the first reserve takes the board and nobody else's position
changes. `/how-it-works` explains all of this with worked examples computed by the same function
that picks the real teams.

Ratings play no part in it. They decide only which board a selected player sits at, strongest first,
which is the league's rule rather than the club's.

## Seasons

```
content/seasons/<id>/season.json    dates, seed, boards, reserves, clocks
content/seasons/<id>/players.json   the roster
content/seasons/<id>/matches.json   fixtures, availability, results, PGNs
content/venues.json                 shared between seasons
content/teams.json                  the sides we enter
```

Two are present. **`2026-autumn-g`** holds the real seven-fixture autumn season and is waiting for its
roster. **`test-season`** is entirely invented and badged as a prototype throughout the UI; it exists
so the site can be tried end to end. To switch which one the site opens on, move `"active": true`.

Schemas in `src/lib/schema.ts` are the contract. Files are validated on load and cross-checked
against each other, and the site refuses to start rather than render a team sheet it cannot stand
behind.
