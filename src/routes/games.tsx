import { ArrowLeft } from "lucide-react";
import * as React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { AnalysisIcons, AnalysisLinks } from "@/components/analysis-links";
import { EngineSwitch } from "@/components/evaluation";
import { DEFAULT_ENGINE_OPTIONS, type EngineOptions } from "@/hooks/use-engine";
import { GameViewer } from "@/components/chess-board";
import { Empty, Page, Section } from "@/components/page";
import { PgnPanel } from "@/components/pgn-panel";
import { seasonPath, useSeason } from "@/components/season-context";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { findMatch, playerById } from "@/lib/data";
import { taggedPgn } from "@/lib/links";
import { GAME_RESULT_LABEL } from "@/lib/schema";
import { orderedMatches } from "@/lib/season";
import { formatShortDate } from "@/lib/time";

import { cn } from "@/lib/utils";

export function Games() {
  const { season } = useSeason();
  // Grouped by match rather than flattened, so the four boards of one evening
  // read as one thing. A flat list of sixteen rows gives no clue where an
  // evening starts and ends, which was the hard part to parse.
  const matches = orderedMatches(season)
    .filter((match) => match.result)
    .map((match) => ({ match, games: [...(match.result?.games ?? [])].sort((a, b) => a.board - b.board) }));

  return (
    <Page title="Games" lede="Every game we have a record of, playable here and one click from a full analysis board.">
      {matches.length === 0 ? (
        <Empty>No games recorded yet this season.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Match</TableHead>
                <TableHead className="w-16 text-right">Board</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="w-20">Colour</TableHead>
                <TableHead>Opponent</TableHead>
                <TableHead className="w-24">Result</TableHead>
                <TableHead className="w-28 text-right">Analyse</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.map(({ match, games }, group) =>
                games.map((game, index) => {
                  const player = playerById(season, game.playerId);
                  const won = game.result === "win" || game.result === "default-win";
                  const drew = game.result === "draw";
                  return (
                    <TableRow
                      key={`${match.id}-${game.board}`}
                      // Alternating shades per match, not per row: the block of
                      // colour is what separates one evening from the next.
                      className={cn(group % 2 === 1 && "bg-muted/40", index === 0 && group > 0 && "border-t-2")}
                    >
                      <TableCell className="align-top">
                        {index === 0 && (
                          <Link to={seasonPath(season.id, `match/${match.id}`)} className="hover:text-primary block">
                            <span className="text-muted-foreground tabular block text-xs">
                              {formatShortDate(match.date)}
                            </span>
                            <span className="font-medium">{match.opponent}</span>
                          </Link>
                        )}
                      </TableCell>
                      <TableCell className="tabular text-right">{game.board}</TableCell>
                      <TableCell className="font-medium">{player?.name ?? game.playerId}</TableCell>
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
                            <AnalysisIcons
                              pgn={taggedPgn(match, game, player?.name ?? game.playerId, season.team.name)}
                            />
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={seasonPath(season.id, `match/${match.id}/board/${game.board}`)}>View</Link>
                            </Button>
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">No PGN</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                }),
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </Page>
  );
}

export function GamePage() {
  const { seasonId, matchId, board } = useParams();
  // On by default: anybody who opens a game page has come to look at the game,
  // and the evaluation is most of why the page is worth opening. The cost is
  // that the engine downloads on arrival rather than on request; it is scoped
  // to this page, so nobody browsing fixtures ever pays it.
  const [analysing, setAnalysing] = React.useState(true);
  const [engineOptions, setEngineOptions] = React.useState<EngineOptions>(DEFAULT_ENGINE_OPTIONS);
  const found = findMatch(seasonId, matchId);
  const game = found?.match.result?.games.find((entry) => entry.board === Number(board));

  if (!found || !game) return <Navigate to="/" replace />;

  const { season, match } = found;
  const player = playerById(season, game.playerId);
  const name = player?.name ?? game.playerId;
  const pgn = taggedPgn(match, game, name, season.team.name);
  const white = game.colour === "white" ? name : game.opponent;
  const black = game.colour === "white" ? game.opponent : name;

  return (
    <Page
      title={`${white} v ${black}`}
      lede={`Board ${game.board} · ${match.home ? "" : "away to "}${match.opponent} · ${formatShortDate(match.date)}`}
      actions={
        <Button variant="ghost" size="sm" asChild>
          <Link to={seasonPath(season.id, `match/${match.id}`)}>
            <ArrowLeft className="size-3.5" />
            Match
          </Link>
        </Button>
      }
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{GAME_RESULT_LABEL[game.result]}</Badge>
          <Badge variant="outline">
            {name} played {game.colour}
          </Badge>
          {game.opponentRating !== null && <Badge variant="outline">Opponent {game.opponentRating}</Badge>}
          {game.opponentJunior && <Badge variant="outline">Junior opponent</Badge>}
        </div>

        {/* Everything that takes the game somewhere else, gathered on the right
            of the same line: two links out, and the engine that runs here. */}
        {game.pgn && (
          <div className="flex flex-wrap items-center gap-3">
            <AnalysisLinks pgn={pgn} />
            <EngineSwitch
              enabled={analysing}
              onToggle={setAnalysing}
              options={engineOptions}
              onOptions={setEngineOptions}
            />
          </div>
        )}
      </div>

      {game.pgn ? (
        <>
          <GameViewer
            pgn={game.pgn}
            orientation={game.colour}
            analysing={analysing}
            engineOptions={engineOptions}
            white={white}
            black={black}
          />

          <Section title="The PGN" className="mt-8">
            <PgnPanel pgn={pgn} label={`${white} v ${black}`} />
          </Section>
        </>
      ) : (
        <Empty>No moves were recorded for this game.</Empty>
      )}
    </Page>
  );
}
