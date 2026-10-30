import { useEffect, useMemo, useRef, useState, type FormEvent, type ChangeEvent } from 'react'
import Editor from '@monaco-editor/react'
import {
  Activity, Bot, Braces, ChevronDown, ChevronRight, CircleHelp, CirclePlus, Cloud,
  Code2, Command, Copy, Cpu, File, FileCode2, FileJson, FilePlus2, Folder,
  FolderOpen, Gauge, GitBranch, HardDrive, History, Maximize2, MessageSquare,
  MoreHorizontal, Minimize2, PanelLeftClose, Play, Plus, Search, Send, Settings2, ShieldCheck,
  Sparkles, Terminal, X, Zap, Save, FolderPlus, FilePlus, SlidersHorizontal, Palette, Keyboard,
  RotateCcw, RotateCw, Scissors, Clipboard, TextCursorInput, Eye, PanelLeft, CircleUserRound
} from 'lucide-react'

type ProjectFile = { name: string; language: string; icon: 'code'|'json'|'file'; content: string }
type StoredWorkspace = { files: ProjectFile[]; activeFile: string; openTabs: string[]; savedContents?: Record<string, string> }
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
const apiUrl = (route: string) => `${API_BASE}${route}`

const ACCESS_TOKEN_KEY = 'bytedock.access_token'
const REFRESH_TOKEN_KEY = 'bytedock.refresh_token'
const LEGACY_MIGRATION_KEY = 'bytedock.legacy_workspace_checked'
function saveAuthSession(session: any) {
  if (session?.access_token) localStorage.setItem(ACCESS_TOKEN_KEY, session.access_token)
  if (session?.refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token)
}
function clearAuthSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}
let refreshInFlight: Promise<boolean> | null = null
async function apiFetch(route: string, init: RequestInit = {}, retryAuth = true): Promise<Response> {
  const headers = new Headers(init.headers || {})
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const response = await fetch(apiUrl(route), { ...init, headers })
  if (response.status !== 401 || !retryAuth || ['/api/auth/login','/api/auth/signup','/api/auth/refresh','/api/auth/logout'].includes(route)) return response
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
  if (!refreshToken) return response
  if (!refreshInFlight) {
    refreshInFlight = fetch(apiUrl('/api/auth/refresh'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: refreshToken })
    }).then(async refreshed => {
      if (!refreshed.ok) { clearAuthSession(); return false }
      const session = await refreshed.json()
      saveAuthSession(session)
      return Boolean(session.access_token)
    }).catch(() => { clearAuthSession(); return false }).finally(() => { refreshInFlight = null })
  }
  const refreshed = await refreshInFlight
  if (!refreshed) return response
  const retryHeaders = new Headers(init.headers || {})
  const newToken = localStorage.getItem(ACCESS_TOKEN_KEY)
  if (newToken) retryHeaders.set('Authorization', `Bearer ${newToken}`)
  return fetch(apiUrl(route), { ...init, headers: retryHeaders })
}
const LEGACY_DB_NAME = 'bytedock-workspace';
const LEGACY_DB_STORE = 'workspace';
async function readLegacyWorkspace(): Promise<StoredWorkspace | undefined> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LEGACY_DB_NAME, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(LEGACY_DB_STORE)) request.result.createObjectStore(LEGACY_DB_STORE); };
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction(LEGACY_DB_STORE, 'readonly').objectStore(LEGACY_DB_STORE).get('default');
      read.onsuccess = () => { db.close(); resolve(read.result as StoredWorkspace | undefined); };
      read.onerror = () => { db.close(); reject(read.error); };
    };
    request.onerror = () => reject(request.error);
  });
}
async function readWorkspace(): Promise<StoredWorkspace | undefined> {
  const response = await apiFetch('/api/workspace');
  if (!response.ok) throw new Error(`Workspace API returned ${response.status}`);
  const payload = await response.json() as { workspace?: StoredWorkspace | null };
  if (payload.workspace) return payload.workspace;
  // Migrate the old browser-wide workspace only once on this browser. Without this marker,
  // a second account using the same device could inherit the first account's pre-cloud files.
  if (localStorage.getItem(LEGACY_MIGRATION_KEY)) return undefined
  const legacy = await readLegacyWorkspace()
  if (legacy?.files?.length) {
    await writeWorkspace(legacy)
    localStorage.setItem(LEGACY_MIGRATION_KEY, 'true')
    return legacy
  }
  localStorage.setItem(LEGACY_MIGRATION_KEY, 'true')
  return undefined;
}
let workspaceWriteQueue: Promise<void> = Promise.resolve();
function writeWorkspace(value: StoredWorkspace): Promise<void> {
  // Serialize writes so a slower older autosave cannot overwrite a newer edit.
  workspaceWriteQueue = workspaceWriteQueue.catch(() => undefined).then(async () => {
    const response = await apiFetch('/api/workspace', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(payload.error || `Workspace API returned ${response.status}`);
    }
  });
  return workspaceWriteQueue;
}
const initialFiles: ProjectFile[] = [
  { name: 'main.py', language: 'python', icon: 'code', content: `from pathlib import Path\n\ndef greet(name: str) -> str:\n    """Return a friendly greeting."""\n    return f"Hello, {name}! Welcome to ByteDock."\n\n\ndef main() -> None:\n    name = input("What's your name? ")\n    print(greet(name.strip() or "developer"))\n\n\nif __name__ == "__main__":\n    main()\n` },
  {
    name: 'README.md',
    language: 'markdown',
    icon: 'file',
    content: [
      '# Hello, ByteDock 👋',
      '',
      'A browser IDE workspace with remote execution and AI assistance.',
      '',
      '## Getting started',
      '',
      '1. Open main.py.',
      '2. Ask the agent to help you change it.',
      '3. Run Python or JavaScript using the configured remote execution provider.',
      '',
      '> ByteDock is a browser IDE. Run Python and JavaScript with the configured remote sandbox, and ask the Nebius-powered AI Agent for programming help.'
    ].join('\n')
  },
  { name: 'package.json', language: 'json', icon: 'json', content: ` {\n  "name": "hello-bytedock",\n  "version": "1.0.0",\n  "private": true,\n  "description": "A sample ByteDock workspace"\n}\n` },
  { name: 'utils.py', language: 'python', icon: 'code', content: `def clamp(value: float, minimum: float, maximum: float) -> float:\n    """Keep a value inside an inclusive range."""\n    return max(minimum, min(value, maximum))\n` },
]

const iconFor = (file: ProjectFile) => file.icon === 'json' ? <FileJson size={15} /> : file.icon === 'code' ? <FileCode2 size={15} /> : <File size={15} />

