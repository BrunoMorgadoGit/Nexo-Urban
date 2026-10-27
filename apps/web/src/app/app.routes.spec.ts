import { routes } from './app.routes';

describe('application routes', () => {
  it('redirects the root and sends unknown paths to the not-found page', () => {
    expect(routes[0]).toMatchObject({ path: '', pathMatch: 'full', redirectTo: 'command' });
    expect(routes.at(-1)).toMatchObject({ path: '**', redirectTo: 'not-found' });
  });

  it('keeps domain screens lazy loaded and preserves detail and editor route order', async () => {
    expect(routes.map((route) => route.path)).toEqual([
      '', 'command', 'live-map', 'alerts', 'intelligence', 'equipments', 'equipments/new',
      'equipments/:id/edit', 'equipments/:id', 'agents', 'agents/new', 'agents/:id/edit',
      'agents/:id', 'maintenance', 'not-found', '**',
    ]);
    expect(routes.slice(1, -1).every((route) => typeof route.loadComponent === 'function')).toBe(true);

    const loadedComponents = await Promise.all(routes.slice(1, -1).map((route) => Promise.resolve(route.loadComponent?.())));

    expect(loadedComponents).toHaveLength(14);
    expect(loadedComponents.every(Boolean)).toBe(true);
  });
});
