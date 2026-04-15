import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCodeValue } from './error-codes';

export class BusinessException extends HttpException {
  constructor(
    public readonly code: ErrorCodeValue,
    public readonly httpStatus: HttpStatus,
    message: string,
    public readonly details?: unknown
  ) {
    super({ code, message, details }, httpStatus);
  }
}