export default function App() {
  const [files, setFiles] = useState(initialFiles)
  const [activeFile, setActiveFile] = useState('main.py')
  const [openTabs, setOpenTabs] = useState<string[]>(['main.py'])
  const [savedContents, setSavedContents] = useState<Record<string, string>>(() => Object.fromEntries(initialFiles.map(file => [file.name, file.content])))
  const [workspaceReady, setWorkspaceReady] = useState(false)
  const [fileContext, setFileContext] = useState<{name:string;x:number;y:number}|null>(null)
  const [renameTarget, setRenameTarget] = useState<string|null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [explorerOpen, setExplorerOpen] = useState(true)
  const [agentOpen, setAgentOpen] = useState(true)
  const [terminalOpen, setTerminalOpen] = useState(true)
  const [editorFocus, setEditorFocus] = useState(false)
  const [terminalTab, setTerminalTab] = useState<'terminal'|'output'|'problems'>('terminal')
  const [prompt, setPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [includeActiveFile, setIncludeActiveFile] = useState(false)
  const [aiStatus, setAiStatus] = useState<{configured:boolean;model:string|null;message:string} | null>(null)
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'Hey! I’m your coding agent. Ask me to explain code, plan a feature, or help debug a problem.' }])
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showNewFile, setShowNewFile] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [notice, setNotice] = useState('')
  const [runCount, setRunCount] = useState(0)
  const [runState, setRunState] = useState<{loading:boolean;ok:boolean|null;stdout:string;stderr:string;exitCode:number|null;duration:number;error?:string}>({loading:false,ok:null,stdout:'',stderr:'',exitCode:null,duration:0})
  const [creditUsed, setCreditUsed] = useState(18)
  const [branchMenu, setBranchMenu] = useState(false)
  const [terminalInput, setTerminalInput] = useState('')
  const [stdinText, setStdinText] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'General'|'Editor'|'Appearance'|'Shortcuts'>('General')
  const [wordWrap, setWordWrap] = useState(() => localStorage.getItem('bytedock.word_wrap') !== 'false')
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => localStorage.getItem('bytedock.auto_save') !== 'false')
  const [confirmBeforeClosing, setConfirmBeforeClosing] = useState(() => localStorage.getItem('bytedock.confirm_close') !== 'false')
  const [minimapEnabled, setMinimapEnabled] = useState(() => localStorage.getItem('bytedock.minimap') !== 'false')
  const [fontSize, setFontSize] = useState(() => { const stored = Number(localStorage.getItem('bytedock.font_size') || 14); return Number.isFinite(stored) ? Math.min(24, Math.max(10, stored)) : 14 })
  const [themeChoice, setThemeChoice] = useState('Graphite Dark')
  const [authConfig, setAuthConfig] = useState<{ enabled: boolean; required: boolean; message?: string } | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authUser, setAuthUser] = useState<{ id: string; email: string | null } | null>(null)
  const [authMode, setAuthMode] = useState<'login'|'signup'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authInfo, setAuthInfo] = useState('')
  const [usageData, setUsageData] = useState<any>(null)
  const [runtimeStatus, setRuntimeStatus] = useState<{ available: boolean; message?: string } | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const openFilesInputRef = useRef<HTMLInputElement>(null)

  const currentFile = files.find(f => f.name === activeFile) ?? files[0]
  const latestRef = useRef({ files, activeFile, openTabs, savedContents, workspaceReady })
  latestRef.current = { files, activeFile, openTabs, savedContents, workspaceReady }

  // Discover whether this deployment requires accounts, then restore a Supabase session.
  useEffect(() => {
    let cancelled = false
    fetch(apiUrl('/api/auth/config')).then(response => response.json()).then(async config => {
      if (cancelled) return
      setAuthConfig(config)
      if (config.enabled) {
        const token = localStorage.getItem(ACCESS_TOKEN_KEY)
        if (token) {
          try {
            const me = await apiFetch('/api/auth/me')
            if (me.ok) { const data = await me.json(); if (!cancelled) setAuthUser(data.user) }
            else clearAuthSession()
          } catch { clearAuthSession() }
        }
      }
      if (!cancelled) setAuthReady(true)
    }).catch(() => {
      if (!cancelled) { setAuthConfig({ enabled: false, required: Boolean(import.meta.env.PROD), message: 'Could not reach the ByteDock API. Configure VITE_API_BASE_URL and verify the backend deployment.' }); setAuthReady(true) }
    })
    return () => { cancelled = true }
  }, [])

  // Each signed-in account loads its own cloud workspace. Local mode preserves Phase 2.2 behavior.
  useEffect(() => {
    if (!authReady) return
    if (authConfig?.required && (!authConfig.enabled || !authUser)) { setWorkspaceReady(false); return }
    let cancelled = false
    setWorkspaceReady(false)
    readWorkspace().then(saved => {
      if (cancelled) return
      if (saved?.files?.length) {
        setFiles(saved.files)
        setSavedContents(saved.savedContents ?? Object.fromEntries(saved.files.map(file => [file.name, file.content])))
        const validTabs = (saved.openTabs || [saved.activeFile]).filter(name => saved.files.some(f => f.name === name))
        const active = saved.files.some(f => f.name === saved.activeFile) ? saved.activeFile : saved.files[0].name
        setOpenTabs(validTabs.length ? validTabs : [active])
        setActiveFile(active)
      } else {
        setFiles(initialFiles)
        setSavedContents(Object.fromEntries(initialFiles.map(file => [file.name, file.content])))
        setActiveFile(initialFiles[0].name)
        setOpenTabs([initialFiles[0].name])
      }
      setWorkspaceReady(true)
    }).catch(() => { if (!cancelled) { setWorkspaceReady(true); setNotice('Could not load the workspace. Check the ByteDock API and account session.') } })
    return () => { cancelled = true }
  }, [authReady, authConfig?.required, authConfig?.enabled, authUser?.id])

  useEffect(() => {
    if (!workspaceReady || !autoSaveEnabled || (authConfig?.required && !authUser)) return
    const timer = window.setTimeout(() => {
      writeWorkspace({ files, activeFile, openTabs, savedContents }).catch(() => setNotice('Workspace save failed. Check your connection and account session.'))
    }, 650)
    return () => window.clearTimeout(timer)
  }, [files, activeFile, openTabs, savedContents, workspaceReady, autoSaveEnabled, authConfig?.required, authUser?.id])

  useEffect(() => {
    localStorage.setItem('bytedock.auto_save', String(autoSaveEnabled))
    localStorage.setItem('bytedock.confirm_close', String(confirmBeforeClosing))
    localStorage.setItem('bytedock.word_wrap', String(wordWrap))
    localStorage.setItem('bytedock.minimap', String(minimapEnabled))
    localStorage.setItem('bytedock.font_size', String(fontSize))
  }, [autoSaveEnabled, confirmBeforeClosing, wordWrap, minimapEnabled, fontSize])

  useEffect(() => {
    if (!confirmBeforeClosing) return
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      const current = latestRef.current
      const hasUnsaved = current.files.some(file => file.content !== current.savedContents[file.name])
      if (hasUnsaved) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [confirmBeforeClosing])

  const refreshUsage = async () => {
    try { const response = await apiFetch('/api/usage'); if (response.ok) setUsageData(await response.json()) } catch { /* Usage display stays unchanged on transient API errors. */ }
  }
  useEffect(() => {
    if (!authReady || (authConfig?.required && !authUser)) return
    void refreshUsage()
    apiFetch('/api/runtime/status').then(async response => { const data = await response.json(); setRuntimeStatus({ available: Boolean(data.available), message: data.message }) }).catch(() => setRuntimeStatus({ available: false, message: 'Could not reach the execution service.' }))
  }, [authReady, authUser?.id, authConfig?.required])

  // Escape exits the distraction-free full-code view.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setEditorFocus(false); setOpenMenu(null); setSettingsOpen(false) }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'p') { event.preventDefault(); setOpenMenu(v => v === 'Command Palette' ? null : 'Command Palette') }
      if ((event.ctrlKey || event.metaKey) && event.key === ',') { event.preventDefault(); setSettingsOpen(true); setOpenMenu(null) }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveCurrentFile() }
      // Browsers reserve Ctrl+N for a new browser window, so ByteDock uses Ctrl+Alt+N.
      if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'n') { event.preventDefault(); setShowNewFile(true); setExplorerOpen(true) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  const filteredFiles = useMemo(() => files.filter(f => f.name.toLowerCase().includes(search.toLowerCase())), [files, search])

  const updateCode = (value?: string) => setFiles(old => old.map(f => f.name === activeFile ? { ...f, content: value ?? '' } : f))
  const openFile = (name: string) => { setActiveFile(name); setOpenTabs(old => old.includes(name) ? old : [...old, name]) }
  const languageFor = (name: string) => { const ext = name.split('.').pop()?.toLowerCase(); return ext === 'py' ? 'python' : ext === 'js' ? 'javascript' : ext === 'ts' || ext === 'tsx' ? 'typescript' : ext === 'jsx' ? 'javascript' : ext === 'json' ? 'json' : ext === 'html' ? 'html' : ext === 'css' ? 'css' : ext === 'md' ? 'markdown' : 'plaintext' }
  const iconForName = (name: string): ProjectFile['icon'] => name.endsWith('.json') ? 'json' : /\.(py|js|jsx|ts|tsx)$/.test(name) ? 'code' : 'file'
  useEffect(() => {
    let cancelled = false
    apiFetch('/api/ai/status')
      .then(response => response.json())
      .then(data => { if (!cancelled) setAiStatus(data) })
      .catch(() => { if (!cancelled) setAiStatus({ configured: false, model: null, message: 'Could not reach the ByteDock AI backend.' }) })
    return () => { cancelled = true }
  }, [])

  const sendPrompt = async () => {
    const trimmed = prompt.trim()
    if (!trimmed || aiLoading) return
    const userContent = includeActiveFile
      ? `${trimmed}\n\n[Active file context: ${currentFile.name}]\n\`\`\`\n${currentFile.content.slice(0, 12000)}\n\`\`\`\n[End active file context]`
      : trimmed
    const history = [...messages, { role: 'user', text: userContent }]
    setMessages(history)
    setPrompt('')
    setAiLoading(true)
    try {
      // Previous turns retain conversational meaning but stale file snapshots are removed.
      // The active file is attached only to this request when the user explicitly opts in.
      const cleanHistory = messages.slice(-11).map(message => ({
        role: message.role,
        content: message.text.replace(/\n?\n\[Active file context:[\s\S]*?\[End active file context\]/g, '')
      }))
      const requestMessages = [...cleanHistory, { role: 'user', content: userContent }]
      const response = await apiFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: requestMessages })
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || `AI request failed with HTTP ${response.status}.`)
      const usageText = result.usage?.totalTokens ? `\n\n— ${result.usage.totalTokens} tokens used · ${result.model || 'Nebius model'}` : `\n\n— ${result.model || 'Nebius model'}`
      setMessages(old => [...old, { role: 'assistant', text: `${result.text}${usageText}` }])
      if (result.usage?.totalTokens) setCreditUsed(v => Math.min(100, v + Math.max(1, Math.ceil(result.usage.totalTokens / 1000))))
      void refreshUsage()
    } catch (error) {
      setMessages(old => [...old, { role: 'assistant', text: `AI request failed: ${error instanceof Error ? error.message : 'Unknown error'}` }])
    } finally {
      setAiLoading(false)
      apiFetch('/api/ai/status').then(response => response.json()).then(setAiStatus).catch(() => undefined)
    }
  }
  const submitAuth = async (event: FormEvent) => {
    event.preventDefault(); setAuthBusy(true); setAuthError(''); setAuthInfo('')
    try {
      const response = await fetch(apiUrl(authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: authEmail.trim(), password: authPassword })
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || `Account request failed (${response.status}).`)
      if (!result.access_token) {
        setAuthInfo('Account created. Check your email for the verification link, then sign in.')
        setAuthMode('login'); setAuthPassword(''); return
      }
      saveAuthSession(result)
      const me = await apiFetch('/api/auth/me')
      if (!me.ok) throw new Error('Signed in, but the account profile could not be loaded. Please retry.')
      const profile = await me.json()
      setAuthUser(profile.user); setAuthPassword(''); setAuthInfo('Signed in. Your personal workspace is loading.')
      setNotice('Account connected. Cloud workspace ready.')
    } catch (error) { setAuthError(error instanceof Error ? error.message : 'Account request failed.') }
    finally { setAuthBusy(false) }
  }
  const signOut = async () => {
    try { await apiFetch('/api/auth/logout', { method: 'POST' }, false) } catch { /* Local sign-out still clears the browser session. */ }
    clearAuthSession(); setAuthUser(null); setFiles(initialFiles); setSavedContents(Object.fromEntries(initialFiles.map(file => [file.name, file.content]))); setActiveFile(initialFiles[0].name); setOpenTabs([initialFiles[0].name]); setWorkspaceReady(false); setUsageData(null); setMessages([{ role: 'assistant', text: 'You have signed out. Sign in to open your cloud workspace.' }])
  }
  const exportWorkspace = () => {
    const backup = { version: 1, exportedAt: new Date().toISOString(), files, activeFile, openTabs }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const link = document.createElement('a')
    link.href = url; link.download = 'bytedock-workspace.json'; link.click(); URL.revokeObjectURL(url)
    setNotice('Workspace backup exported.')
  }
  const importWorkspace = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      if (file.size > 12 * 1024 * 1024) throw new Error('Workspace backup must be 12 MB or smaller.')
      const parsed = JSON.parse(await file.text())
      if (!Array.isArray(parsed.files) || !parsed.files.length || parsed.files.length > 500) throw new Error('Backup must contain between 1 and 500 files.')
      const seen = new Set<string>()
      const imported = parsed.files.map((item: any) => {
        if (!item || typeof item.name !== 'string' || !item.name.trim() || /[\\/]/.test(item.name) || typeof item.content !== 'string' || seen.has(item.name)) throw new Error('Backup contains an invalid or duplicate file.')
        seen.add(item.name)
        return { name: item.name, language: typeof item.language === 'string' ? item.language : languageFor(item.name), icon: item.icon === 'json' || item.icon === 'code' ? item.icon : iconForName(item.name), content: item.content } as ProjectFile
      })
      const totalBytes = imported.reduce((sum, item) => sum + new TextEncoder().encode(item.content).length, 0)
      if (totalBytes > 5 * 1024 * 1024) throw new Error('Workspace content must be 5 MB or smaller for cloud storage.')
      const active = imported.some(item => item.name === parsed.activeFile) ? parsed.activeFile : imported[0].name
      const tabs = Array.isArray(parsed.openTabs) ? parsed.openTabs.filter((name: string) => imported.some(item => item.name === name)) : [active]
      setFiles(imported); setActiveFile(active); setOpenTabs(tabs.length ? tabs : [active]); setSavedContents(Object.fromEntries(imported.map(item => [item.name, item.content])))
      setNotice('Workspace imported. It will be saved to your ByteDock account.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not import this workspace backup.') }
    finally { event.target.value = '' }
  }
  const openFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || [])
    if (!selected.length) return
    try {
      if (selected.length > 100 || files.length + selected.length > 500) throw new Error('The workspace supports up to 500 files total; import fewer files.')
      const incoming: ProjectFile[] = []
      for (const file of selected) {
        if (file.size > 2 * 1024 * 1024) throw new Error(`${file.name} exceeds the 2 MB per-file import limit.`)
        if (/[\\/]/.test(file.name) || !file.name.trim()) throw new Error('Only plain file names are supported. Folder uploads are not enabled yet.')
        if (files.some(existing => existing.name === file.name) || incoming.some(existing => existing.name === file.name)) throw new Error(`A file named ${file.name} already exists.`)
        const content = await file.text()
        incoming.push({ name: file.name, language: languageFor(file.name), icon: iconForName(file.name), content })
      }
      const totalBytes = [...files, ...incoming].reduce((sum, item) => sum + new TextEncoder().encode(item.content).length, 0)
      if (totalBytes > 5 * 1024 * 1024) throw new Error('Cloud workspaces are limited to 5 MB of file content.')
      setFiles(old => [...old, ...incoming])
      setSavedContents(old => ({ ...old, ...Object.fromEntries(incoming.map(file => [file.name, file.content])) }))
      if (incoming.length) { setActiveFile(incoming[0].name); setOpenTabs(old => [...old, ...incoming.map(file => file.name)]) }
      setExplorerOpen(true)
      setNotice(`Imported ${incoming.length} file${incoming.length === 1 ? '' : 's'}. Changes are syncing to your workspace.`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not import the selected files.') }
    finally { event.target.value = '' }
  }
  const createFile = () => {
    const name = newFileName.trim()
    if (!name || name.length > 240 || files.length >= 500 || files.some(f => f.name === name)) { setNotice('Enter a unique file name (up to 240 characters). The workspace supports up to 500 files.'); return }
    if (name.includes('/') || name.includes('\\') || name === '.' || name === '..') { setNotice('Use a file name without folder separators for this milestone.'); return }
    setFiles(old => [...old, { name, language: languageFor(name), icon: iconForName(name), content: '' } as ProjectFile]); setSavedContents(old => ({ ...old, [name]: '' }))
    setActiveFile(name); setOpenTabs(old => [...old, name]); setNewFileName(''); setShowNewFile(false); setNotice(`Created ${name}`)
  }
  const runDemo = async () => {
    if (!currentFile) return
    const language = currentFile.language === 'python' ? 'python' : currentFile.language === 'javascript' ? 'javascript' : null
    setTerminalOpen(true); setTerminalTab('output')
    if (!language) { setRunState({ loading:false, ok:false, stdout:'', stderr:`Execution for ${currentFile.language} files is not supported yet. Run Python (.py) or JavaScript (.js/.jsx) files.`, exitCode:null, duration:0 }); return }
    setRunState({ loading:true, ok:null, stdout:'', stderr:'Submitting to remote execution sandbox…', exitCode:null, duration:0 })
    const started = Date.now()
    try {
      const response = await apiFetch('/api/runtime/run', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ language, code:currentFile.content, stdin: stdinText }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || `Runtime request failed with HTTP ${response.status}.`)
      setRunCount(v => v + 1)
      setRunState({ loading:false, ok:result.ok, stdout:result.stdout || '', stderr:result.stderr || '', exitCode:result.exitCode, duration:Date.now()-started, error:result.timedOut ? 'Execution exceeded the remote provider time limit.' : undefined })
      void refreshUsage()
    } catch (error) {
      setRunState({ loading:false, ok:false, stdout:'', stderr:'', exitCode:null, duration:Date.now()-started, error:error instanceof Error ? error.message : 'Unknown runtime error.' })
    }
  }
  const saveCurrentFile = () => {
    const latest = latestRef.current
    if (!latest.workspaceReady) { setNotice('Workspace is still loading.'); return }
    const fileToSave = latest.files.find(file => file.name === latest.activeFile)
    if (!fileToSave) return
    const nextSavedContents = { ...latest.savedContents, [fileToSave.name]: fileToSave.content }
    writeWorkspace({ ...latest, savedContents: nextSavedContents })
      .then(() => { setSavedContents(nextSavedContents); setNotice(`${fileToSave.name} saved to the ByteDock workspace.`); void refreshUsage() })
      .catch(() => setNotice('Save failed. Check that the ByteDock backend is running.'))
  }
  const closeTab = (name: string) => { const next = openTabs.filter(tab => tab !== name); setOpenTabs(next); if (activeFile === name && next.length) setActiveFile(next[next.length - 1]); else if (activeFile === name) setNotice('Create or open a file to continue editing.') }
  const renameFile = () => { const oldName = renameTarget; const nextName = renameValue.trim(); if (!oldName || !nextName) return; if (files.some(f => f.name === nextName && f.name !== oldName)) { setNotice('A file with that name already exists.'); return } setFiles(old => old.map(f => f.name === oldName ? { ...f, name: nextName, language: languageFor(nextName), icon: iconForName(nextName) } : f)); setOpenTabs(old => old.map(n => n === oldName ? nextName : n)); setSavedContents(old => { const next = { ...old }; if (oldName in next) { next[nextName] = next[oldName]; delete next[oldName] } return next }); if (activeFile === oldName) setActiveFile(nextName); setRenameTarget(null); setRenameValue(''); setNotice(`Renamed ${oldName} to ${nextName}`) }
  const deleteFile = (name: string) => { if (!window.confirm(`Delete ${name}? This removes it from this ByteDock workspace.`)) return; const nextFiles = files.filter(f => f.name !== name); if (!nextFiles.length) { setNotice('Keep at least one file in the workspace.'); return } setFiles(nextFiles); setSavedContents(old => { const next = { ...old }; delete next[name]; return next }); const nextTabs = openTabs.filter(n => n !== name); setOpenTabs(nextTabs.length ? nextTabs : [nextFiles[0].name]); if (activeFile === name) setActiveFile(nextTabs[nextTabs.length - 1] || nextFiles[0].name); setFileContext(null); setNotice(`Deleted ${name}`) }
  const menuAction = (action: string) => {
    setOpenMenu(null)
    if (action === 'New File') { setShowNewFile(true); setExplorerOpen(true); return }
    if (action === 'Export Workspace') { exportWorkspace(); return }
    if (action === 'Import Workspace') { importInputRef.current?.click(); return }
    if (action === 'Open File') { openFilesInputRef.current?.click(); return }
    if (action === 'Save') { saveCurrentFile(); return }
    if (action === 'Settings') { setSettingsOpen(true); return }
    if (action === 'Explorer') { setExplorerOpen(v => !v); return }
    if (action === 'Search') { setShowSearch(v => !v); return }
    if (action === 'Terminal') { setTerminalOpen(v => !v); return }
    if (action === 'Full Screen Editor') { setEditorFocus(v => !v); return }
    if (action === 'Close Editor') { setNotice('The active editor cannot be closed while it is the only open file.'); return }
    if (action === 'Command Palette') { setOpenMenu('Command Palette'); return }
    setNotice(`${action}: available in the ByteDock UI preview.`)
  }
  const runTerminalCommand = () => {
    const cmd = terminalInput.trim()
    if (!cmd) return
    if (cmd === 'run' || cmd === 'python' || cmd === 'node') { setTerminalInput(''); void runDemo(); return }
    if (cmd === 'clear') { setRunState({loading:false,ok:null,stdout:'',stderr:'',exitCode:null,duration:0}); setTerminalInput(''); setTerminalTab('output'); return }
    if (cmd === 'help') { setNotice('Supported console commands: run, clear, help. This is a remote code-run console, not a general operating-system shell.'); setTerminalInput(''); return }
    setNotice('Unknown console command. Type help for supported commands: run, clear, help.')
    setTerminalInput('')
  }

  return <div className="app-shell" onClick={(e) => { if (e.target === e.currentTarget) setOpenMenu(null) }}>
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Braces size={18}/></div><span>byte<span className="brand-accent">dock</span></span><span className="dev-badge">ONLINE IDE</span></div>
      <div className="top-center"><div className="workspace-path"><Cloud size={14}/><span>workspace</span><ChevronRight size={13}/><strong>hello-bytedock</strong><span className="saved-dot" title={workspaceReady ? "Workspace loaded" : "Loading workspace"}/></div></div>
      <div className="top-actions">
        <button className="top-icon" title="Search" onClick={() => setShowSearch(v => !v)}><Search size={16}/></button>
        <button className="branch-button" onClick={() => setBranchMenu(v => !v)}><GitBranch size={14}/> main <ChevronDown size={13}/></button>
        {branchMenu && <div className="branch-popover"><b>Current branch</b><span><GitBranch size={14}/> main</span><small>Git integration will be added later.</small></div>}
        <button className="share-button" onClick={exportWorkspace}><Cloud size={14}/> Backup</button>
        <button className="avatar" title={authUser ? `Sign out ${authUser.email || 'account'}` : 'Account'} onClick={() => authUser ? void signOut() : setNotice(authConfig?.required ? 'Please sign in using the account panel.' : 'Local development mode: account authentication is disabled.')}>{authUser?.email?.[0]?.toUpperCase() || 'H'}</button>
      </div>
    </header>

    <nav className="menubar" aria-label="Application menu">
      <div className="menu-brand-mini"><Braces size={15}/></div>
      {['File','Edit','Selection','View','Go','More'].map(label => <div className="menu-root" key={label}>
        <button className={openMenu === label ? 'menu-root-button active' : 'menu-root-button'} onClick={() => setOpenMenu(v => v === label ? null : label)}>{label === 'More' ? '•••' : label}</button>
        {openMenu === label && <div className="menu-dropdown">
          {(label === 'File' ? [
            ['New Text File','Ctrl+Alt+N'],['New File…','Ctrl+Alt+N'],['New Window','Ctrl+Shift+N'],['separator',''],['Open File…','Ctrl+O'],['Open Folder…','Ctrl+K Ctrl+O'],['Open Recent','›'],['separator',''],['Add Folder to Workspace…',''],['Save','Ctrl+S'],['Save As…','Ctrl+Shift+S'],['Import Workspace…',''],['Export Workspace…',''],['separator',''],['Auto Save',''],['Preferences','›'],['separator',''],['Close Editor','Ctrl+F4'],['Close Folder','Ctrl+K F'],['Close Window','Alt+F4'],['Exit','']
          ] : label === 'Edit' ? [
            ['Undo','Ctrl+Z'],['Redo','Ctrl+Y'],['separator',''],['Cut','Ctrl+X'],['Copy','Ctrl+C'],['Paste','Ctrl+V'],['separator',''],['Find','Ctrl+F'],['Replace','Ctrl+H'],['Find in Files','Ctrl+Shift+F'],['separator',''],['Toggle Line Comment','Ctrl+/']
          ] : label === 'Selection' ? [
            ['Select All','Ctrl+A'],['Expand Selection','Shift+Alt+→'],['Shrink Selection','Shift+Alt+←'],['separator',''],['Copy Line Up','Shift+Alt+↑'],['Copy Line Down','Shift+Alt+↓'],['Move Line Up','Alt+↑'],['Move Line Down','Alt+↓'],['Duplicate Selection',''],['separator',''],['Add Cursor Above','Ctrl+Alt+↑'],['Add Cursor Below','Ctrl+Alt+↓']
          ] : label === 'View' ? [
            ['Command Palette','Ctrl+Shift+P'],['Open View…',''],['separator',''],['Appearance','›'],['Editor Layout','›'],['separator',''],['Explorer','Ctrl+Shift+E'],['Search','Ctrl+Shift+F'],['Source Control','Ctrl+Shift+G'],['Run','Ctrl+Shift+D'],['Extensions','Ctrl+Shift+X'],['separator',''],['Problems','Ctrl+Shift+M'],['Output','Ctrl+Shift+U'],['Terminal','Ctrl+`'],['Full Screen Editor','']
          ] : label === 'Go' ? [
            ['Back','Alt+←'],['Forward','Alt+→'],['separator',''],['Switch Editor','›'],['Go to File…','Ctrl+P'],['Go to Symbol in Workspace…','Ctrl+T'],['Go to Definition','F12'],['Go to Line/Column…','Ctrl+G'],['Next Problem','F8'],['Previous Problem','Shift+F8']
          ] : [
            ['Run','›'],['Terminal','›'],['Settings',''],['Keyboard Shortcuts','Ctrl+K Ctrl+S'],['Themes','›'],['Help','›']
          ]).map(([item, shortcut], i) => item === 'separator' ? <div className="menu-separator" key={`${label}-sep-${i}`}/> : <button className="menu-item" key={item} onClick={() => item === 'Preferences' || item === 'Settings' ? menuAction('Settings') : item === 'Appearance' || item === 'Themes' ? (setSettingsTab('Appearance'),setSettingsOpen(true),setOpenMenu(null)) : item === 'Editor Layout' ? menuAction('Full Screen Editor') : menuAction(item.replace('…','').replace('Text File','File'))}><span>{item}</span><small>{shortcut}</small></button>)}
        </div>}
      </div>)}
      <div className="menubar-spacer"/>
      <button className="menu-settings-button" title="Settings" onClick={() => {setSettingsOpen(true);setOpenMenu(null)}}><Settings2 size={15}/></button>
    </nav>
    {openMenu === 'Command Palette' && <div className="command-palette"><div className="command-input"><Command size={14}/><input autoFocus placeholder="Type a command to search…" onKeyDown={e => {if (e.key === 'Enter') {menuAction((e.currentTarget.value || 'Settings').replace(/^>\s*/,''));}}}/><button onClick={() => setOpenMenu(null)}><X size={14}/></button></div><button onClick={() => menuAction('Settings')}>Preferences: Open Settings <small>Ctrl+,</small></button><button onClick={() => menuAction('Full Screen Editor')}>View: Toggle Full Screen Editor</button><button onClick={() => menuAction('New File')}>File: New File</button></div>}
    {showSearch && <div className="search-bar"><Search size={15}/><input autoFocus placeholder="Search files by name…" value={search} onChange={e => setSearch(e.target.value)} /><button onClick={() => {setShowSearch(false);setSearch('')}}><X size={15}/></button></div>}

    <div className={`workspace ${editorFocus ? "editor-focus" : ""}`}>
      <aside className="activity-rail">
        <button className="rail-button selected" title="Explorer" onClick={() => setExplorerOpen(v => !v)}><PanelLeftClose size={19}/></button>
        <button className="rail-button" title="Search" onClick={() => setShowSearch(v => !v)}><Search size={19}/></button>
        <button className="rail-button" title="Source control" onClick={() => setNotice('Source control is a planned integration.')}><GitBranch size={19}/></button>
        <button className="rail-button" title="AI Agent" onClick={() => setAgentOpen(v => !v)}><Bot size={20}/></button>
        <div className="rail-spacer"/><button className="rail-button" title="Settings" onClick={() => setSettingsOpen(true)}><Settings2 size={19}/></button>
      </aside>

      {explorerOpen && <aside className="explorer panel">
        <div className="panel-heading"><span>EXPLORER</span><div><button title="New file" onClick={() => setShowNewFile(true)}><FilePlus2 size={15}/></button><button title="More options" onClick={() => setNotice('Workspace actions will be added later.')}><MoreHorizontal size={16}/></button></div></div>
        <div className="project-row"><ChevronDown size={14}/><FolderOpen size={15} className="folder-color"/><span>HELLO-BYTEDOCK</span><button title="New file" onClick={() => setShowNewFile(true)}><Plus size={15}/></button></div>
        {showNewFile && <form className="new-file-form" onSubmit={e => {e.preventDefault();createFile()}}><File size={14}/><input autoFocus value={newFileName} onChange={e => setNewFileName(e.target.value)} placeholder="filename.ext"/><button type="submit"><Plus size={14}/></button><button type="button" onClick={() => setShowNewFile(false)}><X size={14}/></button></form>}
        <div className="file-list">{filteredFiles.map(file => <button key={file.name} className={`file-row ${activeFile === file.name ? 'active' : ''}`} onClick={() => openFile(file.name)} onContextMenu={e => {e.preventDefault();setFileContext({name:file.name,x:e.clientX,y:e.clientY})}}>{iconFor(file)}<span>{file.name}</span>{file.content !== savedContents[file.name] && <span className="file-unsaved" title="Unsaved changes"/>}</button>)}{filteredFiles.length === 0 && <div className="empty-search">No matching files</div>}</div>
        <div className="explorer-bottom"><div className="section-label"><ChevronRight size={13}/> OUTLINE</div><div className="section-label"><ChevronRight size={13}/> TIMELINE</div></div>
      </aside>}

      <main className="editor-area">
        <div className="tabs-row"><div className="editor-tabs">{openTabs.filter(name => files.some(f => f.name === name)).map(name => { const tabFile = files.find(f => f.name === name)!; return <div key={name} className={`editor-tab ${activeFile === name ? 'active' : ''}`} onClick={() => setActiveFile(name)}>{iconFor(tabFile)}<span>{name}</span>{tabFile.content !== savedContents[name] && <span className="tab-dot" title="Unsaved changes"/>}<button title={`Close ${name}`} onClick={e => {e.stopPropagation();closeTab(name)}}><X size={12}/></button></div> })}</div><div className="tab-spacer"/><button className="run-button" onClick={runDemo}><Play size={13} fill="currentColor"/> Run <ChevronDown size={12}/></button><button className="editor-action" title="Copy file contents" onClick={() => {void navigator.clipboard?.writeText(currentFile.content);setNotice('File contents copied (if clipboard permission is available).')}}><Copy size={14}/></button><button className="editor-action focus-toggle" title={editorFocus ? "Exit full code view (Esc)" : "Full code view"} aria-label={editorFocus ? "Exit full code view" : "Full code view"} onClick={() => setEditorFocus(v => !v)}>{editorFocus ? <Minimize2 size={14}/> : <Maximize2 size={14}/>}</button></div>
        <div className="breadcrumbs"><span>hello-bytedock</span><ChevronRight size={12}/>{iconFor(currentFile)}<span>{currentFile.name}</span><span className="crumb-muted">›</span></div>
        <div className="monaco-wrap"><Editor height="100%" language={currentFile.language} path={currentFile.name} value={currentFile.content} onChange={updateCode} theme="vs-dark" options={{fontFamily: 'Consolas, "Courier New", monospace', fontSize, lineHeight: 23, minimap: { enabled: minimapEnabled, renderCharacters: true, scale: 1, showSlider: 'always', size: 'fit' }, padding: { top: 15, bottom: 20 }, scrollBeyondLastLine: false, smoothScrolling: true, cursorBlinking: 'smooth', renderLineHighlight: 'all', automaticLayout: true, tabSize: 4, wordWrap: wordWrap ? 'on' : 'off', lineNumbersMinChars: 3, glyphMargin: false, folding: true, bracketPairColorization: { enabled: true }, guides: { indentation: true } }} /></div>
        {terminalOpen && !editorFocus && <section className="terminal-panel">
          <div className="terminal-tabs"><button className={terminalTab === 'problems' ? 'active' : ''} onClick={() => setTerminalTab('problems')}>PROBLEMS <span className="tiny-count">0</span></button><button className={terminalTab === 'output' ? 'active' : ''} onClick={() => setTerminalTab('output')}>OUTPUT</button><button className={terminalTab === 'terminal' ? 'active' : ''} onClick={() => setTerminalTab('terminal')}>TERMINAL</button><button className="terminal-close" onClick={() => setTerminalOpen(false)} title="Close terminal"><X size={14}/></button></div>
          {terminalTab === 'terminal' ? <div className="terminal-content"><div><span className="terminal-prompt">➜</span> <span className="terminal-path">~/workspace</span> <span className="terminal-muted">$</span> <span>{runtimeStatus?.available ? 'Remote sandbox connected for Python and JavaScript.' : runtimeStatus?.message || 'Checking remote execution service…'}</span></div><div className="terminal-hint">Type `run` to execute the active file. Each run is executed remotely with sandbox resource limits.</div><form className="terminal-input-row" onSubmit={e => {e.preventDefault();runTerminalCommand()}}><span className="terminal-prompt">➜</span><input value={terminalInput} onChange={e => setTerminalInput(e.target.value)} placeholder="Type run and press Enter…"/><button type="submit"><Send size={13}/></button></form></div> : terminalTab === 'output' ? <div className="output-content"><div className="output-heading"><span className={runState.ok === true ? 'success-dot' : runState.ok === false ? 'error-dot' : 'success-dot'}/> {runState.loading ? 'Executing in remote sandbox…' : runState.ok === null ? 'Runtime output' : `Run #${runCount} · ${runState.ok ? 'Exited successfully' : 'Execution failed'}`}</div><label className="stdin-label">STANDARD INPUT <textarea value={stdinText} onChange={e => setStdinText(e.target.value)} rows={2} placeholder="Optional input passed to input() / stdin…" /></label>{runState.loading ? <p>Starting remote runtime…</p> : runState.ok === null ? <p>Ready. Press Run to execute the active Python or JavaScript file.</p> : <><p className="terminal-muted">Exit code: {runState.exitCode ?? 'unavailable'} · {runState.duration} ms</p>{runState.stdout && <pre className="runtime-output">{runState.stdout}</pre>}{runState.stderr && <pre className="runtime-error">{runState.stderr}</pre>}{runState.error && <p className="runtime-error">{runState.error}</p>}{!runState.stdout && !runState.stderr && !runState.error && <p className="terminal-muted">Process completed with no output.</p>}</>}</div> : <div className="problems-content"><ShieldCheck size={16}/><span>No diagnostics have been reported.</span><small>Language-server diagnostics are not enabled in this release.</small></div>}
        </section>}
        <footer className="statusbar"><div className="status-left"><button onClick={() => setBranchMenu(v => !v)}><GitBranch size={12}/> main</button><span><CircleHelp size={12}/> 0</span><span><Activity size={12}/> Preview</span></div><div className="status-right"><span>Ln 1, Col 1</span><span>Spaces: 4</span><span>UTF-8</span><span>{currentFile.language}</span><span className="status-live"><span/> {workspaceReady ? (authUser ? 'Cloud workspace' : 'Workspace server') : 'Connecting to backend…'}</span></div></footer>
      </main>


      {agentOpen && !editorFocus && <aside className="agent-panel panel">
        <div className="agent-heading"><div className="agent-title-icon"><Sparkles size={15}/></div><div><strong>AI Agent</strong><span>YOUR PAIR PROGRAMMER</span></div><div className="agent-head-actions"><button title="New chat" onClick={() => setMessages([{role:'assistant',text:'Fresh context. Tell me what you want to build.'}])}><CirclePlus size={16}/></button><button title="Close AI panel" onClick={() => setAgentOpen(false)}><X size={16}/></button></div></div>
        <div className="agent-model"><span className={`model-dot ${aiStatus?.configured ? 'connected' : ''}`}/><span>{aiStatus?.model || 'Nebius Token Factory'}</span><span className="model-tag">{aiStatus?.configured ? 'READY' : 'SETUP REQUIRED'}</span><ChevronDown size={13}/></div>
        <div className="agent-conversation">{messages.map((message, i) => <div key={i} className={`message ${message.role}`}><div className="message-avatar">{message.role === 'assistant' ? <Sparkles size={13}/> : 'H'}</div><div className="message-body">{message.role === 'assistant' && <div className="message-label">BYTEDOCK AGENT</div>}<p>{message.text}</p>{message.role === 'assistant' && i === 0 && <div className="suggestion-chips"><button onClick={() => setPrompt('Explain the current project')}>Explain this project <span>↗</span></button><button onClick={() => setPrompt('Suggest a useful feature for this project')}>Suggest a feature <span>↗</span></button></div>}</div></div>)}{aiLoading && <div className="message assistant"><div className="message-avatar"><Sparkles size={13}/></div><div className="message-body"><p>Contacting Nebius…</p></div></div>}</div>
        <div className="agent-composer"><div className="composer-context"><span><FileCode2 size={12}/>{currentFile.name}</span><label className="file-context-toggle"><input type="checkbox" checked={includeActiveFile} onChange={e => setIncludeActiveFile(e.target.checked)}/> Include file</label></div><textarea value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => {if (e.key === 'Enter' && !e.shiftKey) {e.preventDefault();sendPrompt()}}} placeholder="Ask ByteDock to help with code…" rows={3}/><div className="composer-bottom"><div><button title="Toggle active-file context" onClick={() => setIncludeActiveFile(value => !value)}><Plus size={15}/></button><span><Command size={11}/> Enter to send</span></div><button className="send-button" disabled={!prompt.trim() || aiLoading} onClick={sendPrompt}>{aiLoading ? <span className="ai-loading-indicator">…</span> : <Send size={14}/>}</button></div></div>
        <div className="agent-disclaimer"><ShieldCheck size={12}/> Review AI-generated code before running it.</div>
      </aside>}
    </div>

    <div className="resource-dock"><div className="resource-brand"><div className="resource-logo"><Zap size={13} fill="currentColor"/></div><span>RESOURCE METER</span><span className="demo-pill">{usageData?.plan || (authConfig?.required ? 'FREE' : 'LOCAL')}</span></div><div className="resource-metric token-metric"><div className="metric-icon"><Sparkles size={14}/></div><div className="metric-copy"><span>AI tokens</span><strong>{usageData?.aiTokens?.used?.toLocaleString?.() ?? '—'}<small> / {(usageData?.aiTokens?.limit ?? 100000).toLocaleString()}</small></strong><div className="meter-track"><span style={{width: `${Math.min(100, (usageData?.aiTokens?.used || 0) / (usageData?.aiTokens?.limit || 100000) * 100)}%`}}/></div></div></div><div className="resource-metric"><div className="metric-icon"><Cpu size={14}/></div><div className="metric-copy"><span>CPU time</span><strong>{usageData?.cpu ? `${(usageData.cpu.usedMs/1000).toFixed(1)}s` : '0s'} <small>/ 120s</small></strong><div className="meter-track"><span style={{width:`${Math.min(100, (usageData?.cpu?.usedMs || 0)/(usageData?.cpu?.limitMs || 120000)*100)}%`}}/></div></div></div><div className="resource-metric"><div className="metric-icon"><Gauge size={14}/></div><div className="metric-copy"><span>Memory / run</span><strong>{usageData?.memoryPerExecutionMb || 128} MB <small>limit</small></strong><div className="meter-track"><span style={{width:'20%'}}/></div></div></div><div className="resource-metric"><div className="metric-icon"><HardDrive size={14}/></div><div className="metric-copy"><span>Workspace</span><strong>{usageData?.storage ? `${(usageData.storage.usedBytes/1048576).toFixed(2)} MB` : '—'} <small>/ 5 MB</small></strong><div className="meter-track"><span style={{width:`${Math.min(100, (usageData?.storage?.usedBytes || 0)/(usageData?.storage?.limitBytes || 5242880)*100)}%`}}/></div></div></div><div className="resource-spacer"/><button className="upgrade-button" onClick={() => setNotice('Free plan limits are enforced by the backend. Paid subscriptions and billing are not enabled in this release.')}> <Zap size={13}/> Plans <span>↗</span></button><button className="resource-help" title="About resource usage" onClick={() => setNotice('Usage figures are calculated from account events and workspace size. CPU and memory ceilings are execution-provider limits.') }><CircleHelp size={15}/></button></div>
    <input ref={importInputRef} type="file" accept="application/json,.json" hidden onChange={importWorkspace}/>
    <input ref={openFilesInputRef} type="file" multiple hidden onChange={openFiles}/>
    {authConfig?.required && (!authConfig.enabled || !authUser) && <div className="auth-gate">
      <form className="auth-card" onSubmit={submitAuth}>
        <div className="auth-brand"><div className="brand-mark"><Braces size={20}/></div><span>byte<span className="brand-accent">dock</span></span></div>
        <div className="auth-eyebrow">PERSONAL CLOUD WORKSPACE</div>
        <h1>{!authConfig.enabled ? 'Account service needs configuration' : authMode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        {!authConfig.enabled ? <><p className="auth-help">{authConfig.message || 'The backend requires Supabase Auth and Postgres. Configure the Supabase environment variables on Render, then reload ByteDock.'}</p><div className="auth-config-list">SUPABASE_URL<br/>SUPABASE_PUBLISHABLE_KEY<br/>SUPABASE_SECRET_KEY</div></> : <>
          <p className="auth-help">Sign in to access your private workspace, AI assistant, and remote execution allowance.</p>
          <label>Email<input type="email" autoComplete="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required placeholder="you@example.com"/></label>
          <label>Password<input type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} value={authPassword} onChange={e => setAuthPassword(e.target.value)} required minLength={8} maxLength={128} placeholder="At least 8 characters"/></label>
          {authError && <div className="auth-error">{authError}</div>}{authInfo && <div className="auth-info">{authInfo}</div>}
          <button className="auth-submit" type="submit" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create account'}</button>
          <button className="auth-switch" type="button" onClick={() => {setAuthMode(v => v === 'login' ? 'signup' : 'login');setAuthError('');setAuthInfo('')}}>{authMode === 'login' ? 'New to ByteDock? Create an account' : 'Already have an account? Sign in'}</button>
        </>}
        <div className="auth-footnote"><ShieldCheck size={13}/> Each account has its own cloud workspace and usage allowance.</div>
      </form>
    </div>}
    {fileContext && <><div className="context-dismiss" onClick={() => setFileContext(null)}/><div className="file-context-menu" style={{left: Math.min(fileContext.x, window.innerWidth - 190), top: Math.min(fileContext.y, window.innerHeight - 125)}}><button onClick={() => {openFile(fileContext.name);setFileContext(null)}}>Open</button><button onClick={() => {setRenameTarget(fileContext.name);setRenameValue(fileContext.name);setFileContext(null)}}>Rename…</button><button className="danger" onClick={() => deleteFile(fileContext.name)}>Delete</button></div></>}
    {renameTarget && <div className="settings-backdrop" onMouseDown={e => {if (e.target === e.currentTarget) setRenameTarget(null)}}><form className="rename-dialog" onSubmit={e => {e.preventDefault();renameFile()}}><h3>Rename file</h3><input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} /><div><button type="button" onClick={() => setRenameTarget(null)}>Cancel</button><button type="submit" className="primary">Rename</button></div></form></div>}
    {settingsOpen && <div className="settings-backdrop" onMouseDown={e => {if (e.target === e.currentTarget) setSettingsOpen(false)}}>
      <section className="settings-window" role="dialog" aria-modal="true" aria-label="Settings">
        <header className="settings-titlebar"><div><Settings2 size={16}/><strong>Settings</strong><span>ByteDock preferences</span></div><button onClick={() => setSettingsOpen(false)} title="Close settings"><X size={16}/></button></header>
        <div className="settings-search"><Search size={15}/><input autoFocus placeholder="Search settings" onChange={e => {if (e.target.value.toLowerCase().includes('theme')) setSettingsTab('Appearance'); if (e.target.value.toLowerCase().includes('font') || e.target.value.toLowerCase().includes('minimap') || e.target.value.toLowerCase().includes('wrap')) setSettingsTab('Editor')}}/><kbd>Ctrl+,</kbd></div>
        <div className="settings-body"><aside className="settings-sidebar">{([['General',SlidersHorizontal],['Editor',Code2],['Appearance',Palette],['Shortcuts',Keyboard]] as const).map(([tab,Icon]) => <button key={tab} className={settingsTab === tab ? 'selected' : ''} onClick={() => setSettingsTab(tab)}><Icon size={15}/>{tab}</button>)}</aside>
          <div className="settings-content"><h2>{settingsTab}</h2><p className="settings-description">Customize editor behavior and appearance for this browser session.</p>
            {settingsTab === 'General' && <><div className="setting-row"><div><strong>Auto Save</strong><p>Automatically sync workspace edits while you work.</p></div><label className="toggle-control"><input type="checkbox" checked={autoSaveEnabled} onChange={e => setAutoSaveEnabled(e.target.checked)}/><span/></label></div><div className="setting-row"><div><strong>Confirm before closing</strong><p>Warn before leaving an editor with unsaved changes.</p></div><label className="toggle-control"><input type="checkbox" checked={confirmBeforeClosing} onChange={e => setConfirmBeforeClosing(e.target.checked)}/><span/></label></div><div className="setting-row"><div><strong>Workspace name</strong><p>The label shown in the workspace header.</p></div><span className="setting-value">hello-bytedock</span></div></>}
            {settingsTab === 'Editor' && <><div className="setting-row"><div><strong>Font size</strong><p>Editor font size in pixels.</p></div><div className="stepper"><button onClick={() => setFontSize(v => Math.max(10,v-1))}>−</button><span>{fontSize}px</span><button onClick={() => setFontSize(v => Math.min(24,v+1))}>+</button></div></div><div className="setting-row"><div><strong>Word Wrap</strong><p>Wrap long lines to fit the editor width.</p></div><label className="toggle-control"><input type="checkbox" checked={wordWrap} onChange={e => setWordWrap(e.target.checked)}/><span/></label></div><div className="setting-row"><div><strong>Minimap</strong><p>Show the code overview on the right edge.</p></div><label className="toggle-control"><input type="checkbox" checked={minimapEnabled} onChange={e => setMinimapEnabled(e.target.checked)}/><span/></label></div></>}
            {settingsTab === 'Appearance' && <><div className="setting-row"><div><strong>Color theme</strong><p>Choose the workspace appearance.</p></div><select value={themeChoice} onChange={e => setThemeChoice(e.target.value)}><option>Graphite Dark</option><option>Midnight</option><option>High Contrast</option></select></div><div className="theme-preview"><div className="theme-preview-bar"/><div className="theme-preview-lines"><i/><i/><i/><i/></div><span>{themeChoice}</span></div><p className="settings-note">This selection updates the theme preview panel. The editor currently uses the Graphite Dark base theme.</p></>}
            {settingsTab === 'Shortcuts' && <div className="shortcut-list">{[['Command Palette','Ctrl+Shift+P'],['Open Settings','Ctrl+,'],['Save File','Ctrl+S'],['Find','Ctrl+F'],['Toggle Terminal','Ctrl+`'],['Full Screen Editor','Esc to exit']].map(([name,key]) => <div key={name}><span>{name}</span><kbd>{key}</kbd></div>)}</div>}
          </div></div>
        <footer className="settings-footer"><span><CircleHelp size={13}/> Some integrations are still in preview.</span><button onClick={() => setSettingsOpen(false)}>Done</button></footer>
      </section>
    </div>}
    {notice && <div className="toast"><span>{notice}</span><button onClick={() => setNotice('')}><X size={14}/></button></div>}
  </div>
}
