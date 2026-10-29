import { openStation, shipPosition, stationCenter, StationLayout, StationPose, Viewport } from './stage-layout';
import { STAGE } from './stage.config';

export interface SceneFrame {
  /** rAF timestamp (ms). */
  time: number;
  camera: number;
  /** Stations per second (signed). */
  velocity: number;
  /** End of the current travel (the camera itself at rest, null while dragging). */
  destination: number | null;
  layout: StationLayout;
  stations: ReadonlyArray<StationPose>;
  /** Station whose panels are opening or open, and how far (0 to 1, eased). */
  openIndex: number;
  open: number;
}

interface NearStar {
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

interface Door {
  /** 0 closed, 1 open. */
  open: number;
  target: 0 | 1;
  /** Time (ms) the door last started opening, and the random seed of that gas burst. */
  ventAt: number;
  ventSeed: number;
}

interface StationDoors {
  top: Door;
  bottom: Door;
}

// Placeholder palette, kept in sync with styles.scss until the visual style is decided.
const SPACE = '#05060f';
const ACCENT = '124, 196, 255';
const WARNING = '255, 176, 70';
const HULL = '#232b52';
const DOOR = '#5d6db0';

// Station details (CSS px). The doors are cut in the hull border, the hangar is behind the image.
const BRACKET_GAP = 8;
const HULL_RADIUS = 14;
const DOOR_HALF = 26;
const TEXTURE_SIZE = 96;
/** Vent jets: angle out of the station from the horizontal, and half-width of the cone (radians). */
const JET_TILT = 0.45;
const JET_SPREAD = 0.3;

// Ship geometry (CSS px from its center): nose up, engine below.
const SHIP_NOSE = 20;
const SHIP_TAIL = 12;
/** Speed (stations per second) under which the ship counts as stopped. */
const MOVING = 0.05;
/** Half-turn time when the ship reverses in open space (ms); hidden inside a station it turns at once. */
const TURN_MS = 260;

/**
 * Plain 2D canvas drawing of the stage world. Static star layers and the hull texture are
 * pre-rendered once per resize, so a frame is a few `drawImage` calls plus the close stars,
 * station hulls and the ship. Everything is under the HTML stations: the ship disappears
 * behind the image once it is inside a station.
 */
export class SpaceRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private viewport: Viewport = { width: 0, height: 0 };
  private pixelRatio = 1;
  private background: HTMLCanvasElement | null = null;
  private layers: Array<{ canvas: HTMLCanvasElement; speed: number }> = [];
  private nearStars: Array<NearStar> = [];
  private hullTexture: CanvasPattern | string = HULL;
  private readonly doors = new Map<number, StationDoors>();
  private lastTime: number | null = null;
  /** Ship rotation: 0 nose up (forward), PI nose down (going back). */
  private heading = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('2D canvas is not supported');
    }
    this.ctx = ctx;
  }

  resize(viewport: Viewport, devicePixelRatio: number): void {
    this.viewport = viewport;
    this.pixelRatio = Math.min(devicePixelRatio, STAGE.maxPixelRatio);
    this.canvas.width = Math.round(viewport.width * this.pixelRatio);
    this.canvas.height = Math.round(viewport.height * this.pixelRatio);

    const random = seededRandom(42);
    this.background = this.renderBackground();
    this.layers = STAGE.starLayers.map((layer) => ({
      canvas: this.renderStarLayer(random, layer.density, layer.minRadius, layer.maxRadius),
      speed: layer.speed,
    }));
    this.nearStars = Array.from({ length: STAGE.nearStars.count }, () => ({
      x: random() * viewport.width,
      y: random() * viewport.height,
      radius: 0.8 + random() * 0.9,
      alpha: 0.5 + random() * 0.5,
    }));
    this.hullTexture = this.renderHullTexture(seededRandom(7));
  }

  render(frame: SceneFrame): void {
    const { ctx } = this;
    const { width, height } = this.viewport;
    if (!width || !height || !this.background) {
      return;
    }
    const dt = this.lastTime === null ? 16 : Math.min(Math.max(frame.time - this.lastTime, 0), 100);
    this.lastTime = frame.time;
    const cameraPx = frame.camera * height * STAGE.stationSpacing;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.background, 0, 0);
    for (const layer of this.layers) {
      this.drawTiled(layer.canvas, cameraPx * layer.speed);
    }

    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.updateHeading(frame, dt);
    this.drawNearStars(cameraPx, frame.velocity);
    for (const station of frame.stations) {
      if (station.visible) {
        this.drawStation(frame, station, dt);
      } else {
        this.doors.delete(station.index);
      }
    }
    this.drawShip(frame);
  }

  // ---- Pre-rendered layers (device pixels) ----

  private createLayer(width = this.canvas.width, height = this.canvas.height): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const layer = this.canvas.ownerDocument.createElement('canvas');
    layer.width = width;
    layer.height = height;
    const ctx = layer.getContext('2d');
    if (!ctx) {
      throw new Error('2D canvas is not supported');
    }
    ctx.scale(this.pixelRatio, this.pixelRatio);
    return [layer, ctx];
  }

  private renderBackground(): HTMLCanvasElement {
    const [layer, ctx] = this.createLayer();
    const { width, height } = this.viewport;
    ctx.fillStyle = SPACE;
    ctx.fillRect(0, 0, width, height);
    const nebulas = [
      { x: 0.2, y: 0.25, r: 0.7, color: '70, 40, 140', alpha: 0.22 },
      { x: 0.85, y: 0.7, r: 0.6, color: '20, 70, 140', alpha: 0.2 },
    ];
    for (const n of nebulas) {
      const radius = Math.max(width, height) * n.r;
      const gradient = ctx.createRadialGradient(n.x * width, n.y * height, 0, n.x * width, n.y * height, radius);
      gradient.addColorStop(0, `rgba(${n.color}, ${n.alpha})`);
      gradient.addColorStop(1, `rgba(${n.color}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
    return layer;
  }

  private renderStarLayer(random: () => number, density: number, minRadius: number, maxRadius: number): HTMLCanvasElement {
    const [layer, ctx] = this.createLayer();
    const { width, height } = this.viewport;
    const count = Math.round(width * height * density);
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = `rgba(220, 230, 255, ${0.35 + random() * 0.6})`;
      ctx.beginPath();
      ctx.arc(random() * width, random() * height, minRadius + random() * (maxRadius - minRadius), 0, Math.PI * 2);
      ctx.fill();
    }
    return layer;
  }

  /** Riveted metal plates, tiled over the hulls. */
  private renderHullTexture(random: () => number): CanvasPattern | string {
    const size = TEXTURE_SIZE;
    const pixels = Math.round(size * this.pixelRatio);
    const [tile, ctx] = this.createLayer(pixels, pixels);
    ctx.fillStyle = HULL;
    ctx.fillRect(0, 0, size, size);

    // Grain.
    for (let i = 0; i < 260; i++) {
      const light = random() > 0.5;
      ctx.fillStyle = light ? `rgba(200, 210, 255, ${random() * 0.06})` : `rgba(0, 0, 10, ${random() * 0.18})`;
      ctx.fillRect(random() * size, random() * size, 1 + random() * 3, 1);
    }

    // Plate seams: two rows, the lower one offset like bricks.
    const half = size / 2;
    const seams: Array<[number, number, number, number]> = [
      [0, 0, size, 0],
      [0, half, size, half],
      [0, 0, 0, half],
      [half, half, half, size],
    ];
    for (const [x1, y1, x2, y2] of seams) {
      ctx.strokeStyle = 'rgba(0, 0, 12, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1 + 0.5, y1 + 0.5);
      ctx.lineTo(x2 + 0.5, y2 + 0.5);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(190, 205, 255, 0.08)';
      ctx.beginPath();
      ctx.moveTo(x1 + 1.5, y1 + 1.5);
      ctx.lineTo(x2 + 1.5, y2 + 1.5);
      ctx.stroke();
    }

    // Rivets along the seams.
    for (const [x, y] of [[6, 6], [42, 6], [6, 42], [42, 42], [54, 54], [90, 54], [54, 90], [90, 90]]) {
      ctx.fillStyle = 'rgba(0, 0, 12, 0.5)';
      ctx.beginPath();
      ctx.arc(x + 0.6, y + 0.6, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(200, 212, 255, 0.35)';
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    const pattern = this.ctx.createPattern(tile, 'repeat');
    if (!pattern) {
      return HULL;
    }
    // The tile is drawn in device pixels: scale it back to CSS px.
    pattern.setTransform(new DOMMatrix().scaleSelf(1 / this.pixelRatio));
    return pattern;
  }

  /** Draws a full-screen layer moved down by `offset` CSS px, wrapping vertically. */
  private drawTiled(layer: HTMLCanvasElement, offset: number): void {
    const tileHeight = layer.height;
    // Whole device pixels: sub-pixel offsets would resample (and shimmer) the stars every frame.
    const y = Math.round(mod(offset * this.pixelRatio, tileHeight));
    this.ctx.drawImage(layer, 0, y);
    this.ctx.drawImage(layer, 0, y - tileHeight);
  }

  // ---- Per-frame drawing (CSS px) ----

  private drawNearStars(cameraPx: number, velocity: number): void {
    const { ctx } = this;
    const { height } = this.viewport;
    const { speed, streak } = STAGE.nearStars;
    // Stars move down while travelling forward (the ship flies up), so the trail is drawn above them.
    const trail = velocity * height * STAGE.stationSpacing * streak;
    ctx.lineCap = 'round';
    for (const star of this.nearStars) {
      const y = mod(star.y + cameraPx * speed, height);
      ctx.strokeStyle = `rgba(230, 238, 255, ${star.alpha})`;
      ctx.lineWidth = star.radius * 2;
      ctx.beginPath();
      ctx.moveTo(star.x, y);
      ctx.lineTo(star.x, y - trail - 0.01);
      ctx.stroke();
    }
  }

  private drawStation(frame: SceneFrame, station: StationPose, dt: number): void {
    const { ctx } = this;
    const { time } = frame;
    const { border } = STAGE.station;
    const { hull } = openStation(frame.layout, station.index === frame.openIndex ? frame.open : 0);
    const center = stationCenter(this.viewport);
    const centerY = center.y + station.offsetY;
    const topDoorY = hull.y + border / 2;
    const bottomDoorY = hull.y + hull.height - border / 2;

    // Doors follow the ship, in station coordinates.
    const shipY = (shipPosition(this.viewport).y - centerY) / station.scale;
    const spacing = this.viewport.height * STAGE.stationSpacing;
    // Ship travel left, in station px: a door it won't reach stays closed (the arrival station's far door).
    const reach = frame.destination === null ? Infinity : (Math.abs(frame.destination - frame.camera) * spacing) / station.scale;
    const approach = Math.min((spacing * STAGE.doors.approach) / station.scale, reach + SHIP_NOSE);
    const extent = this.shipExtent(frame.velocity);
    const doors = this.stationDoors(station.index);
    this.updateDoor(doors.top, doorTarget(shipY - topDoorY, frame.velocity, approach, extent), time, dt);
    this.updateDoor(doors.bottom, doorTarget(shipY - bottomDoorY, frame.velocity, approach, extent), time, dt);

    ctx.save();
    ctx.translate(center.x, centerY);
    ctx.scale(station.scale, station.scale);

    // Outer glow ring.
    ctx.strokeStyle = `rgba(${ACCENT}, 0.12)`;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.roundRect(hull.x - 4, hull.y - 4, hull.width + 8, hull.height + 8, HULL_RADIUS + 4);
    ctx.stroke();

    // Textured hull: the HTML title, image and panels cover its inside, the border stays visible.
    ctx.fillStyle = this.hullTexture;
    ctx.beginPath();
    ctx.roundRect(hull.x, hull.y, hull.width, hull.height, HULL_RADIUS);
    ctx.fill();
    ctx.strokeStyle = `rgba(${ACCENT}, 0.5)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0, 0, 12, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(hull.x + border - 2, hull.y + border - 2, hull.width - 2 * border + 4, hull.height - 2 * border + 4, 8);
    ctx.stroke();

    this.drawDoor(topDoorY, -1, doors.top, time);
    this.drawDoor(bottomDoorY, 1, doors.bottom, time);

    // Corner brackets, just outside the hull: any desync with the HTML would show here first.
    ctx.strokeStyle = `rgba(${ACCENT}, 0.9)`;
    ctx.lineWidth = 2;
    const arm = 18;
    const left = hull.x - BRACKET_GAP;
    const right = hull.x + hull.width + BRACKET_GAP;
    const top = hull.y - BRACKET_GAP;
    const bottom = hull.y + hull.height + BRACKET_GAP;
    for (const [x, y, sx, sy] of [[left, top, -1, -1], [right, top, 1, -1], [right, bottom, 1, 1], [left, bottom, -1, 1]] as const) {
      ctx.beginPath();
      ctx.moveTo(x, y - sy * arm);
      ctx.lineTo(x, y);
      ctx.lineTo(x - sx * arm, y);
      ctx.stroke();
    }

    // Side beacons in the border, alternating left / right.
    const blink = (phase: number) => 0.25 + 0.75 * Math.max(0, Math.sin(time / 400 + phase));
    this.drawLight(hull.x + border / 2, 0, blink(Math.PI / 2));
    this.drawLight(hull.x + hull.width - border / 2, 0, blink(-Math.PI / 2));

    ctx.restore();
  }

  private stationDoors(index: number): StationDoors {
    let doors = this.doors.get(index);
    if (!doors) {
      const closed = (): Door => ({ open: 0, target: 0, ventAt: -Infinity, ventSeed: 0 });
      doors = { top: closed(), bottom: closed() };
      this.doors.set(index, doors);
    }
    return doors;
  }

  private updateDoor(door: Door, target: 0 | 1, time: number, dt: number): void {
    // Gas only vents when a door opens: closing happens as the station opens, and would trail along.
    if (target !== door.target) {
      door.target = target;
      if (target === 1) {
        door.ventAt = time;
        door.ventSeed = Math.floor(Math.random() * 2 ** 31);
      }
    }
    const step = dt / STAGE.doors.openMs;
    door.open = target ? Math.min(1, door.open + step) : Math.max(0, door.open - step);
  }

  /** Two halves sliding into the hull border. `outward` is the vertical direction leaving the station. */
  private drawDoor(y: number, outward: -1 | 1, door: Door, time: number): void {
    const { ctx } = this;
    const thickness = STAGE.station.border;
    const top = y - thickness / 2;
    const slide = easeInOut(door.open) * DOOR_HALF;

    // The opening: space shows through.
    ctx.fillStyle = SPACE;
    ctx.fillRect(-DOOR_HALF, top, DOOR_HALF * 2, thickness);

    ctx.save();
    ctx.beginPath();
    ctx.rect(-DOOR_HALF, top, DOOR_HALF * 2, thickness);
    ctx.clip();
    ctx.fillStyle = DOOR;
    ctx.fillRect(-DOOR_HALF - slide, top + 2, DOOR_HALF, thickness - 4);
    ctx.fillRect(slide, top + 2, DOOR_HALF, thickness - 4);
    // Hazard ticks, moving with each half.
    ctx.strokeStyle = `rgba(${WARNING}, 0.6)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 4; x < DOOR_HALF; x += 7) {
      for (const side of [-1, 1]) {
        const tick = side * (x + slide);
        ctx.moveTo(tick, top + thickness - 2);
        ctx.lineTo(tick + side * 4, top + 2);
      }
    }
    ctx.stroke();
    ctx.restore();

    // Jamb lights: flashing amber while the door is open or moving.
    const active = door.open > 0 || door.target === 1;
    const intensity = active ? 0.6 + 0.4 * Math.sin(time / 90) : 0.35;
    const color = active ? WARNING : ACCENT;
    this.drawLight(-DOOR_HALF - 6, y, intensity, color);
    this.drawLight(DOOR_HALF + 6, y, intensity, color);

    const age = time - door.ventAt;
    if (age < STAGE.doors.vent.ms) {
      this.drawVent(y, outward, age / STAGE.doors.vent.ms, door.ventSeed);
    }
  }

  /**
   * Gas burst from the door, `t` from 0 to 1: two jets blown sideways from the door center, tilted out
   * of the station, slowing down and fading. The pattern comes from the door's `ventSeed`, new at
   * each opening.
   */
  private drawVent(y: number, outward: -1 | 1, t: number, seed: number): void {
    const { ctx } = this;
    const { particles, size, reach } = STAGE.doors.vent;
    const random = seededRandom(seed);
    ctx.fillStyle = 'rgb(215, 228, 255)';
    for (let i = 0; i < particles; i++) {
      const side = i % 2 ? 1 : -1;
      // Always draw the same number of values per particle, so each one keeps its path.
      const life = 0.45 + random() * 0.55;
      const start = DOOR_HALF * 0.15 * random();
      // Jet axis: sideways, tilted ~25 degrees out of the station, narrow cone around it.
      const angle = JET_TILT + (random() * 2 - 1) * JET_SPREAD;
      const distance = reach * (0.3 + 0.7 * random());
      const radius = size * (0.6 + 0.8 * random());
      const opacity = 0.35 + 0.55 * random();
      const age = t / life;
      if (age >= 1) {
        continue;
      }
      // Fast out of the center, then slowed down, drifting a bit further out of the station.
      const travelled = distance * (1 - (1 - age) ** 3);
      const x = side * (start + Math.cos(angle) * travelled);
      const py = y + outward * (Math.sin(angle) * travelled + age * age * reach * 0.15);
      ctx.globalAlpha = opacity * (1 - age) ** 1.5;
      ctx.beginPath();
      ctx.arc(x, py, radius * (1 + age * 0.8), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawLight(x: number, y: number, intensity: number, color = ACCENT): void {
    const { ctx } = this;
    ctx.fillStyle = `rgba(${color}, ${intensity * 0.25})`;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${color}, ${intensity})`;
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Turns the ship toward its travel direction: at once while hidden behind a station image. */
  private updateHeading(frame: SceneFrame, dt: number): void {
    const target = frame.velocity > MOVING ? 0 : frame.velocity < -MOVING ? Math.PI : this.heading;
    if (target === this.heading) {
      return;
    }
    const hiddenRange = frame.layout.image.height / 2 - SHIP_NOSE - SHIP_TAIL;
    const hidden = frame.stations.some((station) => Math.abs(station.offsetY) < hiddenRange);
    const step = (Math.PI * dt) / TURN_MS;
    this.heading = hidden ? target : this.heading + Math.sign(target - this.heading) * Math.min(Math.abs(target - this.heading), step);
  }

  /** Ship length above and below its center (px), engine flame included. */
  private shipExtent(velocity: number): { above: number; below: number } {
    const back = SHIP_TAIL + flameLength(velocity);
    if (this.heading === 0) {
      return { above: SHIP_NOSE, below: back };
    }
    if (this.heading === Math.PI) {
      return { above: back, below: SHIP_NOSE };
    }
    // Mid-turn: the ship is sideways, keep the doors open around its full length.
    return { above: back, below: back };
  }

  /** Placeholder ship, nose pointing up (rotated by the heading). */
  private drawShip(frame: SceneFrame): void {
    const { ctx } = this;
    const { x, y } = shipPosition(this.viewport);
    const speed = Math.min(Math.abs(frame.velocity), 2);
    const bob = Math.sin(frame.time / 600) * 2 * Math.max(0, 1 - speed);

    ctx.save();
    ctx.translate(x, y + bob);
    ctx.rotate(this.heading);

    // Engine flame at the back (bottom), longer with speed.
    const flame = flameLength(frame.velocity) + Math.sin(frame.time / 25) * 1.5;
    const gradient = ctx.createLinearGradient(0, SHIP_TAIL, 0, SHIP_TAIL + flame);
    gradient.addColorStop(0, 'rgba(255, 220, 150, 0.95)');
    gradient.addColorStop(1, 'rgba(255, 120, 60, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(-5, SHIP_TAIL);
    ctx.lineTo(5, SHIP_TAIL);
    ctx.lineTo(0, SHIP_TAIL + flame);
    ctx.closePath();
    ctx.fill();

    // Wings.
    ctx.fillStyle = '#7c8cd6';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 7, -2);
      ctx.lineTo(side * 20, 10);
      ctx.lineTo(side * 18, 16);
      ctx.lineTo(side * 6, 10);
      ctx.closePath();
      ctx.fill();
    }

    // Hull and cockpit.
    ctx.fillStyle = '#d6ddff';
    ctx.beginPath();
    ctx.moveTo(0, -SHIP_NOSE);
    ctx.lineTo(8, -2);
    ctx.lineTo(6, SHIP_TAIL);
    ctx.lineTo(-6, SHIP_TAIL);
    ctx.lineTo(-8, -2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgb(${ACCENT})`;
    ctx.beginPath();
    ctx.ellipse(0, -5, 2.6, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

/** Engine flame length (px) for a speed in stations per second. */
function flameLength(velocity: number): number {
  return 5 + Math.min(Math.abs(velocity), 2) * 16;
}

/**
 * Whether a door should be open. `gap` is the ship center minus the door, in station px
 * (positive: the door is above the ship). Open while the ship overlaps it, or when the ship
 * heads toward it and will reach it within `approach`; it closes behind the ship.
 */
function doorTarget(
  gap: number,
  velocity: number,
  approach: number,
  extent: { above: number; below: number },
): 0 | 1 {
  const margin = 6;
  if (gap < extent.above + margin && gap > -(extent.below + margin)) {
    return 1;
  }
  const ahead = velocity > MOVING ? gap : velocity < -MOVING ? -gap : -1;
  return ahead > 0 && ahead < approach ? 1 : 0;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function mod(value: number, size: number): number {
  return ((value % size) + size) % size;
}

/** Deterministic random: the starfield doesn't change on resize, a gas burst keeps its pattern. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
