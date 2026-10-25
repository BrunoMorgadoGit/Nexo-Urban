import type { Repository } from 'typeorm';
import { OrganizationEntity } from './organization.entity.js';
import { OrganizationsService } from './organizations.service.js';

describe('OrganizationsService', () => {
  it('lists only active organizations in name order and maps the public contract', async () => {
    const records = [
      { id: 'org-1', code: 'MOB', name: 'Mobilidade', isActive: true, privateField: 'omit' },
      { id: 'org-2', code: 'GUARD', name: 'Guarda', isActive: true, privateField: 'omit' },
    ];
    const find = vi.fn().mockResolvedValue(records);
    const service = new OrganizationsService({ find } as unknown as Repository<OrganizationEntity>);

    await expect(service.list()).resolves.toEqual([
      { id: 'org-1', code: 'MOB', name: 'Mobilidade' },
      { id: 'org-2', code: 'GUARD', name: 'Guarda' },
    ]);
    expect(find).toHaveBeenCalledWith({ where: { isActive: true }, order: { name: 'ASC' } });
  });

  it('returns an empty list when no organization is active', async () => {
    const service = new OrganizationsService({ find: vi.fn().mockResolvedValue([]) } as unknown as Repository<OrganizationEntity>);

    await expect(service.list()).resolves.toEqual([]);
  });

  it('propagates repository errors', async () => {
    const service = new OrganizationsService({ find: vi.fn().mockRejectedValue(new Error('database unavailable')) } as unknown as Repository<OrganizationEntity>);

    await expect(service.list()).rejects.toThrow('database unavailable');
  });
});
