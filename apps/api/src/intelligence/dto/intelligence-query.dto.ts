import { IsIn, IsOptional } from 'class-validator';
import { intelligenceSourceScopes, type IntelligenceSourceScope } from '@fogo/contracts';

export class IntelligenceQueryDto {
  @IsOptional()
  @IsIn(intelligenceSourceScopes)
  sourceScope: IntelligenceSourceScope = 'demo';
}
