import { describe, expect, it } from "vitest";
import { playerName, seasonById } from "@/lib/data";
import type { Match } from "@/lib/schema";
import { selectionFor } from "@/lib/season";
import { availabilityUpdate, callToAction, describeRound, matchResult, selectedTeam } from "@/lib/messages";

const season = seasonById.get("2026-autumn-g")!;
const first = season.matches.find((match) => match.id === "r1")!;
const second = season.matches.find((match) => match.id === "r2")!;
const away = season.matches.find((match) => match.id === "r3")!;

/**
 * A real fixture with the replies replaced, for the cases that are about a
 * shape of availability rather than about a particular match. The venue, date
 * and opponent stay real so the message still reads as one the captain sends.
 */
function withAvailability(match: Match, yes: string[]): Match {
  return {
    ...match,
    availability: yes.map((playerId) => ({ playerId, reply: "yes" as const, at: "2026-09-01", withdrawn: null })),
  };
}

/** Nobody has answered yet. */
const silent = withAvailability(second, []);

describe("describeRound", () => {
  it("uses words while it has them", () => {
    expect(describeRound(1)).toBe("the first fixture of the season");
    expect(describeRound(7)).toBe("the seventh fixture of the season");
  });

  it("falls back to a number rather than inventing a word", () => {
    expect(describeRound(20)).toBe("round 20");
  });
});

