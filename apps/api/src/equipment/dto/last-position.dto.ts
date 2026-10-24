import { Type } from 'class-transformer';
import { IsDateString, IsLatitude, IsLongitude } from 'class-validator';
import { IsRecordedAtWithinClockSkew } from '../../common/validators/recorded-at.validator.js';

export class LastPositionDto {
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @IsDateString()
  @IsRecordedAtWithinClockSkew()
  recordedAt!: string;
}
