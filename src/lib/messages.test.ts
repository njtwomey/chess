import { describe, expect, it } from "vitest";
import type { Match } from "@/lib/schema";
import { selectionFor } from "@/lib/season";
import { availabilityUpdate, callToAction, describeFixture, matchResult, selectedTeam } from "@/lib/messages";
import type { Game } from "@/lib/schema";
import { aClub, aGame, aMatch, aPlayer, aSeason, aTeam, ours, said } from "@/lib/testing";

/**
 * Built, not read from a season on disk.
 *
 * These tests assert on the exact words a message comes out with, which means
 * asserting on who replied and what they said. Read from shipped data, they
 * fail on the commit that is hardest to argue with: recording a reply that
 * really was sent. Built here, the replies hold still and the assertions can be
 * exact.
 */
const squad = ["Ada", "Bruno", "Cass", "Dermot", "Elin", "Farid", "Gwen", "Hollis", "Imre"].map((name) =>
  aPlayer({ playerId: name.toLowerCase(), name }),
);

/** Who we play, on their own roster rather than embedded in the games. */
const opponents = ["V. One", "W. Two", "X. Three", "Y. Four"].map((name) =>
  aPlayer({ playerId: name.toLowerCase().replace(/[^a-z]+/g, "-"), name }),
);

const us = aTeam({
  clubId: "our-club",
  teamId: "a",
  name: "Our Team A",
  players: squad,
  club: aClub({
    id: "our-club",
    name: "Our Chess Club",
    venue: { address: "1 Some Road", postcode: "AB1 2CD", maps: "https://maps.example.invalid/ours" },
  }),
});
const them = aTeam({
  clubId: "their-club",
  teamId: "b",
  name: "Their Team B",
  players: opponents,
  club: aClub({ id: "their-club", name: "Their Chess Club" }),
});

const theirs = (playerId: string) => `${them.clubId}/${playerId}`;

const home = { home: true, opponentTeamId: them.id };
const awayAt = { home: false, opponentTeamId: them.id };

const first = aMatch({ number: 1, date: "2026-03-10", ...home });
const away = aMatch({ number: 3, date: "2026-04-20", ...awayAt });

/** Every reply group represented, and four players yet to answer. */
const mixed = aMatch({
  number: 6,
  date: "2026-10-13",
  ...home,
  availability: [
    said(ours("ada"), "yes"),
    said(ours("elin"), "yes"),
    said(ours("gwen"), "reserve"),
    said(ours("hollis"), "unsure"),
    said(ours("imre"), "no"),
  ],
});

/** Nobody has answered yet. */
const silent = aMatch({ number: 7, date: "2026-11-10", ...home });

/** Settled, with more volunteers than boards, so somebody missed out. */
const settled = aMatch({
  number: 5,
  date: "2026-09-16",
  ...awayAt,
  settled: true,
  availability: squad.slice(0, 6).map((player) => said(ours(player.playerId), "yes")),
});

/** Played fixtures, one of each outcome the message has to describe. */
const boards = (results: Game["result"][]) =>
  results.map((result, index) =>
    aGame({
      board: index + 1,
      playerId: ours(squad[index]!.playerId),
      opponentId: theirs(opponents[index]!.playerId),
      result,
    }),
  );

const won = aMatch({
  number: 8,
  date: "2026-03-17",
  ...home,
  status: "played",
  result: { ourScore: 2.5, theirScore: 1.5, games: boards(["win", "draw", "win", "loss"]) },
});
const lost = aMatch({
  number: 9,
  date: "2026-03-24",
  ...home,
  status: "played",
  result: { ourScore: 1, theirScore: 3, games: boards(["win", "loss", "loss", "loss"]) },
});
const awayWin = aMatch({
  number: 10,
  date: "2026-04-27",
  ...awayAt,
  status: "played",
  result: { ourScore: 2.5, theirScore: 1.5, games: boards(["win", "draw", "win", "loss"]) },
});
const defaulted = aMatch({
  number: 11,
  date: "2026-05-12",
  ...home,
  status: "played",
  result: { ourScore: 3, theirScore: 1, games: boards(["win", "default-win", "win", "loss"]) },
});

const season = aSeason({
  name: "Test Season",
  team: us,
  teams: [us, them],
  matches: [first, away, mixed, silent, settled, won, lost, awayWin, defaulted],
});

/** A fixture with the replies replaced, for a shape no other fixture has. */
function withAvailability(match: Match, yes: string[]): Match {
  return { ...match, availability: yes.map((playerId) => said(ours(playerId), "yes")) };
}

describe("describeFixture", () => {
  it("uses words while it has them", () => {
    expect(describeFixture(1)).toBe("the first fixture of the season");
    expect(describeFixture(7)).toBe("the seventh fixture of the season");
  });

  it("falls back to a number rather than inventing a word", () => {
    expect(describeFixture(20)).toBe("fixture 20");
  });
});

