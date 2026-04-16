import { IsISO8601, IsOptional } from 'class-validator';

export class AdminJobRunDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  for_date?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  as_of?: string;
}
