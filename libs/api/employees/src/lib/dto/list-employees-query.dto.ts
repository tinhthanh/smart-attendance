import { PaginationDto } from '@smart-attendance/api/common';
import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class ListEmployeesQueryDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsIn(['active', 'on_leave', 'terminated'])
  status?: 'active' | 'on_leave' | 'terminated';

  @IsOptional()
  @IsString()
  @Length(1, 50)
  search?: string;
}
