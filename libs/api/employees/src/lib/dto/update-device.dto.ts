import { IsBoolean } from 'class-validator';

export class UpdateDeviceDto {
  @IsBoolean()
  is_trusted!: boolean;
}
