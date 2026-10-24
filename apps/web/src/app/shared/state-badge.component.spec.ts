import { TestBed } from '@angular/core/testing';
import { StateBadgeComponent } from './state-badge.component';

describe('StateBadgeComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [StateBadgeComponent] }));

  it.each([
    ['operational', 'Operacional', 'positive'],
    ['maintenance', 'Em manutenção', 'warning'],
    ['stolen', 'Furtado', 'danger'],
    ['unknown_state', 'unknown_state', 'neutral'],
  ])('labels %s using the %s presentation', async (status, label, tone) => {
    const fixture = TestBed.createComponent(StateBadgeComponent);
    fixture.componentRef.setInput('status', status);

    await fixture.whenStable();

    const badge = fixture.nativeElement.querySelector('.state-badge') as HTMLElement;
    expect(badge.textContent).toContain(label);
    expect(badge.classList.contains(`state-badge--${tone}`)).toBe(true);
  });
});
