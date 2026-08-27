import type { CommandCenter, GitHubRepository, Project, Task, TaskEvent, VoiceClientSecret, VoiceConfig, VoiceToolResult } from './types';
import { publicEnv } from './env';
import { ensureSupabase } from './supabase';

const baseUrl = publicEnv.apiUrl;

async function authHeader(): Promise<Record<string, string>> {
  const client = await ensureSupabase();
  const accessToken = (await client?.auth.getSession())?.data.session?.access_token;
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeader()),
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
  decisions: () => request<Task[]>('/v1/decisions'),
  missions: () => request<Task[]>('/v1/missions'),
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
  taskEvents: (id: string, after = 0) => request<TaskEvent[]>(`/v1/tasks/${id}/events?after=${after}`),
  createTask: (projectId: string, goal: string, mode: 'fix' | 'modify', autonomy: 'assisted' | 'autopilot' = 'assisted') =>
    request<Task>(`/v1/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify({ goal, mode, autonomy }) }),
  approve: (id: string, decision: 'approved' | 'rejected', feedback?: string) =>
    request<Task>(`/v1/tasks/${id}/approval`, { method: 'POST', body: JSON.stringify({ decision, feedback }) }),
  createPullRequest: (id: string) => request<Task>(`/v1/tasks/${id}/pull-request`, { method: 'POST' }),
  ship: (id: string) => request<Task>(`/v1/tasks/${id}/ship`, { method: 'POST' }),
  cancel: (id: string) => request<Task>(`/v1/tasks/${id}/cancel`, { method: 'POST' }),
  registerDevice: (expoPushToken: string, platform: string) => request('/v1/devices', {
    method: 'POST', body: JSON.stringify({ expo_push_token: expoPushToken, platform }),
  }),
  githubConfig: () => request<{ enabled: boolean; installation_url: string | null }>('/v1/github/config'),
  githubRepositories: (installationId: number) => request<GitHubRepository[]>(`/v1/github/installations/${installationId}/repositories`),
  voiceConfig: () => request<VoiceConfig>('/v1/voice/config'),
  voiceClientSecret: (projectId?: string, missionId?: string) => request<VoiceClientSecret>('/v1/voice/client-secret', {
    method: 'POST', body: JSON.stringify({ project_id: projectId, mission_id: missionId }),
  }),
  voiceTool: (name: string, args: Record<string, unknown>, projectId?: string, missionId?: string) =>
    request<VoiceToolResult>('/v1/voice/tools', {
      method: 'POST',
      body: JSON.stringify({ name, arguments: args, project_id: projectId, mission_id: missionId }),
    }),
};

export async function streamTaskEvents(
  taskId: string,
  after: number,
  onEvent: (event: TaskEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(`${baseUrl}/v1/tasks/${taskId}/events/stream?after=${after}`, {
    headers: { Accept: 'text/event-stream', ...(await authHeader()) },
    signal,
  });
  if (!response.ok || !response.body) throw new Error('Event stream unavailable');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';
    for (const chunk of chunks) {
      const dataLine = chunk.split('\n').find((line) => line.startsWith('data: '));
      if (!dataLine) continue;
      try {
        onEvent(JSON.parse(dataLine.slice(6)) as TaskEvent);
      } catch {
        continue;
      }
    }
  }
}
