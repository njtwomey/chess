/**
 * Loading the content files, and refusing to load broken ones.
 *
 * Clubs and leagues are global, because they outlive any season: the same
 * handful of clubs come round every year. Teams and players are per season,
 * because who turns out for Team G this autumn is not who turned out last
 * spring, and both sides of the board are the same shape so that a rating on
 * theirs can be read back exactly as one on ours.
 *
 * ```
 * content/clubs.json
 * content/leagues.json
 * content/seasons/<period>/<club>-<team>/{season,teams,matches}.json
 * ```
 *
 * Seasons are discovered by glob rather than listed somewhere that would have to
 * be kept in step, and the glob is depth agnostic so the directory layout can
 * change without this file caring.
 *
 * The schemas in `schema.ts` check each file on its own. What they cannot check
 * is whether the files agree with each other, and that is where the mistakes
 * actually happen: a renamed player leaving an availability entry pointing at
 * nobody, a fixture naming a team that is not in the season. Those checks live
 * here and they throw, at import, listing everything wrong at once. A site that
 * refuses to start is a fixable problem; a site that renders a wrong team sheet
 * is not, because nobody will notice.
 */
import {
  ClubsFileSchema,
  GAME_POINTS,
  LeaguesFileSchema,
  MatchesFileSchema,
  SeasonSchema,
  TeamsFileSchema,
  playerSlug,
  seasonSlug,
  teamSlug,
  type Club,
  type League,
  type Player,
  type Season,
  type Team,
} from "@/lib/schema";
import { fieldedFor, opponentTeam, selectionFor, venueFor } from "@/lib/season";

type RawFiles = Record<string, unknown>;

const clubFiles = import.meta.glob("/content/clubs.json", { eager: true, import: "default" }) as RawFiles;
const leagueFiles = import.meta.glob("/content/leagues.json", { eager: true, import: "default" }) as RawFiles;
const seasonFiles = import.meta.glob("/content/seasons/**/season.json", { eager: true, import: "default" }) as RawFiles;
const teamFiles = import.meta.glob("/content/seasons/**/teams.json", { eager: true, import: "default" }) as RawFiles;
const matchFiles = import.meta.glob("/content/seasons/**/matches.json", { eager: true, import: "default" }) as RawFiles;

