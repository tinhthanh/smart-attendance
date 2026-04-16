import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ItemResponse, ListResponse } from '../../shared/types/branch.types';
import {
  ListSessionsQuery,
  OverrideSessionDto,
  Session,
  SessionWithEvents,
} from '../../shared/types/attendance-session.types';
import { ApiService } from '../api/api.service';

function qs(q: Record<string, unknown>): string {
  const entries = Object.entries(q).filter(
    ([, v]) => v !== undefined && v !== null && v !== ''
  );
  if (entries.length === 0) return '';
  return (
    '?' +
    entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
  );
}

@Injectable({ providedIn: 'root' })
export class AttendanceApiService {
  private readonly api = inject(ApiService);

  list(query: ListSessionsQuery): Observable<ListResponse<Session>> {
    return this.api.get<ListResponse<Session>>(
      `/attendance/sessions${qs(query as Record<string, unknown>)}`
    );
  }

  get(id: string): Observable<ItemResponse<SessionWithEvents>> {
    return this.api.get<ItemResponse<SessionWithEvents>>(
      `/attendance/sessions/${id}`
    );
  }

  override(
    id: string,
    dto: OverrideSessionDto
  ): Observable<ItemResponse<{ id: string; status: string; note: string }>> {
    return this.api.patch<
      ItemResponse<{ id: string; status: string; note: string }>
    >(`/attendance/sessions/${id}`, dto);
  }
}
