import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NotFound } from './not-found';

describe('NotFound', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [NotFound],
    providers: [provideRouter([])],
  }));

  it('explains the missing page and links back to operations', async () => {
    const fixture = TestBed.createComponent(NotFound);
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('h2')?.textContent).toContain('Não encontramos esta página');
    expect(root.querySelector('p')?.textContent).toContain('Erro 404');
    expect(root.querySelector<HTMLAnchorElement>('a')?.getAttribute('href')).toBe('/command');
  });
});
