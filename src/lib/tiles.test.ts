import { describe, expect, it } from "vitest";
import { osmUrl, project, TILE_SIZE, tilesAround, tileUrl } from "@/lib/tiles";

describe("project", () => {
  it("puts null island in the middle of the world", () => {
    // At zoom 1 the world is 2x2 tiles, so 0,0 lands exactly on the corner
    // where all four meet.
    expect(project(0, 0, 1)).toEqual({ x: 1, y: 1 });
  });

  it("puts the far west at zero and the far east at the edge", () => {
    expect(project(0, -180, 1).x).toBeCloseTo(0);
    expect(project(0, 180, 1).x).toBeCloseTo(2);
  });

  it("puts north above south, because y grows downwards", () => {
    expect(project(60, 0, 8).y).toBeLessThan(project(-60, 0, 8).y);
  });

  it("places our home venue in the right tile", () => {
    // 99 Oldfield Road, Hotwells. Checked against the tile openstreetmap.org
    // serves for that address.
    const { x, y } = project(51.449421, -2.620344, 16);
    expect(Math.floor(x)).toBe(32290);
    expect(Math.floor(y)).toBe(21809);
  });
});

describe("tilesAround", () => {
  const bristol = { lat: 51.449421, lon: -2.620344 };

  it("draws a 3x3 block by default", () => {
    expect(tilesAround(bristol.lat, bristol.lon, 16)).toHaveLength(9);
  });

  it("puts the middle tile across the centre of the box", () => {
    const tiles = tilesAround(bristol.lat, bristol.lon, 16);
    // The tile containing the point straddles the centre, so its top-left
    // corner is up and to the left of it, by less than one tile.
    const middle = tiles.filter(
      (tile) => tile.left > -TILE_SIZE && tile.left <= 0 && tile.top > -TILE_SIZE && tile.top <= 0,
    );
    expect(middle).toHaveLength(1);
  });

  it("lays the block out on a regular grid", () => {
    const tiles = tilesAround(bristol.lat, bristol.lon, 16);
    const lefts = [...new Set(tiles.map((tile) => Math.round(tile.left)))].sort((a, b) => a - b);
    expect(lefts).toHaveLength(3);
    expect(lefts[1]! - lefts[0]!).toBe(TILE_SIZE);
    expect(lefts[2]! - lefts[1]!).toBe(TILE_SIZE);
  });

  it("drops tiles off the top and bottom of the world rather than asking for them", () => {
    // Near the pole there is no tile above the first row.
    expect(tilesAround(85, 0, 1).length).toBeLessThan(9);
  });

  it("wraps round the date line instead of asking for a tile that is not there", () => {
    for (const tile of tilesAround(0, 179.99, 2)) {
      const x = Number(tile.url.split("/").at(-2));
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(4);
    }
  });
});

describe("urls", () => {
  it("builds a tile url the way the tile server expects", () => {
    expect(tileUrl(32297, 21787, 16)).toBe("https://tile.openstreetmap.org/16/32297/21787.png");
  });

  it("links the attribution back to the point on OpenStreetMap", () => {
    const url = osmUrl(51.449421, -2.620344, 16);
    expect(url).toContain("mlat=51.449421");
    expect(url).toContain("mlon=-2.620344");
    expect(url).toContain("#map=16/");
  });
});
