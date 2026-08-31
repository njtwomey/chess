import { ArrowLeft, Clock3, Eye, EyeOff, ExternalLink, MapPin, Timer } from "lucide-react";
import * as React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { AnalysisIcons } from "@/components/analysis-links";
import { seasonPath } from "@/components/season-context";
import { Empty, Page, Section } from "@/components/page";
import { RatingLabel } from "@/components/rating";
import { SelectionTable } from "@/components/selection-table";
import { VenueMap } from "@/components/venue-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { assignBoards, expectedColour, formatClock } from "@/lib/boards";
import { findMatch, playerById, venueById } from "@/lib/data";
import { mapsUrl, taggedPgn } from "@/lib/links";
import { GAME_RESULT_LABEL, type Match, type Season } from "@/lib/schema";
import { matchScore, ratingOn, selectionFor } from "@/lib/season";
import { formatLongDate, formatYear, relativeDay, today } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * Time and place, at the top, in the largest type on the page.
 *
 * The two facts stack on the left and the map squares off beside them, because
 * a player opening this page already knows who they are playing. What they came
 * for is when to leave the house and where they are going.
 */
function Where({ match }: { match: Match }) {
  const venue = venueById.get(match.venueId);
  const place = venue ? [venue.address, venue.postcode].filter(Boolean).join(", ") : "";

  return (
    <div className="bg-card grid gap-5 rounded-xl border p-5 sm:grid-cols-[minmax(0,1fr)_11rem] md:grid-cols-[minmax(0,1fr)_13rem]">
      <div className="flex flex-col justify-center gap-5">
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

        <div>
          <p className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
            <MapPin className="size-3.5" />
            Where
          </p>
          <p className="mt-1.5 text-lg font-semibold">{venue?.name ?? "Venue to be confirmed"}</p>
          <p className="text-muted-foreground text-sm">{place || "Address not confirmed yet"}</p>
          {venue && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" asChild>
                <a href={mapsUrl(venue)} target="_blank" rel="noreferrer">
                  Open in Maps <ExternalLink className="size-3.5" />
                </a>
              </Button>
              {venue.website && (
                <a
                  href={venue.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary text-xs hover:underline"
                >
                  Club website
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {venue && <VenueMap venue={venue} className="w-full self-center" />}
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
function BoardOrder({ season, match }: { season: Season; match: Match }) {
  const selection = selectionFor(season, match);
  const chosen = selection.boardPlayers
    .map((player) => playerById(season, player.playerId))
    .filter((player) => player !== undefined);

  if (chosen.length === 0) return <Empty>Nobody is selected yet, so there is no board order to propose.</Empty>;

  const boards = assignBoards(chosen, { timeControl: season.timeControl, onDate: match.date });
  const anyJunior = boards.some((entry) => entry.clock.junior);

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
              <TableHead className="w-28">Clock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {boards.map((entry) => (
              <TableRow key={entry.player.id}>
                <TableCell className="tabular font-medium">{entry.board}</TableCell>
                <TableCell>
                  {entry.player.name}
                  {entry.player.junior && (
                    <Badge variant="outline" className="ml-2 text-[0.65rem]">
                      Junior
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <RatingLabel rating={entry.rating} />
                </TableCell>
                <TableCell className="text-muted-foreground text-sm capitalize">
                  {expectedColour(match.home, entry.board)}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "tabular inline-flex items-center gap-1.5 text-sm",
                      entry.clock.junior && "text-reply-unsure font-medium",
                    )}
                  >
                    <Timer className="size-3.5" />
                    {formatClock(entry.clock.clock)}
                    {!entry.clock.certain && <span className="text-muted-foreground text-xs">*</span>}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-muted-foreground text-xs/5">
        Boards run strongest first, on the most recent rating; unrated players go below every graded one. Colours are
        the usual convention, with the home side on White at board one.{" "}
        <span className="whitespace-nowrap">* {formatClock(season.timeControl.standard)}</span> unless the opponent on
        that board is under {season.timeControl.juniorUnder}, which makes it {formatClock(season.timeControl.junior)}.
        {anyJunior &&
          ` A junior of ours settles it either way, so those boards are ${formatClock(season.timeControl.junior)}.`}
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
            <TableHead>{match.opponent}</TableHead>
            <TableHead className="w-28">Result</TableHead>
            <TableHead className="w-20 text-right">Game</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...match.result.games]
            .sort((a, b) => a.board - b.board)
            .map((game) => {
              const player = playerById(season, game.playerId);
              const won = game.result === "win" || game.result === "default-win";
              const drew = game.result === "draw";
              return (
                <TableRow key={game.board}>
                  <TableCell className="tabular font-medium">{game.board}</TableCell>
                  <TableCell>
                    <span className="font-medium">{player?.name ?? game.playerId}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      <RatingLabel rating={player ? ratingOn(player, match.date) : null} />
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm capitalize">{game.colour}</TableCell>
                  <TableCell>
                    {game.opponent}
                    {game.opponentRating !== null && (
                      <span className="text-muted-foreground tabular ml-2 text-xs">{game.opponentRating}</span>
                    )}
                  </TableCell>
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
                        <AnalysisIcons pgn={taggedPgn(match, game, player?.name ?? game.playerId, season.team.name)} />
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={seasonPath(season.id, `match/${match.id}/board/${game.board}`)}>View</Link>
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

export function MatchPage() {
  const { seasonId, matchId } = useParams();
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
  const settled = match.settled || match.result !== null;

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
  const selection = selectionFor(season, match);
  const home = match.home ? season.team.name : match.opponent;
  const away = match.home ? match.opponent : season.team.name;

  return (
    <Page
      title={`${home} v ${away}`}
      lede={`Round ${match.round} · ${season.team.competition}`}
      actions={
        <Button variant="ghost" size="sm" asChild>
          <Link to={seasonPath(season.id, "schedule")}>
            <ArrowLeft className="size-3.5" />
            Schedule
          </Link>
        </Button>
      }
    >
      <Where match={match} />

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
          <Result season={season} match={match} />
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
          <Section
            title={match.result ? "How this team was picked" : showProposal ? "Selection" : "Availability"}
            description={
              match.result
                ? "What the rule produced from the replies at the time. Where the team that took the field differed, it is recorded below."
                : showProposal
                  ? "The order below is what the rule produces from the replies. It is a proposal: the captain fields the team."
                  : "Who has said what so far. The team is picked nearer the match."
            }
            className="mt-8"
          >
            <SelectionTable season={season} match={match} selection={selection} settled={showProposal} />
          </Section>

          {/* Until the captain settles it the order exists but stays off the
              page: a running order shared mid-week is one that will change. */}
          {!match.result &&
            (showProposal ? (
              <Section
                title="Proposed board order"
                description="Now the four are settled, the league decides where they sit."
              >
                <BoardOrder season={season} match={match} />
              </Section>
            ) : (
              <p className="text-muted-foreground mt-6 text-sm">
                The board order is not settled yet, so it is not shown.
              </p>
            ))}
        </>
      )}
    </Page>
  );
}
