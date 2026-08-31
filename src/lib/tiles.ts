/**
 * Slippy-map arithmetic, for drawing a small map out of OpenStreetMap tiles.
 *
 * There is no iframe and no map library here. OSM's own embed is a whole
 * Leaflet page per map, which is a lot of machinery to show one building and
 * did not render reliably; a tile is just a PNG at a URL, and a handful of them
 * positioned correctly is the entire map. That also means `loading="lazy"`
 * works properly and there is nothing to load for a venue nobody scrolls to.
 *
 * The maths is the standard Web Mercator projection, and it is here rather than
 * inline in the component because an off-by-one in it puts the marker on the
 * wrong street and that is worth testing.
 */

export const TILE_SIZE = 256;

/** Fractional tile coordinates: the whole number is the tile, the rest is the offset within it. */
export function project(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const radians = (lat * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * n,
  };
}

export function tileUrl(x: number, y: number, zoom: number): string {
  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

export interface Tile {
  key: string;
  url: string;
  /** Pixels from the centre of the map, where the venue sits. */
  left: number;
  top: number;
}

/**
 * The tiles around a point, positioned relative to the centre of the container.
 *
 * `radius` is how many tiles to draw either side of the middle one, so 1 gives
 * a 3x3 block of 768px, which covers every place this is used. Tiles that would
 * fall off the edge of the world are dropped rather than requested, because the
 * tile server answers those with an error image.
 */
export function tilesAround(lat: number, lon: number, zoom: number, radius = 1): Tile[] {
  const { x, y } = project(lat, lon, zoom);
  const centreX = Math.floor(x);
  const centreY = Math.floor(y);
  // Where the point sits inside its own tile.
  const offsetX = (x - centreX) * TILE_SIZE;
  const offsetY = (y - centreY) * TILE_SIZE;
  const limit = 2 ** zoom;

  const tiles: Tile[] = [];
  for (let i = -radius; i <= radius; i += 1) {
    for (let j = -radius; j <= radius; j += 1) {
      const tileX = centreX + i;
      const tileY = centreY + j;
      if (tileY < 0 || tileY >= limit) continue;
      // Longitude wraps, latitude does not.
      const wrappedX = ((tileX % limit) + limit) % limit;
      tiles.push({
        key: `${tileX},${tileY}`,
        url: tileUrl(wrappedX, tileY, zoom),
        left: i * TILE_SIZE - offsetX,
        top: j * TILE_SIZE - offsetY,
      });
    }
  }
  return tiles;
}

/** The OpenStreetMap page for a point, which the attribution has to link to. */
export function osmUrl(lat: number, lon: number, zoom: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=${zoom}/${lat}/${lon}`;
}
