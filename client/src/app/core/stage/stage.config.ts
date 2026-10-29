/** Every tuning knob of the stage in one place. */
export const STAGE = {
  /** Distance between two stations, as a multiple of the viewport height. > 1 leaves empty space to fly through. */
  stationSpacing: 1.3,
  /** Travel time for one station with a wheel / key step (ms). */
  travelMs: 1200,
  /** Travel time for a full station after a touch release (scaled by the remaining distance). */
  releaseMs: 800,

  /** Height of the HUD band at the top, kept clear of the open stations (px). */
  topZone: 56,
  /** Margin around the stations (px). */
  margin: 16,
  /** Docked station center (the ship's place), as a fraction of the viewport height. */
  centerY: 0.53,
  /** Scale of a station when it is one station away (1 when docked). */
  awayScale: 0.94,

  /** Station geometry (px). Compact: title bar + image in a hull border. */
  station: {
    /** Image width / height, and max image width. */
    imageRatio: 1.5,
    maxImage: 900,
    /** Max image height as a share of the viewport, when the panels open up and down (phone). */
    imageHeightRatio: 0.42,
    titleHeight: 48,
    /** Hull border around the station (the doors are cut in it). */
    border: 14,
    /** Space between the image and an open panel. */
    gap: 8,
    /** The panels open on the sides on landscape screens, or from this width... */
    rowMinWidth: 900,
    /** ...if a side panel gets at least this width. */
    sidePanelMinWidth: 220,
    sidePanelMaxWidth: 300,
  },
  /** Docking sequence: the panels open as soon as the ship stops, and close before it leaves (ms). */
  dock: { openMs: 450, closeMs: 280 },

  /** Wheel direction: 1 = scroll down moves forward, -1 = scroll up moves forward (the ship flies up). */
  wheelDirection: -1,
  /** Accumulated wheel delta (px) needed to start a move. */
  wheelThreshold: 40,
  /** Pause between wheel events (ms) that starts a new gesture. */
  wheelGestureGap: 160,
  /** Finger travel (px) before a touch is classified as drag / native scroll. */
  touchSlop: 8,
  /** Release speed (px/ms) that counts as a flick to the next station. */
  flickVelocity: 0.35,
  /** Fraction of a station dragged that moves to the next one without a flick. */
  dragCommit: 0.25,
  /** Resistance when dragging past the first / last station. */
  edgeResistance: 0.3,

  /** Parallax speed of each star layer, relative to the panels (1). */
  starLayers: [
    { speed: 0.06, density: 1 / 2600, minRadius: 0.3, maxRadius: 0.8 },
    { speed: 0.2, density: 1 / 9000, minRadius: 0.6, maxRadius: 1.2 },
  ],
  /** Station doors: they open ahead of the ship (venting gas) and close behind it. */
  doors: {
    /** Time to fully open or close (ms). */
    openMs: 260,
    /** Distance ahead of the ship (in stations) where a door starts opening. */
    approach: 0.4,
    /** Gas burst when a door opens: small particles blown out of the opening. */
    vent: {
      /** Burst duration (ms); each particle lives 45 to 100% of it. */
      ms: 1200,
      /** Particle count per burst (0 = no vent). Cost is one small arc per particle per frame. */
      particles: 80,
      /** Particle radius (px), before the random variation (x0.6 to x1.4) and the growth as it fades. */
      size: 1.3,
      /** Max distance a particle travels (px). */
      reach: 80,
    },
  },
  /** Close stars drawn every frame, stretched by speed. */
  nearStars: { speed: 0.55, count: 70, streak: 0.06 },
  maxPixelRatio: 2,
} as const;
