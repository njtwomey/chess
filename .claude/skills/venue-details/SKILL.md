---
name: venue-details
description: Add or correct a club venue — address, postcode, Google Maps link or website. Use when setting up a fixture against a new club, or when the captain shares venue details or says a club has moved.
---

# Venue details

`content/venues.json` is shared across every season, because the same clubs come
round each year.

```json
{
  "id": "south-bristol",
  "name": "South Bristol Chess Club",
  "address": "Bristol Independent Gaming, 16 Cater Road, Bishopsworth",
  "postcode": "BS13 7TW",
  "maps": "https://maps.app.goo.gl/6u5Shrm81V4z2SNv7",
  "website": null,
  "note": "Optional. One factual sentence useful to a visiting player."
}
```

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

- **`maps`** — a link somebody actually pasted, ideally a `maps.app.goo.gl`
  short link, which pins the exact building. Without one the site falls back to a
  name search, which is why a missing link degrades gracefully.
- **`website`** — the _chess club's_ page, not the pub's or the community
  centre's. Many clubs meet in a venue that has its own separate site.
- **`note`** — where to find the room, the usual club night, parking. Only from a
  source; no filler.

## Distinguishing the club from the building

`name` is the club, because that is what a player is looking for and what a map
search should match. Put the building in `address` where it is part of finding
the place, as with "Bristol Independent Gaming, 16 Cater Road".

## Afterwards

Run `make check`: the loader refuses a match that names a venue id which is not
here. Then check the venue block on `/season/<id>/schedule`, and confirm the
calendar download carries the address, since that is where most people will read
it.
