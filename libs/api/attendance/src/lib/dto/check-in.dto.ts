import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
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

export class CheckInDto {
  @Type(() => Number) @IsLatitude() latitude!: number;
  @Type(() => Number) @IsLongitude() longitude!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5000)
  accuracy_meters!: number;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  ssid?: string;

  @IsOptional()
  @Matches(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/, {
    message: 'bssid must be a MAC address format (aa:bb:cc:dd:ee:ff)',
  })
  bssid?: string;

  @IsString()
  @Length(8, 128)
  device_fingerprint!: string;

  @IsIn(['ios', 'android', 'web'])
  platform!: 'ios' | 'android' | 'web';

  @IsOptional()
  @IsString()
  @Length(1, 100)
  device_name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  app_version?: string;

  @IsBoolean()
  is_mock_location!: boolean;
}
