/**
 * Builders for tests, never imported by the site.
 *
 * A test that reads the shipped season is a test that fails when somebody
 * records a reply, and it has: twice, on the commit that wrote down something
 * that really happened. These build exactly the season a test needs instead, so
 * nothing in `content/` can break a test and no test can hold the data still.
 *
 * Every builder goes through the schema rather than returning a literal, so a
 * fixture cannot drift from the contract. Add a required field to `PlayerSchema`
 * and the builders fail here, once, rather than in nine test files.
 */
import {
  MatchSchema,
  PlayerSchema,
  SeasonSchema,
  TeamSchema,
  VenueSchema,
  type Availability,
  type Game,
  type Match,
  type Player,
  type Season,
  type Team,
  type Venue,
} from "@/lib/schema";
import type { Reply } from "@/lib/selection";

let counter = 0;
/** Distinct without being meaningful: a test that cares names the thing itself. */
const next = (prefix: string) => `${prefix}-${(counter += 1)}`;

export function aVenue(over: Partial<Venue> = {}): Venue {
  return VenueSchema.parse({ id: next("venue"), name: "A Venue", ...over });
}

export function aTeam(over: Partial<Team> = {}): Team {
  return TeamSchema.parse({
    id: "our-team",
    name: "Our Team",
    club: "Our Club",
    competition: "A League",
    homeVenueId: "our-venue",
    links: { fixtures: "https://example.invalid/fixtures" },
    ...over,
  });
}

export function aPlayer(over: Partial<Player> = {}): Player {
  const id = over.id ?? next("player");
  return PlayerSchema.parse({ id, name: over.name ?? id, ...over });
}

/** A squad of `count` players, all unrated, ids `p1`, `p2`, … */
export function aSquad(count: number, over: (index: number) => Partial<Player> = () => ({})): Player[] {
  return Array.from({ length: count }, (_, index) => aPlayer({ id: `p${index + 1}`, ...over(index) }));
}

export function said(playerId: string, reply: Reply, over: Partial<Availability> = {}): Availability {
  return { playerId, reply, at: "2026-01-01", withdrawn: null, ...over } as Availability;
}

export function aMatch(over: Partial<Match> = {}): Match {
  return MatchSchema.parse({
    id: over.id ?? next("match"),
    round: 1,
    opponent: "Somebody Else",
    home: true,
    venueId: "our-venue",
    date: "2026-03-10",
    time: "19:30",
    status: "scheduled",
    ...over,
  });
}

export function aGame(over: Partial<Game> = {}): Game {
  return {
    board: 1,
    playerId: "p1",
    colour: "black",
    opponent: aPlayer({ id: "them-1", name: "Them One" }),
    result: "win",
    pgn: null,
    ...over,
  } as Game;
}

/**
 * A season, loaded and cross-referenced, as `data.ts` would hand it over.
 *
 * Defaults to four boards and two reserves because that is the shape every rule
 * in this repository is written for; a test wanting otherwise says so.
 */
export function aSeason(over: Partial<Season> = {}): Season {
  // The loaded parts are not in the schema, so they are held back from it: it
  // is strict, and would reject the very fields that make a season usable.
  const { team, players, matches, ...rest } = over;
  const meta = SeasonSchema.parse({
    id: "a-season",
    name: "A Season",
    teamId: "our-team",
    start: "2026-01-01",
    end: "2026-12-31",
    seed: "a-seed",
    boards: 4,
    reserves: 2,
    ...rest,
  });
  return {
    ...meta,
    team: team ?? aTeam(),
    players: players ?? aSquad(8),
    matches: matches ?? [aMatch()],
  };
}
