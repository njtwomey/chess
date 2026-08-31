/**
 * Loading the season files, and refusing to load broken ones.
 *
 * Each season is a directory under `content/seasons/<id>/` holding `season.json`,
 * `players.json` and `matches.json`; venues are shared across seasons because
 * the same handful of clubs come round every year. Dropping in a new directory
 * is all it takes to add a season, which is why the files are discovered by
 * glob rather than listed somewhere that would have to be kept in step.
 *
 * The schemas in `schema.ts` check each file on its own. What they cannot check
 * is whether the files agree with each other, and that is where the mistakes
 * actually happen: a renamed player leaving an availability entry pointing at
 * nobody, a match whose score does not match its games. Those checks live here
 * and they throw, at import, listing everything wrong at once. A site that
 * refuses to start is a fixable problem; a site that renders a wrong team sheet
 * is not, because nobody will notice.
 */
import {
  GAME_POINTS,
  MatchesFileSchema,
  PlayersFileSchema,
  SeasonSchema,
  TeamsFileSchema,
  VenuesFileSchema,
  type Player,
  type Season,
  type Team,
  type Venue,
} from "@/lib/schema";

type RawFiles = Record<string, unknown>;

const seasonFiles = import.meta.glob("/content/seasons/*/season.json", { eager: true, import: "default" }) as RawFiles;
const playerFiles = import.meta.glob("/content/seasons/*/players.json", { eager: true, import: "default" }) as RawFiles;
const matchFiles = import.meta.glob("/content/seasons/*/matches.json", { eager: true, import: "default" }) as RawFiles;
const venueFiles = import.meta.glob("/content/venues.json", { eager: true, import: "default" }) as RawFiles;
const teamFiles = import.meta.glob("/content/teams.json", { eager: true, import: "default" }) as RawFiles;

/** `/content/seasons/demo/players.json` to `demo`. */
function directoryOf(path: string): string {
  return path.split("/").at(-2) ?? path;
}

