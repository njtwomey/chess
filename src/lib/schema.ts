/**
 * The data contract.
 *
 * Every season is a directory of hand-edited JSON, so the schema is the only
 * thing standing between a typo and a wrong team sheet. These are the source of
 * truth for both the runtime check and the TypeScript types: the types are
 * inferred from the schemas rather than declared alongside them, because a
 * hand-written interface next to a validator is two descriptions of one thing
 * and they drift.
 *
 * Objects are strict. An unknown key is nearly always a misspelled known key,
 * and silently ignoring `reserves: 2` written as `reserve: 2` would change who
 * plays without saying anything.
 */
import { z } from "zod";

const ID = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "ids are kebab-case: lowercase, digits and single hyphens");

/**
 * An id that names its parents, joined by "/".
 *
 * `bristol-clifton/team-g/niall` is a club, a team and a player, and it reads as
 * the path it is. Only ever derived, never typed into a file: a record carries
 * its own segment and the loader joins them, so the parts cannot disagree with
 * the whole.
 */
const PATH_ID = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/, "expected a path of kebab-case segments");

/**
 * A fixture's id, which is its number in the season's fixture list.
 *
 * `fixture-3` rather than `r3` or a bare `3`, so that it says what it is the way
 * every other segment does. The number is the id, so there is no separate round
 * field to disagree with it.
 */
const FIXTURE_ID = z.string().regex(/^fixture-[1-9]\d*$/, "a fixture id is fixture-1, fixture-2, and so on");

const URL = z.string().regex(/^https?:\/\/\S+$/, "expected an http(s) URL");

/**
 * A calendar date, checked for being a real one.
 *
 * The regex alone accepts 2026-02-31, which would sail through and then render
 * as 3 March. Round-tripping through Date is what catches it.
 */
const DATE = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected a date as YYYY-MM-DD")
  .refine((value) => new Date(`${value}T00:00:00Z`).toISOString().startsWith(value), "not a real calendar date");

const TIME = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected a 24-hour time as HH:MM");

export const RATING_SOURCES = ["ecf", "fide", "estimated"] as const;

export const RATING_SOURCE_LABEL: Record<(typeof RATING_SOURCES)[number], string> = {
  ecf: "ECF",
  fide: "FIDE",
  estimated: "Estimated",
};

/**
 * One rating on one date, rather than one number per player.
 *
 * These are over-the-board ratings that get recalculated during the season, and
 * a single field would lose the previous value every time one arrived. Keeping
 * the series means the site can show a player's direction of travel, and means
 * a rating quoted on a past match card stays the rating that was true then.
 */
/**
 * The bodies that know a player by a number, which is not the same list as the
 * bodies that publish a rating: nobody is registered with "estimated", and the
 * league's own management site issues a number without rating anybody.
 */
export const CODE_SOURCES = ["ecf", "fide", "lms"] as const;

export const CODE_SOURCE_LABEL: Record<(typeof CODE_SOURCES)[number], string> = {
  ecf: "ECF",
  fide: "FIDE",
  lms: "League management site",
};

/**
 * One registration: who knows them, and the number they know them by.
 *
 * A list rather than a field per body, because `ecfCode` beside `url` could
 * hold exactly one federation and one link, and said nothing about which link
 * belonged to which. Somebody with an ECF code, a FIDE id and an LMS page has
 * three of these and the site can build all three addresses; an opponent we met
 * once has the LMS number that was in the page we read their rating off.
 *
 * The URL is not stored. Every one of these is a template with the code
 * substituted in, so keeping the address as well would be the same fact twice,
 * and the copy would be the one that rots.
 *
 * Checked per body, because the shapes really are different and a FIDE id typed
 * into an ECF field is a link to the wrong person rather than to nobody.
 */
export const PlayerCodeSchema = z.discriminatedUnion("source", [
  z.strictObject({
    source: z.literal("ecf"),
    code: z.string().regex(/^\d{6}[A-Z]$/, "an ECF code is six digits and a capital letter, like 364477H"),
  }),
  z.strictObject({
    source: z.literal("fide"),
    code: z.string().regex(/^\d{4,9}$/, "a FIDE id is four to nine digits"),
  }),
  z.strictObject({
    source: z.literal("lms"),
    code: z.string().regex(/^\d+$/, "an LMS player number is the digits in their page's address"),
  }),
]);

