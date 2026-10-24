import { API_BASE_PATH, MONITORING_STREAM_PATH } from './api-base';

describe('API route constants', () => {
  it('keeps HTTP and event stream calls under the versioned API root', () => {
    expect(API_BASE_PATH).toBe('/api/v1');
    expect(MONITORING_STREAM_PATH).toBe(`${API_BASE_PATH}/monitoring/events/stream`);
  });
});
