import type { MaintenancePriority } from '@fogo/contracts';
import type { EntityManager } from 'typeorm';
import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { MaintenanceEntity } from './maintenance.entity.js';

export async function syncEquipmentMaintenanceSummary(
  manager: EntityManager,
  equipmentId: string,
  terminalRecord?: MaintenanceEntity,
): Promise<void> {
  const equipmentRepository = manager.getRepository(EquipmentEntity);
  const maintenanceRepository = manager.getRepository(MaintenanceEntity);
  const [equipment, records] = await Promise.all([
    equipmentRepository.findOne({ where: { id: equipmentId } }),
    maintenanceRepository.find({ where: { equipmentId } }),
  ]);
  if (!equipment) return;
  const active = records.filter((record) => record.status === 'scheduled' || record.status === 'in_progress');
  if (active.length) {
    const priorityRank = { low: 0, normal: 1, high: 2, immediate: 3 } as const;
    const priority = active.reduce<MaintenancePriority>((highest, record) =>
      priorityRank[record.priority] > priorityRank[highest] ? record.priority : highest, active[0].priority);
    const nextMaintenanceDate = active.reduce((earliest, record) =>
      record.scheduledDate < earliest ? record.scheduledDate : earliest, active[0].scheduledDate);
    await equipmentRepository.update(equipmentId, { nextMaintenanceDate, maintenancePriority: priority });
    return;
  }
  if (terminalRecord && equipment.nextMaintenanceDate === terminalRecord.scheduledDate) {
    await equipmentRepository.update(equipmentId, { nextMaintenanceDate: null, maintenancePriority: 'normal' });
  }
}