export const RatingSchema = z.strictObject({
  date: DATE,
  rating: z.number().int().min(0).max(3500),
  source: z.enum(RATING_SOURCES),
});

/**
 * A person, held by their club rather than by a team.
 *
 * A club is what somebody belongs to; a team is where the club put them this
 * season. Keeping the person here means one name, one ECF code and one rating
 * history however many seasons they play and whichever side they are picked
 * for, which is the difference between a rating series and several copies of
 * one that can disagree.
 *
 * What is deliberately not here is anything only true of a season: see
 * `SquadMemberSchema`.
 */
export const PersonSchema = z.strictObject({
  /**
   * Stored as the bare segment, `niall-twomey`, and loaded as the whole path,
   * `bristol-clifton/niall-twomey`.
   *
   * The record carries only its own part, because the club around it supplies
   * the rest and two copies of a fact eventually disagree. Everything that
   * refers to a player, availability, a shortlist, a game, uses the full path:
   * a fixture has two squads in it, and a bare name is only unambiguous until
   * both sides field a Theo.
   *
   * The club and not the team, because moving from G to F is not becoming
   * somebody else. It also feeds the selection tiebreak, so it is fixed once a
   * fixture has been played: see CLAUDE.md.
   */
  playerId: ID,
  /** What we call them, which is what the site says everywhere. */
  name: z.string().min(1),
  /**
   * Their name as the league publishes it.
   *
   * Two facts, not one: the squad calls him Alfie and the league's record says
   * Alfred Holton-Stoppani, and neither can be derived from the other. Null
   * where nobody has needed it, and for an opponent, whose `name` is already
   * the published form.
   */
  fullName: z.string().min(1).nullable().default(null),
  /**
   * Ascending by date. An empty list means unrated, which is a normal state for
   * a new member and not a missing value to paper over with a zero.
   */
  ratings: z.array(RatingSchema).default([]),
  /**
   * Every body that knows them by a number, and that number.
   *
   * These are what survive a name, which is why they are worth holding: they
   * link to the published record, which is the authority on a rating and the
   * place to look when a new list comes out. Empty is normal for a member who
   * has never registered anywhere.
   */
  codes: z.array(PlayerCodeSchema).default([]),
  note: z.string().optional(),
});

/**
 * One person's place in one team, for one season.
 *
 * The two facts here are the ones that are true of a season rather than of a
 * person. Age is taken once, on the league's cut-off date, so somebody is a
 * junior for a whole season and then is not. A captain captains a side, and the
 * club has more than one side.
 */
export const SquadMemberSchema = z.strictObject({
  /** Into the club's own list of people, bare. */
  playerId: ID,
  /**
   * Captain, or not. There is no separate co-captain: the club runs with more
   * than one and they do the same job, so a second word would be a distinction
   * without a difference.
   */
  role: z.enum(["captain", "member"]).default("member"),
  /**
   * Under the league's junior age on the season's cut-off date, which shortens
   * the clock on their board.
   *
   * A flag rather than a date of birth. The site has no business holding a
   * child's birthday to compute something the captain already knows, and
   * because age is taken once a season and then holds, a flag is not an
   * approximation of the rule: it is the rule. See `timeControl.juniorOn` for
   * the date it was taken on.
   */
  junior: z.boolean().default(false),
});

export const AvailabilitySchema = z.strictObject({
  playerId: PATH_ID,
  reply: z.enum(["yes", "reserve", "unsure", "no"]),
  /** When they said so, for auditing a selection after the fact. */
  at: DATE.optional(),
  note: z.string().optional(),
  /**
   * They offered, and then pulled out.
   *
   * Kept alongside the original reply rather than replacing it, because the two
   * are different facts and the site has to be able to show both: this person
   * said yes, was picked, and then could not come. Overwriting the reply with a
   * "no" would make the record say they were never available, which is unfair
   * to them and hides why a reserve is on the team sheet.
   */
  withdrawn: z.strictObject({ at: DATE.optional(), note: z.string().optional() }).nullable().default(null),
});

export const GameSchema = z.strictObject({
  board: z.number().int().min(1).max(12),
  /** Ours, by the full id their team's roster gives them. */
  playerId: PATH_ID,
  /**
   * Theirs, the same way.
   *
   * Referenced rather than embedded: an opponent met twice used to be two
   * copies of one person, each with its own rating and no way to tell they were
   * the same player.
   */
  opponentId: PATH_ID,
  colour: z.enum(["white", "black"]),
  result: z.enum(["win", "draw", "loss", "default-win", "default-loss"]),
  /** Null is normal: not every game gets written up. */
  pgn: z.string().nullable().default(null),
});

