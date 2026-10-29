import { STAGE } from './stage.config';

type Easing = (t: number) => number;

/** Constant acceleration for the first half, constant braking for the second: no slow crawl at the end. */
const easeInOutQuad: Easing = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOutCubic: Easing = (t) => 1 - (1 - t) ** 3;

interface Travel {
  from: number;
  to: number;
  start: number;
  duration: number;
  easing: Easing;
}

/**
 * The single source of truth of the stage: a position in station units
 * (2.37 = between station 2 and 3). Everything on screen is derived from it.
 */
export class StageCamera {
  /** Current position, in stations. */
  position = 0;
  /** Current speed, in stations per second (signed). */
  velocity = 0;

  private count = 1;
  private travel: Travel | null = null;
  private queuedStep = 0;
  private dragOrigin: number | null = null;
  private pendingStart = false;
  private lastTime: number | null = null;
  private lastPosition = 0;

  constructor(private readonly onArrive: (index: number) => void) {}

  get isTravelling(): boolean {
    return this.travel !== null;
  }

  get isDragging(): boolean {
    return this.dragOrigin !== null;
  }

  /** Where the current travel ends: the position itself at rest, null while dragging (the finger decides). */
  get destination(): number | null {
    if (this.travel) {
      return this.travel.to;
    }
    return this.isDragging ? null : this.position;
  }

  setCount(count: number): void {
    this.count = Math.max(1, count);
    if (this.position > this.count - 1) {
      this.goTo(this.count - 1);
    }
  }

  /** Move one station forward (1) or back (-1). A step during travel is queued (one at most). */
  step(direction: 1 | -1): void {
    if (this.isDragging) {
      return;
    }
    if (this.travel) {
      this.queuedStep = direction;
      return;
    }
    this.goTo(Math.round(this.position) + direction);
  }

  goTo(index: number, duration?: number, easing: Easing = easeInOutQuad): void {
    const to = this.clamp(Math.round(index));
    const distance = Math.abs(to - this.position);
    if (distance < 1e-4) {
      this.travel = null;
      this.position = to;
      this.onArrive(to);
      return;
    }
    this.travel = {
      from: this.position,
      to,
      start: 0,
      duration: duration ?? STAGE.travelMs * Math.min(distance, 1),
      easing,
    };
    // The start time is taken on the next update so travel uses the frame clock.
    this.pendingStart = true;
  }

  beginDrag(): void {
    this.travel = null;
    this.queuedStep = 0;
    this.dragOrigin = this.position;
  }

  /** `deltaStations` is the finger travel since the drag began, converted to stations. */
  dragTo(deltaStations: number): void {
    if (this.dragOrigin === null) {
      return;
    }
    const raw = this.dragOrigin + deltaStations;
    const max = this.count - 1;
    if (raw < 0) {
      this.position = raw * STAGE.edgeResistance;
    } else if (raw > max) {
      this.position = max + (raw - max) * STAGE.edgeResistance;
    } else {
      this.position = raw;
    }
  }

  /** `flick` is the release direction when the finger was fast enough (0 otherwise). */
  endDrag(flick: -1 | 0 | 1): void {
    if (this.dragOrigin === null) {
      return;
    }
    const origin = Math.round(this.dragOrigin);
    this.dragOrigin = null;
    const moved = this.position - origin;
    let target = origin;
    if (flick !== 0) {
      target = origin + flick;
    } else if (Math.abs(moved) > STAGE.dragCommit) {
      target = origin + Math.sign(moved);
    }
    const remaining = Math.min(Math.abs(this.clamp(target) - this.position), 1);
    this.goTo(target, Math.max(180, STAGE.releaseMs * remaining), easeOutCubic);
  }

  /** Advance the travel. Called once per frame with the rAF timestamp. */
  update(now: number): void {
    if (this.travel) {
      if (this.pendingStart) {
        this.travel.start = now;
        this.pendingStart = false;
      }
      const { from, to, start, duration, easing } = this.travel;
      const t = Math.min((now - start) / duration, 1);
      this.position = from + (to - from) * easing(t);
      if (t >= 1) {
        this.travel = null;
        this.position = to;
        this.onArrive(to);
        if (this.queuedStep !== 0) {
          const direction = this.queuedStep;
          this.queuedStep = 0;
          this.goTo(to + direction);
        }
      }
    }

    // Clamp dt so a frame after a hidden tab doesn't produce a huge speed.
    const dt = this.lastTime === null ? 16 : Math.min(Math.max(now - this.lastTime, 1), 100);
    const instant = ((this.position - this.lastPosition) / dt) * 1000;
    this.velocity += (instant - this.velocity) * 0.5;
    this.lastTime = now;
    this.lastPosition = this.position;
  }

  private clamp(index: number): number {
    return Math.min(Math.max(index, 0), this.count - 1);
  }
}
