# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static React site for **Bristol & Clifton G**, a Bristol & District League chess team. It
publishes the fixtures, records who is available for each one, and applies the club's written-down
rule to pick four boards and two reserves.

The point is **fairness that can be shown**. This is a low-division team spreading games across
roughly fourteen players, so the captain is not fielding his strongest four, and every selection
has to be explicable to whoever was not picked. That is why selection is a pure seeded function
rather than a judgement call: it can be re-run months later on the same data and give the same
answer.

## Commands

```bash
make dev          # vite dev server
make check        # typecheck + format-check + test, and what CI runs
make build        # static site into dist/
npx vitest run src/lib/selection.test.ts   # one test file
npx vitest run -t "overspill"              # one test by name
```

Prettier at 120 columns. Run `make format` before finishing.

## No backend, ever

Everything the site shows is derived from the JSON under `content/`. There is no server, no
database and no API. Editing a data file and reloading is the whole workflow, and it is how the
captain uses this: a change to `matches.json` changes the selection, the calendar, the coverage
figures and the team page at once.

So **a new feature is nearly always a new derivation, not new state.** Before adding a field, check
whether it can be computed. Games played is the standing example: it is counted from recorded
results rather than stored, because the moment there are two copies of that number one of them is
wrong.

## Never commit, push or create branches unless explicitly told to

The captain reviews and verifies changes himself. Make the edit, run `make check`, report what
changed, and stop. Do not run `git add`, `git commit`, `git push` or `gh pr create` on your own
initiative, and do not treat "make this change" as permission to do any of them.

## The data

Per season, discovered by glob, so adding a directory is all it takes:

```
content/seasons/<id>/season.json    dates, seed, boards, reserves, clocks, links
content/seasons/<id>/players.json   the roster, which changes every season
content/seasons/<id>/matches.json   fixtures, availability, results and PGNs
content/venues.json                 shared across seasons; the same clubs recur
content/teams.json                  the sides we enter, named once and pointed at by teamId
```

A season points at a team by `teamId` rather than repeating its name, so the club can enter a
second side without the two descriptions drifting apart. Anything about the team, its name, its
club, the competition, its home venue and the league links, lives in `content/teams.json` and is
reached as `season.team`.

`src/lib/schema.ts` is the contract and the single source of truth: the TypeScript types are
inferred from the zod schemas rather than declared beside them. Objects are **strict**, so an
unknown key is an error, because a misspelled `reserve` for `reserves` would otherwise silently
change who plays.

`src/lib/data.ts` parses every file at import and then checks what the schemas cannot: that
availability entries name real players, that a match's score matches its games, that ids are unique
across seasons. **It throws, listing every problem at once.** A site that refuses to start is a
five-minute fix; a site that renders a wrong team sheet is not, because nobody will notice.

## Two seasons, and why one is fake

- **`2026-autumn-g`** is real: the league's actual seven fixtures, real venues, and an **empty
  roster** until the captain enters it.
- **`test-season`** is entirely invented, flagged `prototype: true`, and badged as such throughout
  the UI. It exists so the whole site can be demonstrated end to end.

**Never put a real person in `test-season`, and never put invented data in a real season.** A test
asserts that non-prototype seasons have no players until somebody deliberately adds them.

## Never invent a fact about the real team

No made-up ratings, results, PGNs, addresses or availability replies. If something is unknown,
model it as unknown and let the UI say so. Unrated is `ratings: []` and displays as "Unrated", never
as a zero. A venue with no confirmed address keeps `address: null`, and the map link searches by
name rather than asserting a location, because a plausible wrong address sends somebody to the
wrong side of Bristol on a Tuesday evening.

## Selection, and the things that quietly break it

`src/lib/selection.ts` is one pure function. It reads no clock, no file, no rating and no random
number. One ordering produces both the boards and the reserves, sorted by four keys: games played
(fewest first), then `yes` ahead of `reserve`, then a seeded tiebreak, then player id.

- **Boards and reserves must come out of one ordering, not two passes.** Two passes lose the fact
  that an unpicked `yes` and a declared reserve are competing for the same place, which is exactly
  the case the captain was asked about.
- **The tiebreak hashes `(seed, matchId, playerId)`**, never array position and never `Math.random`.
  Adding a player must not change who was picked for an unrelated match. The match id is in the hash
  so a tied pair does not break the same way all season.
- **Player ids feed that hash, so renaming one re-decides past ties.** Change `name`, never `id`,
  once a match has been played. Before that they are free to change together: a player id is the
  slug of their name (`Alex` is `alex`), which a test enforces, and placeholders such as `player-a`
  for somebody whose name is not known yet must not survive into a season.
- **The seed is immutable once a match has been played.**
- **Games played counts only matches _earlier_ than this one**, which is what makes a past selection
  reproducible after later results are recorded.
- **`unsure` and `no` are never selected**, however short the team is. A short team is reported as
  unfilled boards.
- **A dropout never re-runs the rule.** Someone who withdraws keeps their reply and gains a
  `withdrawn` block; `select` removes them from the order it already built, so everyone below moves
  up exactly one place and the top reserve takes the board. Re-deciding from scratch could reshuffle
  a settled tie and put somebody on a board after they were told they were not playing. Changing
  their reply to `no` would have that effect, which is why the loader rejects a withdrawal on any
  reply but `yes` or `reserve`.

