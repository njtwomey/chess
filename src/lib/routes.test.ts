/**
 * Splitting a URL into a season and a page.
 *
 * A season id is itself a path, so the site cannot tell where the id ends and
 * the page begins by counting slashes. This is the lookup that does it, and
 * every link on the site is built on the other side of it, so a quiet failure
 * here would land readers on the front page from every deep link at once.
 */
import { describe, expect, it } from "vitest";
import { seasonPath, splitSeasonPath } from "@/components/season-context";
import { activeSeason } from "@/lib/data";

const id = activeSeason.id;

describe("splitSeasonPath", () => {
  it("finds a season on its own", () => {
    expect(splitSeasonPath(`/season/${id}`)).toMatchObject({ page: "" });
    expect(splitSeasonPath(`/season/${id}`)?.season.id).toBe(id);
  });

  it("keeps whatever follows the season, however deep", () => {
    expect(splitSeasonPath(`/season/${id}/schedule`)?.page).toBe("schedule");
    expect(splitSeasonPath(`/season/${id}/fixture-1`)?.page).toBe("fixture-1");
    expect(splitSeasonPath(`/season/${id}/fixture-1/board-3`)?.page).toBe("fixture-1/board-3");
  });

  it("round-trips whatever seasonPath builds", () => {
    for (const page of [undefined, "team", "fixture-2/board-1"]) {
      const found = splitSeasonPath(seasonPath(id, page));
      expect(found?.season.id).toBe(id);
      expect(found?.page).toBe(page ?? "");
    }
  });

  it("is nothing at all for a path that names no season", () => {
    expect(splitSeasonPath("/clubs")).toBeNull();
    expect(splitSeasonPath("/season/not-a-season/schedule")).toBeNull();
    // A prefix of the id is not the id: three of the four segments is not a
    // season, and matching it would put the fourth into the page.
    expect(splitSeasonPath(`/season/${id.split("/").slice(0, 3).join("/")}`)).toBeNull();
  });

  it("ignores a trailing slash rather than reading it as a page", () => {
    expect(splitSeasonPath(`/season/${id}/`)?.page).toBe("");
  });
});
