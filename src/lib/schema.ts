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
export const RatingSchema = z.strictObject({
  date: DATE,
  rating: z.number().int().min(0).max(3500),
  source: z.enum(RATING_SOURCES),
});

export const PlayerSchema = z.strictObject({
  id: ID,
  name: z.string().min(1),
  /**
   * Captain, or not. There is no separate co-captain: the club runs with more
   * than one and they do the same job, so a second word would be a distinction
   * without a difference.
   */
  role: z.enum(["captain", "member"]).default("member"),
  /**
   * Ascending by date. An empty list means unrated, which is a normal state for
   * a new member and not a missing value to paper over with a zero.
   */
  ratings: z.array(RatingSchema).default([]),
  /**
   * Their ECF membership code, six digits and a check letter.
   *
   * Worth holding because it is the one identifier that survives a name: it
   * links to the published record, which is the authority on a rating and the
   * place to look when a new list comes out.
   */
  ecfCode: z
    .string()
    .regex(/^\d{6}[A-Z]$/, "an ECF code is six digits and a capital letter, like 364477H")
    .nullable()
    .default(null),
  /**
   * Under the league's junior age, which shortens the clock on their board.
   *
   * A flag rather than a date of birth. The site has no business holding a
   * child's birthday to compute something the captain already knows, and the
   * flag has to be reviewed each season anyway, which is the right prompt.
   */
  junior: z.boolean().default(false),
  note: z.string().optional(),
});

export const AvailabilitySchema = z.strictObject({
  playerId: ID,
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
  playerId: ID,
  colour: z.enum(["white", "black"]),
  opponent: z.string().min(1),
  opponentRating: z.number().int().min(0).max(3500).nullable().default(null),
  /**
   * Needed because the shorter clock applies to the board, not to the child.
   * Ours can be adults and the board still be a 55+10 board.
   */
  opponentJunior: z.boolean().default(false),
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
  id: ID,
  round: z.number().int().min(1),
  opponent: z.string().min(1),
  home: z.boolean(),
  venueId: ID,
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
      playerIds: z.array(ID).min(1),
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
});

/**
 * A team, kept out of the seasons so it can be named once.
 *
 * The club fields several sides and may want more than one of them here, so a
 * season points at a team rather than repeating its name. That also stops the
 * two drifting: a season saying "Bristol & Clifton G" while another says
 * "Bristol and Clifton G" was a matter of time.
 */
export const TeamSchema = z.strictObject({
  id: ID,
  /** How the league writes it, which is what goes on a fixture card. */
  name: z.string().min(1),
  club: z.string().min(1),
  competition: z.string().min(1),
  /** Where this team plays its home matches. */
  homeVenueId: ID,
  /**
   * The league's own pages. `fixtures` is required, because it is the authority
   * on when and where a match is: this site is a convenience built on top of
   * it, and a fixture page with no way back to the record it copied is a page
   * that can be quietly wrong.
   */
  links: z.strictObject({ fixtures: URL, rules: URL.optional(), handbook: URL.optional() }),
});

export const SeasonSchema = z.strictObject({
  id: ID,
  name: z.string().min(1),
  teamId: ID,
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
  }),
  /** The season the site opens on. Exactly one across all seasons. */
  active: z.boolean().default(false),
  /** Invented data. Badged in the UI so it can never be mistaken for real. */
  prototype: z.boolean().default(false),
});

export const VenueSchema = z.strictObject({
  id: ID,
  name: z.string().min(1),
  /** Null until somebody confirms it. Never guessed: see mapsUrl. */
  address: z.string().nullable().default(null),
  postcode: z.string().nullable().default(null),
  /** An exact pasted Maps link, when there is one. */
  maps: URL.nullable().default(null),
  /** The club's own page, which is where playing nights and contacts live. */
  website: URL.nullable().default(null),
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

export const PlayersFileSchema = z.array(PlayerSchema);
export const MatchesFileSchema = z.array(MatchSchema);
export const VenuesFileSchema = z.array(VenueSchema);
export const TeamsFileSchema = z.array(TeamSchema);

export type Clock = z.infer<typeof ClockSchema>;
export type TimeControl = z.infer<typeof TimeControlSchema>;
export type Rating = z.infer<typeof RatingSchema>;
export type Player = z.infer<typeof PlayerSchema>;
export type Availability = z.infer<typeof AvailabilitySchema>;
export type Game = z.infer<typeof GameSchema>;
export type Result = z.infer<typeof ResultSchema>;
export type Match = z.infer<typeof MatchSchema>;
export type SeasonMeta = z.infer<typeof SeasonSchema>;
export type Venue = z.infer<typeof VenueSchema>;
export type Team = z.infer<typeof TeamSchema>;

/** A season with its files loaded, its team resolved and everything cross-checked. */
export interface Season extends SeasonMeta {
  team: Team;
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
