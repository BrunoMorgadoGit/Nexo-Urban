import type { EquipmentStatus } from '@fogo/contracts';

export type EquipmentStatusCounts = Partial<Record<EquipmentStatus, number>>;

export function calculateAvailability(counts: EquipmentStatusCounts): {
  totalEquipment: number;
  eligibleEquipment: number;
  operationalEquipment: number;
  unavailableEquipment: number;
  availabilityPercent: number;
} {
  const totalEquipment = Object.values(counts).reduce((total, count) => total + (count ?? 0), 0);
  const eligibleEquipment = Object.entries(counts)
    .filter(([status]) => status !== 'not_installed' && status !== 'deactivated')
    .reduce((total, [, count]) => total + (count ?? 0), 0);
  const operationalEquipment = counts.operational ?? 0;
  return {
    totalEquipment,
    eligibleEquipment,
    operationalEquipment,
    unavailableEquipment: Math.max(0, eligibleEquipment - operationalEquipment),
    availabilityPercent: eligibleEquipment === 0
      ? 0
      : Math.round((operationalEquipment / eligibleEquipment) * 1000) / 10,
  };
}