function parse<T>(schema: { parse: (value: unknown) => T }, value: unknown, path: string): T {
  try {
    return schema.parse(value);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${path} does not match its schema:\n${detail}`);
  }
}

function loadVenues(): Venue[] {
  const [path, raw] = Object.entries(venueFiles)[0] ?? [];
  if (!path) throw new Error("content/venues.json is missing");
  return parse(VenuesFileSchema, raw, path);
}

export const venues: Venue[] = loadVenues();

for (const venue of venues) {
  // Half a coordinate pair would silently place a marker on the prime meridian.
  if ((venue.lat === null) !== (venue.lon === null)) {
    throw new Error(`content/venues.json: "${venue.id}" has only one half of a lat/lon pair`);
  }
  // A map link with no path is a half-copied short link. It passes for a URL,
  // opens a blank map, and is worse than the name search it displaced, so it
  // has to be caught rather than shipped. A website may be a bare host, so this
  // applies only to the map.
  if (venue.maps && new URL(venue.maps).pathname.replace(/\/+$/, "") === "") {
    throw new Error(
      `content/venues.json: "${venue.id}" has a map link with no place in it (${venue.maps}). ` +
        `Paste the full short link, or set it to null and let the map search by name.`,
    );
  }
}
export const venueById = new Map(venues.map((venue) => [venue.id, venue]));

function loadTeams(): Team[] {
  const [path, raw] = Object.entries(teamFiles)[0] ?? [];
  if (!path) throw new Error("content/teams.json is missing");
  const teams = parse(TeamsFileSchema, raw, path);
  for (const team of teams) {
    if (!venueById.has(team.homeVenueId)) {
      throw new Error(`content/teams.json: "${team.id}" plays at "${team.homeVenueId}", which is not in venues.json`);
    }
  }
  return teams;
}

export const teams: Team[] = loadTeams();
export const teamById = new Map(teams.map((team) => [team.id, team]));

function loadSeasons(): Season[] {
  const problems: string[] = [];

  const loaded = Object.entries(seasonFiles).map(([path, raw]) => {
    const directory = directoryOf(path);
    const meta = parse(SeasonSchema, raw, path);
    if (meta.id !== directory) {
      problems.push(`${path}: id "${meta.id}" does not match its directory "${directory}"`);
    }

    const playersPath = `/content/seasons/${directory}/players.json`;
    const matchesPath = `/content/seasons/${directory}/matches.json`;
    const playersRaw = playerFiles[playersPath];
    const matchesRaw = matchFiles[matchesPath];
    if (playersRaw === undefined) problems.push(`${playersPath} is missing`);
    if (matchesRaw === undefined) problems.push(`${matchesPath} is missing`);

    const players = playersRaw === undefined ? [] : parse(PlayersFileSchema, playersRaw, playersPath);
    const matches = matchesRaw === undefined ? [] : parse(MatchesFileSchema, matchesRaw, matchesPath);

    const team = teamById.get(meta.teamId);
    if (!team) problems.push(`${path}: names team "${meta.teamId}", which is not in teams.json`);

    return { ...meta, team: team ?? (teams[0] as Team), players, matches } satisfies Season;
  });

  for (const season of loaded) problems.push(...checkSeason(season));

  const active = loaded.filter((season) => season.active);
  if (active.length > 1) {
    problems.push(`more than one season is marked active: ${active.map((season) => season.id).join(", ")}`);
  }

  if (problems.length > 0) {
    throw new Error(`The season data is inconsistent:\n\n${problems.map((line) => `  - ${line}`).join("\n")}`);
  }

  return loaded.sort((a, b) => (a.start < b.start ? 1 : -1));
}

/** Everything the schemas cannot see, because it spans two files or two records. */
function checkSeason(season: Season): string[] {
  const problems: string[] = [];
  const where = `season "${season.id}"`;
  const note = (message: string) => problems.push(`${where}: ${message}`);

  if (season.end < season.start) note(`ends (${season.end}) before it starts (${season.start})`);

  const playerIds = new Set<string>();
  for (const player of season.players) {
    if (playerIds.has(player.id)) note(`two players share the id "${player.id}"`);
    playerIds.add(player.id);

    const dates = player.ratings.map((rating) => rating.date);
    if (dates.some((date, index) => index > 0 && date <= (dates[index - 1] ?? ""))) {
      note(`${player.id} has ratings that are not in ascending date order`);
    }
  }

  const known = (id: string) => playerIds.has(id);
  const rounds = new Set<number>();
  const matchIds = new Set<string>();

  for (const match of season.matches) {
    const at = `match "${match.id}"`;
    if (matchIds.has(match.id)) note(`two matches share the id "${match.id}"`);
    matchIds.add(match.id);
    if (rounds.has(match.round)) note(`${at} reuses round ${match.round}`);
    rounds.add(match.round);

    if (!venueById.has(match.venueId)) note(`${at} names venue "${match.venueId}", which is not in venues.json`);
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

    if (match.status === "played" && match.result === null) note(`${at} is marked played but has no result`);
    if (match.status !== "played" && match.result !== null) note(`${at} is not played but carries a result`);

    if (match.result) {
      const boards = new Set<number>();
      const played = new Set<string>();
      for (const game of match.result.games) {
        if (!known(game.playerId)) note(`${at} records a game for "${game.playerId}", who is not on the roster`);
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
 * A match, by the season it belongs to and its own id.
 *
 * Match ids are unique within a season rather than across all of them, because
 * the URL already names the season. That is what lets a match be `r1` instead
 * of `2026-autumn-g-r1`, which was the season id written twice.
 */
export function findMatch(seasonId: string | undefined, matchId: string | undefined) {
  if (!seasonId || !matchId) return undefined;
  const season = seasonById.get(seasonId);
  const match = season?.matches.find((candidate) => candidate.id === matchId);
  return season && match ? { season, match } : undefined;
}

export function playerName(season: Season, playerId: string): string {
  return season.players.find((player) => player.id === playerId)?.name ?? playerId;
}

export function playerById(season: Season, playerId: string): Player | undefined {
  return season.players.find((player) => player.id === playerId);
}
