import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  full_name?: string;

  @IsOptional()
  @Matches(/^[0-9+\-\s()]{8,20}$/)
  phone?: string;

  @IsOptional()
  @IsUUID()
  primary_branch_id?: string;

  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsIn(['active', 'on_leave', 'terminated'])
  employment_status?: 'active' | 'on_leave' | 'terminated';
}
