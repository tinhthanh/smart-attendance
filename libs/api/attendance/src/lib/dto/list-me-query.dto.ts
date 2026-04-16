import { PaginationDto } from '@smart-attendance/api/common';
import { IsISO8601, IsOptional } from 'class-validator';

export class ListMeQueryDto extends PaginationDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  date_from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  date_to?: string;
}
