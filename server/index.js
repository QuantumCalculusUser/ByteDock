import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, stat, rename } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const dataDir = path.join(root, 'data')
const workspacePath = path.join(dataDir, 'workspace.json')
const port = Number(process.env.PORT || 4173)
const isProduction = process.env.NODE_ENV === 'production'
let vite

const seedFiles = [
  { name: 'main.py', language: 'python', icon: 'code', content: 'from pathlib import Path\n\ndef greet(name: str) -> str:\n    """Return a friendly greeting."""\n    return f"Hello, {name}! Welcome to ByteDock."\n\n\ndef main() -> None:\n    name = input("What is your name? ")\n    print(greet(name.strip() or "developer"))\n\n\nif __name__ == "__main__":\n    main()\n' },
  { name: 'README.md', language: 'markdown', icon: 'file', content: '# Hello, ByteDock 👋\n\nA tiny demo project running in your workspace.\n\n## Getting started\n\n1. Open main.py.\n2. Edit and save your code.\n3. Code execution will be connected in a later milestone.\n' },
  { name: 'package.json', language: 'json', icon: 'json', content: '{\n  "name": "hello-bytedock",\n  "version": "1.0.0",\n  "private": true\n}\n' },
  { name: 'utils.py', language: 'python', icon: 'code', content: 'def clamp(value: float, minimum: float, maximum: float) -> float:\n    """Keep a value inside an inclusive range."""\n    return max(minimum, min(value, maximum))\n' },
]

