import { firstValueFrom } from 'rxjs';
import { BranchesApiService } from '../branches/branches.api.service';

/**
 * Resolve the first branch a manager has scope over.
 * Used for dashboard auto-redirect from `/dashboard` → `/dashboard/branch/:id`.
 */
export async function getFirstManagerBranchId(
  branches: BranchesApiService
): Promise<string | null> {
  try {
    const resp = await firstValueFrom(branches.list({ limit: 1 }));
    return resp.data[0]?.id ?? null;
  } catch {
    return null;
  }
}
