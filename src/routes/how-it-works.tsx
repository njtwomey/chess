import { Page, Section } from "@/components/page";
import { ReplyBadge, RoleBadge } from "@/components/reply-badge";
import { useSeason } from "@/components/season-context";
import { formatClock } from "@/lib/boards";
import { REPLIES, select, type Candidate } from "@/lib/selection";
import { cn } from "@/lib/utils";

/**
 * Every example on this page is computed by the real selection function.
 *
 * Typing the outcomes into prose would be quicker and would be wrong within a
 * season: the page would keep asserting yesterday's behaviour while the code
 * did something else, and this is the page people will be pointed at when they
 * want to argue. Running the function means the documentation cannot drift.
 *
 * The cast is world champions, which is a joke and also useful: nobody can
 * mistake an example for a real team sheet.
 */
function Worked({
  title,
  question,
  candidates,
  boards = 4,
  reserves = 2,
  matchId = "worked-example",
}: {
  title: string;
  question: string;
  candidates: Candidate[];
  boards?: number;
  reserves?: number;
  matchId?: string;
}) {
  const selection = select({ matchId, seed: "how-it-works", boards, reserves, candidates });
  // `standing` rather than `order`, so a dropout stays visible in the place it
  // held. Rendering only the survivors would make the person vanish, which is
  // exactly the impression this section exists to correct.
  const rows = [...selection.standing, ...selection.unavailable];

  return (
    <div className="rounded-lg border">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-muted-foreground mt-1 text-sm/6">{question}</p>
      </div>
      <div className="divide-y">
        {rows.map((player) => (
          <div
            key={player.playerId}
            className={cn(
              "flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2",
              player.role === "board" && "bg-accent/40",
            )}
          >
            <span className="tabular text-muted-foreground w-5 shrink-0 text-xs">{player.position ?? "—"}</span>
            <span
              className={cn(
                "w-28 shrink-0 text-sm font-medium capitalize",
                player.role === "withdrawn" && "text-muted-foreground line-through",
              )}
            >
              {player.playerId.replace(/-/g, " ")}
            </span>
            <ReplyBadge reply={player.reply} />
            <span className="text-muted-foreground tabular text-xs">
              {player.gamesPlayed} {player.gamesPlayed === 1 ? "game" : "games"}
            </span>
            {selection.promoted.includes(player) && (
              <span className="text-reply-yes ml-auto text-[0.7rem] font-medium">moved up</span>
            )}
            <RoleBadge role={player.role} className={cn(!selection.promoted.includes(player) && "ml-auto")} />
          </div>
        ))}
      </div>
      {selection.unfilled > 0 && (
        <p className="text-reply-unsure border-t px-4 py-2.5 text-sm font-medium">
          {selection.unfilled} {selection.unfilled === 1 ? "board" : "boards"} cannot be filled.
        </p>
      )}
    </div>
  );
}

function c(playerId: string, reply: Candidate["reply"], gamesPlayed: number): Candidate {
  return { playerId, reply, gamesPlayed };
}

