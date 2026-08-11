// Centralized tool safety: schema validation + execution receipts.
//
// Every tool result is wrapped in a structured receipt so the agent can
// distinguish real external data from simulated/fallback output, and so
// unknown tools fail closed instead of silently succeeding.

export interface ToolReceipt {
  ok: boolean;
  source: 'external' | 'local' | 'mock' | 'error';
  retrievedAt: string;
  verified: boolean;
  simulated: boolean;
  confidence: number; // 0..1
  externalReceipt?: { provider: string; reference?: string };
  error?: string;
}

export function receipt(
  base: Partial<ToolReceipt> & { ok: boolean },
): ToolReceipt {
  const simulated = base.simulated ?? base.source === 'mock';
  return {
    ok: base.ok,
    source: base.source ?? (base.ok ? 'local' : 'error'),
    retrievedAt: new Date().toISOString(),
    verified: base.verified ?? false,
    simulated,
    confidence: base.confidence ?? (base.ok ? (simulated ? 0.5 : 0.9) : 0),
    externalReceipt: base.externalReceipt,
    error: base.error,
  };
}

export function failure(error: string): ToolReceipt {
  return receipt({ ok: false, source: 'error', verified: false, confidence: 0, error });
}

// ── Minimal schema validation (no external deps) ──

type FieldSpec =
  | { type: 'string'; min?: number; max?: number; pattern?: RegExp }
  | { type: 'number'; min?: number; max?: number }
  | { type: 'boolean' }
  | { type: 'object' }
  | { type: 'any' };

export interface SchemaSpec {
  [key: string]: FieldSpec;
}

export function validateParams(
  params: Record<string, any>,
  schema: SchemaSpec,
): { valid: true } | { valid: false; error: string } {
  for (const [key, spec] of Object.entries(schema)) {
    const value = params[key];
    if (value === undefined || value === null || value === '') {
      return { valid: false, error: `Missing required parameter: ${key}` };
    }
    switch (spec.type) {
      case 'string': {
        if (typeof value !== 'string') return { valid: false, error: `${key} must be a string` };
        const s = value as string;
        if (spec.min !== undefined && s.length < spec.min) return { valid: false, error: `${key} must be at least ${spec.min} characters` };
        if (spec.max !== undefined && s.length > spec.max) return { valid: false, error: `${key} must be at most ${spec.max} characters` };
        if (spec.pattern && !spec.pattern.test(s)) return { valid: false, error: `${key} has an invalid format` };
        break;
      }
      case 'number': {
        const n = Number(value);
        if (Number.isNaN(n)) return { valid: false, error: `${key} must be a number` };
        if (spec.min !== undefined && n < spec.min) return { valid: false, error: `${key} must be >= ${spec.min}` };
        if (spec.max !== undefined && n > spec.max) return { valid: false, error: `${key} must be <= ${spec.max}` };
        break;
      }
      case 'boolean': {
        if (typeof value !== 'boolean') return { valid: false, error: `${key} must be a boolean` };
        break;
      }
      case 'object': {
        if (typeof value !== 'object' || Array.isArray(value)) return { valid: false, error: `${key} must be an object` };
        break;
      }
      default:
        break;
    }
  }
  return { valid: true };
}
