import { describe, expect, it } from "vitest";
import { moveCount } from "@/lib/pgn";

describe("moveCount", () => {
  it("counts the moves White made", () => {
    expect(moveCount("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6")).toBe(3);
    expect(moveCount("1. e4 e5 2. Nf3")).toBe(2);
  });

  it("is not fooled by a continuation marker", () => {
    // "32..." is the same move as "32.", written again for the reply.
    expect(moveCount("31. Qc3 Qe3+ 32. Kh2 32... g4")).toBe(2);
  });

  it("ignores a date inside a comment", () => {
    expect(moveCount("1. e4 e5 { stopped here on 2026.10.05 } *")).toBe(1);
  });

  it("is zero for no moves at all", () => {
    expect(moveCount("")).toBe(0);
  });
});
