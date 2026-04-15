import { Controller, Get } from '@nestjs/common';
import { Public } from '@smart-attendance/api/auth';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get('health')
  getHealth() {
    return this.appService.getData();
  }
}
