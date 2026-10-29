import { Component, computed, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { Appli, appliDateLabel, appliImageUrls, MAX_LEVEL } from '../../models/appli.model';
import { openStation, Rect, StationLayout, StationPose } from '../../stage/stage-layout';

/**
 * One station of the stage: title bar and square image carousel, plus the description and
 * context / technos panels that open around them once the ship is docked.
 * The stage frame loop places it with `place` / `move` / `expand`, which write styles directly.
 */
@Component({
  selector: 'app-station',
  imports: [NgOptimizedImage],
  templateUrl: './station.component.html',
  styleUrl: './station.component.scss',
  host: {
    role: 'article',
    '[attr.aria-labelledby]': 'titleId()',
    '[class.is-open]': 'open()',
    '[class.is-row]': 'row()',
  },
})
export class StationComponent {
  readonly appli = input.required<Appli>();
  /** Set on the first station so its first image loads eagerly (LCP). */
  readonly priority = input(false);
  /** Panels fully out: their content fades in. */
  readonly open = input(false);

  protected readonly titleId = computed(() => `station-${this.appli().name.replace(/\W+/g, '-')}`);
  protected readonly dateLabel = computed(() => appliDateLabel(this.appli()));
  protected readonly images = computed(() => appliImageUrls(this.appli()));
  protected readonly currentImage = signal(0);
  /** Panels on the sides (wide screens): set on resize only. */
  protected readonly row = signal(false);
  protected readonly levels = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);
  protected readonly maxLevel = MAX_LEVEL;

  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly title = viewChild.required<ElementRef<HTMLElement>>('title');
  private readonly gallery = viewChild.required<ElementRef<HTMLElement>>('gallery');
  private readonly details = viewChild.required<ElementRef<HTMLElement>>('details');
  private readonly extra = viewChild.required<ElementRef<HTMLElement>>('extra');

  private layout: StationLayout | null = null;
  private appliedMove = '';
  private appliedOpen = -1;

  /** Sizes every part for a viewport; `center` is the docked station center on screen. */
  place(layout: StationLayout, center: { x: number; y: number }): void {
    this.layout = layout;
    this.row.set(layout.row);
    this.host.style.left = `${center.x}px`;
    this.host.style.top = `${center.y}px`;
    setRect(this.title().nativeElement, layout.title);
    setRect(this.gallery().nativeElement, layout.image);
    setRect(this.details().nativeElement, layout.details);
    setRect(this.extra().nativeElement, layout.extra);
    this.appliedOpen = -1;
  }

  move(pose: StationPose): void {
    const transform = pose.visible
      ? `translate3d(0, ${pose.offsetY.toFixed(2)}px, 0) scale(${pose.scale.toFixed(4)})`
      : 'hidden';
    if (transform === this.appliedMove) {
      return;
    }
    this.appliedMove = transform;
    this.host.style.visibility = pose.visible ? 'visible' : 'hidden';
    if (pose.visible) {
      this.host.style.transform = transform;
    }
  }

  /** `open` from 0 (compact) to 1 (panels out), eased. Same geometry as the canvas hull. */
  expand(open: number): void {
    const { layout } = this;
    if (!layout || open === this.appliedOpen) {
      return;
    }
    this.appliedOpen = open;
    const state = openStation(layout, open);
    const details = this.details().nativeElement;
    const extra = this.extra().nativeElement;

    this.title().nativeElement.style.transform = `translate3d(0, ${(state.titleY - layout.title.y).toFixed(2)}px, 0)`;
    const visibility = open > 0 ? 'visible' : 'hidden';
    details.style.visibility = visibility;
    extra.style.visibility = visibility;
    // Each panel unfolds from the image side.
    if (layout.row) {
      details.style.clipPath = `inset(0 0 0 ${(layout.details.width - state.detailsSize).toFixed(2)}px)`;
      extra.style.clipPath = `inset(0 ${(layout.extra.width - state.extraSize).toFixed(2)}px 0 0)`;
    } else {
      details.style.clipPath = `inset(${(layout.details.height - state.detailsSize).toFixed(2)}px 0 0 0)`;
      extra.style.clipPath = `inset(0 0 ${(layout.extra.height - state.extraSize).toFixed(2)}px 0)`;
    }
  }

  protected onGalleryScroll(scroller: HTMLElement): void {
    const width = scroller.clientWidth;
    if (width) {
      this.currentImage.set(Math.round(scroller.scrollLeft / width));
    }
  }
}

function setRect(element: HTMLElement, rect: Rect): void {
  const { style } = element;
  style.left = `${rect.x}px`;
  style.top = `${rect.y}px`;
  style.width = `${rect.width}px`;
  style.height = `${rect.height}px`;
}
