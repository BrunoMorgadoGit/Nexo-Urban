import { registerDecorator, type ValidationOptions, ValidatorConstraint, type ValidatorConstraintInterface } from 'class-validator';

export const GPS_CLOCK_SKEW_TOLERANCE_MS = 2 * 60 * 1000;

@ValidatorConstraint({ name: 'recordedAtWithinClockSkew', async: false })
class RecordedAtWithinClockSkewConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const recordedAt = Date.parse(value);
    return Number.isFinite(recordedAt) && recordedAt <= Date.now() + GPS_CLOCK_SKEW_TOLERANCE_MS;
  }

  defaultMessage(): string {
    return 'recordedAt não pode estar mais de dois minutos no futuro.';
  }
}

export function IsRecordedAtWithinClockSkew(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    registerDecorator({
      name: 'recordedAtWithinClockSkew',
      target: target.constructor,
      propertyName: String(propertyKey),
      options,
      validator: RecordedAtWithinClockSkewConstraint,
    });
  };
}
