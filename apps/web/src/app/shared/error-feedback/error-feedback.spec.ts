import { TestBed } from '@angular/core/testing';
import { ErrorFeedback } from './error-feedback';

describe('ErrorFeedback', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [ErrorFeedback] }));

  it('announces a contextual title and message to assistive technology', async () => {
    const fixture = TestBed.createComponent(ErrorFeedback);
    fixture.componentRef.setInput('message', 'O serviço está indisponível.');
    fixture.componentRef.setInput('title', 'Não foi possível carregar os dados');

    await fixture.whenStable();

    const alert = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Não foi possível carregar os dados');
    expect(alert?.textContent).toContain('O serviço está indisponível.');
  });

  it('emits the retry action only when its button is activated', async () => {
    const fixture = TestBed.createComponent(ErrorFeedback);
    fixture.componentRef.setInput('message', 'Tente novamente.');
    fixture.componentRef.setInput('retryLabel', 'Tentar novamente');
    const retry = vi.fn();
    fixture.componentInstance.retry.subscribe(retry);

    await fixture.whenStable();

    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button');
    expect(button?.textContent).toContain('Tentar novamente');
    button?.click();
    expect(retry).toHaveBeenCalledOnce();
  });

  it('omits the retry button when no retry action is configured', async () => {
    const fixture = TestBed.createComponent(ErrorFeedback);
    fixture.componentRef.setInput('message', 'Revise o endereço.');

    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
  });
});
