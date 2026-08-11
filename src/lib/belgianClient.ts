import { getBackendUrl, getAuthHeaders } from './whatsappClient';

/**
 * Executes a Belgian-specific administrative or business tool on the backend Express server.
 * @param tool The name of the Belgian tool to call.
 * @param params Object containing tool-specific arguments.
 */
export async function callBelgianTool(tool: string, params: Record<string, any> = {}): Promise<any> {
  const backendUrl = getBackendUrl();
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${backendUrl}/api/belgian/tool`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({
      tool,
      params,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Server returned status ${response.status}`);
  }
  return data;
}
