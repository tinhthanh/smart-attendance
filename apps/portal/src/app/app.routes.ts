import { Route } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const appRoutes: Route[] = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  { path: '**', redirectTo: 'dashboard' },
];
