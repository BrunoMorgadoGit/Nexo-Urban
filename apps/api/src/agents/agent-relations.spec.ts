import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { AgentEntity } from './agent.entity.js';
import { OperationalBaseEntity } from './operational-base.entity.js';

describe('agent persistence relations', () => {
  it('resolves organization, base, equipment, position and region relation metadata', () => {
    const relations = getMetadataArgsStorage().relations.filter(
      ({ target }) => target === AgentEntity || target === OperationalBaseEntity,
    );

    expect(relations.map(({ propertyName }) => propertyName)).toEqual(expect.arrayContaining([
      'organization', 'operationalBase', 'linkedEquipment', 'position', 'region',
    ]));
    for (const relation of relations) {
      expect(typeof relation.type).toBe('function');
      expect((relation.type as () => unknown)()).toBeTruthy();
      if (typeof relation.inverseSideProperty === 'function') {
        expect(relation.inverseSideProperty({ agent: 'agent', position: 'position' })).toBeTruthy();
      }
    }
  });
});
