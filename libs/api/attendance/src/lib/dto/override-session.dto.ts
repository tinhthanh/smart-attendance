import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class OverrideSessionDto {
  @IsOptional()
  @IsIn(['on_time', 'late', 'early_leave', 'missing_checkout', 'absent'], {
    message:
      'status override allowed values: on_time, late, early_leave, missing_checkout, absent (overtime is auto-computed)',
  })
  status?: 'on_time' | 'late' | 'early_leave' | 'missing_checkout' | 'absent';

  @IsString()
  @Length(10, 500)
  note!: string;
}
