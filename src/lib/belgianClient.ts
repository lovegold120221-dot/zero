import { getBackendUrl } from './whatsappClient';

/**
 * Executes a Belgian-specific administrative or business tool on the backend Express server.
 * @param tool The name of the Belgian tool to call.
 * @param params Object containing tool-specific arguments.
 */
export async function callBelgianTool(tool: string, params: Record<string, any> = {}): Promise<any> {
  const backendUrl = getBackendUrl();
  const response = await fetch(`${backendUrl}/api/belgian/tool`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
