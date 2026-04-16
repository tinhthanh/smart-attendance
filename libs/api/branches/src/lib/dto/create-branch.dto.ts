import { Type } from 'class-transformer';
import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateBranchDto {
  @IsString()
  @Length(3, 20)
  @Matches(/^[A-Z0-9-]+$/, {
    message: 'code must be uppercase letters, digits, or dash',
  })
  code!: string;

  @IsString()
  @Length(1, 200)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  address?: string;

  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(50)
  @Max(1000)
  radius_meters?: number;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  timezone?: string;
}
