# Etappli — Design & Objectives

> Status legend: 📋 planned · 🚧 in progress · ✅ implemented · ❌ abandoned
> Last updated: 20/10/2026

## 1. Vision

Etappli is a small portfolio app to sum up and discover all my creations on the web.
The presentation is as much a showcase as the content itself: browsing the projects
should feel like a mini game.

- **Target users:** recruiters (to promote my skills) and friends (for the fame).
  Must look great on phone and desktop.
- **Core problem:** offer a beautiful, easy-to-access experience where the form
  promotes my skills as much as the content does.
- **Success looks like:** people enjoy scrolling through the content like a mini game.

## 2. Objectives

### Project steps (in order)

- [x] **0. Angular modernization:** ✅ `client/` is standalone + zoneless + signals
      (`bootstrapApplication` + `app.config.ts`, no `zone.js`).
- [x] **1. Basic frames:** ✅ use the server's JSON file to build a scrollable list of basic
      project frames with information and images (snap scrolling). Native CSS scroll-snap,
      one frame per project, horizontal image strip, year-0 entries skipped. Kept as the
      **simple / low-spec version** (`/simple`, and the default under `prefers-reduced-motion`).
- [ ] **2. Space canvas:** 🚧 add an animated space background on a canvas, centered on a
      spaceship that travels into the frames as if they were stations. First spike built on the
      one-camera stage (see section 4). The ship flies **up** from the center of the screen: the
      next station comes down from above. It enters through a door in the bottom of the hull and
      leaves through the top one; the doors slide open ahead of the ship, vent gas and close behind it.
- [ ] **3. Stations:** 🚧 a station shows only its textured hull, title and image carousel (1.5:1);
      once the ship is docked inside (hidden behind the image), it expands to reveal the details.
      Phone / portrait: the description opens upward under the title, context and technos open
      downward. Landscape / desktop: they open on the left and right sides. Each panel scrolls on
      its own. A move starts at once and the panels close as the station moves away.
- [ ] **4. Planet phase / categories:** offer several paths, each showing a single
      category. The planet is used as a dial to choose the category, then the ship is launched.
- [ ] **5. Intro:** a short introduction that zooms out from the ship and hints at what
      visitors are about to discover and how to explore.

### Later

- 📋 English version: French by default, switched with a request param and/or a button.
- 🚧 Low-spec mode: more static display with minimal animations for weak devices. The step 1
  version is the fallback; automatic detection and a manual toggle are still to do.
- 📋 Use AI to bring back old projects with dead code or unavailable dependencies so people
  can try them.
- 📋 Unify the data format (see section 3).

### Non-goals

- No admin UI or CMS: the content is edited by hand in the JSON files. The app is display only.
- No user accounts or authentication.
- No backend logic beyond serving the app, data and images.

## 3. Domain model

| Entity   | Description                                                         | Key relations                               |
| -------- | ------------------------------------------------------------------- | ------------------------------------------- |
| Project  | One creation, displayed as a **station**                            | belongs to a Category, has Images, Technos  |
| Category | Topic/path the user picks with the planet dial (games, tools, pro…) | has many Projects                           |
| Techno   | A technology used, with a mastery `level` (1–5, `Level` enum)       | many per Project                            |
| Image    | Screenshot shown in the station carousel                            | `images: n` = number of images of a Project |

**Current data** (`assets/data/apps_game.json`), one object per project:

```jsonc
{
  "name": "Battle Cruiser",
  "description": "…", // what the project is (French)
  "context": "…", // what I learned / why it was made (French)
  "year": 2013,
  "month": 5, // year 0 = no date (category-like entries)
  "hours": 10, // time spent
  "images": 4, // image count
  "technos": [{ "name": "Canvas", "level": 2 }],
}
```

🚧 Format migration: `assets/data/origin_pro.js` and `origin_tool.js` use an older format
(`long`, `skills`, `link`, `hide`, `img`, `date`, `time`) and will be converted to the JSON
format above later. Until then, do not build features against the old format.

**Glossary**

- **Spaceship / ship:** the central character on screen. It travels into stations to reveal
  their content; animations are built around it.
- **Station:** a frame representing one project. Stations are the ship's destinations and are
  scrolled one at a time, like YouTube Shorts.
- **Space:** the canvas background with animations while scrolling.
- **Planet / planet phase:** the category selection screen. The planet acts as a dial.
- **Warp:** going back from the stations to the planet phase to pick another category.
- **Intro:** the short opening sequence before the planet phase.

## 4. Architecture

- **Frontend** `client/`: Angular 22 + plain 2D Canvas for the space scene.
  - ✅ Standalone + zoneless + signals (`main.ts` → `bootstrapApplication`, `app.config.ts`).
  - Layout: `core/models`, `core/services`, `core/components`, `pages/` (lazy routes).
  - Data is fetched as static files (`/assets/data/apps_game.json`) with `httpResource`;
    in dev, `ng serve` proxies `/assets` to the Express server (`client/proxy.conf.json`).
