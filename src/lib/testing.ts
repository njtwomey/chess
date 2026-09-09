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
 *
 * The loaded shapes (a team with its club, a season with everything resolved)
 * are assembled here the way `data.ts` assembles them, because those parts are
 * by definition not in the schema: it is strict, and would reject the very
 * fields that make a season usable.
 */
import {
  ClubSchema,
  LeagueSchema,
  MatchSchema,
  PlayerSchema,
  SeasonSchema,
  SquadMemberSchema,
  TeamSchema,
  playerSlug,
  teamSlug,
  type Availability,
  type Club,
  type Game,
  type League,
  type Match,
  type Player,
  type Season,
  type Team,
  type Venue,
} from "@/lib/schema";
import type { Reply } from "@/lib/selection";

/** The side every built fixture is against, unless a test says otherwise. */
export const THEIR_TEAM = "their-club/team-b";

/** The id somebody at the default club ends up with. The club, not the team. */
export const ours = (playerId: string) => `our-club/${playerId}`;
/** The same for a player at the club we are playing. */
export const theirs = (playerId: string) => `their-club/${playerId}`;

/** The last segment of an id, which is what a record actually stores. */
const bare = (playerId: string) => playerId.split("/").at(-1) ?? playerId;

let counter = 0;
/** Distinct without being meaningful: a test that cares names the thing itself. */
const next = (prefix: string) => `${prefix}-${(counter += 1)}`;

export function aClub(over: Partial<Omit<Club, "venue">> & { venue?: Partial<Venue> } = {}): Club {
  return ClubSchema.parse({ id: next("club"), name: "A Club", ...over, venue: { ...over.venue } });
}

export function aLeague(over: Partial<League> = {}): League {
  return LeagueSchema.parse({ id: next("league"), name: "A League", ...over });
}

/**
 * A team as the loader hands it over: its id spelled out, its club attached and
 * its players' ids resolved to the whole path, exactly as `data.ts` does it.
 *
 * A test that built bare ids here would be testing something the site never
 * sees, and would pass while the real loader disagreed with it.
 */
export function aTeam(over: Partial<Team> = {}): Team {
  const { id, club, players, ...rest } = over;
  void id;
  const squad = players ?? [];
  const record = TeamSchema.parse({
    clubId: "our-club",
    teamId: "a",
    name: "Our Team",
    ...rest,
    players: squad.map(({ playerId, role, junior }) => ({ playerId: bare(playerId), role, junior })),
  });
  // The people go on the club and the picks on the team, which is where they
  // live, and then the loader's own join is repeated here so a test is looking
  // at the same object the site would.
  const home: Club = {
    ...(club ?? aClub({ id: record.clubId, name: "Our Club" })),
    players: squad.map(({ role, junior, ...person }) => ({ ...person, playerId: bare(person.playerId) })),
  };
  return {
    ...record,
    id: teamSlug(record),
    club: home,
    players: squad.map((player) => ({ ...player, playerId: playerSlug(home, { playerId: bare(player.playerId) }) })),
  };
}

/**
 * A player as a season sees them: the person, and what was true of them that
 * season. Both halves go through their own schema, because they live in
 * different files and only meet in the loader.
 */
export function aPlayer(over: Partial<Player> = {}): Player {
  const { role, junior, ...rest } = over;
  const playerId = bare(rest.playerId ?? next("player"));
  const person = PlayerSchema.parse({ ...rest, playerId, name: rest.name ?? playerId });
  const member = SquadMemberSchema.parse({
    playerId,
    ...(role === undefined ? {} : { role }),
    ...(junior === undefined ? {} : { junior }),
  });
  return { ...person, role: member.role, junior: member.junior };
}

/** A squad of `count` players, all unrated, ids `p1`, `p2`, … */
export function aSquad(count: number, over: (index: number) => Partial<Player> = () => ({})): Player[] {
  return Array.from({ length: count }, (_, index) => aPlayer({ playerId: `p${index + 1}`, ...over(index) }));
}

export function said(playerId: string, reply: Reply, over: Partial<Availability> = {}): Availability {
  return { playerId, reply, at: "2026-01-01", withdrawn: null, ...over } as Availability;
}

export function aMatch(over: Partial<Match> = {}): Match {
  return MatchSchema.parse({
    id: over.id ?? `fixture-${(counter += 1)}`,
    opponentTeamId: THEIR_TEAM,
    home: true,
    date: "2026-03-10",
    time: "19:30",
    status: "scheduled",
    ...over,
  });
}

export function aGame(over: Partial<Game> = {}): Game {
  return {
    board: 1,
    playerId: ours("p1"),
    opponentId: theirs("them-1"),
    colour: "black",
    result: "win",
    pgn: null,
    ...over,
  } as Game;
}

/**
 * A season, loaded and cross-referenced, as `data.ts` would hand it over.
 *
 * Defaults to four boards and two reserves because that is the shape every rule
 * in this repository is written for; a test wanting otherwise says so. It also
 * comes with the side it is playing, so a fixture can always resolve its
 * opponent and therefore its venue.
 */
export function aSeason(over: Partial<Season> = {}): Season {
  const { id, league, club, team, teams, players, matches, ...rest } = over;
  void id;
  const meta = SeasonSchema.parse({
    leagueId: "a-league",
    clubId: "our-club",
    teamId: "a",
    period: "spring-2026",
    name: "A Season",
    start: "2026-01-01",
    end: "2026-12-31",
    seed: "a-seed",
    boards: 4,
    reserves: 2,
    ...rest,
  });

  const us =
    team ??
    aTeam({
      clubId: meta.clubId,
      teamId: meta.teamId,
      name: "Our Team",
      players: players ?? aSquad(8),
      ...(club ? { club } : {}),
    });
  const them = aTeam({
    clubId: "their-club",
    teamId: "b",
    name: "Their Team",
    players: [aPlayer({ playerId: "them-1", name: "Them One" })],
  });

  return {
    ...meta,
    id: `${meta.leagueId}/${teamSlug(meta)}/${meta.period}`,
    league: league ?? aLeague({ id: meta.leagueId, name: "A League" }),
    club: us.club,
    team: us,
    teams: teams ?? [us, them],
    players: us.players,
    matches: matches ?? [aMatch()],
  };
}