describe("callToAction", () => {
  const message = callToAction(season, first);

  it("asks the question, then names the match", () => {
    expect(message.split("\n").filter(Boolean)).toEqual([
      "Who can play in the first fixture of the season?",
      "Bristol & Clifton G v South Bristol D, Tuesday 8 September, 19:30, at home (https://maps.app.goo.gl/1gBZP8mgdUhoXYJH7).",
    ]);
  });

  it("gives the date and time without a relative one", () => {
    // A message sits in the chat for a week, and "in 14 days" ages badly.
    expect(message).toContain("Tuesday 8 September, 19:30");
    expect(message).not.toMatch(/in \d+ days|today|tomorrow/);
  });

  it("says where, with a map", () => {
    expect(message).toContain("at home");
    expect(message).toContain("https://maps.app.goo.gl/");
  });

  it("names the away club rather than just saying away", () => {
    const line = callToAction(season, away);
    expect(line).toContain("away at Bristol Grendel Chess Club");
    expect(line).toContain("Bristol Grendel C v Bristol & Clifton G");
  });

  it("does not spell out the four answers, which go out as a poll", () => {
    expect(message.toLowerCase()).not.toContain("can be a reserve");
    expect(message.split("\n").filter(Boolean)).toHaveLength(2);
  });

  it("is plain text, because it is going into WhatsApp", () => {
    expect(message).not.toMatch(/[*_`#]|<\/?[a-z]/i);
  });
});

describe("availabilityUpdate", () => {
  const message = availabilityUpdate(season, first);

  it("names the fixture, so it cannot be read against the wrong match", () => {
    expect(message.startsWith("Where we are for Bristol & Clifton G v South Bristol D, Tuesday 8 September")).toBe(
      true,
    );
  });

  it("carries no map, because it is a reply to the message that had one", () => {
    expect(message).not.toContain("maps.app.goo.gl");
  });

  it("says which side of the fixture we are on for an away match", () => {
    expect(availabilityUpdate(season, away)).toContain("Bristol Grendel C v Bristol & Clifton G");
  });

  it("groups the replies and sorts each group", () => {
    expect(message).toContain("Can play: Jade, Lorenzo, Mukhtar, Niall, Steve, Theo.");
    expect(message).toContain("Can be a reserve: Alex, Max.");
    expect(message).toContain("Not sure yet: Thomas, Will.");
  });

  it("names the people who have not replied at all", () => {
    expect(message).toContain("Not heard from: John, Mark.");
  });

  it("says plainly that nobody is picked", () => {
    // Otherwise a list of "can play" reads as a team sheet.
    expect(message).toContain("Nobody is picked yet");
  });

  it("leaves out a group nobody is in", () => {
    // Availability is written here rather than borrowed from a real fixture:
    // the season's own replies change every week, and a test that reads them
    // is really asserting who happened to answer the captain.
    const summary = availabilityUpdate(season, silent);
    expect(summary).not.toContain("Can play:");
    expect(summary).toContain("Not heard from:");
  });
});

describe("selectedTeam", () => {
  const settled = season.matches.find((match) => match.id === "r1")!;
  const message = selectedTeam(season, settled, selectionFor(season, settled));

  it("names the fixture, with a map, because people have to get there", () => {
    expect(message.startsWith("Team for Bristol & Clifton G v South Bristol D, Tuesday 8 September")).toBe(true);
    expect(message).toContain("maps.app.goo.gl");
  });

  it("reports the players and nothing else", () => {
    expect(message).toContain("Playing:");
    expect(message).toContain("Reserves:");
    // Nobody is named as having missed out.
    expect(message).not.toContain("Not this time");
    // No arguing its own case: the working is on the site for anybody who wants
    // it, and a chat message that justifies itself invites the argument.
    expect(message).not.toContain("coin toss");
    expect(message).not.toContain("took the last board");
    expect(message).not.toContain("Still to hear from");
  });

  it("keeps the reserves in the rule's order and sorts the rest", () => {
    const reserves = /Reserves: ([^.]+)\./.exec(message)?.[1];
    const selection = selectionFor(season, settled);
    expect(reserves).toBe(selection.reservePlayers.map((player) => playerName(season, player.playerId)).join(", "));
  });

  it("tells anybody who missed out that they move up next time", () => {
    expect(message).toContain("nearer the front next time");
  });

  it("says nothing consoling when everybody available is playing", () => {
    // Four boards, four volunteers, nobody left over: there is nobody to
    // console and the line would be addressed at no one. Exactly four is a
    // shape a real fixture only holds until the fifth person replies.
    const exact = withAvailability(second, ["niall", "steve", "max", "thomas"]);
    expect(selectedTeam(season, exact, selectionFor(season, exact))).not.toContain("nearer the front");
  });
});

describe("matchResult", () => {
  const demo = seasonById.get("demo")!;
  const played = demo.matches.find((match) => match.id === "r1")!;
  const lost = demo.matches.find((match) => match.id === "r2")!;
  const awayWin = demo.matches.find((match) => match.id === "r3")!;

  it("is nothing at all until there is a result", () => {
    const pending = demo.matches.find((match) => match.status === "scheduled")!;
    expect(matchResult(demo, pending)).toBeNull();
  });

  it("leads with whether we won", () => {
    expect(matchResult(demo, played)!.startsWith("A win:")).toBe(true);
    expect(matchResult(demo, lost)!.startsWith("A loss:")).toBe(true);
  });

  it("writes the scoreline home side first", () => {
    // Ours is the away side here, so our score has to be the second number or
    // an away win reads as a defeat.
    const message = matchResult(demo, awayWin)!;
    expect(message).toContain("Bristol Grendel C 1½ - 2½ Bristol & Clifton G.");
    expect(message.startsWith("A win:")).toBe(true);
  });

  it("writes a bare half as a half", () => {
    expect(matchResult(demo, played)).toContain("2½ - 1½");
    expect(matchResult(demo, played)).not.toContain("0½");
  });

  it("gives every board, ours first, in board order", () => {
    const boards = matchResult(demo, played)!
      .split("\n")
      .filter((line) => /^\d\./.test(line));
    expect(boards).toHaveLength(4);
    expect(boards[0]).toBe("1. Ada Mercer 1 - 0 R. Whitlock");
    expect(boards[1]).toBe("2. Bruno Halliday ½ - ½ P. Ndiaye");
  });

  it("marks a default rather than passing it off as a game", () => {
    const defaulted = demo.matches.find((match) => match.id === "r4")!;
    expect(matchResult(demo, defaulted)).toContain("(default)");
  });
});
