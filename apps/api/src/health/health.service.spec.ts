import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('reports database connectivity after a successful query', async () => {
    const query = vi.fn().mockResolvedValue([{ '?column?': 1 }]);
    const dataSource = { query } as unknown as DataSource;
    const service = new HealthService(dataSource);

    await expect(service.check()).resolves.toMatchObject({
      status: 'ok',
      service: 'fogo-api',
      database: 'connected',
    });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('returns a safe service error when the database query fails', async () => {
    const query = vi
      .fn()
      .mockRejectedValue(new Error('private connection details'));
    const dataSource = { query } as unknown as DataSource;
    const service = new HealthService(dataSource);
    const result = await service
      .check()
      .catch((error: unknown) => error);

    expect(result).toBeInstanceOf(ServiceUnavailableException);
    expect(result).toHaveProperty('message', 'Database unavailable');
    expect(result).not.toHaveProperty('message', 'private connection details');
  });
});
