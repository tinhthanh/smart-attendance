import { IsIn, IsISO8601, IsOptional, IsUUID } from 'class-validator';

export class CreateExportDto {
  @IsIn(['attendance_csv'])
  type!: 'attendance_csv';

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsISO8601({ strict: true })
  date_from!: string;

  @IsISO8601({ strict: true })
  date_to!: string;
}
