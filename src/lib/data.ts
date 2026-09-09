/**
 * Loading the content files, and refusing to load broken ones.
 *
 * Clubs and leagues are global, because they outlive any season: the same
 * handful of clubs come round every year, and so do the people in them. A club
 * holds its people, so a rating history belongs to a person rather than to one
 * season's copy of them, and both sides of the board are the same shape so that
 * a rating on theirs can be read back exactly as one on ours. A season's team
 * says only who it picked, and what was true of them that season.
 *
 * ```
 * content/clubs/<club>.json
 * content/leagues.json
 * content/seasons/<period>/<club>/team-<letter>/{season,teams,matches}.json
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
  ClubSchema,
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

const clubFiles = import.meta.glob("/content/clubs/*.json", { eager: true, import: "default" }) as RawFiles;
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

/**
 * One file per club, because a club now carries its people.
 *
 * The filename is the id, checked rather than assumed: a club edited in the
 * belief that it was another one is the kind of mistake that shows up as
 * somebody else's address on a fixture card.
 */
function loadClubs(): Club[] {
  return Object.entries(clubFiles)
    .map(([path, raw]) => {
      const club = parse(ClubSchema, raw, path);
      const named = path.replace(/^\/content\/clubs\//, "").replace(/\.json$/, "");
      if (club.id !== named) throw new Error(`${path}: holds club "${club.id}", so it belongs in ${named}.json`);
      return club;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

const clubs: Club[] = loadClubs();
const leagues: League[] = only(leagueFiles, LeaguesFileSchema, "leagues.json");

for (const club of clubs) {
  const venue = club.venue;
  const where = `content/clubs/${club.id}.json`;
  // Half a coordinate pair would silently place a marker on the prime meridian.
  if ((venue.lat === null) !== (venue.lon === null)) {
    throw new Error(`${where}: only one half of a lat/lon pair`);
  }
  // A map link with no path is a half-copied short link. It passes for a URL,
  // opens a blank map, and is worse than the name search it displaced, so it
  // has to be caught rather than shipped. A website may be a bare host, so this
  // applies only to the map.
  if (venue.maps && new URL(venue.maps).pathname.replace(/\/+$/, "") === "") {
    throw new Error(
      `${where}: the map link has no place in it (${venue.maps}). ` +
        `Paste the full short link, or set it to null and let the map search by name.`,
    );
  }
}

const clubById = new Map(clubs.map((club) => [club.id, club]));
const leagueById = new Map(leagues.map((league) => [league.id, league]));

function loadSeasons(): Season[] {
  const problems: string[] = [];
  const fallbackClub = clubs[0] as Club;

  const loaded = Object.entries(seasonFiles).map(([path, raw]) => {
    const directory = directoryOf(path);
    const meta = parse(SeasonSchema, raw, path);

    // The directory is not the id: the id leads with the league, and a folder
    // leads with the period, which is how somebody looks for a season and what
    // puts a club's sides for one period together. Below that it is spelled the
    // way every id is, because `bristol-clifton-g` cannot be read back into a
    // club and a team without already knowing the club list.
    //
    // It still has to say which season it holds, or a file can be edited in the
    // belief that it belongs to another one.
    const expected = `${meta.period}/${meta.clubId}/team-${meta.teamId}`;
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
      if (!club) {
        problems.push(`${teamsPath}: "${teamSlug(record)}" is at club "${record.clubId}", which is not a club`);
      }
      const people = new Map((club ?? fallbackClub).players.map((person) => [person.playerId, person]));

      // A squad entry names somebody in the club and adds what was true of them
      // that season. The two halves are put together here, once, and the id is
      // spelled out from the club: everything downstream, the availability
      // entries and the games alike, refers to that whole path, so there is
      // exactly one way to name a person and no scope for a bare "theo" to mean
      // whichever Theo the reader had in mind.
      const players = record.players.flatMap((member) => {
        const person = people.get(member.playerId);
        if (!person) {
          problems.push(
            `${teamsPath}: "${teamSlug(record)}" picks "${member.playerId}", who is not at ${record.clubId}`,
          );
          return [];
        }
        const { playerId: _, ...season } = member;
        return [{ ...person, ...season, playerId: playerSlug(club ?? fallbackClub, person) }];
      });

      return { ...record, id: teamSlug(record), club: club ?? fallbackClub, players };
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

  for (const club of clubs) problems.push(...checkClub(club));
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

/**
 * The people at a club, checked once each rather than once per season.
 *
 * These are facts about a person, so they belong beside the person. What a
 * season can get wrong is who it picks, which is checked where the picking is.
 */
function checkClub(club: Club): string[] {
  const problems: string[] = [];
  const where = `content/clubs/${club.id}.json`;
  const note = (message: string) => problems.push(`${where}: ${message}`);
  const ids = new Set<string>();

  for (const player of club.players) {
    if (ids.has(player.playerId)) note(`two people share the id "${player.playerId}"`);
    ids.add(player.playerId);

    // The convention, so an id can be read and typed from a name. It follows
    // the fullest name we hold, which is the league's own form where there is
    // one: our squad is known to each other as Will and Alfie, and an id of
    // `will` beside an opponent's `sean-hubble` was our own side written to a
    // different rule. It is also what feeds the tiebreak hash, which is why a
    // rename after a fixture has been played needs a deliberate decision rather
    // than a tidy-up.
    const named = player.fullName ?? player.name;
    if (player.playerId !== slug(named)) {
      note(`"${player.playerId}" is not the slug of "${named}", which would be "${slug(named)}"`);
    }

    // "player-a" and a display name of "A" were both stand-ins for somebody
    // whose name nobody had asked for yet. One that survives is a person nobody
    // has checked on.
    if (/^player-/.test(player.playerId) || player.name.length < 2) {
      note(`"${player.playerId}" still looks like a placeholder rather than a person`);
    }

    const dates = player.ratings.map((rating) => rating.date);
    if (dates.some((date, index) => index > 0 && date <= (dates[index - 1] ?? ""))) {
      note(`"${player.playerId}" has ratings that are not in ascending date order`);
    }

    // One number per body. Two ECF codes for one person is not two records, it
    // is one of them being somebody else, and the site would link to whichever
    // came first.
    const sources = new Set<string>();
    for (const entry of player.codes) {
      if (sources.has(entry.source)) note(`"${player.playerId}" has two ${entry.source} codes`);
      sources.add(entry.source);
    }
  }
  return problems;
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

    const picked = new Set<string>();
    for (const player of team.players) {
      if (picked.has(player.playerId)) note(`team "${team.id}" picks "${player.playerId}" twice`);
      picked.add(player.playerId);
    }
    rosters.set(team.id, picked);
  }

  // Two sides of one club cannot both field the same person in one season, and
  // the ids no longer say which team somebody is in, so this is what catches it.
  const seen = new Map<string, string>();
  for (const team of season.teams) {
    for (const player of team.players) {
      const already = seen.get(player.playerId);
      // Not the same team twice: that is the check above, and "in both G and G"
      // reads as nonsense beside it.
      if (already && already !== team.id) {
        note(`"${player.playerId}" is in both "${already}" and "${team.id}"`);
      }
      seen.set(player.playerId, team.id);
    }
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
    //
    // Only once everything above has come back clean, because this is the one
    // check that runs the rule rather than reading the data, and the rule throws
    // on input it has already been told is impossible. A stack trace out of
    // `select` in place of the list of problems would hide the very thing that
    // caused it.
    if (match.settled && match.result === null && problems.length === 0) {
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