/** `/content/seasons/autumn-2026/bristol-clifton-g/season.json` to `autumn-2026/bristol-clifton-g`. */
function directoryOf(path: string): string {
  return path.replace(/^\/content\/seasons\//, "").replace(/\/[^/]+$/, "");
}

function parse<T>(schema: { parse: (value: unknown) => T }, value: unknown, path: string): T {
  try {
    return schema.parse(value);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${path} does not match its schema:\n${detail}`);
  }
}

function only<T>(files: RawFiles, schema: { parse: (value: unknown) => T }, name: string): T {
  const [path, raw] = Object.entries(files)[0] ?? [];
  if (!path) throw new Error(`content/${name} is missing`);
  return parse(schema, raw, path);
}

export const clubs: Club[] = only(clubFiles, ClubsFileSchema, "clubs.json");
export const leagues: League[] = only(leagueFiles, LeaguesFileSchema, "leagues.json");

for (const club of clubs) {
  const venue = club.venue;
  // Half a coordinate pair would silently place a marker on the prime meridian.
  if ((venue.lat === null) !== (venue.lon === null)) {
    throw new Error(`content/clubs.json: "${club.id}" has only one half of a lat/lon pair`);
  }
  // A map link with no path is a half-copied short link. It passes for a URL,
  // opens a blank map, and is worse than the name search it displaced, so it
  // has to be caught rather than shipped. A website may be a bare host, so this
  // applies only to the map.
  if (venue.maps && new URL(venue.maps).pathname.replace(/\/+$/, "") === "") {
    throw new Error(
      `content/clubs.json: "${club.id}" has a map link with no place in it (${venue.maps}). ` +
        `Paste the full short link, or set it to null and let the map search by name.`,
    );
  }
}

export const clubById = new Map(clubs.map((club) => [club.id, club]));
export const leagueById = new Map(leagues.map((league) => [league.id, league]));

function loadSeasons(): Season[] {
  const problems: string[] = [];
  const fallbackClub = clubs[0] as Club;

  const loaded = Object.entries(seasonFiles).map(([path, raw]) => {
    const directory = directoryOf(path);
    const meta = parse(SeasonSchema, raw, path);

    // The directory is not the id: the id is four levels deep and carries the
    // league, where a folder needs only to be unique and short enough to type.
    // It still has to say which season it holds, or a file can be edited in the
    // belief that it belongs to another one.
    const expected = `${meta.period}/${meta.clubId}-${meta.teamId}`;
    if (directory !== expected) {
      problems.push(`${path}: this season belongs in "content/seasons/${expected}/", not "${directory}"`);
    }

    const teamsPath = `/content/seasons/${directory}/teams.json`;
    const matchesPath = `/content/seasons/${directory}/matches.json`;
    if (teamFiles[teamsPath] === undefined) problems.push(`${teamsPath} is missing`);
    if (matchFiles[matchesPath] === undefined) problems.push(`${matchesPath} is missing`);

    const records = teamFiles[teamsPath] === undefined ? [] : parse(TeamsFileSchema, teamFiles[teamsPath], teamsPath);
    const matches =
      matchFiles[matchesPath] === undefined ? [] : parse(MatchesFileSchema, matchFiles[matchesPath], matchesPath);

    const teams: Team[] = records.map((record) => {
      const club = clubById.get(record.clubId);
      if (!club)
        problems.push(`${teamsPath}: "${teamSlug(record)}" is at club "${record.clubId}", which is not in clubs.json`);
      // A player's id is spelled out here, once, from the team that owns the
      // record and the segment stored on it. Everything downstream, the
      // availability entries and the games alike, refers to that whole path, so
      // there is exactly one way to name a person and no scope for a bare
      // "theo" to mean whichever Theo the reader had in mind.
      return {
        ...record,
        id: teamSlug(record),
        club: club ?? fallbackClub,
        players: record.players.map((player) => ({ ...player, playerId: playerSlug(record, player) })),
      };
    });

    const league = leagueById.get(meta.leagueId);
    if (!league) problems.push(`${path}: names league "${meta.leagueId}", which is not in leagues.json`);

    const ours = teams.find((team) => team.id === teamSlug(meta));
    if (!ours)
      problems.push(`${path}: "${teamSlug(meta)}" is not in ${teamsPath}, so the season has no team of its own`);

    const team = ours ?? (teams[0] as Team);
    return {
      ...meta,
      id: seasonSlug(meta),
      league: league ?? (leagues[0] as League),
      club: team?.club ?? fallbackClub,
      team,
      teams,
      players: team?.players ?? [],
      matches,
    } satisfies Season;
  });

  for (const season of loaded) problems.push(...checkSeason(season));

  // No made-up player on a real team sheet, and no real person in the
  // prototype. Compared on names rather than ids: the two casts are in
  // different clubs now, so their ids cannot collide even when the same person
  // appears in both, and it is the person the check is about.
  const invented = new Set(
    loaded.filter((season) => season.prototype).flatMap((season) => season.players.map((player) => player.name)),
  );
  for (const season of loaded) {
    if (season.prototype) continue;
    for (const player of season.players) {
      if (invented.has(player.name))
        problems.push(`season "${season.id}": "${player.name}" is also a prototype player`);
    }
  }

  const ids = new Set<string>();
  for (const season of loaded) {
    if (ids.has(season.id)) problems.push(`two seasons share the id "${season.id}"`);
    ids.add(season.id);
  }

  // Exactly one, not at most one. With none, the header opens on nothing and
  // every bare path has nowhere to redirect to.
  const active = loaded.filter((season) => season.active);
  if (active.length !== 1) {
    problems.push(
      active.length === 0
        ? "no season is marked active"
        : `more than one season is marked active: ${active.map((season) => season.id).join(", ")}`,
    );
  }

  if (problems.length > 0) {
    throw new Error(`The season data is inconsistent:\n\n${problems.map((line) => `  - ${line}`).join("\n")}`);
  }

  return loaded.sort((a, b) => (a.start < b.start ? 1 : -1));
}

/** The id a name should produce, so the two cannot drift apart. */
function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Whoever a team fields, checked the same way whichever side of the board they are on. */
function checkRoster(team: Team, note: (message: string) => void): Set<string> {
  const ids = new Set<string>();
  const where = `team "${team.id}"`;
  for (const player of team.players) {
    if (ids.has(player.playerId)) note(`${where} has two players with the id "${player.playerId}"`);
    ids.add(player.playerId);
    // The stored segment, which is the part a person types into a file.
    const bare = player.playerId.split("/").at(-1) ?? player.playerId;

    // The convention, so an id can be read and typed from a name. It is also
    // what feeds the tiebreak hash, which is why a rename after a match has
    // been played needs a deliberate decision rather than a tidy-up.
    if (bare !== slug(player.name)) {
      note(`${where}: "${bare}" is not the slug of "${player.name}", which would be "${slug(player.name)}"`);
    }

    // "player-a" and a display name of "A" were both stand-ins for somebody
    // whose name nobody had asked for yet. One that survives into a season is a
    // person nobody has checked on.
    if (/^player-/.test(bare) || player.name.length < 2) {
      note(`${where}: "${bare}" still looks like a placeholder rather than a person`);
    }

    const dates = player.ratings.map((rating) => rating.date);
    if (dates.some((date, index) => index > 0 && date <= (dates[index - 1] ?? ""))) {
      note(`${where}: "${player.playerId}" has ratings that are not in ascending date order`);
    }
  }
  return ids;
}

/** Everything the schemas cannot see, because it spans two files or two records. */
function checkSeason(season: Season): string[] {
  const problems: string[] = [];
  const where = `season "${season.id}"`;
  const note = (message: string) => problems.push(`${where}: ${message}`);

  if (season.end < season.start) note(`ends (${season.end}) before it starts (${season.start})`);

  const teamIds = new Set<string>();
  const rosters = new Map<string, Set<string>>();
  for (const team of season.teams) {
    if (teamIds.has(team.id)) note(`two teams share the id "${team.id}"`);
    teamIds.add(team.id);
    rosters.set(team.id, checkRoster(team, note));
  }

  const ours = rosters.get(season.team.id) ?? new Set<string>();
  const known = (id: string) => ours.has(id);
  const fixtures = new Set<string>();

  for (const match of season.matches) {
    const at = `fixture "${match.id}"`;
    if (fixtures.has(match.id)) note(`two fixtures share the id "${match.id}"`);
    fixtures.add(match.id);

    if (!teamIds.has(match.opponentTeamId)) {
      note(`${at} is against "${match.opponentTeamId}", which is not in teams.json`);
    }
    if (match.opponentTeamId === season.team.id) note(`${at} is against ourselves`);
    if (match.date < season.start || match.date > season.end) {
      note(`${at} is on ${match.date}, outside the season (${season.start} to ${season.end})`);
    }

    const replied = new Set<string>();
    for (const entry of match.availability) {
      if (!known(entry.playerId)) note(`${at} has a reply from "${entry.playerId}", who is not on the roster`);
      if (replied.has(entry.playerId)) note(`${at} has two replies from "${entry.playerId}"`);
      replied.add(entry.playerId);

      // You can only drop out of something you offered to do. A withdrawal on a
      // "no" or a "not sure" means somebody has recorded the wrong reply, and
      // silently ignoring it would hide a player who is actually available.
      if (entry.withdrawn && entry.reply !== "yes" && entry.reply !== "reserve") {
        note(`${at} marks "${entry.playerId}" as dropped out, but their reply was "${entry.reply}"`);
      }
    }

    if (match.lineup) {
      const fielded = new Set<string>();
      for (const playerId of match.lineup.playerIds) {
        if (!known(playerId)) note(`${at} fields "${playerId}", who is not on the roster`);
        if (fielded.has(playerId)) note(`${at} fields "${playerId}" twice`);
        fielded.add(playerId);
      }
      // A shortlist is written in board order and runs on into the reserves, so
      // the limit is the whole team sheet rather than the boards alone.
      const room = season.boards + season.reserves;
      if (match.lineup.playerIds.length > room) {
        note(
          `${at} names ${match.lineup.playerIds.length} players, above the season's ${season.boards} boards and ${season.reserves} reserves`,
        );
      }
      // A settled team that the site refuses to show is the state this field
      // exists to prevent, so it is an error rather than something to guess at.
      if (!match.settled && match.result === null) {
        note(`${at} names a team but is not settled, so the site would not show it`);
      }
    }

    // Settling is what puts a running order in front of the squad, so the thing
    // worth catching is a short one: a published sheet with a board nobody is on
    // is worse than saying nothing yet.
    if (match.settled && match.result === null) {
      const unfilled = fieldedFor(season, match, selectionFor(season, match)).unfilled;
      if (unfilled > 0) note(`${at} is settled but ${unfilled} of its boards have nobody on them`);
    }

    if (match.status === "played" && match.result === null) note(`${at} is marked played but has no result`);
    if (match.status !== "played" && match.result !== null) note(`${at} is not played but carries a result`);

    if (match.result) {
      const them = rosters.get(match.opponentTeamId) ?? new Set<string>();
      const theirPlayers = new Map(opponentTeam(season, match).players.map((player) => [player.playerId, player]));
      const boards = new Set<number>();
      const played = new Set<string>();
      for (const game of match.result.games) {
        if (!known(game.playerId)) note(`${at} records a game for "${game.playerId}", who is not on the roster`);
        if (!them.has(game.opponentId)) {
          note(`${at} plays board ${game.board} against "${game.opponentId}", who is not in "${match.opponentTeamId}"`);
        }

        // A rating dated after the game was played was read off a later list
        // than the one that was true on the night, and the match card would
        // quote it as though it were.
        const opponent = theirPlayers.get(game.opponentId);
        if (opponent?.ratings.some((rating) => rating.date > match.date)) {
          note(`${at} has a rating for "${opponent.name}" dated after the fixture was played`);
        }
        if (boards.has(game.board)) note(`${at} has two games on board ${game.board}`);
        if (played.has(game.playerId)) note(`${at} has "${game.playerId}" playing twice`);
        if (game.board > season.boards)
          note(`${at} has a game on board ${game.board}, above the season's ${season.boards}`);
        boards.add(game.board);
        played.add(game.playerId);
      }

      // The score is written down as well as derivable, because it is what the
      // league publishes. Checking the two agree catches a mistyped result.
      const scored = match.result.games.reduce((total, game) => total + GAME_POINTS[game.result], 0);
      if (scored !== match.result.ourScore) {
        note(`${at} scores ${match.result.ourScore} but its games add up to ${scored}`);
      }
      const total = match.result.ourScore + match.result.theirScore;
      if (total !== match.result.games.length) {
        note(`${at} has ${match.result.games.length} games but a combined score of ${total}`);
      }
    }

    // Nothing to check about the venue: it is the home club's, so it cannot
    // disagree with anything. Reading it here keeps that derivation honest.
    void venueFor(season, match);
  }

  return problems;
}

