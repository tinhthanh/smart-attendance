# Feature / Map Visualization (T-B02)

This plan outlines the steps to implement the "Map Visualization" bonus feature for the Smart Attendance project.

## User Review Required

> [!IMPORTANT]
> The Heatmap part of this task requires visualizing check-in locations. Should the heatmap be added to the Main Dashboard overview (`/dashboard`) or specifically inside the Anomalies page (`/anomalies`)? For now, I propose placing it on the Main Admin Dashboard. Please review and confirm.

## Proposed Changes

### Add Dependencies

- `leaflet`
- `@types/leaflet`
- `leaflet.heat` (for Heatmap)
- `@types/leaflet.heat`

We will install these at the root/workspace level or specifically for the `portal` app.

---

### Portal App (`apps/portal`)

#### [MODIFY] [branch-detail.page.ts](file:///Users/vetgo/smart-attendance/apps/portal/src/app/pages/branches/branch-detail.page.ts)

- Initialize a Leaflet map when the "Geofence" tab is active.
- Center the map on the branch's base coordinates.
- Draw circular overlays for each `geofence` configured (center and radius).
- Allow clicking the map to auto-fill latitude/longitude in the "Thêm Geofence" form.

#### [MODIFY] [branch-detail.page.html](file:///Users/vetgo/smart-attendance/apps/portal/src/app/pages/branches/branch-detail.page.html)

- Add a `<div id="map">` container above the geofence list.
- Apply styling so the map renders clearly (e.g., `height: 300px; width: 100%`).

#### [MODIFY] [dashboard.page.ts](file:///Users/vetgo/smart-attendance/apps/portal/src/app/pages/dashboard/dashboard.page.ts)

- Integrate a large Leaflet map configured with the `leaflet.heat` plugin.
- Fetch raw check-in coordinates from the API (requires a new endpoint or piggybacking on an existing session endpoint with `lat`/`lng` exposed) to populate the heatmap layer.

#### [NEW] API Endpoint (If needed)

If the current `/dashboard/admin/overview` doesn't return raw coordinates, we might need a quick `GET /dashboard/admin/heatmap` to fetch recent `(lat, lng, weight)` check-in points for the heatmap.

## Open Questions

1. Do we want to allow managers to "Edit" geofence radiuses directly by dragging the circles on the map, or keep it Display-Only and Form-driven? (Proposal: Display-only for v1, form-driven for inputs)
2. Should the heatmap show ALL sessions of the day, or should it highlight "Failed/Anomalous" check-ins in red vs "Success" in green?

## Verification Plan

### Automated Tests

- Run `pnpm nx run-many --target=test --all` to ensure no existing tests break.
- Add basic smoke tests for the Leaflet component rendering (mocking leaflet).

### Manual Verification

- Login as Admin on Portal.
- Go to Branches > Chi tiết > Tab "Geofence". Verify the map loads and shows the circles.
- Go to Dashboard, verify the heatmap loads showing employee check-in clusters.