Ratings are not an input. They decide only the board order, in `src/lib/boards.ts`, which is a
separate file on purpose: it is the league's rule, not the club's, and letting a rating reach the
selection step would start deciding who gets a game.

`src/lib/selection.test.ts` is the most important file in the repository after `selection.ts`. It
covers permutation invariance, seed stability, the overspill case, and a statistical fairness check
over a thousand matches. Extend it before changing behaviour.

## The how-it-works page runs the real function

`src/routes/how-it-works.tsx` computes every worked example by calling `select()`. Do not replace
those with typed-out outcomes: this is the page people are pointed at when they want to argue, and
prose describing the code drifts from it within a season.

## URLs are shareable

Every page worth sending to the group chat names its subject in the path, and everything hangs off
the season: `/season/:seasonId`, `/season/:seasonId/schedule`,
`/season/:seasonId/match/:matchId`, `/season/:seasonId/match/:matchId/board/:board`.

That nesting is why **match ids are unique within a season, not across all of them**. The path
already names the season, so a match is `r1` rather than `2026-autumn-g-r1`, which was the season
id written twice. The ICS UID has to add the season back, because `r1` alone would collide with
every other season's first round.

There is no separate organisation page: a match page carries its own selection, and shows the
results above it once they exist.
Match ids are unique across seasons, so match and game pages look their season up rather than
spelling it twice. The season picker is a convenience that redirects; it must never be the only way
to reach a view, and `/` redirects so the address bar always shows something pasteable.

## Deployment

`.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on every push to `main`.
There is no deploy script and no `source` branch; built output is never committed.

This is a **project** site under an account whose user site carries a CNAME, so it is served at
`nialltwomey.com/<repo>/`. **The repository has to be named `chess`** for that to be
`nialltwomey.com/chess`, and `VITE_BASE` in the workflow has to match the same prefix. Get them out
of step and the page loads and then fails to find its own JavaScript.

The dev server uses `/chess/` too, on purpose. A hard-coded `/somewhere` works perfectly at the root
and breaks in production, so assets go through `import.meta.env.BASE_URL` and the base is met
locally. Because routing is client-side, the build writes `404.html` as a copy of `index.html`,
which is what makes a direct hit on a match URL work on Pages.

## The stack, which is not negotiable

React + TypeScript on Vite, Tailwind v4, **shadcn/ui for every UI component**, **lucide-react for
every icon**. No second component library, no second icon set, no CSS-in-JS.

- Add shadcn components with `npx shadcn@latest add <component>`, never by hand. Files under
  `src/components/ui/` are generated and not edited.
- Style with the semantic tokens (`bg-background`, `text-muted-foreground`), never raw palette
  values. The four reply colours and the board colours are tokens too, defined once in
  `src/index.css` so a badge and a legend cannot disagree.
- **Light and dark are both real.** A colour defined in only one of them is a bug that is invisible
  to whoever is testing in the other.
- The board is **lichess's chessground**, and chess.js parses PGNs and supplies legal moves.
  Neither is a UI kit, and chessground owns its own DOM, so React creates it once and pushes state
  at it.

## The game viewer and the engine

`src/components/chess-board.tsx` shows a recorded game and lets a reader explore from it. Moving a
piece never edits the game: it opens a **line**, drawn muted and indented under the move it branches
from, and one button closes it. Hovering anything, a game move, a line move, or a move of an engine
variation, previews that position on the board without committing to it.

**Stockfish is opt-in and lazy.** `scripts/copy-engine.mjs` copies the single-threaded WASM build out
of `node_modules` into `public/engine/` at build time, so it is never bundled, never committed, and
cannot drift from the installed version. The multi-threaded build would be faster and is unusable
here: it needs SharedArrayBuffer, which needs cross-origin isolation headers a static host cannot
send.

- **Gate readiness on `uciok`, not `readyok`.** This build never answers `isready`, so waiting for
  `readyok` hangs on a spinner for ever.
- **UCI scores from the side to move**, so the same position reads `+120` for White and `-120` after
  Black's reply. `parseInfo` flips it into White's terms, which is what the bar and every reader
  expect. Getting this backwards would tell a player they lost a game they won, so it is tested.
- Nothing is precomputed and no evaluation is stored. Only the position on screen is analysed, and a
  new position replaces the search rather than queueing behind it.

## Prose

Complete sentences, and no em dashes: a comma, a colon, a semicolon or a full stop instead. This
applies to anything a player reads. Code comments are exempt and should explain why at whatever
length it takes.

## Skills

| skill                 | e.g.                                             |
| --------------------- | ------------------------------------------------ |
| `record-availability` | "here's who replied", a pasted group-chat thread |
| `record-result`       | "we won 2.5-1.5", a scoresheet, a PGN            |
| `new-season`          | "set up next season", a pasted LMS fixture table |
| `add-player`          | "X has joined", new ECF grades published         |
| `venue-details`       | a new opponent club, or a club that has moved    |
