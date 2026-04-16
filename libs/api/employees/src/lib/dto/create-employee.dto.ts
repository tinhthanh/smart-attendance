import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class CreateEmployeeDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(8, 100)
  password!: string;

  @IsString()
  @Length(1, 100)
  full_name!: string;

  @IsOptional()
  @Matches(/^[0-9+\-\s()]{8,20}$/, {
    message: 'phone must be digits, +, -, space or ()',
  })
  phone?: string;

  @IsString()
  @Length(1, 30)
  @Matches(/^[A-Z0-9-]+$/, {
    message: 'employee_code must be uppercase letters, digits, or dash',
  })
  employee_code!: string;

  @IsUUID()
  primary_branch_id!: string;

  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsIn(['admin', 'manager', 'employee'])
  role!: 'admin' | 'manager' | 'employee';
}
