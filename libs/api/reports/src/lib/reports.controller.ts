import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthUser, CurrentUser, Roles } from '@smart-attendance/api/auth';
import { RATE_LIMITS } from '@smart-attendance/shared/constants';
import type { Response } from 'express';
import { CreateExportDto } from './dto/create-export.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Roles('admin', 'manager')
  @Throttle({
    default: {
      ttl: RATE_LIMITS.EXPORT.ttl,
      limit: RATE_LIMITS.EXPORT.limit,
    },
  })
  @Post('export')
  @HttpCode(HttpStatus.ACCEPTED)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateExportDto) {
    return this.reports.createExportJob(user, dto);
  }

  @Roles('admin', 'manager')
  @Get('export/:jobId')
  status(
    @CurrentUser() user: AuthUser,
    @Param('jobId', new ParseUUIDPipe({ version: '4' })) jobId: string
  ) {
    return this.reports.getJobStatus(user, jobId);
  }

  @Roles('admin', 'manager')
  @Get('export/:jobId/download')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('jobId', new ParseUUIDPipe({ version: '4' })) jobId: string,
    @Res() res: Response
  ): Promise<void> {
    const { stream, filename, contentLength } = await this.reports.streamFile(
      user,
      jobId
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', contentLength);
    stream.pipe(res);
  }
}