export const ResultSchema = z.strictObject({
  ourScore: z.number().min(0).multipleOf(0.5),
  theirScore: z.number().min(0).multipleOf(0.5),
  games: z.array(GameSchema),
});

export const MatchSchema = z.strictObject({
  id: FIXTURE_ID,
  /** The other side, by its full path id: `south-bristol/team-d`. */
  opponentTeamId: PATH_ID,
  /**
   * Whether we are at home, which is also where the match is: the venue is the
   * home club's, so it is derived rather than written down. A stored venue was
   * a third fact that had to agree with the other two.
   */
  home: z.boolean(),
  date: DATE,
  time: TIME,
  status: z.enum(["scheduled", "played", "cancelled"]),
  availability: z.array(AvailabilitySchema).default([]),
  /**
   * Whether the board order has been settled and can be shown.
   *
   * Off until the captain says so. The order is computed either way; this only
   * decides whether it is on the page. Sharing a match while the replies are
   * still coming in should show who is available and who the rule picks,
   * without publishing a running order that is going to change. A played match
   * settles itself, so this is only ever set on a fixture still to come.
   */
  settled: z.boolean().default(false),
  /**
   * The league's own page for this fixture.
   *
   * The team already links to the whole fixture list, which is the authority on
   * when and where a match is. This is the authority on what happened in it:
   * the board order as submitted, both sides' ratings, and who reported it. A
   * result recorded here that disagrees with that page is wrong, and a reader
   * who suspects as much should not have to go hunting for the comparison.
   *
   * Null until the league publishes it, which is usually a day or two after the
   * match rather than the same night.
   */
  recordUrl: URL.nullable().default(null),
  /**
   * The team the captain is actually fielding, when it is not the one the rule
   * produced.
   *
   * The rule proposes and the captain fields the team, and until this existed
   * the only place an override could be recorded was the result, which is to
   * say after the event. Meanwhile the page went on showing a proposed team and
   * a board order for players who were not going to play, which is worse than
   * showing nothing: it is wrong, and it is wrong in the one place the whole
   * site asks to be trusted.
   *
   * An ordered shortlist: board order first, running on into the reserves. It
   * answers both questions at once, because a team and the order it sits in are
   * settled in the same conversation.
   *
   * Writing the order down is usually a correction rather than a deviation.
   * `assignBoards` can only sort on the ratings this site holds, and most of
   * the squad is unrated, so it puts the one graded player on board one and the
   * rest in alphabetical order, which is not a strength order at all. The
   * captain knows who is actually strongest. With no shortlist the computed
   * order still stands, because it is better than nothing and needs no upkeep.
   *
   * This does not touch selection, which still runs on the replies and is still
   * shown beside this as what the rule said. Nor does it touch anybody's game
   * count: that is only ever counted from results, so being written in here is
   * not the same as having played.
   */
  lineup: z
    .strictObject({
      playerIds: z.array(PATH_ID).min(1),
      /** When the captain settled it. */
      at: DATE.optional(),
      /** Why it is not what the rule said. Worth writing: somebody will ask. */
      note: z.string().optional(),
    })
    .nullable()
    .default(null),
  result: ResultSchema.nullable().default(null),
});

export const ClockSchema = z.strictObject({
  minutes: z.number().int().min(1),
  increment: z.number().int().min(0),
});

/**
 * The league's clocks, in the data rather than in code, because they are a
 * league rule and league rules get revised between seasons.
 */
export const TimeControlSchema = z.strictObject({
  standard: ClockSchema,
  /** Applied to a board with a junior on either side of it. */
  junior: ClockSchema,
  juniorUnder: z.number().int().min(1).default(16),
  /**
   * The date age is taken on, which the league fixes for the whole season.
   *
   * Without it the site says "under 16" and leaves a reader to guess whether
   * that means today. It does not: somebody who turns 16 in October was 15 on
   * the cut-off and stays on the short clock until the summer. Null where the
   * date has not been recorded, and then the site says less rather than
   * guessing.
   */
  juniorOn: DATE.nullable().default(null),
});

