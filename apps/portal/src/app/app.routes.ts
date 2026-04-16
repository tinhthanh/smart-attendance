import { Route } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const appRoutes: Route[] = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/main.layout').then((m) => m.MainLayout),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.page').then(
            (m) => m.DashboardPage
          ),
      },
      {
        path: 'branches',
        loadComponent: () =>
          import('./pages/branches/branches-list.page').then(
            (m) => m.BranchesListPage
          ),
      },
      {
        path: 'branches/:id',
        loadComponent: () =>
          import('./pages/branches/branch-detail.page').then(
            (m) => m.BranchDetailPage
          ),
      },
      {
        path: 'employees',
        loadComponent: () =>
          import('./pages/employees/employees-list.page').then(
            (m) => m.EmployeesListPage
          ),
      },
      {
        path: 'employees/:id',
        loadComponent: () =>
          import('./pages/employees/employee-detail.page').then(
            (m) => m.EmployeeDetailPage
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
