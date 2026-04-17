import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Response } from 'express';
import { BusinessException } from './business-exception';
import { ErrorCode } from './error-codes';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof BusinessException) {
      res.status(exception.httpStatus).json({
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
      });
      return;
    }

    if (exception instanceof ThrottlerException) {
      res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        error: {
          code: ErrorCode.TOO_MANY_ATTEMPTS,
          message: 'Too many requests',
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : (payload as { message?: string | string[] }).message ??
            exception.message;
      const code = this.defaultCodeForStatus(status);
      const details =
        typeof payload === 'object' &&
        payload &&
        'message' in (payload as object)
          ? (payload as { message?: unknown }).message
          : undefined;
      res.status(status).json({
        error: {
          code,
          message: Array.isArray(message) ? message.join('; ') : message,
          details: Array.isArray(details) ? details : undefined,
        },
      });
      return;
    }

    this.logger.error('Unhandled exception', exception as Error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
      },
    });
  }

  private defaultCodeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_FAILED;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.INVALID_TOKEN;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.TOO_MANY_ATTEMPTS;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}
