import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiSuccessResponse } from './types/api-response.type';

@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, ApiSuccessResponse<T> | T>
{
  intercept(
    _ctx: ExecutionContext,
    next: CallHandler<T>
  ): Observable<ApiSuccessResponse<T> | T> {
    return next.handle().pipe(
      map((payload) => {
        if (
          payload &&
          typeof payload === 'object' &&
          'data' in (payload as object)
        ) {
          return payload as unknown as ApiSuccessResponse<T>;
        }
        return { data: payload } as ApiSuccessResponse<T>;
      })
    );
  }
}