describe("callToAction", () => {
  const message = callToAction(season, first);

  it("asks the question, then names the match", () => {
    expect(message.split("\n").filter(Boolean)).toEqual([
      "Who can play in the first fixture of the season?",
      "Our Team A v Their Team B, Tuesday 10 March, 19:30, at home (1 Some Road, AB1 2CD).",
    ]);
  });

  it("gives the date and time without a relative one", () => {
    // A message sits in the chat for a week, and "in 14 days" ages badly.
    expect(message).toContain("Tuesday 10 March, 19:30");
    expect(message).not.toMatch(/in \d+ days|today|tomorrow/);
  });

  it("says where, with the address rather than a link", () => {
    expect(message).toContain("at home");
    expect(message).toContain("1 Some Road, AB1 2CD");
    // A pasted URL takes up more of a chat than the fixture does, and unfurls
    // into a preview card on top of that.
    expect(message).not.toMatch(/https?:\/\//);
  });

  it("names the away club rather than just saying away", () => {
    const line = callToAction(season, away);
    expect(line).toContain("away at Their Chess Club");
    expect(line).toContain("Their Team B v Our Team A");
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
    expect(message.startsWith("Where we are for Our Team A v Their Team B, Tuesday 10 March")).toBe(true);
  });

  it("carries no address, because it is a reply to the message that had one", () => {
    expect(message).not.toContain("1 Some Road");
  });

  it("says which side of the fixture we are on for an away match", () => {
    expect(availabilityUpdate(season, away)).toContain("Their Team B v Our Team A");
  });

  it("groups the replies and sorts each group", () => {
    const summary = availabilityUpdate(season, mixed);
    expect(summary).toContain("Can play: Ada, Elin.");
    expect(summary).toContain("Can be a reserve: Gwen.");
    expect(summary).toContain("Not sure yet: Hollis.");
    expect(summary).toContain("Cannot play: Imre.");
  });

  it("names the people who have not replied at all", () => {
    // Everybody on the roster who is not in the replies, in one sorted list.
    const summary = availabilityUpdate(season, mixed);
    const answered = new Set(mixed.availability.map((entry) => entry.playerId));
    const silentOnes = season.players
      .filter((player) => !answered.has(player.playerId))
      .map((player) => player.name)
      .sort();
    expect(summary).toContain(`Not heard from: ${silentOnes.join(", ")}.`);
    expect(silentOnes.length).toBeGreaterThan(1);
  });

  it("says plainly that nobody is picked", () => {
    // Otherwise a list of "can play" reads as a team sheet.
    expect(message).toContain("Nobody is picked yet");
  });

  it("leaves out a group nobody is in", () => {
    const summary = availabilityUpdate(season, silent);
    expect(summary).not.toContain("Can play:");
    expect(summary).toContain("Not heard from:");
  });
});

describe("selectedTeam", () => {
  const message = selectedTeam(season, settled, selectionFor(season, settled));

  it("opens with a greeting, then names the fixture and where it is", () => {
    expect(message.startsWith("Morning all.\nHere is the team for next week's fixture:")).toBe(true);
    expect(message).toContain("Team for Their Team B v Our Team A, Wednesday 16 September");
    expect(message).toContain("away at Their Chess Club");
    expect(message).not.toMatch(/https?:\/\//);
  });

  it("asks the named players to confirm with a reaction rather than a reply", () => {
    // Eight people typing "yes" buries the team the message exists to publish.
    expect(message).toContain("Can all players and reserves please confirm");
    expect(message).toContain("React with 👍");
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
    expect(reserves).toBe(
      selection.reservePlayers
        .map((player) => season.players.find((p) => p.playerId === player.playerId)!.name)
        .join(", "),
    );
  });

  it("tells anybody who missed out that they move up next time", () => {
    expect(message).toContain("nearer the front next time");
  });

  it("says nothing consoling when everybody available is playing", () => {
    // Four boards, four volunteers, nobody left over: there is nobody to
    // console and the line would be addressed at no one. Exactly four is a
    // shape a real fixture only holds until the fifth person replies.
    const exact = withAvailability(settled, ["ada", "bruno", "elin", "farid"]);
    const message = selectedTeam(season, exact, selectionFor(season, exact));
    // Asserted first, because a message naming nobody also lacks the line, and
    // a fixture that quietly emptied would pass this test without testing it.
    expect(/Playing: (?:[^,.]+, ){3}[^,.]+\./.test(message)).toBe(true);
    expect(message).not.toContain("Reserves:");
    expect(message).not.toContain("nearer the front");
    // Nobody is in reserve, so there are no reserves to ask.
    expect(message).toContain("Can all players please confirm");
  });
});

describe("matchResult", () => {
  const played = won;

  it("is nothing at all until there is a result", () => {
    const pending = season.matches.find((match) => match.status === "scheduled")!;
    expect(matchResult(season, pending)).toBeNull();
  });

  it("leads with whether we won", () => {
    expect(matchResult(season, played)!.startsWith("A win:")).toBe(true);
    expect(matchResult(season, lost)!.startsWith("A loss:")).toBe(true);
  });

  it("writes the scoreline home side first", () => {
    // Ours is the away side here, so our score has to be the second number or
    // an away win reads as a defeat.
    const message = matchResult(season, awayWin)!;
    expect(message).toContain("Their Team B 1½ - 2½ Our Team A.");
    expect(message.startsWith("A win:")).toBe(true);
  });

  it("writes a bare half as a half", () => {
    expect(matchResult(season, played)).toContain("2½ - 1½");
    expect(matchResult(season, played)).not.toContain("0½");
  });

  it("gives every board, ours first, in board order", () => {
    const rows = matchResult(season, played)!
      .split("\n")
      .filter((line) => /^\d\./.test(line));
    expect(rows).toHaveLength(4);
    expect(rows[0]).toBe("1. Ada 1 - 0 V. One");
    expect(rows[1]).toBe("2. Bruno ½ - ½ W. Two");
  });

  it("marks a default rather than passing it off as a game", () => {
    expect(matchResult(season, defaulted)).toContain("(default)");
  });
});
