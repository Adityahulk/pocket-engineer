import { Platform } from 'react-native';

import type { CommandCenter, GitHubRepository, Project, Task, TaskEvent, VoiceClientSecret, VoiceConfig } from './types';
import { supabase } from './supabase';

const defaultHost = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? defaultHost;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = (await supabase?.auth.getSession())?.data.session?.access_token;
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  baseUrl,
  commandCenter: () => request<CommandCenter>('/v1/command-center'),
  projects: () => request<Project[]>('/v1/projects'),
  createProject: (repository: GitHubRepository, installationId: number) => request<Project>('/v1/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: repository.full_name.split('/').at(-1), repo_url: repository.clone_url,
      repo_full_name: repository.full_name, default_branch: repository.default_branch,
      github_installation_id: installationId,
    }),
  }),
  project: (id: string) => request<Project>(`/v1/projects/${id}`),
  tasks: (projectId: string) => request<Task[]>(`/v1/projects/${projectId}/tasks`),
  task: (id: string) => request<Task>(`/v1/tasks/${id}`),
  taskEvents: (id: string) => request<TaskEvent[]>(`/v1/tasks/${id}/events`),
  createTask: (projectId: string, goal: string, mode: 'fix' | 'modify') => request<Task>(`/v1/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify({ goal, mode }) }),
  approve: (id: string, decision: 'approved' | 'rejected') => request<Task>(`/v1/tasks/${id}/approval`, { method: 'POST', body: JSON.stringify({ decision }) }),
  createPullRequest: (id: string) => request<Task>(`/v1/tasks/${id}/pull-request`, { method: 'POST' }),
  cancel: (id: string) => request<Task>(`/v1/tasks/${id}/cancel`, { method: 'POST' }),
  githubConfig: () => request<{ enabled: boolean; installation_url: string | null }>('/v1/github/config'),
  githubRepositories: (installationId: number) => request<GitHubRepository[]>(`/v1/github/installations/${installationId}/repositories`),
  voiceConfig: () => request<VoiceConfig>('/v1/voice/config'),
  voiceClientSecret: (projectId?: string, missionId?: string) => request<VoiceClientSecret>('/v1/voice/client-secret', {
    method: 'POST', body: JSON.stringify({ project_id: projectId, mission_id: missionId }),
  }),
};
