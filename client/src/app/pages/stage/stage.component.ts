import { afterNextRender, Component, DestroyRef, ElementRef, inject, signal, viewChild, viewChildren } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StationComponent } from '../../core/components/station/station.component';
import { AppliService } from '../../core/services/appli.service';
import { SpaceRenderer } from '../../core/stage/space-renderer';
import { StageCamera } from '../../core/stage/stage-camera';
import { StageInput } from '../../core/stage/stage-input';
import { easeInOutCubic, stationCenter, stationLayout, StationLayout, stationPose, Viewport } from '../../core/stage/stage-layout';
import { STAGE } from '../../core/stage/stage.config';
import { StationDock } from '../../core/stage/station-dock';

@Component({
  selector: 'app-stage',
  imports: [StationComponent, RouterLink],
  templateUrl: './stage.component.html',
  styleUrl: './stage.component.scss',
})
export class StageComponent {
  private readonly appliService = inject(AppliService);

  protected readonly projects = this.appliService.projects;
  protected readonly isLoading = this.appliService.isLoading;
  protected readonly error = this.appliService.error;

  /** Discrete state only, never set per frame: the station the ship is at, and the open one (-1: none). */
  protected readonly currentIndex = signal(0);
  protected readonly openIndex = signal(-1);
  protected readonly hasTravelled = signal(false);

  private readonly surface = viewChild.required<ElementRef<HTMLElement>>('surface');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly stations = viewChildren(StationComponent);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => destroyRef.onDestroy(this.startStage()));
  }

  protected retry(): void {
    this.appliService.reload();
  }

  protected pad(value: number): string {
    return value.toString().padStart(2, '0');
  }

  /** Starts the frame loop; returns the cleanup. */
  private startStage(): () => void {
    const surface = this.surface().nativeElement;
    const renderer = new SpaceRenderer(this.canvas().nativeElement);
    const camera = new StageCamera((index) => this.currentIndex.set(index));
    const dock = new StationDock(camera, (index) => this.openIndex.set(index));

    let viewport: Viewport = { width: 0, height: 0 };
    let layout: StationLayout = stationLayout(viewport);
    let placedStations: ReadonlyArray<StationComponent> = [];

    // Moves start at once: the open station closes while it moves away.
    const travelled = () => this.hasTravelled.set(true);
    const input = new StageInput(surface, {
      step: (direction) => {
        travelled();
        camera.step(direction);
      },
      goTo: (where) => {
        travelled();
        camera.goTo(where === 'first' ? 0 : this.projects().length - 1);
      },
      dragStart: () => {
        travelled();
        camera.beginDrag();
      },
      dragMove: (distance) => camera.dragTo(distance / (viewport.height * STAGE.stationSpacing)),
      dragEnd: (flick) => camera.endDrag(flick),
    });

    const resize = () => {
      viewport = { width: surface.clientWidth, height: surface.clientHeight };
      layout = stationLayout(viewport);
      renderer.resize(viewport, surface.ownerDocument.defaultView?.devicePixelRatio ?? 1);
      placedStations = [];
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(surface);
    resize();

    let frameId = 0;
    let lastTime: number | null = null;
    const frame = (now: number) => {
      const dt = lastTime === null ? 16 : Math.min(Math.max(now - lastTime, 0), 100);
      lastTime = now;
      const stations = this.stations();
      camera.setCount(stations.length);
      camera.update(now);
      dock.update(dt);
      const open = easeInOutCubic(dock.progress);

      // Canvas hulls and HTML stations are placed from the same layout and poses, in the same frame.
      const poses = stations.map((_, i) => stationPose(i, camera.position, viewport));
      if (placedStations !== stations) {
        const center = stationCenter(viewport);
        stations.forEach((station) => station.place(layout, center));
        placedStations = stations;
      }
      stations.forEach((station, i) => {
        station.move(poses[i]);
        station.expand(i === dock.index ? open : 0);
      });

      renderer.render({
        time: now,
        camera: camera.position,
        velocity: camera.velocity,
        destination: camera.destination,
        layout,
        stations: poses,
        openIndex: dock.index,
        open,
      });
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      input.destroy();
    };
  }
}
