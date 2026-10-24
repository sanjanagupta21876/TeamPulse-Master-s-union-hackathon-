import { API_BASE_URL } from './api';

export type MissionStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type InterventionStatus = 'proposed' | 'approved' | 'rejected' | 'resolved' | 'failed' | 'escalated';
export type LoopStage = 'detect' | 'diagnose' | 'intervene' | 'verify' | 'adapt' | 'recovered';

export interface RiskSignal {
  code: string;
  message: string;
}

export interface MissionView {
  id: string;
  title: string;
  owner_id: string | null;
  owner_call_sign: string | null;
  status: MissionStatus;
  progress: number;
  estimate_hours: number;
  remaining_hours: number;
  due_at: string;
  last_update_at: string | null;
  depends_on: string[];
  risk_level: RiskLevel;
  signals: RiskSignal[];
  downstream: string[];
  is_root_bottleneck: boolean;
}

export interface MissionUpdateView {
  id: string;
  mission_id: string;
  crew_call_sign: string | null;
  text: string;
  progress: number;
  status: MissionStatus;
  simulated: boolean;
  created_at: string;
}

export interface CheckInView {
  id: string;
  mission_id: string;
  crew_call_sign: string | null;
  question: string;
  answer: string | null;
  created_at: string;
  answered_at: string | null;
}

export interface InterventionView {
  id: string;
  mission_id: string;
  mission_title: string;
  cause: string;
  cause_label: string;
  confidence: 'low' | 'medium' | 'high';
  diagnosis_source: 'rules' | 'llm';
  explanation: string;
  evidence: string[];
  action_code: string;
  action_title: string;
  action_summary: string;
  steps: string[];
  message_draft: string;
  success_criteria: string;
  status: InterventionStatus;
  attempt_no: number;
  previous_intervention_id: string | null;
  verification_note: string | null;
  created_at: string;
  decided_at: string | null;
  verified_at: string | null;
}

export interface TimelineEvent {
  id: string;
  kind: string;
  /** "agent", "captain", "system" or "crew:<call sign>" */
  actor: string;
  message: string;
  meta: string | null;
  mission_id: string | null;
  intervention_id: string | null;
  simulated: boolean;
  created_at: string;
}

export interface CrewMember {
  id: string;
  call_sign: string;
  role: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  deadline_at: string;
}

export interface MissionControlView {
  project: ProjectSummary;
  now: string;
  hours_to_deadline: number;
  risk_level: RiskLevel;
  emergency_mode: boolean;
  root_bottleneck_id: string | null;
  loop_stage: LoopStage;
  crew: CrewMember[];
  missions: MissionView[];
  active_intervention: InterventionView | null;
  interventions: InterventionView[];
  checkins: CheckInView[];
  updates: MissionUpdateView[];
  timeline: TimelineEvent[];
  llm_enabled: boolean;
}

export const DEMO_PROJECT_ID = 'proj_campus_events';

export class TeamAPIClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private async request<T>(path: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new Error(`Unable to reach the backend at ${this.baseUrl}. Is the FastAPI server running?`);
    }

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error?.message || data?.detail || `Request failed with status ${response.status}`);
    }
    return data as T;
  }

  getMissionControl(projectId: string = DEMO_PROJECT_ID) {
    return this.request<MissionControlView>(`/api/team/projects/${projectId}/mission-control`);
  }

  analyze(projectId: string = DEMO_PROJECT_ID) {
    return this.request<MissionControlView>(`/api/team/projects/${projectId}/analyze`, 'POST');
  }

  approve(interventionId: string) {
    return this.request<MissionControlView>(`/api/team/interventions/${interventionId}/approve`, 'POST');
  }

  reject(interventionId: string) {
    return this.request<MissionControlView>(`/api/team/interventions/${interventionId}/reject`, 'POST');
  }

  createCheckIn(missionId: string, question?: string) {
    return this.request<CheckInView>(`/api/team/missions/${missionId}/checkins`, 'POST', { question: question || null });
  }

  answerCheckIn(checkInId: string, answer: string) {
    return this.request<CheckInView>(`/api/team/checkins/${checkInId}/answer`, 'POST', { answer });
  }

  simulateUpdate(missionId: string, outcome: 'resolved' | 'still_blocked') {
    return this.request<MissionControlView>(`/api/team/missions/${missionId}/simulate-update`, 'POST', { outcome });
  }

  resetDemo() {
    return this.request<MissionControlView>('/api/team/demo/reset', 'POST');
  }
}

export const teamApi = new TeamAPIClient();
