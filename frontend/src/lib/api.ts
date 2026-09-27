import type { ConfigBody, SavedConfig, SharedConfig } from './config3d';
export type { ConfigBody, SavedConfig, SharedConfig };

const BASE = (((import.meta as any).env.REACT_APP_BACKEND_URL ?? '') as string).trim().replace(/\/$/, '');
export const apiUrl = (path: string) => {
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  // The downloaded frontend has no Emergent environment/backend. Its catalog
  // is bundled locally; other API operations still require the backend.
  if (!BASE && path.startsWith('/api/assets/catalog/')) return path.replace('/api/assets/catalog/', '/catalog/assets/');
  return `${BASE}${path}`;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(apiUrl(path), { credentials: 'include', ...init });
  if (!res.ok) {
    let detail: any = res.statusText;
    try { detail = (await res.json()).detail; } catch {}
    if (Array.isArray(detail)) detail = detail.map((d: any) => d.msg ?? JSON.stringify(d)).join(' ');
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return res.status === 204 ? (undefined as T) : res.json();
}
const json = (method: string, body?: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  me: () => request<User>('/api/auth/me'),
  login: (email: string, password: string) => request<User>('/api/auth/login', json('POST', { email, password })),
  register: (email: string, password: string, name: string) => request<User>('/api/auth/register', json('POST', { email, password, name })),
  logout: () => request('/api/auth/logout', json('POST')),
  catalog: () => request<Catalog>(BASE ? '/api/catalog' : '/catalog/catalog.json'),
  listConfigs: () => request<SavedConfig[]>('/api/configs'),
  createConfig: (body: ConfigBody) => request<SavedConfig>('/api/configs', json('POST', body)),
  updateConfig: (id: string, body: ConfigBody) => request<SavedConfig>(`/api/configs/${id}`, json('PUT', body)),
  deleteConfig: (id: string) => request(`/api/configs/${id}`, json('DELETE')),
  uploadPreview: (id: string, kind: 'coverFront' | 'boxInterior', blob: Blob) => {
    const fd = new FormData(); fd.append('file', blob, `${kind}.jpg`);
    return request<{ url: string }>(`/api/configs/${id}/previews/${kind}`, { method: 'POST', body: fd });
  },
  publish: (id: string, expiresInDays?: number) => request<{ shareToken: string; publishedAt: string; shareExpiresAt: string | null }>(`/api/configs/${id}/publish`, json('POST', { expiresInDays })),
  revoke: (id: string) => request(`/api/configs/${id}/revoke`, json('POST')),
  share: (token: string) => request<SharedConfig>(`/api/share/${token}`),
};

export interface User { id: string; email: string; name: string; role: string }
export interface Family { id: string; name: string; textureUrl: string }
export interface Variant { code: string; familyId: string; name: string; colorHex: string | null; swatchUrl: string; outOfProduction: boolean; pdfPage: number }
export interface Catalog { families: Family[]; variants: Variant[] }
