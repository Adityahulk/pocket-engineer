export type Project = {
  id: string; name: string; provider: string; repo_url: string; repo_full_name: string | null;
  default_branch: string; status: string; is_demo: boolean; health_status: string; health_summary: string;
  incident_count: number; last_signal_at: string | null; created_at: string;
};

export type Verification = {
  name: string; category: string; status: 'passed' | 'failed' | 'blocked' | 'skipped' | 'not_applicable';
  command: string | null; duration_ms: number; output: string; required: boolean;
};

export type Task = {
  id: string; project_id: string; goal: string; mode: 'fix' | 'modify';
  priority: 'normal' | 'high' | 'urgent'; autonomy: 'assisted' | 'autopilot';
  state: string; base_sha: string | null; summary: string | null; root_cause: string | null;
  investigation: { file_count?: number; files?: string[]; notes?: string; hits?: { path: string; line: number; text: string }[] };
  diff: string | null; verification: Verification[]; error: string | null; feedback: string | null;
  approval_status: 'pending' | 'approved' | 'rejected'; pull_request_url: string | null;
  pull_request_state: string | null; created_at: string; updated_at: string;
  engineer_name: string; engineer_provider: string;
};

export type TaskEvent = {
  sequence: number; event_type: string; message: string; details: Record<string, unknown>; created_at: string;
};

export type GitHubRepository = {
  full_name: string; clone_url: string; default_branch: string; private: boolean;
};

export type Engineer = {
  id: string; name: string; specialty: string; status: string;
  current_mission_id: string | null; project_id: string | null;
};

export type CommandCenter = {
  portfolio_health: string; active_missions: number; approval_count: number; incident_count: number;
  engineer_name: string; engineer_title: string;
  projects: Project[]; engineers: Engineer[]; pending_decisions: Task[]; active_mission_list: Task[];
};

export type VoiceConfig = {
  enabled: boolean; provider: string; model: string; voice: string;
  engineer_name: string; engineer_title: string;
};
export type VoiceClientSecret = { value: string; expires_at?: number };
export type VoiceToolResult = {
  started?: boolean; shipped?: boolean; rejected?: boolean;
  mission?: Task; incident_count?: number;
};
