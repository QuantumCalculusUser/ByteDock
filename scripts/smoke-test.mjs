import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tempData = await mkdtemp(path.join(os.tmpdir(), 'bytedock-smoke-'))
const checks = []
const assert = (condition, message) => { if (!condition) throw new Error(message); checks.push(message) }
const freePort = async () => {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}
let mockServer
const mockWorkspaces = new Map()
const mockUsageEvents = []
const mockUsersByToken = new Map()
let secretKeyHeaderVerified = false
let apiProcess
let authGateProcess
let supabaseProcess
try {
  const providerPort = await freePort()
  const provider = createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${providerPort}`)
    res.setHeader('Content-Type', 'application/json')
    if (url.pathname === '/auth/v1/token' && req.method === 'POST') {
      let body = ''; for await (const chunk of req) body += chunk.toString()
      const payload = JSON.parse(body || '{}')
      const email = payload.email || 'one@example.test'
      const userId = email.startsWith('two@') ? 'mock-user-two' : 'mock-user-one'
      const token = userId === 'mock-user-two' ? 'mock-access-two' : 'mock-access-one'
      mockUsersByToken.set(token, { id: userId, email })
      res.end(JSON.stringify({ access_token: token, refresh_token: userId === 'mock-user-two' ? 'mock-refresh-two' : 'mock-refresh-one', token_type: 'bearer', expires_in: 3600, user: { id: userId, email } }))
      return
    }
    if (url.pathname === '/auth/v1/user' && req.method === 'GET') {
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
      const user = mockUsersByToken.get(token)
      if (!user) { res.statusCode = 401; res.end(JSON.stringify({ message: 'Invalid token' })); return }
      res.end(JSON.stringify(user)); return
    }
    if (url.pathname === '/auth/v1/logout' && req.method === 'POST') { res.end(JSON.stringify({})); return }
    if (url.pathname === '/rest/v1/workspaces' && req.method === 'GET') {
      secretKeyHeaderVerified ||= req.headers.apikey === 'sb_secret_mock' && !req.headers.authorization
      const filter = url.searchParams.get('user_id') || ''
      const id = filter.replace(/^eq\./, '')
      const row = mockWorkspaces.get(id)
      res.end(JSON.stringify(row ? [row] : [])); return
    }
    if (url.pathname === '/rest/v1/workspaces' && req.method === 'POST') {
      secretKeyHeaderVerified ||= req.headers.apikey === 'sb_secret_mock' && !req.headers.authorization
      let body = ''; for await (const chunk of req) body += chunk.toString()
      const row = JSON.parse(body || '{}')
      mockWorkspaces.set(row.user_id, row)
      res.statusCode = 201; res.end(JSON.stringify([])); return
    }
    if (url.pathname === '/rest/v1/usage_events' && req.method === 'GET') {
      const filter = url.searchParams.get('user_id') || ''
      const id = filter.replace(/^eq\./, '')
      res.end(JSON.stringify(mockUsageEvents.filter(item => item.user_id === id))); return
    }
    if (url.pathname === '/rest/v1/usage_events' && req.method === 'POST') {
      let body = ''; for await (const chunk of req) body += chunk.toString()
      mockUsageEvents.push(JSON.parse(body || '{}'))
      res.statusCode = 201; res.end(JSON.stringify([])); return
    }
    if (url.pathname === '/v1/chat/completions' && req.method === 'POST') {
      res.end(JSON.stringify({ model: 'mock-model', choices: [{ message: { content: 'MOCK_BYTEDOCK_OK' } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }))
      return
    }
    if (url.pathname === '/languages') { res.end(JSON.stringify([{ id: 71 }, { id: 63 }])); return }
    if (url.pathname === '/submissions' && req.method === 'POST') { res.statusCode = 201; res.end(JSON.stringify({ token: 'mock-submission' })); return }
    if (url.pathname === '/submissions/mock-submission' && req.method === 'GET') {
      res.end(JSON.stringify({ stdout: 'MOCK_EXECUTION_OK\n', stderr: null, compile_output: null, message: null, status: { id: 3, description: 'Accepted' }, exit_code: 0, time: '0.01', memory: 2048 }))
      return
    }
    res.statusCode = 404; res.end(JSON.stringify({ error: 'mock route not found' }))
  })
  mockServer = provider
  provider.listen(providerPort, '127.0.0.1')
  await once(provider, 'listening')

  const apiPort = await freePort()
  apiProcess = spawn(process.execPath, ['server/index.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'production', PORT: String(apiPort), AUTH_REQUIRED: 'false',
      BYTEDOCK_DATA_DIR: tempData,
      NEBIUS_API_KEY: 'mock-api-key', NEBIUS_MODEL: 'mock-model',
      NEBIUS_BASE_URL: `http://127.0.0.1:${providerPort}/v1`,
      JUDGE0_BASE_URL: `http://127.0.0.1:${providerPort}`,
      EXECUTION_ENABLED: 'true', CORS_ORIGIN: 'https://pages.example.test'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let logs = ''
  apiProcess.stdout.on('data', chunk => { logs += chunk.toString() })
  apiProcess.stderr.on('data', chunk => { logs += chunk.toString() })
  const base = `http://127.0.0.1:${apiPort}`
  let healthy = false
  for (let attempt = 0; attempt < 40; attempt++) {
    try { const response = await fetch(`${base}/api/health`); if (response.ok) { healthy = true; break } } catch {}
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  assert(healthy, `API starts successfully${logs ? ` (${logs.trim()})` : ''}`)

  let response = await fetch(`${base}/api/health`, { headers: { Origin: 'https://pages.example.test' } })
  let data = await response.json()
  assert(response.ok && data.ok && data.storage === 'local-filesystem', 'Health endpoint reports local mode')
  assert(response.headers.get('access-control-allow-origin') === 'https://pages.example.test', 'CORS allowlist returns the configured origin')

  response = await fetch(`${base}/api/auth/config`)
  data = await response.json()
  assert(response.ok && data.enabled === false && data.required === false, 'Auth configuration endpoint reports local development mode')

  response = await fetch(`${base}/api/workspace`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: [{ name: 'smoke.py', language: 'python', icon: 'code', content: 'print("ok")' }], activeFile: 'smoke.py', openTabs: ['smoke.py'], savedContents: { 'smoke.py': 'print("ok")' } }) })
  assert(response.ok, 'Workspace save validates and persists')
  response = await fetch(`${base}/api/workspace`); data = await response.json()
  assert(response.ok && data.workspace.files[0].name === 'smoke.py', 'Workspace reload returns saved content')

  response = await fetch(`${base}/api/ai/status`); data = await response.json()
  assert(response.ok && data.configured && data.model === 'mock-model', 'AI status reports configured backend model')
  response = await fetch(`${base}/api/ai/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }) }); data = await response.json()
  assert(response.ok && data.text === 'MOCK_BYTEDOCK_OK' && data.usage.totalTokens === 15, 'Nebius-compatible chat request and token usage parsing work against mock provider')

  response = await fetch(`${base}/api/runtime/status`); data = await response.json()
  assert(response.ok && data.available, 'Execution provider status works against mock provider')
  response = await fetch(`${base}/api/runtime/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: 'python', code: 'print("hello")', stdin: '' }) }); data = await response.json()
  assert(response.ok && data.ok && data.stdout.includes('MOCK_EXECUTION_OK'), 'Remote execution submission and result polling work against mock provider')

  response = await fetch(`${base}/api/runtime/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: 'ruby', code: 'puts 1' }) })
  assert(response.status === 400, 'Unsupported runtime language is rejected')

  // A public production backend must fail closed if Supabase is required but absent.
  const authGatePort = await freePort()
  authGateProcess = spawn(process.execPath, ['server/index.js'], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'production', PORT: String(authGatePort), AUTH_REQUIRED: 'true', BYTEDOCK_DATA_DIR: tempData },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  const authBase = `http://127.0.0.1:${authGatePort}`
  let authGateReady = false
  for (let attempt = 0; attempt < 40; attempt++) {
    try { const probe = await fetch(`${authBase}/api/health`); if (probe.ok) { authGateReady = true; break } } catch {}
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  assert(authGateReady, 'Production auth-gate API starts without Supabase credentials')
  response = await fetch(`${authBase}/api/auth/config`); data = await response.json()
  assert(response.ok && data.required === true && data.enabled === false, 'Production auth configuration reports required but not configured')
  response = await fetch(`${authBase}/api/workspace`)
  data = await response.json()
  assert(response.status === 503 && data.code === 'AUTH_NOT_CONFIGURED', 'Workspace API fails closed when production authentication is required but unavailable')

  // Exercise Supabase Auth and per-user Postgres workspace logic against a mock provider.
  const supabasePort = await freePort()
  supabaseProcess = spawn(process.execPath, ['server/index.js'], {
    cwd: root,
    env: {
      ...process.env, NODE_ENV: 'production', PORT: String(supabasePort), AUTH_REQUIRED: 'true',
      SUPABASE_URL: `http://127.0.0.1:${providerPort}`, SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_mock',
      SUPABASE_SECRET_KEY: 'sb_secret_mock', NEBIUS_API_KEY: 'mock-api-key', NEBIUS_MODEL: 'mock-model',
      NEBIUS_BASE_URL: `http://127.0.0.1:${providerPort}/v1`, BYTEDOCK_DATA_DIR: tempData,
      EXECUTION_ENABLED: 'true', JUDGE0_BASE_URL: `http://127.0.0.1:${providerPort}`
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  const supabaseBase = `http://127.0.0.1:${supabasePort}`
  let supabaseReady = false
  for (let attempt = 0; attempt < 40; attempt++) {
    try { const probe = await fetch(`${supabaseBase}/api/health`); if (probe.ok) { supabaseReady = true; break } } catch {}
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  assert(supabaseReady, 'Supabase-mode API starts successfully')
  response = await fetch(`${supabaseBase}/api/auth/config`); data = await response.json()
  assert(response.ok && data.enabled && data.required, 'Supabase auth configuration reports enabled and required')
  response = await fetch(`${supabaseBase}/api/workspace`)
  assert(response.status === 401, 'Protected workspace endpoint rejects requests without a session')

  response = await fetch(`${supabaseBase}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'one@example.test', password: 'long-enough-test-password' }) }); data = await response.json()
  const tokenOne = data.access_token
  assert(response.ok && tokenOne === 'mock-access-one', 'Supabase password login returns a session')
  response = await fetch(`${supabaseBase}/api/workspace`, { headers: { Authorization: `Bearer ${tokenOne}` } }); data = await response.json()
  assert(response.ok && data.workspace === null, 'New user begins with an empty personal workspace')
  response = await fetch(`${supabaseBase}/api/workspace`, { method: 'PUT', headers: { Authorization: `Bearer ${tokenOne}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ files: [{ name: 'private-one.py', language: 'python', icon: 'code', content: 'print("user one")' }], activeFile: 'private-one.py', openTabs: ['private-one.py'], savedContents: { 'private-one.py': 'print("user one")' } }) })
  assert(response.ok, 'Authenticated workspace is saved to Supabase storage')
  response = await fetch(`${supabaseBase}/api/workspace`, { headers: { Authorization: `Bearer ${tokenOne}` } }); data = await response.json()
  assert(response.ok && data.workspace.files[0].name === 'private-one.py', 'Authenticated user can reload their own cloud workspace')

  response = await fetch(`${supabaseBase}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'two@example.test', password: 'long-enough-test-password' }) }); data = await response.json()
  const tokenTwo = data.access_token
  response = await fetch(`${supabaseBase}/api/workspace`, { headers: { Authorization: `Bearer ${tokenTwo}` } }); data = await response.json()
  assert(response.ok && data.workspace === null, 'Second user cannot read the first user workspace')

  response = await fetch(`${supabaseBase}/api/ai/chat`, { method: 'POST', headers: { Authorization: `Bearer ${tokenOne}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'test authenticated chat' }] }) }); data = await response.json()
  assert(response.ok && data.text === 'MOCK_BYTEDOCK_OK', 'Authenticated user can call Nebius chat through the backend')
  response = await fetch(`${supabaseBase}/api/usage`, { headers: { Authorization: `Bearer ${tokenOne}` } }); data = await response.json()
  assert(response.ok && data.plan === 'Free' && data.aiTokens.used === 15, 'Per-user usage events are recorded and returned')
  response = await fetch(`${supabaseBase}/api/runtime/status`, { headers: { Authorization: `Bearer ${tokenOne}` } }); data = await response.json()
  assert(response.ok && data.available, 'Authenticated production runtime status reaches the configured provider')
  response = await fetch(`${supabaseBase}/api/runtime/run`, { method: 'POST', headers: { Authorization: `Bearer ${tokenOne}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ language: 'python', code: 'print("secure run")', stdin: '' }) }); data = await response.json()
  assert(response.ok && data.ok && data.stdout.includes('MOCK_EXECUTION_OK'), 'Authenticated user can run code through the remote execution proxy')
  response = await fetch(`${supabaseBase}/api/usage`, { headers: { Authorization: `Bearer ${tokenOne}` } }); data = await response.json()
  assert(response.ok && data.executions.used === 1, 'Remote execution increments per-user usage records')
  assert(secretKeyHeaderVerified, 'Modern Supabase secret key is sent only as an API key header, not as a Bearer JWT')

  console.log(`ByteDock smoke tests passed: ${checks.length}`)
  for (const check of checks) console.log(`PASS  ${check}`)
} catch (error) {
  console.error('ByteDock smoke tests failed:', error)
  process.exitCode = 1
} finally {
  if (apiProcess && !apiProcess.killed) apiProcess.kill('SIGTERM')
  if (authGateProcess && !authGateProcess.killed) authGateProcess.kill('SIGTERM')
  if (supabaseProcess && !supabaseProcess.killed) supabaseProcess.kill('SIGTERM')
  if (mockServer) await new Promise(resolve => mockServer.close(resolve))
  await rm(tempData, { recursive: true, force: true })
}
