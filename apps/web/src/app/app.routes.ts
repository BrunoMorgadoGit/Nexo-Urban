import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'equipments' },
  {
    path: 'equipments',
    pathMatch: 'full',
    loadComponent: () => import('./equipment/equipment-list.component').then((module) => module.EquipmentListComponent),
  },
  {
    path: 'equipments/new',
    loadComponent: () => import('./equipment/equipment-editor.component').then((module) => module.EquipmentEditorComponent),
  },
  {
    path: 'equipments/:id/edit',
    loadComponent: () => import('./equipment/equipment-editor.component').then((module) => module.EquipmentEditorComponent),
  },
  {
    path: 'equipments/:id',
    loadComponent: () => import('./equipment/equipment-details.component').then((module) => module.EquipmentDetailsComponent),
  },
  {
    path: 'agents',
    pathMatch: 'full',
    loadComponent: () => import('./agents/agents-list.component').then((module) => module.AgentsListComponent),
  },
  {
    path: 'agents/new',
    loadComponent: () => import('./agents/agent-editor.component').then((module) => module.AgentEditorComponent),
  },
  {
    path: 'agents/:id/edit',
    loadComponent: () => import('./agents/agent-editor.component').then((module) => module.AgentEditorComponent),
  },
  {
    path: 'agents/:id',
    loadComponent: () => import('./agents/agent-details.component').then((module) => module.AgentDetailsComponent),
  },
  {
    path: 'maintenance',
    loadComponent: () => import('./maintenance/maintenance-list.component').then((module) => module.MaintenanceListComponent),
  },
  { path: '**', redirectTo: 'equipments' },
];
