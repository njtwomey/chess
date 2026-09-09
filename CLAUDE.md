# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static React site for **Bristol & Clifton G**, a Bristol & District League chess team, published at
nialltwomey.com/chess. It holds the fixtures, records who is available for each one, and applies the
club's written-down rule to pick four boards and two reserves.

The point is **fairness that can be shown**. This is a low-division side spreading games across
sixteen players, so the captain is not fielding his strongest four, and every selection has to be
explicable to whoever was not picked. That is why selection is a pure seeded function rather than a
judgement call: it can be re-run months later on the same data and give the same answer.

## Commands

```bash
make dev          # vite dev server, at /chess/
make check        # typecheck + format-check + test, and what CI runs
make build        # static site into dist/
npx vitest run src/lib/selection.test.ts   # one file
npx vitest run -t "overspill"              # one test
```

Prettier at 120 columns. Run `make format` before finishing.

## Never commit, push or branch unless told to

The captain reviews changes himself. Make the edit, run `make check`, report, stop. Do not run
`git add`, `git commit`, `git push` or `gh pr create` on your own initiative, and do not read "make
this change" as permission to do any of them. A push deploys to a public site within a minute.

The remote is `git@github-njtwomey:njtwomey/chess.git`. That host alias is deliberate: this machine's
`~/.ssh/config` pins plain `github.com` to a key the account does not use.

## The data

There is no server and no database. Everything the site shows is derived from JSON, and editing a
file is the whole workflow.

```
content/clubs/<club>.json                 who they are, where they meet, and their people
content/leagues.json                      the competitions, and their rules links
content/seasons/<period>/<club>/team-<letter>/
  season.json                             dates, seed, boards, reserves, clocks
  teams.json                              both sides, each naming who it picked
  matches.json                            fixtures, availability, results, PGNs
```

