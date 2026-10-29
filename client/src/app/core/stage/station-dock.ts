import { StageCamera } from './stage-camera';
import { STAGE } from './stage.config';

/**
 * Docking sequence of the current station: as soon as the ship stops inside, the panels open;
 * they close while it leaves.
 */
export class StationDock {
  /** Station whose panels are open or moving (-1: none). */
  index = -1;
  /** 0 compact, 1 open (linear, ease it to draw). */
  progress = 0;

  private openIndex = -1;

  constructor(
    private readonly camera: StageCamera,
    /** Called with the open station once its panels are fully out, -1 as soon as they close. */
    private readonly onOpenChange: (index: number) => void,
  ) {}

  update(dt: number): void {
    const { camera } = this;
    const station = Math.round(camera.position);
    const atRest = !camera.isTravelling && !camera.isDragging && Math.abs(camera.position - station) < 1e-3;
    if (this.progress === 0) {
      this.index = station;
    }
    const open = atRest && this.index === station;
    this.progress = open
      ? Math.min(1, this.progress + dt / STAGE.dock.openMs)
      : Math.max(0, this.progress - dt / STAGE.dock.closeMs);

    const openIndex = this.progress === 1 ? this.index : -1;
    if (openIndex !== this.openIndex) {
      this.openIndex = openIndex;
      this.onOpenChange(openIndex);
    }
  }
}
