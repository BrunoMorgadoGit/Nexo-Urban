import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-error-feedback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './error-feedback.html',
  styleUrl: './error-feedback.scss',
})
export class ErrorFeedback {
  readonly message = input.required<string>();
  readonly title = input('');
  readonly retryLabel = input<string | null>(null);
  readonly retry = output<void>();
}
