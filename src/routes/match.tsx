import { ArrowLeft, Clock3, Eye, EyeOff, ExternalLink, MapPin } from "lucide-react";
import * as React from "react";
import { Link, Navigate } from "react-router-dom";
import { AnalysisIcons } from "@/components/analysis-links";
import { seasonPath } from "@/components/season-context";
import { Empty, Page, Section } from "@/components/page";
import { CompetitionLink } from "@/components/competition-link";
import { HomeAway } from "@/components/home-away";
import { PlayerCell, PlayerLink } from "@/components/player-link";
import { RatingLabel } from "@/components/rating";
import { SelectionTable } from "@/components/selection-table";
import { VenueMap } from "@/components/venue-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { assignBoards, expectedColour, formatClock, type BoardAssignment } from "@/lib/boards";
import { findMatch, playerById } from "@/lib/data";
import { addressLines, mapsUrl, taggedPgn } from "@/lib/links";
import { GAME_RESULT_LABEL, boardSlug, type Match, type Player, type Season } from "@/lib/schema";
import {
  fieldedFor,
  matchScore,
  opponentOf,
  opponentTeam,
  ratingOn,
  selectionFor,
  sides,
  venueFor,
  type Fielded,
} from "@/lib/season";
import { formatDated, formatLongDate, formatYear, relativeDay, today } from "@/lib/time";
import type { Selection } from "@/lib/selection";
import { cn } from "@/lib/utils";

/**
 * Time and place, at the top, in the largest type on the page.
 *
 * The two facts stack on the left and the map squares off beside them, because
 * a player opening this page already knows who they are playing. What they came
 * for is when to leave the house and where they are going.
 */
