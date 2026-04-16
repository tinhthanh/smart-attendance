import { PaginationDto } from '@smart-attendance/api/common';
import { IsIn, IsISO8601, IsOptional, IsUUID } from 'class-validator';

export class ListSessionsQueryDto extends PaginationDto {
  @IsOptional() @IsUUID() branch_id?: string;
  @IsOptional() @IsUUID() employee_id?: string;
  @IsOptional() @IsISO8601({ strict: true }) date_from?: string;
  @IsOptional() @IsISO8601({ strict: true }) date_to?: string;

  @IsOptional()
  @IsIn([
    'on_time',
    'late',
    'early_leave',
    'overtime',
    'missing_checkout',
    'absent',
  ])
  status?:
    | 'on_time'
    | 'late'
    | 'early_leave'
    | 'overtime'
    | 'missing_checkout'
    | 'absent';
}
