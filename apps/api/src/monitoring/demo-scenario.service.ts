import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { DemoScenario } from '@fogo/contracts';
import { DataSource } from 'typeorm';
import { EquipmentEntity } from '../equipment/equipment.entity.js';
import { MonitoringWriteService } from './monitoring-write.service.js';

const scenarioSerial = 'DEMO-RAD-001';
const initialNextMaintenanceDate = '2026-11-10';

@Injectable()
export class DemoScenarioService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly monitoringWrite: MonitoringWriteService,
  ) {}

  async get(): Promise<DemoScenario> {
    const equipment = await this.findEquipment();
    return this.toContract(equipment);
  }

  async outage(): Promise<DemoScenario> {
    const equipment = await this.findEquipment();
    if (equipment.status !== 'malfunctioning') {
      const previousStatus = equipment.status;
      await this.dataSource.getRepository(EquipmentEntity).update(equipment.id, {
        status: 'malfunctioning',
        maintenancePriority: 'immediate',
      });
      await this.monitoringWrite.equipmentChanged(equipment.id, previousStatus, 'demo', 'demo.scenario.changed', {
        scenarioCode: 'radar-outage',
        action: 'outage',
      });
    }
    return this.get();
  }

  async reset(): Promise<DemoScenario> {
    const equipment = await this.findEquipment();
    if (equipment.status !== 'operational' || equipment.maintenancePriority !== 'normal' || equipment.nextMaintenanceDate !== initialNextMaintenanceDate) {
      const previousStatus = equipment.status;
      await this.dataSource.getRepository(EquipmentEntity).update(equipment.id, {
        status: 'operational',
        maintenancePriority: 'normal',
        nextMaintenanceDate: initialNextMaintenanceDate,
      });
      await this.monitoringWrite.equipmentChanged(equipment.id, previousStatus, 'demo', 'demo.scenario.changed', {
        scenarioCode: 'radar-outage',
        action: 'reset',
      });
    }
    return this.get();
  }

  private async findEquipment(): Promise<EquipmentEntity> {
    const equipment = await this.dataSource.getRepository(EquipmentEntity).findOne({ where: { serialNumber: scenarioSerial } });
    if (!equipment) throw new NotFoundException('Equipamento do cenário demonstrativo não encontrado. Execute o seed oficial.');
    if (equipment.dataOrigin !== 'demo') {
      throw new ConflictException('O equipamento do cenário não está marcado como demonstrativo.');
    }
    return equipment;
  }

  private toContract(equipment: EquipmentEntity): DemoScenario {
    return {
      mode: 'DEMONSTRATION',
      code: 'radar-outage',
      label: 'Indisponibilidade controlada de radar',
      equipmentId: equipment.id,
      serialNumber: equipment.serialNumber,
      status: equipment.status,
      initialStatus: 'operational',
      active: equipment.status === 'malfunctioning',
    };
  }
}