export const seasons: Season[] = loadSeasons();
export const seasonById = new Map(seasons.map((season) => [season.id, season]));

/**
 * The season the site opens on.
 *
 * `active` in the data wins. Falling back to the most recent one means removing
 * the flag degrades to something sensible rather than to a blank site.
 */
export const activeSeason: Season = seasons.find((season) => season.active) ?? (seasons[0] as Season);

/**
 * A fixture, by the season it belongs to and its own id.
 *
 * Fixture ids are unique within a season rather than across all of them, because
 * the URL already names the season. That is what lets a fixture be `fixture-1`
 * instead of the season id written twice.
 */
export function findMatch(seasonId: string | undefined, matchId: string | undefined) {
  if (!seasonId || !matchId) return undefined;
  const season = seasonById.get(seasonId);
  const match = season?.matches.find((candidate) => candidate.id === matchId);
  return season && match ? { season, match } : undefined;
}

export function playerName(season: Season, playerId: string): string {
  return season.players.find((player) => player.playerId === playerId)?.name ?? playerId;
}

export function playerById(season: Season, playerId: string): Player | undefined {
  return season.players.find((player) => player.playerId === playerId);
}

/** The clubs a real season actually plays, which is what the clubs page is for. */
export function playedClubs(): Club[] {
  const met = new Set(
    seasons.filter((season) => !season.prototype).flatMap((season) => season.teams.map((team) => team.clubId)),
  );
  return clubs.filter((club) => met.has(club.id));
}
