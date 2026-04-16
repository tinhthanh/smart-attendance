import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AttendanceSession,
  CheckInRequest,
  CheckInResponse,
  CheckOutResponse,
  ItemResponse,
  ListResponse,
} from '../../shared/types/checkin.types';
import { ApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class CheckinApiService {
  private readonly api = inject(ApiService);

  checkIn(body: CheckInRequest): Observable<ItemResponse<CheckInResponse>> {
    return this.api.post<ItemResponse<CheckInResponse>>(
      '/attendance/check-in',
      body
    );
  }

  checkOut(body: CheckInRequest): Observable<ItemResponse<CheckOutResponse>> {
    return this.api.post<ItemResponse<CheckOutResponse>>(
      '/attendance/check-out',
      body
    );
  }

  listMe(
    dateFrom?: string,
    dateTo?: string
  ): Observable<ListResponse<AttendanceSession>> {
    const params: string[] = ['limit=30'];
    if (dateFrom) params.push(`date_from=${encodeURIComponent(dateFrom)}`);
    if (dateTo) params.push(`date_to=${encodeURIComponent(dateTo)}`);
    return this.api.get<ListResponse<AttendanceSession>>(
      `/attendance/me?${params.join('&')}`
    );
  }
}
