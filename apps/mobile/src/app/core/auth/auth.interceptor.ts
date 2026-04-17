import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { getCachedAccessToken } from './token-storage';
import { AuthService } from './auth.service';

let isRefreshing = false;
const refreshSubject = new BehaviorSubject<string | null>(null);
const SKIP_PATHS = ['/auth/login', '/auth/refresh'];

function shouldSkip(url: string): boolean {
  return SKIP_PATHS.some((p) => url.includes(p));
}

function addToken(
  req: HttpRequest<unknown>,
  token: string
): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const auth = inject(AuthService);

  const token = getCachedAccessToken();
  if (token && !shouldSkip(req.url)) {
    req = addToken(req, token);
  }

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || shouldSkip(req.url)) {
        return throwError(() => err);
      }

      if (!isRefreshing) {
        isRefreshing = true;
        refreshSubject.next(null);
        return new Observable<HttpEvent<unknown>>((subscriber) => {
          auth
            .refreshToken()
            .then((ok) => {
              isRefreshing = false;
              if (ok) {
                const newToken = getCachedAccessToken()!;
                refreshSubject.next(newToken);
                next(addToken(req, newToken)).subscribe(subscriber);
              } else {
                refreshSubject.next(null);
                auth.logout();
                subscriber.error(err);
              }
            })
            .catch(() => {
              isRefreshing = false;
              refreshSubject.next(null);
              auth.logout();
              subscriber.error(err);
            });
        });
      }

      return refreshSubject.pipe(
        filter((t) => t !== null),
        take(1),
        switchMap((newToken) => next(addToken(req, newToken!)))
      );
    })
  );
};
