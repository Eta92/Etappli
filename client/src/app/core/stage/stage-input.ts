import { STAGE } from './stage.config';

export interface StageInputHandlers {
  step(direction: 1 | -1): void;
  goTo(index: 'first' | 'last'): void;
  dragStart(): void;
  /** Finger travel since the drag began (px, positive = finger moved up). */
  dragMove(distance: number): void;
  dragEnd(flick: -1 | 0 | 1): void;
}

/** Attribute marking an element whose content scrolls natively before the stage moves. */
export const SCROLLABLE_ATTR = 'data-stage-scrollable';

const LINE_HEIGHT = 16;

type TouchMode = 'pending' | 'drag' | 'native';

/**
 * Turns wheel, touch and keyboard into camera commands.
 * A wheel / trackpad gesture (events less than `wheelGestureGap` apart) moves one station at most,
 * so trackpad momentum never chains several moves.
 */
export class StageInput {
  private wheelAccumulated = 0;
  private wheelLastTime = -Infinity;
  private wheelGestureUsed = false;

  private touchMode: TouchMode | null = null;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchDragOriginY = 0;
  private touchScrollable: HTMLElement | null = null;
  private touchSamples: Array<{ y: number; time: number }> = [];

  private readonly listeners: Array<() => void> = [];

  constructor(
    private readonly surface: HTMLElement,
    private readonly handlers: StageInputHandlers,
  ) {
    this.listen(surface, 'wheel', (e) => this.onWheel(e as WheelEvent), { passive: false });
    this.listen(surface, 'touchstart', (e) => this.onTouchStart(e as TouchEvent), { passive: true });
    this.listen(surface, 'touchmove', (e) => this.onTouchMove(e as TouchEvent), { passive: false });
    this.listen(surface, 'touchend', (e) => this.onTouchEnd(e as TouchEvent), { passive: true });
    this.listen(surface, 'touchcancel', (e) => this.onTouchEnd(e as TouchEvent), { passive: true });
    const view = surface.ownerDocument.defaultView;
    if (view) {
      this.listen(view, 'keydown', (e) => this.onKeyDown(e as KeyboardEvent));
    }
  }

  destroy(): void {
    this.listeners.forEach((remove) => remove());
    this.listeners.length = 0;
  }

