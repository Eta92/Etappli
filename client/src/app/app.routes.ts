import { DOCUMENT, inject } from '@angular/core';
import { CanMatchFn, Routes } from '@angular/router';

/** The animated stage is skipped when the visitor asked the OS for reduced motion. */
const motionAllowed: CanMatchFn = () =>
  !inject(DOCUMENT).defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches;

const loadHome = () => import('./pages/home/home.component').then((m) => m.HomeComponent);

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canMatch: [motionAllowed],
    loadComponent: () => import('./pages/stage/stage.component').then((m) => m.StageComponent),
  },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: loadHome,
  },
  {
    // Simple / low-spec version: native scroll-snap, no canvas.
    path: 'simple',
    loadComponent: loadHome,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
