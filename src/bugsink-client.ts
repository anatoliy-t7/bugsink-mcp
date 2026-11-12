/**
 * Bugsink API Client (read-only)
 *
 * Client for interacting with Bugsink's REST API.
 * API docs: https://www.bugsink.com/blog/bugsink-2.0-api/
 *
 * This client intentionally only issues GET requests. Bugsink API tokens are
 * not scoped, so this code is the only thing preventing writes.
 */

export interface BugsinkConfig {
  baseUrl: string;
  apiToken: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
}

export interface PaginatedResponse<T> {
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Project {
  id: number;
  team: string;
  name: string;
  slug: string;
  dsn: string;
  digested_event_count: number;
  stored_event_count: number;
  alert_on_new_issue: boolean;
  alert_on_regression: boolean;
  alert_on_unmute: boolean;
  visibility: string;
  retention_max_event_count: number;
}

export interface Team {
  id: string;
  name: string;
  visibility: string;
}

export interface Issue {
  id: string;
  project: number;
  digest_order: number;
  first_seen: string;
  last_seen: string;
  digested_event_count: number;
  stored_event_count: number;
  calculated_type: string;
  calculated_value: string;
  transaction: string;
  is_resolved: boolean;
  is_resolved_by_next_release: boolean;
  is_muted: boolean;
}

export interface StackFrame {
  filename: string;
  function: string;
  lineno?: number;
  colno?: number;
  in_app?: boolean;
  context_line?: string;
  pre_context?: string[];
  post_context?: string[];
}

export interface ExceptionValue {
  type: string;
  value: string;
  stacktrace?: {
    frames: StackFrame[];
  };
}

export interface EventData {
  exception?: {
    values?: ExceptionValue[];
  };
  message?: string;
  level?: string;
  platform?: string;
  tags?: Record<string, string>;
  contexts?: Record<string, unknown>;
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
  };
  browser?: {
    name?: string;
    version?: string;
  };
  os?: {
    name?: string;
    version?: string;
  };
}

export interface Event {
  id: string;
  event_id: string;
  issue: string;
  project: number;
  timestamp: string;
  ingested_at: string;
  digested_at: string;
  digest_order: number;
  grouping: number;
  data?: EventData;
  stacktrace_md?: string;
}

export interface Release {
  id: string;
  project: number;
  version: string;
  date_released: string;
  semver?: string;
  is_semver?: boolean;
  sort_epoch?: number;
}

const MAX_ERROR_BODY = 500;

/**
 * Validate and normalize the Bugsink base URL. Requires https unless the host
 * is local, so the API token is never sent in cleartext over the network.
 */
export function normalizeBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`BUGSINK_URL is not a valid URL: ${raw}`);
  }
  const localHosts = ['localhost', '127.0.0.1', '[::1]'];
  if (url.protocol === 'http:' && !localHosts.includes(url.hostname)) {
    if (process.env.BUGSINK_ALLOW_HTTP !== '1') {
      throw new Error(
        'BUGSINK_URL must use https (set BUGSINK_ALLOW_HTTP=1 to override for trusted networks)'
      );
    }
  } else if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`BUGSINK_URL must be an http(s) URL, got ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new Error('BUGSINK_URL must not contain credentials');
  }
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/+$/, '');
}

/** Encode a single path segment so user input can't alter the request path. */
function seg(value: string | number): string {
  return encodeURIComponent(String(value));
}

export class BugsinkClient {
  private baseUrl: string;
  private apiToken: string;
  private timeoutMs: number;

  constructor(config: BugsinkConfig) {
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.apiToken = config.apiToken;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  get origin(): string {
    return this.baseUrl;
  }

  private async get(endpoint: string, accept: string): Promise<Response> {
    const url = `${this.baseUrl}/api/canonical/0${endpoint}`;

    const response = await fetch(url, {
      method: 'GET',
      // Never follow redirects: avoids leaking the token or hitting unexpected endpoints.
      redirect: 'error',
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        Accept: accept,
      },
    });

    if (!response.ok) {
      let body = '';
      try {
        body = (await response.text()).slice(0, MAX_ERROR_BODY);
      } catch {
        // ignore
      }
      throw new Error(`Bugsink API error (${response.status} ${response.statusText})${body ? `: ${body}` : ''}`);
    }

    return response;
  }

  private async getJson<T>(endpoint: string): Promise<T> {
    const response = await this.get(endpoint, 'application/json');
    return (await response.json()) as T;
  }

  async listProjects(): Promise<PaginatedResponse<Project>> {
    return this.getJson('/projects/');
  }

  async getProject(projectId: number): Promise<Project> {
    return this.getJson(`/projects/${seg(projectId)}/`);
  }

  async listTeams(): Promise<PaginatedResponse<Team>> {
    return this.getJson('/teams/');
  }

  async getTeam(teamId: string): Promise<Team> {
    return this.getJson(`/teams/${seg(teamId)}/`);
  }

  async listIssues(
    projectId: number,
    options?: {
      status?: string;
      limit?: number;
      sort?: 'digest_order' | 'last_seen';
      order?: 'asc' | 'desc';
    }
  ): Promise<PaginatedResponse<Issue>> {
    const params = new URLSearchParams();
    params.set('project', projectId.toString());
    if (options?.status) params.set('status', options.status);
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.sort) params.set('sort', options.sort);
    if (options?.order) params.set('order', options.order);

    const res = await this.getJson<PaginatedResponse<Issue>>(`/issues/?${params.toString()}`);
    if (options?.limit) res.results = res.results.slice(0, options.limit);
    return res;
  }

  async getIssue(issueId: string): Promise<Issue> {
    return this.getJson(`/issues/${seg(issueId)}/`);
  }

  async listEvents(issueId: string, options?: { limit?: number }): Promise<PaginatedResponse<Event>> {
    const params = new URLSearchParams();
    params.set('issue', issueId);
    if (options?.limit) params.set('limit', options.limit.toString());

    const res = await this.getJson<PaginatedResponse<Event>>(`/events/?${params.toString()}`);
    if (options?.limit) res.results = res.results.slice(0, options.limit);
    return res;
  }

  async getEvent(eventId: string): Promise<Event> {
    return this.getJson(`/events/${seg(eventId)}/`);
  }

  /** Get event stacktrace as pre-rendered Markdown */
  async getEventStacktrace(eventId: string): Promise<string> {
    const response = await this.get(`/events/${seg(eventId)}/stacktrace/`, 'text/markdown, text/plain, */*');
    return response.text();
  }

  async listReleases(projectId: number): Promise<PaginatedResponse<Release>> {
    const params = new URLSearchParams({ project: projectId.toString() });
    return this.getJson(`/releases/?${params.toString()}`);
  }

  async getRelease(releaseId: string): Promise<Release> {
    return this.getJson(`/releases/${seg(releaseId)}/`);
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const projects = await this.listProjects();
      return {
        success: true,
        message: `Connected successfully. Found ${projects.results.length} project(s).`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
