import { Route } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const appRoutes: Route[] = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/tabs.layout').then((m) => m.TabsLayout),
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      {
        path: 'home',
        loadComponent: () =>
          import('./pages/home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./pages/history/history.page').then((m) => m.HistoryPage),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.page').then((m) => m.ProfilePage),
      },
    ],
  },
  { path: '', redirectTo: 'tabs/home', pathMatch: 'full' },
  { path: '**', redirectTo: 'tabs/home' },
];