function Where({ season, match }: { season: Season; match: Match }) {
  const venue = venueFor(season, match);
  const place = addressLines(venue).join(", ");

  return (
    <div className="bg-card grid gap-5 rounded-xl border p-5 sm:grid-cols-[minmax(0,1fr)_11rem] md:grid-cols-[minmax(0,1fr)_13rem]">
      {/* When and where read as one line: they answer the same question, which
          is whether you can get there. The links live underneath rather than
          inside either, so the top of the card is facts and the bottom is
          things to click. */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
            <Clock3 className="size-3.5" />
            When
          </p>
          <p className="mt-1.5 text-lg font-semibold">
            {formatLongDate(match.date)} {formatYear(match.date)}
          </p>
          <p className="text-muted-foreground tabular text-sm">
            {match.time} start · {relativeDay(today(), match.date)}
          </p>
        </div>

        <div className="min-w-0">
          <p className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
            <MapPin className="size-3.5" />
            Where
          </p>
          <p className="mt-1.5 text-lg font-semibold">
            {venue.name}{" "}
            <span className="ml-1 align-middle">
              <HomeAway home={match.home} />
            </span>
          </p>
          <p className="text-muted-foreground text-sm">{place || "Address not confirmed yet"}</p>
        </div>
      </div>

      {/* Down the side of both rows, so the column is not left empty under it
          and the card is no taller than the map. */}
      <VenueMap club={venue} className="w-full self-start sm:row-span-2" />

      <div className="space-y-2.5 border-t pt-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={mapsUrl(venue)} target="_blank" rel="noreferrer">
              Open in Maps <ExternalLink className="size-3.5" />
            </a>
          </Button>
          {match.recordUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={match.recordUrl} target="_blank" rel="noreferrer">
                Fixture link <ExternalLink className="size-3.5" />
              </a>
            </Button>
          )}
          {venue.links.website && (
            <Button variant="ghost" size="sm" asChild>
              <a href={venue.links.website} target="_blank" rel="noreferrer">
                Club website <ExternalLink className="size-3.5" />
              </a>
            </Button>
          )}
        </div>

        {/* The league's list is the authority on when and where a match is. This
            page is a convenience built on top of it, so it says so and links
            back: a fixture page with no way to the record it copied is one that
            can be quietly wrong for weeks. */}
        <p className="text-muted-foreground text-xs">
          Times and venues come from{" "}
          <a
            href={season.team.links.fixtures ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="text-primary inline-flex items-center gap-1 hover:underline"
          >
            the league's fixture list
            <ExternalLink className="size-3" />
          </a>
          . If the two disagree, the league is right. The fixture link is this match's own page there, with the board
          order as submitted and both sides' ratings.
        </p>
      </div>
    </div>
  );
}

/**
 * The rule's order beside the settled one, and only on this machine.
 *
 * Written as `import.meta.env.DEV && ...` so the bundler folds it away, exactly
 * as the force-the-proposal control is: this is a captain's working view and
 * has no business on the published site, where two competing orders would be
 * precisely the confusion the shortlist exists to remove.
 *
 * The point of it is the diff. Once a team is settled by hand the rule's answer
 * stops being visible anywhere the boards are shown, and settling one board by
 * hand quietly moves everybody below it. Seeing both makes that a decision
 * rather than a surprise.
 */
function LocalComparison({
  season,
  match,
  selection,
  fielded,
}: {
  season: Season;
  match: Match;
  selection: Selection;
  fielded: Fielded;
}) {
  const ruled = assignBoards(
    selection.boardPlayers
      .map((player) => playerById(season, player.playerId))
      .filter((player) => player !== undefined),
    { timeControl: season.timeControl, onDate: match.date },
  );
  const settled = assignBoards(fielded.players, {
    timeControl: season.timeControl,
    onDate: match.date,
    keepOrder: fielded.ordered,
  });

  const column = (title: string, boards: BoardAssignment[], other: BoardAssignment[]) => (
    <div className="min-w-0 flex-1">
      <p className="text-muted-foreground mb-1.5 text-xs font-medium">{title}</p>
      <ol className="space-y-1">
        {boards.map((entry) => {
          const same = other[entry.board - 1]?.player.playerId === entry.player.playerId;
          return (
            <li key={entry.player.playerId} className="flex items-baseline gap-2 text-sm">
              <span className="tabular text-muted-foreground w-4 shrink-0 text-xs">{entry.board}</span>
              <span className={cn("truncate", !same && "text-reply-unsure font-medium")}>{entry.player.name}</span>
              <span className="tabular text-muted-foreground ml-auto shrink-0 text-xs">
                {entry.rating ? entry.rating.rating : "Unrated"}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );

  return (
    <div className="border-reply-unsure/40 bg-reply-unsure-soft/40 mt-4 rounded-lg border p-4">
      <p className="text-reply-unsure mb-3 text-sm font-medium">Only visible to you, running locally.</p>
      {!fielded.fromRule && (
        <div className="mb-3 space-y-0.5 text-sm/6">
          {fielded.added.length > 0 && (
            <p>
              <span className="text-muted-foreground">Playing although the rule did not pick them:</span>{" "}
              {fielded.added.map((player) => player.name).join(", ")}.
            </p>
          )}
          {fielded.dropped.length > 0 && (
            <p>
              <span className="text-muted-foreground">Picked by the rule and not playing:</span>{" "}
              {fielded.dropped.map((player) => player.name).join(", ")}.
            </p>
          )}
          {fielded.note && <p className="text-muted-foreground">{fielded.note}</p>}
        </div>
      )}
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        {column("What the rule and the ratings give", ruled, settled)}
        {column("What you have settled", settled, ruled)}
      </div>
    </div>
  );
}

/**
 * Who was next in line, under whichever table names the four who played.
 *
 * Under the boards rather than beside them, because a reserve is not a board:
 * they have no colour and no clock until somebody drops out. Numbered, because
 * the order is the answer to "who comes in first".
 *
 * Shown on a played fixture as well. Standing by is what somebody did that
 * evening whether or not they got a game, and dropping them from the page once
 * the result arrives would quietly rewrite it as though only four had turned
 * out.
 */
function Reserves({ match, reserves }: { match: Match; reserves: Player[] }) {
  if (reserves.length === 0) return null;

  return (
    <div className="bg-muted/30 overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Reserve</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="w-24 text-right">Rating</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reserves.map((player, index) => (
            <TableRow key={player.playerId}>
              <TableCell className="tabular font-medium">{index + 1}</TableCell>
              <TableCell>
                <PlayerLink player={player} />
              </TableCell>
              <TableCell className="text-right">
                <RatingLabel rating={ratingOn(player, match.date)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * The proposed board order, which is a different question from who plays.
 *
 * Kept visually separate from the selection table for the same reason it is a
 * separate module: one is the club's fairness rule and the other is the
 * league's rating rule, and running them together is how a rating starts
 * quietly influencing who gets a game.
 */
function BoardOrder({ season, match, fielded }: { season: Season; match: Match; fielded: Fielded }) {
  if (fielded.players.length === 0)
    return <Empty>Nobody is selected yet, so there is no board order to propose.</Empty>;

  const boards = assignBoards(fielded.players, {
    timeControl: season.timeControl,
    onDate: match.date,
    keepOrder: fielded.ordered,
  });

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Board</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="w-24 text-right">Rating</TableHead>
              <TableHead className="w-24">Colour</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {boards.map((entry) => (
              <TableRow key={entry.player.playerId}>
                <TableCell className="tabular font-medium">{entry.board}</TableCell>
                <TableCell>
                  <PlayerLink player={entry.player} />
                </TableCell>
                <TableCell className="text-right">
                  <RatingLabel rating={entry.rating} />
                </TableCell>
                <TableCell className="text-muted-foreground text-sm capitalize">
                  {expectedColour(match.home, entry.board)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Reserves match={match} reserves={fielded.reserves} />

      <p className="text-muted-foreground text-xs/5">
        {fielded.ordered
          ? "Boards run strongest first, in the order the captain set. "
          : "Boards run strongest first, on the most recent rating; unrated players go below every graded one. "}
        {fielded.reserves.length > 0 ? "Reserves are in the order they would come in. " : ""}
        Colours alternate down the sheet, with the home side on Black at board one. Games are{" "}
        {formatClock(season.timeControl.standard)}, but a junior on either side of a board can choose{" "}
        {formatClock(season.timeControl.junior)} instead
        {season.timeControl.juniorOn
          ? `, a junior being anybody under ${season.timeControl.juniorUnder} on ${formatDated(season.timeControl.juniorOn)}`
          : ""}
        .
      </p>
    </div>
  );
}

function Result({ season, match }: { season: Season; match: Match }) {
  if (!match.result) return null;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Board</TableHead>
            <TableHead>Us</TableHead>
            <TableHead className="w-20">Colour</TableHead>
            <TableHead>{opponentTeam(season, match).name}</TableHead>
            <TableHead className="w-28">Result</TableHead>
            <TableHead className="w-20 text-right">Game</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...match.result.games]
            .sort((a, b) => a.board - b.board)
            .map((game) => {
              const player = playerById(season, game.playerId);
              const opponent = opponentOf(season, match, game);
              const won = game.result === "win" || game.result === "default-win";
              const drew = game.result === "draw";
              return (
                <TableRow key={game.board}>
                  <TableCell className="tabular font-medium">{game.board}</TableCell>
                  <TableCell>
                    <span className="font-medium">{player ? <PlayerLink player={player} /> : game.playerId}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      <RatingLabel rating={player ? ratingOn(player, match.date) : null} />
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm capitalize">{game.colour}</TableCell>
                  <TableCell>{opponent ? <PlayerCell player={opponent} /> : game.opponentId}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        won && "text-reply-yes",
                        drew && "text-muted-foreground",
                        !won && !drew && "text-reply-no",
                      )}
                    >
                      {GAME_RESULT_LABEL[game.result]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {game.pgn ? (
                      <span className="inline-flex items-center gap-1">
                        <AnalysisIcons
                          pgn={taggedPgn(
                            match,
                            game,
                            player?.name ?? game.playerId,
                            opponent?.name ?? game.opponentId,
                            sides(season, match),
                          )}
                        />
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={seasonPath(season.id, `${match.id}/${boardSlug(game)}`)}>View</Link>
                        </Button>
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Not recorded</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </div>
  );
}

export function MatchPage({ seasonId, matchId }: { seasonId: string; matchId: string }) {
  const found = findMatch(seasonId, matchId);
  if (!found) return <Navigate to="/schedule" replace />;

  const { season, match } = found;
  const score = matchScore(match);
  /**
   * Settled by the flag, or by having been played.
   *
   * The second one matters: a match with a result is history, and hiding how
   * that team was picked would defeat the point of keeping the working.
   */
  const selection = selectionFor(season, match);
  const settled = match.settled || match.result !== null;
  const fielded = fieldedFor(season, match, selection);

  /**
   * The captain can always see the proposal locally.
   *
   * Deciding whether to settle a match means looking at what settling would
   * publish, and that is impossible if the thing is hidden until published.
   * `import.meta.env.DEV` is false in every built bundle, so this cannot leak
   * to the deployed site; the banner below makes sure it is never mistaken for
   * something the team can see.
   */
  /**
   * Locally, the proposal can be forced into view on an unsettled match.
   *
   * Written as `DEV && ...` so the bundler folds it to a constant false and
   * drops the whole branch, rather than shipping a dead banner. There is
   * nothing to force on a settled match, so the control does not appear there:
   * what you see is already what the team sees.
   */
  const canForce = import.meta.env.DEV && !settled;
  const [forced, setForced] = React.useState(true);
  const showProposal = settled || (canForce && forced);
  const { home, away } = sides(season, match);

  return (
    <Page
      title={`${home} v ${away}`}
      badge={<HomeAway home={match.home} size="lg" />}
      lede={
        <>
          Fixture {match.number} · <CompetitionLink season={season} />
        </>
      }
      actions={
        <Button variant="ghost" size="sm" asChild>
          <Link to={seasonPath(season.id, "schedule")}>
            <ArrowLeft className="size-3.5" />
            Schedule
          </Link>
        </Button>
      }
    >
      <Where season={season} match={match} />

      {score && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border px-5 py-4">
          <span className="text-muted-foreground text-sm">Final score</span>
          <span className="tabular text-2xl font-semibold">{score}</span>
          <Badge
            variant="outline"
            className={cn(
              match.result && match.result.ourScore > match.result.theirScore && "border-reply-yes/50 text-reply-yes",
              match.result && match.result.ourScore < match.result.theirScore && "border-reply-no/50 text-reply-no",
            )}
          >
            {match.result && match.result.ourScore > match.result.theirScore
              ? "Won"
              : match.result && match.result.ourScore < match.result.theirScore
                ? "Lost"
                : "Drawn"}
          </Badge>
        </div>
      )}

      {/* Results first once they exist, because that is what anyone opening a
          played match came for. The organisation below stays on the page rather
          than being replaced: it is the record of how this team was arrived at,
          and it is what somebody would want to look back at months later. */}
      {match.result && (
        <Section title="Results" className="mt-8">
          <div className="space-y-3">
            <Result season={season} match={match} />
            <Reserves match={match} reserves={fielded.reserves} />
          </div>
        </Section>
      )}

      {/* Unmistakable, because the whole risk of a local-only view is telling
          somebody a team that the site is not actually showing them. */}
      {canForce && (
        <div className="border-reply-unsure/40 bg-reply-unsure-soft/40 text-reply-unsure mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-lg border px-4 py-3 text-sm">
          <p>
            {forced ? (
              <>
                <strong className="font-semibold">Not settled, so this is only visible to you.</strong> The published
                site shows the replies alone. Set <code className="font-mono text-xs">"settled": true</code> on the
                match to publish it.
              </>
            ) : (
              <>
                <strong className="font-semibold">This is what the team sees.</strong> The match is not settled, so the
                published site shows the replies and nothing else.
              </>
            )}
          </p>
          <Button variant="outline" size="sm" onClick={() => setForced((value) => !value)} className="shrink-0">
            {forced ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {forced ? "View as published" : "Show the proposal"}
          </Button>
        </div>
      )}

      {season.players.length === 0 ? (
        <Section title="Selection" className="mt-8">
          <Empty>No squad has been entered for {season.name} yet, so there is nobody to pick from.</Empty>
        </Section>
      ) : (
        <>
          {/* The team sheet first once there is one to show. Until the captain
              settles it the order exists but stays off the page: a running
              order shared mid-week is one that will change. */}
          {!match.result &&
            (showProposal ? (
              <Section
                title={fielded.ordered ? "Board order" : "Proposed board order"}
                description={
                  fielded.ordered
                    ? "Written down by the captain, so this is the order as it stands."
                    : "Now the four are settled, the league decides where they sit."
                }
                className="mt-8"
              >
                <BoardOrder season={season} match={match} fielded={fielded} />
                {import.meta.env.DEV && fielded.ordered && (
                  <LocalComparison season={season} match={match} selection={selection} fielded={fielded} />
                )}
              </Section>
            ) : (
              <p className="text-muted-foreground mt-6 text-sm">
                The board order is not settled yet, so it is not shown.
              </p>
            ))}

          <Section
            title={match.result ? "How this team was picked" : showProposal ? "Selection" : "Availability"}
            description={
              match.result
                ? "What the rule produced from the replies at the time. The team that actually took the field is above."
                : !showProposal
                  ? "Who has said what so far. The team is picked nearer the match."
                  : fielded.ordered
                    ? "The team as it stands, then everybody else who replied."
                    : "The order below is what the rule produces from the replies. It is a proposal: the captain fields the team."
            }
          >
            <SelectionTable
              season={season}
              match={match}
              selection={selection}
              fielded={fielded}
              settled={showProposal}
            />
          </Section>
        </>
      )}
    </Page>
  );
}
