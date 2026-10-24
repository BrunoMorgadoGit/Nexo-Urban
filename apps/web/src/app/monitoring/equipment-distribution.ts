import type { EquipmentStatus, MonitoringOverview } from '@fogo/contracts';

const statusPresentation: ReadonlyArray<{ status: EquipmentStatus | 'unclassified'; label: string }> = [
  { status: 'operational', label: 'Operacionais' },
  { status: 'malfunctioning', label: 'Mau funcionamento' },
  { status: 'maintenance', label: 'Em manutenção' },
  { status: 'stolen', label: 'Furtados' },
  { status: 'deactivated', label: 'Desativados' },
  { status: 'not_installed', label: 'Não instalados' },
  { status: 'unclassified', label: 'Situação não reconhecida' },
];

const radius = 34;
const circumference = 2 * Math.PI * radius;

export type EquipmentDistributionSegment = {
  status: EquipmentStatus | 'unclassified';
  label: string;
  count: number;
  percent: number;
  dashArray: string;
  dashOffset: number;
};

export function equipmentDistribution(overview: MonitoringOverview): EquipmentDistributionSegment[] {
  let offset = 0;
  const total = overview.totalEquipment;
  return statusPresentation.map(({ status, label }) => {
    const count = status === 'unclassified' ? overview.unclassifiedEquipment : overview.equipmentStatusCounts[status];
    const length = total > 0 ? count / total * circumference : 0;
    const segment = {
      status,
      label,
      count,
      percent: total > 0 ? count / total * 100 : 0,
      dashArray: `${length} ${circumference - length}`,
      dashOffset: -offset,
    };
    offset += length;
    return segment;
  });
}