  private listen(
    target: EventTarget,
    type: string,
    listener: (e: Event) => void,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, listener, options);
    this.listeners.push(() => target.removeEventListener(type, listener, options));
  }

  // ---- Wheel ----

  private onWheel(e: WheelEvent): void {
    if (e.ctrlKey) {
      return; // pinch-zoom on trackpads
    }
    const delta = this.normalizeWheel(e);
    const newGesture = e.timeStamp - this.wheelLastTime > STAGE.wheelGestureGap;
    this.wheelLastTime = e.timeStamp;
    if (newGesture) {
      this.wheelAccumulated = 0;
      this.wheelGestureUsed = false;
    }

    // Panel content scrolls first. The gesture is then used up so its momentum
    // doesn't jump to the next station when the content hits its edge.
    if (canScroll(findScrollable(e.target, this.surface), delta)) {
      this.wheelGestureUsed = true;
      return;
    }
    e.preventDefault();
    if (this.wheelGestureUsed || Math.abs(delta) < Math.abs(e.deltaX)) {
      return;
    }
    this.wheelAccumulated += delta;
    if (Math.abs(this.wheelAccumulated) >= STAGE.wheelThreshold) {
      this.wheelGestureUsed = true;
      this.handlers.step(Math.sign(this.wheelAccumulated) === STAGE.wheelDirection ? 1 : -1);
    }
  }

  private normalizeWheel(e: WheelEvent): number {
    if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      return e.deltaY * LINE_HEIGHT;
    }
    if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      return e.deltaY * this.surface.clientHeight;
    }
    return e.deltaY;
  }

  // ---- Touch ----

  private onTouchStart(e: TouchEvent): void {
    if (e.touches.length !== 1) {
      this.cancelTouch();
      return;
    }
    const touch = e.touches[0];
    this.touchMode = 'pending';
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchScrollable = findScrollable(e.target, this.surface);
    this.touchSamples = [{ y: touch.clientY, time: e.timeStamp }];
  }

  private onTouchMove(e: TouchEvent): void {
    if (this.touchMode === null || this.touchMode === 'native' || e.touches.length !== 1) {
      return;
    }
    const touch = e.touches[0];
    const dx = touch.clientX - this.touchStartX;
    const dy = touch.clientY - this.touchStartY;

    if (this.touchMode === 'pending') {
      if (Math.hypot(dx, dy) < STAGE.touchSlop) {
        return;
      }
      // Horizontal swipes belong to the image strips; content that can still scroll keeps the finger.
      if (Math.abs(dx) > Math.abs(dy) || canScroll(this.touchScrollable, -dy)) {
        this.touchMode = 'native';
        return;
      }
      this.touchMode = 'drag';
      this.touchDragOriginY = touch.clientY;
      this.handlers.dragStart();
    }

    if (e.cancelable) {
      e.preventDefault();
    }
    this.touchSamples.push({ y: touch.clientY, time: e.timeStamp });
    if (this.touchSamples.length > 6) {
      this.touchSamples.shift();
    }
    this.handlers.dragMove(this.touchDragOriginY - touch.clientY);
  }

  private onTouchEnd(e: TouchEvent): void {
    if (this.touchMode === 'drag') {
      this.touchMode = null;
      this.handlers.dragEnd(this.flickDirection(e.timeStamp));
    }
    this.cancelTouch();
  }

  /** Ends the current touch; an unfinished drag settles without a flick. */
  private cancelTouch(): void {
    if (this.touchMode === 'drag') {
      this.handlers.dragEnd(0);
    }
    this.touchMode = null;
    this.touchScrollable = null;
    this.touchSamples = [];
  }

  /** Finger speed over the last ~100 ms; finger moving up = forward. */
  private flickDirection(now: number): -1 | 0 | 1 {
    const recent = this.touchSamples.filter((s) => now - s.time < 100);
    if (recent.length < 2) {
      return 0;
    }
    const first = recent[0];
    const last = recent[recent.length - 1];
    const velocity = (first.y - last.y) / Math.max(last.time - first.time, 1);
    if (Math.abs(velocity) < STAGE.flickVelocity) {
      return 0;
    }
    return velocity > 0 ? 1 : -1;
  }

  // ---- Keyboard ----

  private onKeyDown(e: KeyboardEvent): void {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isEditable(e.target)) {
      return;
    }
    switch (e.key) {
      // The ship flies up: up keys move forward.
      case 'ArrowUp':
      case 'PageUp':
      case ' ':
        this.handlers.step(e.shiftKey && e.key === ' ' ? -1 : 1);
        break;
      case 'ArrowDown':
      case 'PageDown':
        this.handlers.step(-1);
        break;
      case 'Home':
        this.handlers.goTo('first');
        break;
      case 'End':
        this.handlers.goTo('last');
        break;
      default:
        return;
    }
    e.preventDefault();
  }
}

function findScrollable(target: EventTarget | null, root: HTMLElement): HTMLElement | null {
  const element = target instanceof Element ? target : null;
  const scrollable = element?.closest<HTMLElement>(`[${SCROLLABLE_ATTR}]`) ?? null;
  return scrollable && root.contains(scrollable) ? scrollable : null;
}

/** Whether `element` can still scroll vertically in the direction of `delta` (positive = down). */
function canScroll(element: HTMLElement | null, delta: number): boolean {
  if (!element || element.scrollHeight <= element.clientHeight + 1) {
    return false;
  }
  if (delta > 0) {
    return element.scrollTop + element.clientHeight < element.scrollHeight - 1;
  }
  return delta < 0 && element.scrollTop > 0;
}

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}
