const BASE_URL = '/api/v1';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(response.status, body.error || response.statusText);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  // Logs
  searchLogs(params: Record<string, string>) {
    const query = new URLSearchParams(params).toString();
    return request<{ logs: unknown[]; total: number; limit: number; offset: number }>(
      `/logs?${query}`
    );
  },

  // Aggregations
  getLogVolume(params: Record<string, string>) {
    const query = new URLSearchParams(params).toString();
    return request<{ buckets: unknown[] }>(`/aggregations/volume?${query}`);
  },

  getErrorRate(params: Record<string, string>) {
    const query = new URLSearchParams(params).toString();
    return request<{ buckets: unknown[] }>(`/aggregations/error-rate?${query}`);
  },

  getTopSources(params: Record<string, string>) {
    const query = new URLSearchParams(params).toString();
    return request<{ sources: unknown[] }>(`/aggregations/top-sources?${query}`);
  },

  // Sources
  getSources() {
    return request<{ sources: string[] }>('/sources');
  },

  // Alerts
  listAlerts() {
    return request<{ rules: unknown[] }>('/alerts');
  },

  getAlert(id: string) {
    return request<unknown>(`/alerts/${id}`);
  },

  createAlert(data: unknown) {
    return request<unknown>('/alerts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateAlert(id: string, data: unknown) {
    return request<unknown>(`/alerts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteAlert(id: string) {
    return request<void>(`/alerts/${id}`, { method: 'DELETE' });
  },

  // Dashboards
  listDashboards() {
    return request<{ dashboards: unknown[] }>('/dashboards');
  },

  getDashboard(id: string) {
    return request<unknown>(`/dashboards/${id}`);
  },

  createDashboard(data: { name: string; description?: string }) {
    return request<unknown>('/dashboards', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteDashboard(id: string) {
    return request<void>(`/dashboards/${id}`, { method: 'DELETE' });
  },

  // API Keys
  listApiKeys() {
    return request<{ keys: unknown[] }>('/api-keys');
  },

  createApiKey(name: string) {
    return request<{ id: string; key: string; prefix: string }>('/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  revokeApiKey(id: string) {
    return request<void>(`/api-keys/${id}`, { method: 'DELETE' });
  },

  // Auth
  login(email: string, password: string) {
    return request<{ user: { id: string; email: string; name: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  logout() {
    return request<void>('/auth/logout', { method: 'POST' });
  },

  getMe() {
    return request<{ user: { id: string; email: string; name: string } }>('/auth/me');
  },

  register(email: string, password: string, name?: string) {
    return request<{ user: { id: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  },

  // Saved Searches
  listSavedSearches() {
    return request<{ searches: unknown[] }>('/saved-searches');
  },

  createSavedSearch(name: string, query: string, filters: Record<string, unknown>) {
    return request<{ id: string }>('/saved-searches', {
      method: 'POST',
      body: JSON.stringify({ name, query, filters }),
    });
  },

  deleteSavedSearch(id: string) {
    return request<void>(`/saved-searches/${id}`, { method: 'DELETE' });
  },
};
