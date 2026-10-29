import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProjectFrameComponent } from '../../core/components/project-frame/project-frame.component';
import { AppliService } from '../../core/services/appli.service';

@Component({
  selector: 'app-home',
  imports: [ProjectFrameComponent, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private readonly appliService = inject(AppliService);

  protected readonly projects = this.appliService.projects;
  protected readonly isLoading = this.appliService.isLoading;
  protected readonly error = this.appliService.error;

  protected retry(): void {
    this.appliService.reload();
  }
}