/**
 * A team, named by the club that fields it and the letter the league gives it.
 *
 * Stored as its two parts rather than as the path they spell, so the id is
 * derived and cannot disagree with the components beside it. `name` is written
 * out because the league's own form of it is not reliably derivable: it is one
 * string per team, not one per fixture, which is the duplication that mattered.
 */
export const TeamSchema = z.strictObject({
  clubId: ID,
  /** The league's letter for this side, bare: "g", not "team-g". */
  teamId: ID,
  /** How the league writes it, which is what goes on a fixture card. */
  name: z.string().min(1),
  /**
   * The league's page for this team's fixtures, which is the authority on when
   * and where a match is: this site is a convenience built on top of it, and a
   * fixture page with no way back to the record it copied is a page that can be
   * quietly wrong. Null for a side we merely play, whose page we have no reason
   * to hold.
   */
  links: z.strictObject({ fixtures: URL.nullable().default(null) }).default({ fixtures: null }),
  /** Who was in the squad this season, by reference into the club's own list. */
  players: z.array(SquadMemberSchema).default([]),
});

/**
 * One team's campaign, in one competition, over one period.
 *
 * Those three things identify it and together they spell its id. The division
 * is deliberately not among them: it moves with promotion and relegation, and
 * an id built on an attribute that changes takes every shared link with it when
 * it does.
 */
export const SeasonSchema = z.strictObject({
  leagueId: ID,
  clubId: ID,
  /** Ours, bare, as on the team record. */
  teamId: ID,
  /** The stretch of the calendar this covers: `autumn-2026`. */
  period: ID,
  name: z.string().min(1),
  /** Which division we are in this time round. Null before the league says. */
  division: z.number().int().min(1).nullable().default(null),
  start: DATE,
  end: DATE,
  /**
   * The tiebreak seed. Committed, and immutable once a match has been played:
   * changing it re-decides every tie in the season's history.
   */
  seed: z.string().min(1),
  boards: z.number().int().min(1).max(12),
  reserves: z.number().int().min(0).max(12),
  timeControl: TimeControlSchema.default({
    standard: { minutes: 80, increment: 10 },
    junior: { minutes: 55, increment: 10 },
    juniorUnder: 16,
    juniorOn: null,
  }),
  /** The season the site opens on. Exactly one across all seasons. */
  active: z.boolean().default(false),
  /** Invented data. Badged in the UI so it can never be mistaken for real. */
  prototype: z.boolean().default(false),
});

/**
 * Where a club meets, which is not the same fact as who the club is.
 *
 * Bristol Grendel is a club and it happens to meet in a pub; UWE meets in a
 * lecture room; Bristol & Clifton meets in its own building. Flattening the two
 * into one record made all three read as though the building were the club.
 *
 * `name` is the building, and null where there is nothing to add beyond the
 * club's own name.
 */
export const VenueSchema = z.strictObject({
  name: z.string().min(1).nullable().default(null),
  /** Null until somebody confirms it. Never guessed: see mapsUrl. */
  address: z.string().nullable().default(null),
  postcode: z.string().nullable().default(null),
  /** An exact pasted Maps link, when there is one. */
  maps: URL.nullable().default(null),
  /**
   * Where the building is, for the OpenStreetMap square.
   *
   * Both or neither: a latitude without a longitude is not half a location, it
   * is a bug, and the loader rejects it. Null is fine and the map falls back to
   * a link, which is much better than a marker on the wrong building.
   */
  lat: z.number().min(-90).max(90).nullable().default(null),
  lon: z.number().min(-180).max(180).nullable().default(null),
  note: z.string().optional(),
});

/**
 * A club, which is the thing that outlives a season.
 *
 * Everybody we play is one of these, ours included, so a fixture's venue is
 * simply the home club's. `links` sits here rather than on a team because a
 * club's own pages are the club's: Team G has no website, Bristol & Clifton
 * does.
 */
export const ClubSchema = z.strictObject({
  id: ID,
  /** As the league writes it, which is what appears on a fixture card. */
  name: z.string().min(1),
  links: z.strictObject({ website: URL.nullable().default(null) }).default({ website: null }),
  venue: VenueSchema,
  /**
   * Everybody who has played for the club, ours and theirs alike.
   *
   * Held here rather than on a season's team because a person outlives both:
   * they may play for G this year and F the next, and an opponent we meet twice
   * is one man with one rating history rather than two records that can
   * disagree. A season says who was picked; this says who they are.
   */
  players: z.array(PersonSchema).default([]),
});

