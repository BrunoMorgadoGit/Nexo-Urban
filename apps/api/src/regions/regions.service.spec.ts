import type { Repository } from 'typeorm';
import { RegionEntity } from './region.entity.js';
import { RegionsService } from './regions.service.js';

describe('RegionsService', () => {
  it('orders regions by zone and name and returns their transport fields', async () => {
    const regions = [{
      id: 'region-1', code: 'CENTRO', name: 'Centro', zone: 'Central', city: 'Campinas', state: 'SP', privateField: 'omit',
    }];
    const find = vi.fn().mockResolvedValue(regions);
    const service = new RegionsService({ find } as unknown as Repository<RegionEntity>);

    await expect(service.list()).resolves.toEqual([{
      id: 'region-1', code: 'CENTRO', name: 'Centro', zone: 'Central', city: 'Campinas', state: 'SP',
    }]);
    expect(find).toHaveBeenCalledWith({ order: { zone: 'ASC', name: 'ASC' } });
  });

  it('returns an empty list when no regions are configured', async () => {
    const service = new RegionsService({ find: vi.fn().mockResolvedValue([]) } as unknown as Repository<RegionEntity>);

    await expect(service.list()).resolves.toEqual([]);
  });

  it('propagates repository errors', async () => {
    const service = new RegionsService({ find: vi.fn().mockRejectedValue(new Error('database unavailable')) } as unknown as Repository<RegionEntity>);

    await expect(service.list()).rejects.toThrow('database unavailable');
  });
});