- **Stage (stations, later planet and intro): "one camera" rendering.**
  - No native scroll. An input controller turns wheel, touch swipes and keyboard into moves
    of a single number, `camera` (in station units: 2.37 = between station 2 and 3).
  - The camera animates toward whole numbers with our own easing and duration, so travel speed
    is exact and tunable. On touch it follows the finger 1:1, then snaps on release.
  - One `requestAnimationFrame` loop renders everything from `camera` in the same frame:
    the **canvas** draws the world (space layers, ship, station hulls), and the **HTML panels**
    (station content) are moved with `transform`. Both come from the same layout function,
    so they cannot drift apart.
  - Angular renders the panels once; the frame loop writes styles directly to element refs and
    never sets signals per frame. Signals only carry discrete state (current station, later
    expanded state and category).
  - The station layout (`stationLayout` / `openStation`) gives the compact and open geometry;
    the canvas hull and the HTML station (`core/components/station`) are both placed from it.
    `StationDock` runs the docking sequence (ship stops → panels open → text fades in; a move
    closes the panels while the camera travels).
  - Code: `core/stage/` (camera, input, layout, dock, renderer, tuning constants in
    `stage.config.ts`), page `pages/stage/`.
- **Backend** `server/`: Node + Express, minimal TypeScript server.
- **Data** JSON and images in `assets/data` (root), served by the server.
- **Images** Every app many images in `assets/images/apps` with format "app_name X.jpg"
- **Auth** none, free for all public users.
- **Hosting / deployment** self-hosted, manual deploy with WinSCP and PuTTY.
  Source code is open source on GitHub.

## 5. Key user flows & interactions

1. **Intro:** plays on every start. Scrolling once skips it and goes to the planet phase.
2. **Planet phase:** the screen is split into two zones:
   - scrolling on the **left** part changes the mode/category (the planet turns like a dial);
   - scrolling on the **right** part triggers the first scroll: the ship launches toward the
     first station of the chosen category.
3. **Station scrolling:** scrolling snaps to one project at a time for the best display,
   but the transition is slow enough to show the ship traveling between stations.
4. **Station lifecycle:**
   - approaching: the station shows its hull, title and image carousel;
   - ship inside (hidden behind the image): as soon as it stops the station expands, then the
     details fade in;
   - ship leaving (next scroll): the ship leaves at once while the details fade out and the panels collapse.
5. **Warp back:** return to the planet phase to choose another category.

Inputs: touch swipe on phone (swipe up = forward, like steering the ship); mouse wheel on desktop
(scroll up = forward, `STAGE.wheelDirection`); keyboard (Arrow Up / Page Up / Space = forward, Arrow Down / Page Down /
Shift+Space = back, Home/End). A wheel or trackpad gesture moves one station at most; one extra move can be queued
during travel. Panel content scrolls natively first, and the stage takes over at its edges.

## 6. Decisions (ADR-lite)

| Date       | Decision                             | Why                                           | Alternatives rejected                     |
| ---------- | ------------------------------------ | --------------------------------------------- | ----------------------------------------- |
| 02/10/2026 | Zoneless Angular with signals        | Simpler change detection, better perf         | Zone.js                                   |
| 02/10/2026 | Data and images served via `assets/` | Faster front build time and faster deployment | Content in `client/`                      |
| 02/10/2026 | Plain 2D Canvas for the space scene  | Performance, no dependency (not set in stone) | WebGL / PixiJS (to re-evaluate if needed) |
| 02/10/2026 | Static JSON files, no database       | Display only, content edited by hand          | Database + admin UI                       |
| 02/10/2026 | French by default                    | Main audience; English later                  | —                                         |
| 02/10/2026 | One camera drives canvas + HTML panels, no native scroll | Native scroll runs on the compositor thread and the canvas lags one or more frames behind (visual glitches); one rAF loop rendering both from the same value is always in sync, and travel speed is fully controlled | Native scroll with the canvas following it (desync); 100% canvas (text layout, links, accessibility and SEO by hand) |

## 7. Constraints

- **Performance:** must be beautiful but run smoothly on phones. Plan a degraded mode for
  low-spec devices (more static display, minimal animations).
- **Browser / device support:** optimized for phones (mobile-first), still pretty and usable
  on desktop.
- **Budget / infra:** self-hosted.
- **Legal / licensing:** free, open source on GitHub. No personal data collected.

## 8. Open questions

- [ ] Visual style (palette, ship design, references): WIP, mockups to add in `docs/` later.
- [ ] How is the low-spec mode triggered: automatic detection, `prefers-reduced-motion`,
      a manual toggle, or all of them? (`prefers-reduced-motion` and the `/simple` route done;
      automatic detection and a toggle still open.)
- [x] Keyboard navigation on desktop (arrow keys)? Yes, see section 5.
- [ ] How is a project's category stored once the data format is unified (a field, or one
      file per category)?
- [ ] Does a station link to a playable version of the project?
- [ ] How to warp back: a dedicated gesture, a button, or scrolling past the last station?
