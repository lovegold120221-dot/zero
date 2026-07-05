import { getBackendUrl } from './whatsappClient';

export interface WebGlanceResult {
  query: string;
  heading?: string;
  abstract?: string;
  source?: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
}

export async function webGlance(query: string, maxResults = 3): Promise<WebGlanceResult> {
  const trimmed = query.trim();
  if (!trimmed) throw new Error('Search query is required.');

  const res = await fetch(`${getBackendUrl()}/api/web/glance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: trimmed, maxResults }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Server returned ${res.status}`);
  return data as WebGlanceResult;
}
