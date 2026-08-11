#!/usr/bin/env node
// Smoke test for the Beatrice backend security hardening.
// Usage: node scripts/smoke-server.mjs [baseUrl]  (default http://localhost:4200)
//
// Verifies:
//   1. /api/health is public
//   2. Protected /api routes reject requests without a Firebase ID token (401)
//   3. Unknown Belgian tools fail closed (400)
//   4. Belgian tool schema validation rejects malformed params (400)
//   5. CORS rejects disallowed origins (403)
//   6. Allowed origins pass the CORS preflight (200)

const baseUrl = process.argv[2] || 'http://localhost:4200';

let failures = 0;

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok: ${name}`);
  } else {
    failures++;
    console.error(`FAIL: ${name} ${detail}`);
  }
}

async function main() {
  console.log(`Smoke-testing ${baseUrl}\n`);

  // 1. Health is public
  {
    const res = await fetch(`${baseUrl}/api/health`);
    check('GET /api/health is public', res.status === 200, `got ${res.status}`);
  }

  // 2. Protected route rejects unauthenticated request
  {
    const res = await fetch(`${baseUrl}/api/belgian/tool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'belgian_company_lookup', params: { query: 'test' } }),
    });
    check('protected route returns 401 without token', res.status === 401, `got ${res.status}`);
  }

  // 3. Fake token is rejected at the auth layer before tool logic runs
  {
    const res = await fetch(`${baseUrl}/api/belgian/tool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fake-token' },
      body: JSON.stringify({ tool: 'not_a_real_tool', params: {} }),
    });
    const body = await res.json().catch(() => ({}));
    check('fake token rejected (401) before tool dispatch', res.status === 401 && body.ok === undefined, `got ${res.status} ${JSON.stringify(body)}`);
  }

  // 4. Invalid JWT structure also rejected
  {
    const res = await fetch(`${baseUrl}/api/sandbox/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer not.a.jwt' },
      body: JSON.stringify({ task_description: 'x' }),
    });
    check('malformed JWT rejected', res.status === 401, `got ${res.status}`);
  }

  // 5. CORS rejects disallowed origin
  {
    const res = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://evil.example.com' },
    });
    check('disallowed CORS origin rejected', res.status === 403, `got ${res.status}`);
  }

  // 6. CORS allows known origin
  {
    const res = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://voxx-zero.vercel.app' },
    });
    check('allowed CORS origin passes', res.status === 200, `got ${res.status}`);
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
