# The house design for published pages

Every page the guild publishes (roadmap, QA board, analysis page, flow stats, system map, project map) shares
one design, so a person who has seen one page can read the next. The source of truth is the code
block in `roadmap/roadmap-page.md`; this file says what a builder needs from it. If the two ever
differ, the roadmap page wins, and this file is the one to fix.

A new page starts from these tokens and adds no one-off colour, size or radius. Both themes
always. Every value that comes from the data is escaped (set with `textContent`, never
`innerHTML`).

## Tokens

Name them as the roadmap does. A page may add its own aliases for them (the QA board's `--pass`
is `--done`'s value), never a new value.

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| `--bg` | `#f4f5f7` | `#12161c` | page background |
| `--surface` | `#ffffff` | `#1a2029` | cards, panels |
| `--ink` | `#18202b` | `#e8ebf0` | text |
| `--muted` | `#5d6675` | `#9aa3b2` | secondary text, labels |
| `--line` | `#dde1e7` | `#2c3440` | borders, empty bars |
| `--accent` | `#6e2a4a` | `#d77fa6` | eyebrow, links, focus ring, selected state |
| `--done` / `--done-soft` | `#2f7d4f` / `#e4f2e9` | `#6cc990` / `#1b2e23` | finished |
| `--active` / `--active-soft` | `#1f5fa8` / `#e3edf9` | `#7fb2ee` / `#1a2638` | in progress |
| `--planned` / `--planned-soft` | `#5b5f86` / `#ebebf5` | `#a9acd6` / `#232437` | planned, not started |
| `--pending` / `--pending-soft` | `#9a6212` / `#f8eedc` | `#e0ad5c` / `#33291a` | waiting, or later |
| `--you` / `--you-soft` | `#b3261e` / `#fbe6e4` | `#f28b82` / `#3a1f1d` | needs the owner, failed, missing |
| `--f-body` | `"Fira Sans", "Helvetica Neue", Arial, sans-serif` | same | text |
| `--f-mono` | `"Fira Code", ui-monospace, "SF Mono", Menlo, monospace` | same | labels, numbers, pills |

Write the theme as three blocks, so the page follows the reader's setting and a page that sets
`data-theme` can override it:

```css
:root { /* light values; --bg through --f-mono */ }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* dark values */ color-scheme: dark; }
}
:root[data-theme="dark"] { /* the same dark values */ color-scheme: dark; }
```

## Type

Load the fonts with the link from the roadmap page, after `<title>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap">
```

Fira Sans is for text. Fira Code is for labels, numbers, dates and pills.

| Element | Font | Size and weight |
| --- | --- | --- |
| body | body | 15px, line height 1.5 |
| eyebrow | mono | 12px, uppercase, letter spacing .06em, `--accent` |
| h1 | body | `clamp(26px, 4vw, 34px)`, 700, letter spacing -.01em, `text-wrap: balance` |
| lede or headline | body | 15 to 16px, `--muted` for the lede, line length at most 72ch |
| section heading (h2) | body | 13px, 600, uppercase, letter spacing .07em, `--muted` |
| lane or group heading (h3) | body | 15px, 600 |
| card title | body | 14.5px, 500 (15.5px, 600 on a wide card) |
| card note | body | 13.5px, `--muted` |
| mono label, stamp, count | mono | 11 to 12px, `--muted`, `font-variant-numeric: tabular-nums` for numbers |
| pill, tag | mono | 11px |

## Status colours

Four states and one flag. Pages with other words map onto them; they do not add colours.

| Colour | Roadmap | QA board | Analysis page | Flow stats |
| --- | --- | --- | --- | --- |
| `--done` (green) | done, merged | pass | sourced; decided; chosen | accepted; a passing CI run |
| `--active` (blue) | in progress | not used | recommended | building time; medium findings; the skill a suggestion names |
| `--planned` (violet) | planned | open (no result yet) | not used | declined; review time; low findings |
| `--pending` (amber) | pending, waiting | blocked | assumption; open; for you to decide | proposed; fixing time; high findings; a flaky CI run |
| `--you` (red) | needs you | fail | gap; source missing | critical findings; a real CI failure |

An unknown value from the data gets the cautious colour, never the good one: the roadmap treats an
unknown status as pending, and the analysis page shows an unknown tag as a gap.

## Components

- **Pill**: mono 11px, padding `1px 7px`, fully rounded, `white-space: nowrap`, status colour on
  its soft background (`.s-done`, `.s-active`, `.s-planned`, `.s-pending`).
- **Tag**: mono 11px, `--muted`, 1px `--line` border, radius 4px, padding `0 5px`. The "needs
  you" flag is the same shape in `--you` on `--you-soft`.
- **Card**: `--surface`, 1px `--line` border, radius 8px, padding about `12px` (`14px 16px` on a
  page of wide cards), `min-width: 0`, text wrapped with `overflow-wrap: anywhere`. A card that
  waits on the owner takes a `--you` border.
- **Progress bar**: 4px high, radius 2px, `--line` track, `--done` fill, width clamped to 0 to
  100. Step strips are 3px segments, on in the status colour.
- **Notice** (empty or loading): `--surface`, 1px dashed `--line` border, radius 8px, padding
  `14px 16px`, `--muted` text.
- **Focus ring**: `outline: 2px solid var(--accent); outline-offset: 2px` on every control, shown
  with `:focus-visible`. Never remove an outline without giving one back.
- Hover changes only the border colour, and only when motion is allowed (`prefers-reduced-motion`).

## Layout

- One centred `.wrap`: `max-width` 1280px for a board, 980px for a list, 820px for reading; side
  gutter 16px or more, written `max(16px, env(safe-area-inset-left, 0px))` on the left and the
  same with `right` on the right, so a notched phone never clips text; vertical padding `28px 56px`
  (`20px 40px` at phone width); sections 28px apart, items inside a section 8 to 14px apart.
- Boards use a grid of equal `minmax(0, 1fr)` columns, so long words cannot widen a lane.
- Breakpoints: four lanes above 1020px, two lanes to 620px, one lane below. A list page is one
  column at every width.
- Nothing scrolls sideways at phone width. A wide table or diagram scrolls inside its own box.

## Rules

1. Copy the page template unchanged. Change its tokens only where the project has a brand (below).
2. A new page adds no colour, font size or radius outside this file. For anything this file does
   not list, the shipped templates are the reference.
3. Light and dark always, with the three theme blocks.
4. Every value from the data goes in with `textContent`, or is escaped before it goes in as HTML.
5. If the project already has a design system or a brand, ask the owner once whether its pages use
   the house look or the project's. If the project's: only the token values change, and the
   structure, class names and script stay as they are.
