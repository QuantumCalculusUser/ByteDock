import { useEffect, useMemo, useRef, useState } from 'react'
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
  const response = await fetch(apiUrl('/api/workspace'));
  if (!response.ok) throw new Error(`Workspace API returned ${response.status}`);
  const payload = await response.json() as { workspace?: StoredWorkspace | null };
  if (payload.workspace) return payload.workspace;
  // One-time migration: keep the user's Phase 2.1 IndexedDB workspace when moving to backend storage.
  const legacy = await readLegacyWorkspace();
  if (legacy?.files?.length) { await writeWorkspace(legacy); return legacy; }
  return undefined;
}
let workspaceWriteQueue: Promise<void> = Promise.resolve();
function writeWorkspace(value: StoredWorkspace): Promise<void> {
  // Serialize writes so a slower older autosave cannot overwrite a newer edit.
  workspaceWriteQueue = workspaceWriteQueue.catch(() => undefined).then(async () => {
    const response = await fetch(apiUrl('/api/workspace'), {
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
      'A tiny demo project running in your workspace.',
      '',
      '## Getting started',
      '',
      '1. Open main.py.',
      '2. Ask the agent to help you change it.',
      '3. Run your code when execution is connected.',
      '',
      '> Phase 1 is the frontend prototype. AI and secure execution arrive in later phases.'
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
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'General'|'Editor'|'Appearance'|'Shortcuts'>('General')
  const [wordWrap, setWordWrap] = useState(true)
  const [minimapEnabled, setMinimapEnabled] = useState(true)
  const [fontSize, setFontSize] = useState(14)
  const [themeChoice, setThemeChoice] = useState('Graphite Dark')

  const currentFile = files.find(f => f.name === activeFile) ?? files[0]
  const latestRef = useRef({ files, activeFile, openTabs, savedContents, workspaceReady })
  latestRef.current = { files, activeFile, openTabs, savedContents, workspaceReady }

  // Load workspace state from the backend once, then persist changes to server storage.
  useEffect(() => {
    let cancelled = false
    readWorkspace().then(saved => {
      if (cancelled) return
      if (saved?.files?.length) {
        setFiles(saved.files)
        setSavedContents(saved.savedContents ?? Object.fromEntries(saved.files.map(file => [file.name, file.content])))
        const validTabs = (saved.openTabs || [saved.activeFile]).filter(name => saved.files.some(f => f.name === name))
        const active = saved.files.some(f => f.name === saved.activeFile) ? saved.activeFile : saved.files[0].name
        setOpenTabs(validTabs.length ? validTabs : [active])
        setActiveFile(active)
      }
      setWorkspaceReady(true)
    }).catch(() => { if (!cancelled) { setWorkspaceReady(true); setNotice('Could not reach the workspace backend. Start ByteDock with npm run dev.') } })
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    if (!workspaceReady) return
    writeWorkspace({ files, activeFile, openTabs, savedContents }).catch(() => setNotice('Workspace save failed. Check that the ByteDock backend is running.'))
  }, [files, activeFile, openTabs, savedContents, workspaceReady])

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
    fetch(apiUrl('/api/ai/status'))
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
      const response = await fetch(apiUrl('/api/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.filter(message => message.role === 'user' || message.role === 'assistant').slice(-12).map(message => ({ role: message.role, content: message.text })) })
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || `AI request failed with HTTP ${response.status}.`)
      const usageText = result.usage?.totalTokens ? `\n\n— ${result.usage.totalTokens} tokens used · ${result.model || 'Nebius model'}` : `\n\n— ${result.model || 'Nebius model'}`
      setMessages(old => [...old, { role: 'assistant', text: `${result.text}${usageText}` }])
      if (result.usage?.totalTokens) setCreditUsed(v => Math.min(100, v + Math.max(1, Math.ceil(result.usage.totalTokens / 1000))))
    } catch (error) {
      setMessages(old => [...old, { role: 'assistant', text: `AI request failed: ${error instanceof Error ? error.message : 'Unknown error'}` }])
    } finally {
      setAiLoading(false)
      fetch(apiUrl('/api/ai/status')).then(response => response.json()).then(setAiStatus).catch(() => undefined)
    }
  }
  const createFile = () => {
    const name = newFileName.trim()
    if (!name || files.some(f => f.name === name)) { setNotice('Enter a unique file name.'); return }
    if (name.includes('/') || name.includes('\\') || name === '.' || name === '..') { setNotice('Use a file name without folder separators for this milestone.'); return }
    setFiles(old => [...old, { name, language: languageFor(name), icon: iconForName(name), content: '' } as ProjectFile]); setSavedContents(old => ({ ...old, [name]: '' }))
    setActiveFile(name); setOpenTabs(old => [...old, name]); setNewFileName(''); setShowNewFile(false); setNotice(`Created ${name}`)
  }
  const runDemo = async () => {
    if (!currentFile) return
    const language = currentFile.language === 'python' ? 'python' : ['javascript','typescript'].includes(currentFile.language) ? 'javascript' : null
    setTerminalOpen(true); setTerminalTab('output')
    if (!language) { setRunState({ loading:false, ok:false, stdout:'', stderr:`Execution for ${currentFile.language} files is not supported yet. Run Python (.py) or JavaScript (.js) files.`, exitCode:null, duration:0 }); return }
    setRunState({ loading:true, ok:null, stdout:'', stderr:'Submitting to remote execution sandbox…', exitCode:null, duration:0 })
    const started = Date.now()
    try {
      const response = await fetch(apiUrl('/api/runtime/run'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ language, code:currentFile.content }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || `Runtime request failed with HTTP ${response.status}.`)
      setRunCount(v => v + 1)
      setRunState({ loading:false, ok:result.ok, stdout:result.stdout || '', stderr:result.stderr || '', exitCode:result.exitCode, duration:Date.now()-started, error:result.timedOut ? 'Execution exceeded the remote provider time limit.' : undefined })
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
      .then(() => { setSavedContents(nextSavedContents); setNotice(`${fileToSave.name} saved to the ByteDock workspace server.`) })
      .catch(() => setNotice('Save failed. Check that the ByteDock backend is running.'))
  }
  const closeTab = (name: string) => { const next = openTabs.filter(tab => tab !== name); setOpenTabs(next); if (activeFile === name && next.length) setActiveFile(next[next.length - 1]); else if (activeFile === name) setNotice('Create or open a file to continue editing.') }
  const renameFile = () => { const oldName = renameTarget; const nextName = renameValue.trim(); if (!oldName || !nextName) return; if (files.some(f => f.name === nextName && f.name !== oldName)) { setNotice('A file with that name already exists.'); return } setFiles(old => old.map(f => f.name === oldName ? { ...f, name: nextName, language: languageFor(nextName), icon: iconForName(nextName) } : f)); setOpenTabs(old => old.map(n => n === oldName ? nextName : n)); setSavedContents(old => { const next = { ...old }; if (oldName in next) { next[nextName] = next[oldName]; delete next[oldName] } return next }); if (activeFile === oldName) setActiveFile(nextName); setRenameTarget(null); setRenameValue(''); setNotice(`Renamed ${oldName} to ${nextName}`) }
  const deleteFile = (name: string) => { if (!window.confirm(`Delete ${name}? This removes it from this ByteDock workspace.`)) return; const nextFiles = files.filter(f => f.name !== name); if (!nextFiles.length) { setNotice('Keep at least one file in the workspace.'); return } setFiles(nextFiles); setSavedContents(old => { const next = { ...old }; delete next[name]; return next }); const nextTabs = openTabs.filter(n => n !== name); setOpenTabs(nextTabs.length ? nextTabs : [nextFiles[0].name]); if (activeFile === name) setActiveFile(nextTabs[nextTabs.length - 1] || nextFiles[0].name); setFileContext(null); setNotice(`Deleted ${name}`) }
  const menuAction = (action: string) => {
    setOpenMenu(null)
    if (action === 'New File') { setShowNewFile(true); setExplorerOpen(true); return }
    if (action === 'Open File') { setExplorerOpen(true); setNotice('Choose a file from the Explorer. Uploading files will be added later.'); return }
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
    setNotice('Phase 2.4 terminal supports the run command. Use the Run button to execute the active Python or JavaScript file in the remote execution sandbox.')
    setTerminalInput('')
  }

  return <div className="app-shell" onClick={(e) => { if (e.target === e.currentTarget) setOpenMenu(null) }}>
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Braces size={18}/></div><span>byte<span className="brand-accent">dock</span></span><span className="dev-badge">PHASE 2</span></div>
      <div className="top-center"><div className="workspace-path"><Cloud size={14}/><span>workspace</span><ChevronRight size={13}/><strong>hello-bytedock</strong><span className="saved-dot" title="Local preview"/></div></div>
      <div className="top-actions">
        <button className="top-icon" title="Search" onClick={() => setShowSearch(v => !v)}><Search size={16}/></button>
        <button className="branch-button" onClick={() => setBranchMenu(v => !v)}><GitBranch size={14}/> main <ChevronDown size={13}/></button>
        {branchMenu && <div className="branch-popover"><b>Current branch</b><span><GitBranch size={14}/> main</span><small>Git integration will be added later.</small></div>}
        <button className="share-button" onClick={() => setNotice('Workspace is stored by the local ByteDock backend. Remote sharing will be added with authentication.')}><Cloud size={14}/> Share</button>
        <button className="avatar" title="Account">H</button>
      </div>
    </header>

    <nav className="menubar" aria-label="Application menu">
      <div className="menu-brand-mini"><Braces size={15}/></div>
      {['File','Edit','Selection','View','Go','More'].map(label => <div className="menu-root" key={label}>
        <button className={openMenu === label ? 'menu-root-button active' : 'menu-root-button'} onClick={() => setOpenMenu(v => v === label ? null : label)}>{label === 'More' ? '•••' : label}</button>
        {openMenu === label && <div className="menu-dropdown">
          {(label === 'File' ? [
            ['New Text File','Ctrl+Alt+N'],['New File…','Ctrl+Alt+N'],['New Window','Ctrl+Shift+N'],['separator',''],['Open File…','Ctrl+O'],['Open Folder…','Ctrl+K Ctrl+O'],['Open Recent','›'],['separator',''],['Add Folder to Workspace…',''],['Save','Ctrl+S'],['Save As…','Ctrl+Shift+S'],['separator',''],['Auto Save',''],['Preferences','›'],['separator',''],['Close Editor','Ctrl+F4'],['Close Folder','Ctrl+K F'],['Close Window','Alt+F4'],['Exit','']
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
          {terminalTab === 'terminal' ? <div className="terminal-content"><div><span className="terminal-prompt">➜</span> <span className="terminal-path">~/workspace</span> <span className="terminal-muted">$</span> <span>Remote sandbox runner ready for Python and JavaScript.</span></div><div className="terminal-hint">Type `run` to execute the active file. Each run is executed remotely with sandbox resource limits.</div><form className="terminal-input-row" onSubmit={e => {e.preventDefault();runTerminalCommand()}}><span className="terminal-prompt">➜</span><input value={terminalInput} onChange={e => setTerminalInput(e.target.value)} placeholder="Type run and press Enter…"/><button type="submit"><Send size={13}/></button></form></div> : terminalTab === 'output' ? <div className="output-content"><div className="output-heading"><span className={runState.ok === true ? 'success-dot' : runState.ok === false ? 'error-dot' : 'success-dot'}/> {runState.loading ? 'Executing in isolated container…' : runState.ok === null ? 'Runtime output' : `Run #${runCount} · ${runState.ok ? 'Exited successfully' : 'Execution failed'}`}</div>{runState.loading ? <p>Starting remote runtime…</p> : runState.ok === null ? <p>Ready. Press Run to execute the active Python or JavaScript file.</p> : <><p className="terminal-muted">Exit code: {runState.exitCode ?? 'unavailable'} · {runState.duration} ms</p>{runState.stdout && <pre className="runtime-output">{runState.stdout}</pre>}{runState.stderr && <pre className="runtime-error">{runState.stderr}</pre>}{runState.error && <p className="runtime-error">{runState.error}</p>}{!runState.stdout && !runState.stderr && !runState.error && <p className="terminal-muted">Process completed with no output.</p>}</>}</div> : <div className="problems-content"><ShieldCheck size={16}/><span>No problems reported by the frontend preview.</span><small>Python/JavaScript diagnostics are not connected yet.</small></div>}
        </section>}
        <footer className="statusbar"><div className="status-left"><button onClick={() => setBranchMenu(v => !v)}><GitBranch size={12}/> main</button><span><CircleHelp size={12}/> 0</span><span><Activity size={12}/> Preview</span></div><div className="status-right"><span>Ln 1, Col 1</span><span>Spaces: 4</span><span>UTF-8</span><span>{currentFile.language}</span><span className="status-live"><span/> {workspaceReady ? 'Workspace server' : 'Connecting to backend…'}</span></div></footer>
      </main>


      {agentOpen && !editorFocus && <aside className="agent-panel panel">
        <div className="agent-heading"><div className="agent-title-icon"><Sparkles size={15}/></div><div><strong>AI Agent</strong><span>YOUR PAIR PROGRAMMER</span></div><div className="agent-head-actions"><button title="New chat" onClick={() => setMessages([{role:'assistant',text:'Fresh context. Tell me what you want to build.'}])}><CirclePlus size={16}/></button><button title="Close AI panel" onClick={() => setAgentOpen(false)}><X size={16}/></button></div></div>
        <div className="agent-model"><span className={`model-dot ${aiStatus?.configured ? 'connected' : ''}`}/><span>{aiStatus?.model || 'Nebius Token Factory'}</span><span className="model-tag">{aiStatus?.configured ? 'READY' : 'SETUP REQUIRED'}</span><ChevronDown size={13}/></div>
        <div className="agent-conversation">{messages.map((message, i) => <div key={i} className={`message ${message.role}`}><div className="message-avatar">{message.role === 'assistant' ? <Sparkles size={13}/> : 'H'}</div><div className="message-body">{message.role === 'assistant' && <div className="message-label">BYTEDOCK AGENT</div>}<p>{message.text}</p>{message.role === 'assistant' && i === 0 && <div className="suggestion-chips"><button onClick={() => setPrompt('Explain the current project')}>Explain this project <span>↗</span></button><button onClick={() => setPrompt('Suggest a useful feature for this project')}>Suggest a feature <span>↗</span></button></div>}</div></div>)}{aiLoading && <div className="message assistant"><div className="message-avatar"><Sparkles size={13}/></div><div className="message-body"><p>Contacting Nebius…</p></div></div>}</div>
        <div className="agent-composer"><div className="composer-context"><span><FileCode2 size={12}/>{currentFile.name}</span><label className="file-context-toggle"><input type="checkbox" checked={includeActiveFile} onChange={e => setIncludeActiveFile(e.target.checked)}/> Include file</label></div><textarea value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => {if (e.key === 'Enter' && !e.shiftKey) {e.preventDefault();sendPrompt()}}} placeholder="Ask ByteDock to help with code…" rows={3}/><div className="composer-bottom"><div><button title="Toggle active-file context" onClick={() => setIncludeActiveFile(value => !value)}><Plus size={15}/></button><span><Command size={11}/> Enter to send</span></div><button className="send-button" disabled={!prompt.trim() || aiLoading} onClick={sendPrompt}>{aiLoading ? <span className="ai-loading-indicator">…</span> : <Send size={14}/>}</button></div></div>
        <div className="agent-disclaimer"><ShieldCheck size={12}/> Review AI-generated code before running it.</div>
      </aside>}
    </div>

    <div className="resource-dock"><div className="resource-brand"><div className="resource-logo"><Zap size={13} fill="currentColor"/></div><span>RESOURCE METER</span><span className="demo-pill">DEMO</span></div><div className="resource-metric token-metric"><div className="metric-icon"><Sparkles size={14}/></div><div className="metric-copy"><span>AI credits</span><strong>{100 - creditUsed}<small> / 100 left</small></strong><div className="meter-track"><span style={{width: `${creditUsed}%`}}/></div></div></div><div className="resource-metric"><div className="metric-icon"><Cpu size={14}/></div><div className="metric-copy"><span>CPU</span><strong>1 vCPU <small>limit</small></strong><div className="meter-track"><span style={{width:'22%'}}/></div></div></div><div className="resource-metric"><div className="metric-icon"><Gauge size={14}/></div><div className="metric-copy"><span>Memory</span><strong>2 GB <small>limit</small></strong><div className="meter-track"><span style={{width:'34%'}}/></div></div></div><div className="resource-metric"><div className="metric-icon"><HardDrive size={14}/></div><div className="metric-copy"><span>Storage</span><strong>1.2 <small>/ 5 GB</small></strong><div className="meter-track"><span style={{width:'24%'}}/></div></div></div><div className="resource-spacer"/><button className="upgrade-button" onClick={() => setNotice('Upgrade flow preview: plans and billing will be implemented after usage enforcement.')}> <Zap size={13}/> Upgrade plan <span>↗</span></button><button className="resource-help" title="About resource usage" onClick={() => setNotice('Demo figures only. Real quotas must be measured and enforced by the backend.') }><CircleHelp size={15}/></button></div>
    {fileContext && <><div className="context-dismiss" onClick={() => setFileContext(null)}/><div className="file-context-menu" style={{left: Math.min(fileContext.x, window.innerWidth - 190), top: Math.min(fileContext.y, window.innerHeight - 125)}}><button onClick={() => {openFile(fileContext.name);setFileContext(null)}}>Open</button><button onClick={() => {setRenameTarget(fileContext.name);setRenameValue(fileContext.name);setFileContext(null)}}>Rename…</button><button className="danger" onClick={() => deleteFile(fileContext.name)}>Delete</button></div></>}
    {renameTarget && <div className="settings-backdrop" onMouseDown={e => {if (e.target === e.currentTarget) setRenameTarget(null)}}><form className="rename-dialog" onSubmit={e => {e.preventDefault();renameFile()}}><h3>Rename file</h3><input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} /><div><button type="button" onClick={() => setRenameTarget(null)}>Cancel</button><button type="submit" className="primary">Rename</button></div></form></div>}
    {settingsOpen && <div className="settings-backdrop" onMouseDown={e => {if (e.target === e.currentTarget) setSettingsOpen(false)}}>
      <section className="settings-window" role="dialog" aria-modal="true" aria-label="Settings">
        <header className="settings-titlebar"><div><Settings2 size={16}/><strong>Settings</strong><span>ByteDock preferences</span></div><button onClick={() => setSettingsOpen(false)} title="Close settings"><X size={16}/></button></header>
        <div className="settings-search"><Search size={15}/><input autoFocus placeholder="Search settings" onChange={e => {if (e.target.value.toLowerCase().includes('theme')) setSettingsTab('Appearance'); if (e.target.value.toLowerCase().includes('font') || e.target.value.toLowerCase().includes('minimap') || e.target.value.toLowerCase().includes('wrap')) setSettingsTab('Editor')}}/><kbd>Ctrl+,</kbd></div>
        <div className="settings-body"><aside className="settings-sidebar">{([['General',SlidersHorizontal],['Editor',Code2],['Appearance',Palette],['Shortcuts',Keyboard]] as const).map(([tab,Icon]) => <button key={tab} className={settingsTab === tab ? 'selected' : ''} onClick={() => setSettingsTab(tab)}><Icon size={15}/>{tab}</button>)}</aside>
          <div className="settings-content"><h2>{settingsTab}</h2><p className="settings-description">Customize your ByteDock workspace. Changes apply immediately in this preview.</p>
            {settingsTab === 'General' && <><div className="setting-row"><div><strong>Auto Save</strong><p>Save changes automatically while you work.</p></div><label className="toggle-control"><input type="checkbox" defaultChecked/><span/></label></div><div className="setting-row"><div><strong>Confirm before closing</strong><p>Warn before leaving an editor with unsaved changes.</p></div><label className="toggle-control"><input type="checkbox" defaultChecked/><span/></label></div><div className="setting-row"><div><strong>Workspace name</strong><p>The label shown in the workspace header.</p></div><span className="setting-value">hello-bytedock</span></div></>}
            {settingsTab === 'Editor' && <><div className="setting-row"><div><strong>Font size</strong><p>Editor font size in pixels.</p></div><div className="stepper"><button onClick={() => setFontSize(v => Math.max(10,v-1))}>−</button><span>{fontSize}px</span><button onClick={() => setFontSize(v => Math.min(24,v+1))}>+</button></div></div><div className="setting-row"><div><strong>Word Wrap</strong><p>Wrap long lines to fit the editor width.</p></div><label className="toggle-control"><input type="checkbox" checked={wordWrap} onChange={e => setWordWrap(e.target.checked)}/><span/></label></div><div className="setting-row"><div><strong>Minimap</strong><p>Show the code overview on the right edge.</p></div><label className="toggle-control"><input type="checkbox" checked={minimapEnabled} onChange={e => setMinimapEnabled(e.target.checked)}/><span/></label></div></>}
            {settingsTab === 'Appearance' && <><div className="setting-row"><div><strong>Color theme</strong><p>Choose the workspace appearance.</p></div><select value={themeChoice} onChange={e => setThemeChoice(e.target.value)}><option>Graphite Dark</option><option>Midnight</option><option>High Contrast</option></select></div><div className="theme-preview"><div className="theme-preview-bar"/><div className="theme-preview-lines"><i/><i/><i/><i/></div><span>{themeChoice}</span></div><p className="settings-note">Theme selection is saved for this session. Additional themes can be added later.</p></>}
            {settingsTab === 'Shortcuts' && <div className="shortcut-list">{[['Command Palette','Ctrl+Shift+P'],['Open Settings','Ctrl+,'],['Save File','Ctrl+S'],['Find','Ctrl+F'],['Toggle Terminal','Ctrl+`'],['Full Screen Editor','Esc to exit']].map(([name,key]) => <div key={name}><span>{name}</span><kbd>{key}</kbd></div>)}</div>}
          </div></div>
        <footer className="settings-footer"><span><CircleHelp size={13}/> Some integrations are still in preview.</span><button onClick={() => setSettingsOpen(false)}>Done</button></footer>
      </section>
    </div>}
    {notice && <div className="toast"><span>{notice}</span><button onClick={() => setNotice('')}><X size={14}/></button></div>}
  </div>
}