Clubs and leagues are global, because they outlive a season, and **a person is held by their club**:
one name, one ECF code, one rating history, however many seasons they play. A team is per season and
says only who it picked, plus the two things that are true of a season rather than of a person,
`junior` (age is taken on the league's cut-off date) and `role: captain`. Clubs and seasons are both
found by glob, so adding a file or a directory is all it takes.

**Ids are paths, composed from the parts the records store and never written down whole.** A slug
names its parent, then itself: `-` inside a segment, `/` between them, and a segment says what it is.

```
league    bristol-district
club      bristol-clifton
team      bristol-clifton/team-g          from clubId "bristol-clifton", teamId "g"
player    bristol-clifton/niall-twomey    the club, not the team: moving from G to F
                                          is not becoming somebody else
season    bristol-district/bristol-clifton/team-g/autumn-2026
fixture   fixture-1                       unique within its season
board     board-3                         within its fixture
```

The season id is also the URL, so `/season/` takes a splat and the site splits it by the longest
season id that prefixes it. The directory is not the id, because the id leads with the league and a
folder leads with the period: that is how somebody looks for a season, and it puts a club's sides for
one period together. Below the period it is spelled the way every id is, and the loader checks the
directory against the record.

A fixture names the other side by its team id and says whether we are at home. **The venue is the
home club's**, derived rather than stored, and a game names both players by id rather than embedding
one of them. A club's filename is its id, checked, the same guarantee a season's directory gives.

**A new feature is nearly always a new derivation, not new state.** Before adding a field, check
whether it can be computed. Games played is the standing example: counted from recorded results
rather than stored, because two copies of that number means one of them is wrong.

`src/lib/schema.ts` is the contract and the single source of truth; the TypeScript types are inferred
from the zod schemas rather than declared beside them. Objects are **strict**, so an unknown key is
an error: a misspelled `reserve` for `reserves` would otherwise silently change who plays.

`src/lib/data.ts` parses every file at import and then checks what a schema cannot, because it spans
files: availability naming real players, a score matching its games, a fixture naming a team that is in the season.
**It throws, listing every problem at once.** A site that refuses to start is a five-minute fix; one
that renders a wrong team sheet is not, because nobody will notice.

### Two seasons, and never invent

**`autumn-2026/bristol-clifton/team-g`** is real and active. **`spring-2026/demo-club/team-d`** is entirely
invented, in an invented league against invented clubs, flagged
`prototype: true`, and badged as such throughout the UI. Never put a real person in the prototype or
invented data in a real season; a test enforces that the two casts do not overlap.

No made-up ratings, results, PGNs, addresses or availability replies. If something is unknown, model
it as unknown and let the UI say so. Unrated is `ratings: []` and shows as "Unrated", never a zero. A
venue with no confirmed address keeps `address: null` and its map link searches by name, because a
plausible wrong address sends somebody to the wrong side of Bristol on a Tuesday evening.

### Names, and what the site is allowed to know

The repository is public. A player is a **first name**, the league's own fuller form of it in
`fullName`, a junior flag, and where they have one a rating and an ECF code. **Never an email
address, a phone number or a home address.** `playerId` is the slug of the fullest name held, so
`fullName` where there is one and `name` otherwise, enforced by the loader: Will Blatchford is
`william-blatchford` and shows as "Will". Placeholders such as `player-a` must not survive into a
season.

## Selection, and the things that quietly break it

`src/lib/selection.ts` is one pure function. It reads no clock, no file, no rating and no random
number. One ordering produces both the boards and the reserves, sorted by four keys: **reply**
(`yes` ahead of `reserve`, always), then **games played** (fewest first, within each group), then a
**seeded tiebreak**, then player id.

- **Boards and reserves come out of one ordering, not two passes.** Two passes lose the fact that an
  unpicked `yes` and a declared reserve are competing for the same place.
- **`yes` outranks `reserve` outright**, not as a tiebreaker. Offering to stand in is taken at face
  value: it forgoes priority to the people who asked for a game.
- **The tiebreak hashes `(seed, matchId, playerId)`**, never array position and never `Math.random`.
  The match id is in the hash so a tied pair does not break the same way all season.
- **Player ids feed that hash, so renaming one re-decides past ties.** The id is the whole path, so
  moving a player between teams counts as a rename. Change `name`, never `playerId`, once a fixture
  has been played.
- **The seed is immutable once a match has been played.**
- **Games played counts only matches _earlier_ than this one**, which is what makes a past selection
  reproducible after later results are recorded.
- **`unsure` and `no` are never selected**, however short the team is. A short team is reported as
  unfilled boards and sorted out by hand.
- **A dropout never re-runs the rule.** Someone who withdraws keeps their reply and gains a
  `withdrawn` block; `select` removes them from the order already built, so everyone below moves up
  exactly one place and the top reserve takes the board. Changing the reply to `no` would re-decide
  settled ties, which is why the loader rejects a withdrawal on any other reply.
- **Explain a decision only where one was made.** The note under the selection table appears only
  when somebody who said `yes` missed out; otherwise it describes a contest nobody was in. The
  per-row reason column was removed: it explained pairs the rule never had to separate.
- **An override is the captain's, and is not published.** Where a match carries a `lineup`, the
  tables show the team he wrote down, in his order. What it changed is shown only when running
  locally, because it names the player who lost their place and they have not been asked.

`src/lib/selection.test.ts` is the most important file here after `selection.ts`: permutation
invariance, seed stability, the overspill case, dropouts, and a fairness check over a thousand
matches. Extend it before changing behaviour.

## Boards and clocks

`src/lib/boards.ts`, deliberately a separate file: selection is the club's fairness rule, board order
is the league's rating rule, and letting a rating reach selection is the one thing this must not do.

Boards run strongest first on the most recent rating, unrated last, ties **alphabetical** rather than
on the seeded tiebreak: board order has no fairness in it, so a coin toss there is merely
unexplainable.

The order is computed always but **shown only when `settled` is true** on the match, or once it has
been played. That is so a match can be shared while replies are still arriving without publishing a
running order that is going to change: until then the page shows the replies alone, with no
position, no outcome and no reasoning.

Clocks are 80+10, and 55+10 on a board with a player under 16 **on either side**, so an adult can
find themselves playing the short clock.

## The site

Every page names its subject in the path, and everything hangs off the season: `/season/<id>`,
`/season/<id>/schedule`, `/season/<id>/fixture-1`, `/season/<id>/fixture-1/board-3`. **Fixture ids
are unique within a season, not across them** — the path already names the season, so a fixture is
`fixture-1`. The ICS UID has to add the season back, or `fixture-1` would collide with every other
season's first fixture.

There is no organisation page: a match carries its own selection, with the results above it once they
exist. `src/routes/how-it-works.tsx` computes every worked example by calling `select()`. Do not
replace those with typed-out outcomes: that is the page people are pointed at when they want to
argue, and prose describing code drifts from it.

The game viewer uses lichess's **chessground**, with chess.js for PGNs and legal moves. Moving a piece
never edits the game: it opens a line, shown muted and indented. Hovering any move, in the game, in a
line, or in an engine variation, previews it on the board.

**Stockfish is opt-in and lazy.** `scripts/copy-engine.mjs` copies the single-threaded WASM build out
of `node_modules` into `public/engine/` at build time, so it is gitignored yet always ships and cannot
drift from the installed version. The multi-threaded build needs SharedArrayBuffer and cannot work on
static hosting. Two traps: **gate readiness on `uciok`, not `readyok`**, because this build never
answers `isready`; and **UCI scores from the side to move**, so `parseInfo` flips them into White's
terms. Getting that backwards would tell a player they lost a game they won.

## The stack, which is not negotiable

React + TypeScript on Vite, Tailwind v4, **shadcn/ui for every UI component**, **lucide-react for
every icon**. No second component library, no second icon set, no CSS-in-JS.

- Add shadcn components with `npx shadcn@latest add <component>`, never by hand. Files under
  `src/components/ui/` are generated and not edited.
- Style with the semantic tokens (`bg-background`, `text-muted-foreground`), never raw palette values.
  The four reply colours and the board colours are tokens too, defined once in `src/index.css`.
- **Light and dark are both real.** A colour defined in only one of them is invisible to whoever is
  testing in the other. Dark mode keeps almost no chroma on surfaces: at that lightness a warm tint
  reads as brown rather than as a lifted black.

## Deployment

`.github/workflows/deploy.yml` publishes `dist/` on every push to `main`, from an artifact so Jekyll
never touches it. CI runs `make check` first, so inconsistent data fails the deploy rather than
publishing a wrong team sheet.

This is a **project** site under an account whose user site carries a CNAME, so it is served at
`nialltwomey.com/<repo>/`. **The repository is named `chess`**, and `VITE_BASE: /chess/` in the
workflow has to match it. The dev server uses the same prefix on purpose: a hard-coded `/somewhere`
works at the root and only breaks in production. Assets go through `import.meta.env.BASE_URL`.

Routing is client-side, so the build writes `404.html` as a copy of `index.html`. A deep link
therefore returns an HTTP 404 while rendering correctly, which is inherent to Pages.

## Prose

Complete sentences, and no em dashes: a comma, a colon, a semicolon or a full stop instead. This
applies to anything a player reads. Code comments are exempt and should explain why at whatever
length it takes.

## Skills

| skill                 | e.g.                                                                |
| --------------------- | ------------------------------------------------------------------- |
| `record-availability` | "here's who replied", a pasted group-chat thread, settling the team |
| `record-result`       | "we won 2.5-1.5", a scoresheet, a PGN                               |
| `new-season`          | "set up next season", a pasted LMS fixture table                    |
| `add-player`          | "X has joined", new ECF grades published                            |
| `venue-details`       | a new opponent club, or a club that has moved                       |
