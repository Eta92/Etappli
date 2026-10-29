import { Component, computed, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { Appli, appliDateLabel, appliImageUrls, MAX_LEVEL } from '../../models/appli.model';

@Component({
  selector: 'app-project-frame',
  imports: [NgOptimizedImage],
  templateUrl: './project-frame.component.html',
  styleUrl: './project-frame.component.scss',
})
export class ProjectFrameComponent {
  readonly appli = input.required<Appli>();
  /** Set on the first frame so its first image loads eagerly (LCP). */
  readonly priority = input(false);

  protected readonly titleId = computed(() => `frame-${this.appli().name.replace(/\W+/g, '-')}`);
  protected readonly dateLabel = computed(() => appliDateLabel(this.appli()));
  protected readonly images = computed(() => appliImageUrls(this.appli()));
  protected readonly levels = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);
  protected readonly maxLevel = MAX_LEVEL;
}
