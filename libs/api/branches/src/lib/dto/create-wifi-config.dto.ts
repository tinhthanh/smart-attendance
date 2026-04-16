import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateWifiConfigDto {
  @IsString()
  @Length(1, 32)
  ssid!: string;

  @IsOptional()
  @Matches(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/, {
    message: 'bssid must be a MAC address format (aa:bb:cc:dd:ee:ff)',
  })
  bssid?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  notes?: string;
}
