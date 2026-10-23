import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import type { EquipmentTypeContract } from '@fogo/contracts';

const plate = z.string().regex(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/);

export const equipmentTypeDefinitions: EquipmentTypeContract[] = [
  {
    code: 'speed_radar',
    label: 'Radar de velocidade',
    mobility: 'fixed',
    characteristics: [
      { key: 'speedLimitKmh', label: 'Limite (km/h)', kind: 'number', required: true, minimum: 20, maximum: 130 },
      { key: 'lanes', label: 'Faixas monitoradas', kind: 'number', required: true, minimum: 1, maximum: 8 },
      { key: 'technology', label: 'Tecnologia', kind: 'select', required: true, options: ['doppler', 'laser', 'sectional'] },
    ],
  },
  {
    code: 'surveillance_camera',
    label: 'Câmera de monitoramento',
    mobility: 'fixed',
    characteristics: [
      { key: 'resolution', label: 'Resolução', kind: 'select', required: true, options: ['1080p', '2k', '4k'] },
      { key: 'nightVision', label: 'Visão noturna', kind: 'boolean', required: true },
      { key: 'panTiltZoom', label: 'Pan, tilt e zoom', kind: 'boolean', required: true },
    ],
  },
  {
    code: 'weighbridge',
    label: 'Balança rodoviária',
    mobility: 'fixed',
    characteristics: [
      { key: 'maxWeightKg', label: 'Capacidade máxima (kg)', kind: 'number', required: true, minimum: 1000, maximum: 120000 },
      { key: 'precisionKg', label: 'Precisão (kg)', kind: 'number', required: true, minimum: 0.1, maximum: 10 },
    ],
  },
  {
    code: 'enforcement_vehicle',
    label: 'Veículo de fiscalização',
    mobility: 'mobile',
    characteristics: [
      { key: 'vehicleClass', label: 'Categoria', kind: 'select', required: true, options: ['sedan', 'pickup', 'van'] },
      { key: 'plate', label: 'Placa demonstrativa', kind: 'text', required: true },
      { key: 'radioCode', label: 'Código de rádio', kind: 'text', required: true },
    ],
  },
  {
    code: 'access_barrier',
    label: 'Cancela de acesso',
    mobility: 'fixed',
    characteristics: [
      { key: 'laneCount', label: 'Faixas', kind: 'number', required: true, minimum: 1, maximum: 12 },
      { key: 'maxOpeningSeconds', label: 'Abertura máxima (s)', kind: 'number', required: true, minimum: 1, maximum: 120 },
      { key: 'accessMode', label: 'Controle de acesso', kind: 'select', required: true, options: ['tag', 'plate', 'manual'] },
    ],
  },
  {
    code: 'transit_vehicle',
    label: 'Veículo de transporte',
    mobility: 'mobile',
    characteristics: [
      { key: 'vehicleClass', label: 'Categoria', kind: 'select', required: true, options: ['bus', 'van', 'light_rail'] },
      { key: 'passengerCapacity', label: 'Capacidade de passageiros', kind: 'number', required: true, minimum: 1, maximum: 300 },
      { key: 'accessible', label: 'Acessível', kind: 'boolean', required: true },
    ],
  },
  {
    code: 'service_kiosk',
    label: 'Totem de atendimento',
    mobility: 'fixed',
    characteristics: [
      { key: 'screenInches', label: 'Tela (pol.)', kind: 'number', required: true, minimum: 7, maximum: 65 },
      { key: 'network', label: 'Conectividade', kind: 'select', required: true, options: ['ethernet', 'wifi', 'cellular'] },
    ],
  },
  {
    code: 'scooter',
    label: 'Patinete elétrico',
    mobility: 'mobile',
    characteristics: [
      { key: 'batteryCapacityWh', label: 'Bateria (Wh)', kind: 'number', required: true, minimum: 1, maximum: 1500 },
      { key: 'topSpeedKmh', label: 'Velocidade máxima (km/h)', kind: 'number', required: true, minimum: 1, maximum: 45 },
    ],
  },
  {
    code: 'motorcycle',
    label: 'Motocicleta',
    mobility: 'mobile',
    characteristics: [
      { key: 'engineCapacityCc', label: 'Cilindrada (cc)', kind: 'number', required: true, minimum: 50, maximum: 2000 },
      { key: 'plate', label: 'Placa demonstrativa', kind: 'text', required: true },
      { key: 'radioCode', label: 'Código de rádio', kind: 'text', required: true },
    ],
  },
  {
    code: 'patrol_vehicle',
    label: 'Viatura',
    mobility: 'mobile',
    characteristics: [
      { key: 'vehicleClass', label: 'Categoria', kind: 'select', required: true, options: ['sedan', 'pickup', 'van'] },
      { key: 'plate', label: 'Placa demonstrativa', kind: 'text', required: true },
      { key: 'radioCode', label: 'Código de rádio', kind: 'text', required: true },
    ],
  },
];

const characteristicsSchemas: Record<string, z.ZodType<Record<string, string | number | boolean>>> = {
  speed_radar: z.object({
    speedLimitKmh: z.number().int().min(20).max(130),
    lanes: z.number().int().min(1).max(8),
    technology: z.enum(['doppler', 'laser', 'sectional']),
  }).strict(),
  surveillance_camera: z.object({
    resolution: z.enum(['1080p', '2k', '4k']),
    nightVision: z.boolean(),
    panTiltZoom: z.boolean(),
  }).strict(),
  weighbridge: z.object({
    maxWeightKg: z.number().int().min(1000).max(120000),
    precisionKg: z.number().min(0.1).max(10),
  }).strict(),
  enforcement_vehicle: z.object({
    vehicleClass: z.enum(['sedan', 'pickup', 'van']),
    plate,
    radioCode: z.string().trim().min(2).max(20),
  }).strict(),
  access_barrier: z.object({
    laneCount: z.number().int().min(1).max(12),
    maxOpeningSeconds: z.number().int().min(1).max(120),
    accessMode: z.enum(['tag', 'plate', 'manual']),
  }).strict(),
  transit_vehicle: z.object({
    vehicleClass: z.enum(['bus', 'van', 'light_rail']),
    passengerCapacity: z.number().int().min(1).max(300),
    accessible: z.boolean(),
  }).strict(),
  service_kiosk: z.object({
    screenInches: z.number().min(7).max(65),
    network: z.enum(['ethernet', 'wifi', 'cellular']),
  }).strict(),
  scooter: z.object({
    batteryCapacityWh: z.number().int().min(1).max(1500),
    topSpeedKmh: z.number().int().min(1).max(45),
  }).strict(),
  motorcycle: z.object({
    engineCapacityCc: z.number().int().min(50).max(2000),
    plate,
    radioCode: z.string().trim().min(2).max(20),
  }).strict(),
  patrol_vehicle: z.object({
    vehicleClass: z.enum(['sedan', 'pickup', 'van']),
    plate,
    radioCode: z.string().trim().min(2).max(20),
  }).strict(),
};

export function validateEquipmentCharacteristics(
  typeCode: string,
  input: unknown,
): Record<string, string | number | boolean> {
  const schema = characteristicsSchemas[typeCode];
  if (!schema) {
    throw new BadRequestException('Tipo de equipamento não possui um esquema de características ativo.');
  }

  const result = schema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    throw new BadRequestException({
      message: 'Características incompatíveis com o tipo de equipamento.',
      errors: issues,
    });
  }
  return result.data;
}
