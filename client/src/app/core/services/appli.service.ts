import { computed, Service } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { Appli } from '../models/appli.model';

const APPLIS_URL = '/assets/data/apps_game.json';

@Service()
export class AppliService {
  private readonly applis = httpResource<Array<Appli>>(() => APPLIS_URL);

  /** Real projects only: year 0 entries are category-like and kept for the planet phase. */
  readonly projects = computed(() =>
    this.applis.hasValue() ? this.applis.value().filter((appli) => appli.year > 0) : [],
  );
  readonly isLoading = this.applis.isLoading;
  readonly error = this.applis.error;

  reload(): void {
    this.applis.reload();
  }
}