export function HowItWorks() {
  const { season } = useSeason();

  return (
    <Page
      title="How selection works"
      lede="Every example on this page is produced by the same function that picks the real teams."
    >
      <p className="text-[0.95rem]/7">
        We are Team G, so we are here to get beginners playing. The objective is to give as many people as many games as
        possible, and everything below follows from that.
      </p>
      <p className="mt-3 text-[0.95rem]/7">
        Before each match a poll goes out. There are four responses, and what you pick is taken to mean what it says.
      </p>

      {/* No heading. "The four answers" named the thing without telling anybody
          anything the sentence above had not already said. */}
      <div className="mt-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {REPLIES.map((reply) => (
            <div key={reply} className="rounded-lg border p-3">
              <ReplyBadge reply={reply} />
              <p className="text-muted-foreground mt-2 text-sm/6">
                {reply === "yes" && "In the running for a board, least-played first."}
                {reply === "reserve" &&
                  "Behind everybody who said they can play. Offering to stand in is taken to mean you would rather not this time."}
                {reply === "unsure" && "Never selected. Somebody will come and ask you."}
                {reply === "no" && "Out for this one. Your game count is untouched, so you move up for the next."}
              </p>
            </div>
          ))}
        </div>
      </div>

      <Section
        title="The order"
        description="Everyone who said yes or offered to reserve goes into one list, sorted by four keys in this order."
      >
        <ol className="space-y-3 text-sm/7">
          {[
            {
              key: "Can play, ahead of can reserve",
              body: "Always, not merely as a tiebreaker. Choosing 'reserve' over 'yes' usually means there is some reason you would rather sit this one out, and it would be a strange thanks for the more accommodating answer to hand you a game that somebody else was asking for.",
            },
            {
              key: "Fewest games first",
              body: "Applied inside each group, which is where it does the work: the boards go to the least-played of the people who asked for a game. Games are counted from the results of earlier fixtures, never typed in by hand.",
            },
            {
              key: "A seeded coin toss",
              body: `Ties are broken by a number derived from the season seed (${season.seed}), the match, and the player's id. It is not random at run time: the same inputs always give the same answer, and it comes out differently in each match so the same person does not keep losing the toss.`,
            },
            {
              key: "Player id",
              body: "A last resort so that the order is total and can never depend on the order the data happens to be in.",
            },
          ].map((rule, index) => (
            <li key={rule.key} className="flex gap-3">
              <span className="bg-primary text-primary-foreground tabular mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                {index + 1}
              </span>
              <span>
                <strong className="font-semibold">{rule.key}.</strong> {rule.body}
              </span>
            </li>
          ))}
        </ol>
        <p className="text-muted-foreground mt-4 text-sm/7">
          The first {season.boards} in that list play. The next {season.reserves} are the reserves.
        </p>
        <p className="text-muted-foreground mt-3 text-sm/7">
          <strong className="text-foreground font-semibold">The reserves are ranked, not a pool.</strong> Reserve one is
          ahead of reserve two, and if a board falls vacant it is reserve one who fills it. There is no second decision
          to be made on the night: the whole list, from board one to the last person who offered, is settled in one go.
        </p>
      </Section>

      <Section title="Worked examples">
        <div className="space-y-5">
          <Worked
            title="More people than places"
            question="Five say they can play. Who gets the four boards?"
            matchId="example-plain"
            candidates={[
              c("capablanca", "yes", 0),
              c("fischer", "yes", 1),
              c("tal", "yes", 1),
              c("morphy", "yes", 2),
              c("lasker", "yes", 3),
            ]}
          />
          <p className="text-muted-foreground -mt-2 text-sm/7">
            The four who have played least. Lasker has had three games already, so this week that means first reserve.
          </p>

          <Worked
            title="Offering to stand in"
            question="Carlsen has not had a game all season, but ticked 'can be a reserve' rather than 'can play'. Does that beat four people who have played three each?"
            matchId="example-reserve"
            candidates={[
              c("kasparov", "yes", 3),
              c("karpov", "yes", 3),
              c("anand", "yes", 3),
              c("kramnik", "yes", 3),
              c("carlsen", "reserve", 0),
            ]}
          />
          <p className="text-muted-foreground -mt-2 text-sm/7">
            No. Carlsen offered to step in if needed rather than asking for a game, and that is taken at face value.
            First reserve, though, so if anybody drops out the board is his.
          </p>

          <Worked
            title="The overspill"
            question="Five say they can play and three offer to stand in, and everybody has played the same number of games. The fifth yes cannot have a board, so where do they go?"
            matchId="example-overspill"
            candidates={[
              c("capablanca", "yes", 1),
              c("alekhine", "yes", 1),
              c("euwe", "yes", 1),
              c("botvinnik", "yes", 1),
              c("smyslov", "yes", 1),
              c("petrosian", "reserve", 1),
              c("spassky", "reserve", 1),
              c("fischer", "reserve", 1),
            ]}
          />
          <p className="text-muted-foreground -mt-2 text-sm/7">
            Straight to the top of the reserves, ahead of the three who only offered to stand in.
          </p>

          <Worked
            title="Not sure is not a maybe"
            question="Polgar has never played and says 'not sure', and the team is a board short. Do we pencil her in?"
            matchId="example-unsure"
            candidates={[
              c("kasparov", "yes", 2),
              c("karpov", "yes", 2),
              c("tal", "yes", 3),
              c("polgar", "unsure", 0),
              c("morphy", "no", 0),
            ]}
          />
          <p className="text-muted-foreground -mt-2 text-sm/7">
            No. The board is reported as unfilled and it becomes a situation we sort out by hand. We want all four
            boards covered, so somebody goes and asks.
          </p>
        </div>
      </Section>

      <Section title="If somebody drops out">
        <p className="text-sm/7">
          People pull out. Work, illness, a train. When that happens the rule is{" "}
          <strong className="font-semibold">not run again</strong>. The order was settled when the replies came in, and
          a withdrawal takes that one person out of it: everybody below moves up exactly one place, so the first reserve
          takes the empty board and the second reserve becomes the first.
        </p>

        <div className="mt-4 space-y-4">
          <Worked
            title="Before"
            question="Nobody has dropped out. Four play, two are reserves, and the reserves are in order."
            matchId="example-dropout"
            candidates={[
              c("capablanca", "yes", 0),
              c("lasker", "yes", 1),
              c("tal", "yes", 2),
              c("botvinnik", "yes", 3),
              c("fischer", "yes", 4),
              c("kasparov", "yes", 5),
              c("carlsen", "yes", 6),
            ]}
          />

          <Worked
            title="After Tal drops out"
            question="Tal was playing and has had to withdraw. Nobody is re-ranked."
            matchId="example-dropout"
            candidates={[
              c("capablanca", "yes", 0),
              c("lasker", "yes", 1),
              { ...c("tal", "yes", 2), withdrawn: true },
              c("botvinnik", "yes", 3),
              c("fischer", "yes", 4),
              c("kasparov", "yes", 5),
              c("carlsen", "yes", 6),
            ]}
          />
        </div>

        <p className="text-muted-foreground mt-4 text-sm/7">
          Fischer was the first reserve and now has a board. Kasparov moves from second reserve to first, and Carlsen
          comes into the reserves. Nobody who was above Tal is affected at all.
        </p>

        <p className="mt-3 text-sm/7">
          Re-running the rule instead would be the obvious thing to do and it would be wrong. A tie that had already
          been settled could come out the other way, and somebody who had been told they were not playing could find
          themselves on the team, or worse, the reverse. Recording a withdrawal as a withdrawal rather than changing the
          person's answer to "cannot play" is what keeps the original order intact and keeps the record honest about
          what actually happened.
        </p>
      </Section>

      <Section title="Which board you play" description="A different question, decided by a different rule.">
        <p className="text-sm/7">
          Selection decides <em>who</em> plays and takes no account of anybody's rating. Where those four then sit is
          the league's business: boards run strongest first, so the highest rated of the four plays board one and it
          descends from there. Unrated players go below every graded one, because there is nothing to show they belong
          higher.
        </p>
        <p className="mt-3 text-sm/7">
          Keeping the two apart is deliberate. If a rating could reach the selection step it would start deciding who
          gets a game, which is the one thing this system must not do.
        </p>
      </Section>

      <Section title="Clocks">
        <p className="text-sm/7">
          Boards are {formatClock(season.timeControl.standard)}. A board with a player under{" "}
          {season.timeControl.juniorUnder} on <em>either</em> side is {formatClock(season.timeControl.junior)}. The
          shorter clock belongs to the board rather than to the child, so an adult can find themselves playing it, and a
          board can turn out to be a junior board only once the other club names its team.
        </p>
      </Section>

      <Section title="When the captain overrules it">
        <p className="text-sm/7">
          The rule produces a proposal, not a team sheet. People drop out on the day, a reserve steps in, and sometimes
          there is a reason the list cannot know about. When that happens the match records what was actually fielded
          and why, alongside what the rule said, rather than quietly rewriting the answer to match the outcome.
        </p>
        <p className="mt-3 text-sm/7">
          What does not change is the arithmetic underneath: a game played is a game counted, so anybody who steps in
          moves down the order for the next fixture exactly as if they had been picked.
        </p>
      </Section>
    </Page>
  );
}
