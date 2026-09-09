---
name: venue-details
description: Add or correct a club — its venue address, postcode, Google Maps link or website. Use when setting up a fixture against a new club, or when the captain shares venue details or says a club has moved.
---

# Club and venue details

One file per club, `content/clubs/<id>.json`, shared across every season because
the same clubs come round each year. The filename is the id and the loader
checks it. A club is who they are; the venue nested inside it is where they
meet, and the two are separate facts: Bristol Grendel is a club and it happens
to meet in a pub. The club also holds its people, which the `add-player` skill
covers.

```json
{
  "id": "south-bristol",
  "name": "South Bristol Chess Club",
  "links": { "website": "https://www.southbristolchess.com/" },
  "venue": {
    "name": "Bristol Independent Gaming",
    "address": "16 Cater Road, Bishopsworth",
    "postcode": "BS13 7TW",
    "maps": "https://maps.app.goo.gl/6u5Shrm81V4z2SNv7",
    "lat": 51.415681,
    "lon": -2.609972,
    "note": "Optional. One factual sentence useful to a visiting player."
  }
}
```

The venue is what makes a fixture findable: a match has no venue of its own, and
the site shows whichever club is at home. Adding a club is therefore part of
adding an opponent, not a separate errand.

## The one rule

**Never guess an address.** This field sends real people to a real building on a
weeknight, and a plausible wrong address is worse than no address at all. `null`
is a correct value; the site handles it, saying "address to be confirmed" and
building a map link that _searches_ for the club by name rather than asserting a
location.

Sources, in order of authority: the captain, the club's own site, the Bristol
league site at chessinbristol.uk, the ECF LMS. If two sources disagree, say so
and ask rather than picking one.

## Fields

- **`id`** — the club's name with "Chess Club" dropped and slugified:
  `south-bristol`. Every team of theirs hangs off it, so it is permanent.
- **`venue.name`** — the building, and only where it differs from the club:
  "The Sportsman's Bar (downstairs)". Null when a club meets in its own rooms,
  and then the site simply shows the club's name.
- **`venue.maps`** — a link somebody actually pasted, ideally a
  `maps.app.goo.gl` short link, which pins the exact building. Without one the
  site falls back to a name search, which is why a missing link degrades
  gracefully.
- **`venue.lat` / `venue.lon`** — both or neither; the loader rejects half a
  pair. They draw the map square, and null falls back to a link.
- **`links.website`** — the _chess club's_ page, not the pub's or the community
  centre's. Many clubs meet in a venue that has its own separate site.
- **`venue.note`** — where to find the room, the usual club night, parking. Only
  from a source; no filler.

## Afterwards

Run `make check`: the loader refuses a team whose `clubId` names no club. Then
check the venue block on a fixture page, and confirm the calendar download
carries the address, since that is where most people will read it.
