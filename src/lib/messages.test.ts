import { describe, expect, it } from "vitest";
import { seasonById } from "@/lib/data";
import { availabilitySummary, callToAction, describeRound } from "@/lib/messages";

const season = seasonById.get("2026-autumn-g")!;
const first = season.matches.find((match) => match.id === "r1")!;
const away = season.matches.find((match) => match.id === "r3")!;

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

  it("asks the question first", () => {
    expect(message.startsWith("Who can play in the first fixture of the season?")).toBe(true);
  });

  it("names the fixture the way the league does, home side first", () => {
    expect(message).toContain("Bristol & Clifton G v South Bristol D");
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

describe("availabilitySummary", () => {
  const message = availabilitySummary(season, first);

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
    const quiet = season.matches.find((match) => match.id === "r2")!;
    const summary = availabilitySummary(season, quiet);
    expect(summary).not.toContain("Can play:");
    expect(summary).toContain("Not heard from:");
  });
});