async function readStoredWorkspace() {
  try { return JSON.parse(await readFile(workspacePath, 'utf8')) }
  catch (error) { if (error.code !== 'ENOENT') throw error; return null }
}
async function writeStoredWorkspace(workspace) {
  await mkdir(dataDir, { recursive: true })
  const tempPath = `${workspacePath}.tmp`
  await writeFile(tempPath, JSON.stringify(workspace, null, 2), 'utf8')
  await rename(tempPath, workspacePath)
}
function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(data))
}
async function bodyJson(req, limit = 15 * 1024 * 1024) {
  const chunks = []; let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) { const error = new Error('Request body is too large.'); error.status = 413; throw error }
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') }
  catch { const error = new Error('Request body must be valid JSON.'); error.status = 400; throw error }
}
function validName(name) { return typeof name === 'string' && !!name.trim() && name.length <= 240 && !/[\\/]/.test(name) && name !== '.' && name !== '..' }
function validateWorkspace(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.files)) return 'Workspace must include a files array.'
  if (value.files.length > 500) return 'Workspace cannot contain more than 500 files.'
  let total = 0; const seen = new Set()
  for (const file of value.files) {
    if (!file || !validName(file.name)) return `Invalid file name: ${file?.name ?? ''}`
    if (seen.has(file.name)) return `Duplicate file name: ${file.name}`
    seen.add(file.name)
    if (typeof file.content !== 'string') return `File content must be text: ${file.name}`
    total += Buffer.byteLength(file.content, 'utf8')
  }
  if (total > 12 * 1024 * 1024) return 'Workspace content exceeds the 12 MB limit.'
  if (value.activeFile && !seen.has(value.activeFile)) return 'The active file must exist in the workspace.'
  return null
}
function safeFileName(encoded) { try { const name = decodeURIComponent(encoded); return validName(name) ? name : null } catch { return null } }
async function handleApi(req, res, url) {
  if (url.pathname === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true, service: 'bytedock-workspace-api', phase: '2.2', storage: 'server-filesystem' })
  if (url.pathname === '/api/workspace' && req.method === 'GET') return send(res, 200, { workspace: await readStoredWorkspace(), storage: 'server-filesystem' })
  if (url.pathname === '/api/workspace' && req.method === 'PUT') {
    const workspace = await bodyJson(req); const invalid = validateWorkspace(workspace)
    if (invalid) return send(res, 400, { error: invalid })
    workspace.updatedAt = new Date().toISOString(); await writeStoredWorkspace(workspace)
    return send(res, 200, { ok: true, updatedAt: workspace.updatedAt })
  }
  if (url.pathname === '/api/files' && req.method === 'GET') {
    const workspace = await readStoredWorkspace() || { files: seedFiles }
    return send(res, 200, { files: workspace.files })
  }
  if (url.pathname === '/api/files' && req.method === 'POST') {
    const file = await bodyJson(req, 2 * 1024 * 1024)
    if (!validName(file.name)) return send(res, 400, { error: 'Provide a valid file name without folder separators.' })
    if (typeof file.content !== 'string') file.content = ''
    const workspace = await readStoredWorkspace() || { files: seedFiles, activeFile: seedFiles[0].name, openTabs: [seedFiles[0].name], savedContents: Object.fromEntries(seedFiles.map(f => [f.name, f.content])) }
    if (workspace.files.some(item => item.name === file.name)) return send(res, 409, { error: 'A file with that name already exists.' })
    const created = { name: file.name, language: file.language || 'plaintext', icon: file.icon || 'file', content: file.content }
    workspace.files.push(created); workspace.savedContents = { ...(workspace.savedContents || {}), [file.name]: file.content }
    await writeStoredWorkspace(workspace); return send(res, 201, { file: created })
  }
  const match = url.pathname.match(/^\/api\/files\/([^/]+)$/)
  if (match) {
    const name = safeFileName(match[1]); if (!name) return send(res, 400, { error: 'Invalid file name.' })
    const workspace = await readStoredWorkspace(); if (!workspace) return send(res, 404, { error: 'Workspace has not been initialized yet.' })
    const index = workspace.files.findIndex(file => file.name === name)
    if (req.method === 'PUT') {
      if (index < 0) return send(res, 404, { error: 'File not found.' })
      const payload = await bodyJson(req, 2 * 1024 * 1024); if (typeof payload.content !== 'string') return send(res, 400, { error: 'File content must be text.' })
      workspace.files[index].content = payload.content; workspace.savedContents = { ...(workspace.savedContents || {}), [name]: payload.content }
      await writeStoredWorkspace(workspace); return send(res, 200, { ok: true, file: workspace.files[index] })
    }
    if (req.method === 'PATCH') {
      if (index < 0) return send(res, 404, { error: 'File not found.' })
      const payload = await bodyJson(req, 1024 * 1024); if (!validName(payload.name)) return send(res, 400, { error: 'Provide a valid new file name.' })
      if (workspace.files.some(file => file.name === payload.name)) return send(res, 409, { error: 'A file with that name already exists.' })
      workspace.files[index].name = payload.name; workspace.files[index].language = payload.language || workspace.files[index].language; workspace.files[index].icon = payload.icon || workspace.files[index].icon
      workspace.savedContents = { ...(workspace.savedContents || {}) }; if (name in workspace.savedContents) { workspace.savedContents[payload.name] = workspace.savedContents[name]; delete workspace.savedContents[name] }
      workspace.openTabs = (workspace.openTabs || []).map(tab => tab === name ? payload.name : tab); if (workspace.activeFile === name) workspace.activeFile = payload.name
      await writeStoredWorkspace(workspace); return send(res, 200, { ok: true, file: workspace.files[index] })
    }
    if (req.method === 'DELETE') {
      if (index < 0) return send(res, 404, { error: 'File not found.' })
      if (workspace.files.length === 1) return send(res, 409, { error: 'Keep at least one file in the workspace.' })
      workspace.files.splice(index, 1); workspace.savedContents = { ...(workspace.savedContents || {}) }; delete workspace.savedContents[name]
      workspace.openTabs = (workspace.openTabs || []).filter(tab => tab !== name); if (workspace.activeFile === name) workspace.activeFile = workspace.openTabs.at(-1) || workspace.files[0].name
      await writeStoredWorkspace(workspace); return send(res, 200, { ok: true })
    }
  }
  return send(res, 404, { error: 'API route not found.' })
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  if (url.pathname.startsWith('/api/')) {
    try { await handleApi(req, res, url) }
    catch (error) { send(res, error.status || 500, { error: error.message || 'Internal server error.' }) }
    return
  }
  if (!isProduction) { vite.middlewares(req, res, error => { if (error) { res.statusCode = 500; res.end(error.message) } }); return }
  const dist = path.join(root, 'dist'); let requested
  try { requested = path.resolve(dist, `.${decodeURIComponent(url.pathname)}`) } catch { requested = path.join(dist, 'index.html') }
  if (!requested.startsWith(dist + path.sep) && requested !== dist) requested = path.join(dist, 'index.html')
  try {
    let info; try { info = await stat(requested) } catch { requested = path.join(dist, 'index.html'); info = await stat(requested) }
    if (info.isDirectory()) requested = path.join(requested, 'index.html')
    const content = await readFile(requested); const ext = path.extname(requested)
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' }
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' }); res.end(content)
  } catch { res.writeHead(404); res.end('Not found') }
})

if (!isProduction) { const { createServer: createViteServer } = await import('vite'); vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' }); server.on('close', () => vite.close()) }
server.listen(port, () => console.log(`ByteDock Phase 2.2 server listening at http://localhost:${port}`))
