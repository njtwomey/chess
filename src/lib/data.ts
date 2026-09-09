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
import { fieldedFor, selectionFor } from "@/lib/season";

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

  // No made-up player on a real team sheet, and no real person in the
  // prototype. The two casts are checked against each other rather than the
  // real ones being required to be empty, which they no longer are.
  const invented = new Set(
    loaded.filter((season) => season.prototype).flatMap((season) => season.players.map((player) => player.id)),
  );
  for (const season of loaded) {
    if (season.prototype) continue;
    for (const player of season.players) {
      if (invented.has(player.id)) problems.push(`season "${season.id}": "${player.id}" is also a prototype player`);
    }
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

    // The convention, so an id can be read and typed from a name. It is also
    // what feeds the tiebreak hash, which is why a rename after a match has
    // been played needs a deliberate decision rather than a tidy-up.
    if (player.id !== slug(player.name)) {
      note(`${player.id} is not the slug of "${player.name}", which would be "${slug(player.name)}"`);
    }

    // "player-a" and a display name of "A" were both stand-ins for somebody
    // whose name nobody had asked for yet. One that survives into a season is a
    // person nobody has checked on.
    if (/^player-/.test(player.id) || player.name.length < 2) {
      note(`${player.id} still looks like a placeholder rather than a person`);
    }

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
    if (match.home && match.venueId !== season.team.homeVenueId) {
      note(`${at} is at home but not at "${season.team.homeVenueId}", where this team plays`);
    }
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
      const boards = new Set<number>();
      const played = new Set<string>();
      for (const game of match.result.games) {
        if (!known(game.playerId)) note(`${at} records a game for "${game.playerId}", who is not on the roster`);

        // An opponent is a player record too, and nothing else checks it: the
        // per-season checks above only ever see our own roster.
        const them = game.opponent;
        if (playerIds.has(them.id)) note(`${at} gives its board ${game.board} opponent the id of one of ours`);
        const dates = them.ratings.map((rating) => rating.date);
        if (dates.some((date, index) => index > 0 && date <= (dates[index - 1] ?? ""))) {
          note(`${at} has ratings for "${them.name}" that are not in ascending date order`);
        }
        if (dates.some((date) => date > match.date)) {
          note(`${at} has a rating for "${them.name}" dated after the match was played`);
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