/**
 * A competition, and the two documents that govern it.
 *
 * `rules` and `handbook` were on the team, where they were a copy waiting to be
 * made: they are the same for every side in the league, so they belong to the
 * league.
 */
export const LeagueSchema = z.strictObject({
  id: ID,
  name: z.string().min(1),
  links: z
    .strictObject({ rules: URL.nullable().default(null), handbook: URL.nullable().default(null) })
    .default({ rules: null, handbook: null }),
});

export const MatchesFileSchema = z.array(MatchSchema);
export const TeamsFileSchema = z.array(TeamSchema);
export const LeaguesFileSchema = z.array(LeagueSchema);

export type Clock = z.infer<typeof ClockSchema>;
export type TimeControl = z.infer<typeof TimeControlSchema>;
export type Rating = z.infer<typeof RatingSchema>;
export type PlayerCode = z.infer<typeof PlayerCodeSchema>;
export type Person = z.infer<typeof PersonSchema>;
export type SquadMember = z.infer<typeof SquadMemberSchema>;

/**
 * A person as one season's squad knows them: who they are, plus the two things
 * that were true of them that season. Assembled by the loader, because neither
 * half is the whole player.
 */
export interface Player extends Person, Omit<SquadMember, "playerId"> {}
export type Availability = z.infer<typeof AvailabilitySchema>;
export type Game = z.infer<typeof GameSchema>;
export type Result = z.infer<typeof ResultSchema>;
export type Match = z.infer<typeof MatchSchema>;
export type SeasonMeta = z.infer<typeof SeasonSchema>;
export type Venue = z.infer<typeof VenueSchema>;
export type League = z.infer<typeof LeagueSchema>;
export type Club = z.infer<typeof ClubSchema>;
export type TeamRecord = z.infer<typeof TeamSchema>;

/**
 * Ids, spelled out from the parts the records store.
 *
 * One rule at every level: a slug names its parent, then itself, joined by "/".
 * `-` stays inside a segment, so `hanham-folk-centre/team-b/j-smith` splits into
 * three however many hyphens a name contains. A segment says what it is, which
 * is why a team's bare "g" is written as "team-g": on its own a letter means
 * nothing, and in a path somebody has to read at a glance it says which of the
 * two Gs is being talked about.
 *
 * Composed here and never stored, so every id in the repository is correct by
 * construction and every component is still visible on the record that owns it.
 */
export function teamSlug(team: { clubId: string; teamId: string }): string {
  return `${team.clubId}/team-${team.teamId}`;
}

export function playerSlug(club: { id: string }, player: { playerId: string }): string {
  return `${club.id}/${player.playerId}`;
}

/** Which fixture of the season this is, read back off its id. */
export function fixtureNumber(match: { id: string }): number {
  return Number(match.id.slice("fixture-".length));
}

/** A board within a fixture, which is how a game is addressed. */
export function boardSlug(game: { board: number }): string {
  return `board-${game.board}`;
}

export function seasonSlug(season: { leagueId: string; clubId: string; teamId: string; period: string }): string {
  return `${season.leagueId}/${teamSlug(season)}/${season.period}`;
}

/** A team with its club resolved, its id spelled out and its squad filled in. */
export interface Team extends Omit<TeamRecord, "players"> {
  id: string;
  club: Club;
  players: Player[];
}

/** A season with its files loaded, everything resolved and everything cross-checked. */
export interface Season extends SeasonMeta {
  id: string;
  league: League;
  club: Club;
  /** Ours. `teams` holds it too, alongside everybody we play. */
  team: Team;
  teams: Team[];
  /** Our squad, which is `team.players` under the name the site reads it by. */
  players: Player[];
  matches: Match[];
}

/** Points for us, by game result. Draws are the reason scores are halves. */
export const GAME_POINTS: Record<Game["result"], number> = {
  win: 1,
  "default-win": 1,
  draw: 0.5,
  loss: 0,
  "default-loss": 0,
};

export const GAME_RESULT_LABEL: Record<Game["result"], string> = {
  win: "Win",
  draw: "Draw",
  loss: "Loss",
  "default-win": "Win by default",
  "default-loss": "Loss by default",
};
