import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    redirect: '/explorer',
  },
  {
    path: '/explorer',
    name: 'explorer',
    component: () => import('./views/LogExplorer.vue'),
  },
  {
    path: '/live',
    name: 'live',
    component: () => import('./views/LiveTail.vue'),
  },
  {
    path: '/alerts',
    name: 'alerts',
    component: () => import('./views/AlertRules.vue'),
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('./views/Dashboard.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('./views/Settings.vue'),
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
