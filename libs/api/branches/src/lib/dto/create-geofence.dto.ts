import { Type } from 'class-transformer';
import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateGeofenceDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @Type(() => Number)
  @IsLatitude()
  center_lat!: number;

  @Type(() => Number)
  @IsLongitude()
  center_lng!: number;

  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(2000)
  radius_meters!: number;
}
