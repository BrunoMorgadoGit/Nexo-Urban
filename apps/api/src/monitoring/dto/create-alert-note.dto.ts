import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAlertNoteDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  note!: string;
}
