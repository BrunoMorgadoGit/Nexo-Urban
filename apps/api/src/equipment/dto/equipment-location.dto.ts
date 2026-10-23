import { Transform, Type } from 'class-transformer';
import { IsIn, IsLatitude, IsLongitude, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class EquipmentLocationDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @Matches(/^\d{5}-?\d{3}$/)
  postalCode!: string;

  @IsString()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(2)
  @MaxLength(160)
  street!: string;

  @IsString()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(1)
  @MaxLength(100)
  reference!: string;

  @IsUUID()
  regionId!: string;

  @IsString()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(2)
  @MaxLength(100)
  city!: string;

  @Matches(/^[A-Z]{2}$/)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  state!: string;

  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @IsIn(['fixed', 'base'])
  role!: 'fixed' | 'base';
}
