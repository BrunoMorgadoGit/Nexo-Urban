import { Type } from 'class-transformer';
import { IsDateString, IsLatitude, IsLongitude } from 'class-validator';

export class LastPositionDto {
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @IsDateString()
  recordedAt!: string;
}
