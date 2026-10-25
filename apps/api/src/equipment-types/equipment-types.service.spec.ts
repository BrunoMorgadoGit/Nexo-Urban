import { EquipmentTypesService } from './equipment-types.service.js';
import { EquipmentTypeEntity } from './equipment-type.entity.js';
import type { Repository } from 'typeorm';

describe('EquipmentTypesService', () => {
  it('returns the public type fields and requests alphabetical ordering', async () => {
    const records = [
      { code: 'speed_radar', label: 'Radar de velocidade', mobility: 'fixed', characteristics: { speedLimitKmh: 50 } },
      { code: 'patrol_car', label: 'Viatura', mobility: 'mobile', characteristics: { plate: true } },
    ];
    const find = vi.fn().mockResolvedValue(records);
    const service = new EquipmentTypesService({ find } as unknown as Repository<EquipmentTypeEntity>);

    await expect(service.list()).resolves.toEqual(records);
    expect(find).toHaveBeenCalledWith({ order: { label: 'ASC' } });
  });

  it('returns an empty list when no equipment types are registered', async () => {
    const service = new EquipmentTypesService({ find: vi.fn().mockResolvedValue([]) } as unknown as Repository<EquipmentTypeEntity>);

    await expect(service.list()).resolves.toEqual([]);
  });

  it('propagates repository errors for the caller to handle', async () => {
    const service = new EquipmentTypesService({ find: vi.fn().mockRejectedValue(new Error('database unavailable')) } as unknown as Repository<EquipmentTypeEntity>);

    await expect(service.list()).rejects.toThrow('database unavailable');
  });
});
