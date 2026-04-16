import { PaginationDto } from '@smart-attendance/api/common';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class ListBranchesQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsString()
  @Length(1, 50)
  search?: string;
}
