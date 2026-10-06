/// <reference types="vite/client" />
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Project {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  archivedAt: string | null;
  version: number;
  data: any;
}

export const projectsApi = {
  list: () => apiClient.get<Project[]>('/projects').then(res => res.data),
  get: (id: string) => apiClient.get<Project>(`/projects/${id}`).then(res => res.data),
  create: (data: Partial<Project>) => apiClient.post<Project>('/projects', data).then(res => res.data),
  update: (id: string, data: Partial<Project>) => apiClient.put<Project>(`/projects/${id}`, data).then(res => res.data),
  delete: (id: string) => apiClient.delete(`/projects/${id}`),
  duplicate: (id: string) => apiClient.post<Project>(`/projects/${id}/duplicate`).then(res => res.data),
  archive: (id: string) => apiClient.put<Project>(`/projects/${id}/archive`).then(res => res.data),
  import: (data: any) => apiClient.post<Project>('/projects/import', data).then(res => res.data),
  exportUrl: (id: string) => `${API_URL}/projects/${id}/export`,
};
