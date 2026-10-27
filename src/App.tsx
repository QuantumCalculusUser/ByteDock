import { useEffect, useMemo, useState } from 'react'
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
  const [explorerOpen, setExplorerOpen] = useState(true)
  const [agentOpen, setAgentOpen] = useState(true)
  const [terminalOpen, setTerminalOpen] = useState(true)
  const [editorFocus, setEditorFocus] = useState(false)
  const [terminalTab, setTerminalTab] = useState<'terminal'|'output'|'problems'>('terminal')
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'Hey! I’m your coding agent. Ask me to explain this project, sketch a feature, or help plan a fix. Model integration is coming in Phase 2.' }])
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showNewFile, setShowNewFile] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [notice, setNotice] = useState('')
  const [runCount, setRunCount] = useState(0)
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

  // Escape exits the distraction-free full-code view.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setEditorFocus(false); setOpenMenu(null); setSettingsOpen(false) }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'p') { event.preventDefault(); setOpenMenu(v => v === 'Command Palette' ? null : 'Command Palette') }
      if ((event.ctrlKey || event.metaKey) && event.key === ',') { event.preventDefault(); setSettingsOpen(true); setOpenMenu(null) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  const filteredFiles = useMemo(() => files.filter(f => f.name.toLowerCase().includes(search.toLowerCase())), [files, search])

  const updateCode = (value?: string) => setFiles(old => old.map(f => f.name === activeFile ? { ...f, content: value ?? '' } : f))
  const sendPrompt = () => {
    const trimmed = prompt.trim()
    if (!trimmed) return
    setMessages(old => [...old, { role: 'user', text: trimmed }, { role: 'assistant', text: 'This is the Phase 1 interface prototype, so I haven’t called a model or changed files automatically. In Phase 2, I’ll send this request to NVIDIA Nemotron through Nebius Token Factory and show the proposed diff here.' }])
    setPrompt('')
    setCreditUsed(v => Math.min(100, v + 2))
  }
  const createFile = () => {
    const name = newFileName.trim()
    if (!name || files.some(f => f.name === name)) { setNotice('Enter a unique file name.'); return }
    const ext = name.split('.').pop()?.toLowerCase()
    const language = ext === 'py' ? 'python' : ext === 'js' ? 'javascript' : ext === 'ts' || ext === 'tsx' ? 'typescript' : ext === 'json' ? 'json' : ext === 'html' ? 'html' : ext === 'css' ? 'css' : 'plaintext'
    const icon = ext === 'json' ? 'json' : ['py','js','ts','tsx','jsx'].includes(ext ?? '') ? 'code' : 'file'
    setFiles(old => [...old, { name, language, icon, content: '' } as ProjectFile])
    setActiveFile(name); setNewFileName(''); setShowNewFile(false); setNotice(`Created ${name}`)
  }
  const runDemo = () => {
    setRunCount(v => v + 1); setTerminalOpen(true); setTerminalTab('output')
    setNotice('Demo run complete')
  }
  const saveCurrentFile = () => setNotice(`${currentFile.name} is saved in this local preview.`)
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
    setMessages(old => old) // keep the terminal mock self-contained
    setNotice(`Terminal is a UI preview. “${cmd}” was not executed.`)
    setTerminalInput('')
  }

  return <div className="app-shell" onClick={(e) => { if (e.target === e.currentTarget) setOpenMenu(null) }}>
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Braces size={18}/></div><span>byte<span className="brand-accent">dock</span></span><span className="dev-badge">PREVIEW</span></div>
      <div className="top-center"><div className="workspace-path"><Cloud size={14}/><span>workspace</span><ChevronRight size={13}/><strong>hello-bytedock</strong><span className="saved-dot" title="Local preview"/></div></div>
      <div className="top-actions">
        <button className="top-icon" title="Search" onClick={() => setShowSearch(v => !v)}><Search size={16}/></button>
        <button className="branch-button" onClick={() => setBranchMenu(v => !v)}><GitBranch size={14}/> main <ChevronDown size={13}/></button>
        {branchMenu && <div className="branch-popover"><b>Current branch</b><span><GitBranch size={14}/> main</span><small>Git integration will be added later.</small></div>}
        <button className="share-button" onClick={() => setNotice('Sharing will be available when cloud workspaces are connected.')}><Cloud size={14}/> Share</button>
        <button className="avatar" title="Account">H</button>
      </div>
    </header>

    <nav className="menubar" aria-label="Application menu">
      <div className="menu-brand-mini"><Braces size={15}/></div>
      {['File','Edit','Selection','View','Go','More'].map(label => <div className="menu-root" key={label}>
        <button className={openMenu === label ? 'menu-root-button active' : 'menu-root-button'} onClick={() => setOpenMenu(v => v === label ? null : label)}>{label === 'More' ? '•••' : label}</button>
        {openMenu === label && <div className="menu-dropdown">
          {(label === 'File' ? [
            ['New Text File','Ctrl+N'],['New File…','Ctrl+Alt+N'],['New Window','Ctrl+Shift+N'],['separator',''],['Open File…','Ctrl+O'],['Open Folder…','Ctrl+K Ctrl+O'],['Open Recent','›'],['separator',''],['Add Folder to Workspace…',''],['Save','Ctrl+S'],['Save As…','Ctrl+Shift+S'],['separator',''],['Auto Save',''],['Preferences','›'],['separator',''],['Close Editor','Ctrl+F4'],['Close Folder','Ctrl+K F'],['Close Window','Alt+F4'],['Exit','']
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
        <div className="file-list">{filteredFiles.map(file => <button key={file.name} className={`file-row ${activeFile === file.name ? 'active' : ''}`} onClick={() => setActiveFile(file.name)}>{iconFor(file)}<span>{file.name}</span>{activeFile === file.name && <span className="file-unsaved"/>}</button>)}{filteredFiles.length === 0 && <div className="empty-search">No matching files</div>}</div>
        <div className="explorer-bottom"><div className="section-label"><ChevronRight size={13}/> OUTLINE</div><div className="section-label"><ChevronRight size={13}/> TIMELINE</div></div>
      </aside>}

      <main className="editor-area">
        <div className="tabs-row"><div className="editor-tab active">{iconFor(currentFile)}<span>{currentFile.name}</span><span className="tab-dot"/></div><div className="tab-spacer"/><button className="run-button" onClick={runDemo}><Play size={13} fill="currentColor"/> Run <ChevronDown size={12}/></button><button className="editor-action" title="Copy file contents" onClick={() => {void navigator.clipboard?.writeText(currentFile.content);setNotice('File contents copied (if clipboard permission is available).')}}><Copy size={14}/></button><button className="editor-action focus-toggle" title={editorFocus ? "Exit full code view (Esc)" : "Full code view"} aria-label={editorFocus ? "Exit full code view" : "Full code view"} onClick={() => setEditorFocus(v => !v)}>{editorFocus ? <Minimize2 size={14}/> : <Maximize2 size={14}/>}</button></div>
        <div className="breadcrumbs"><span>hello-bytedock</span><ChevronRight size={12}/>{iconFor(currentFile)}<span>{currentFile.name}</span><span className="crumb-muted">›</span></div>
        <div className="monaco-wrap"><Editor height="100%" language={currentFile.language} path={currentFile.name} value={currentFile.content} onChange={updateCode} theme="vs-dark" options={{fontFamily: 'Consolas, "Courier New", monospace', fontSize, lineHeight: 23, minimap: { enabled: minimapEnabled, renderCharacters: true, scale: 1, showSlider: 'always', size: 'fit' }, padding: { top: 15, bottom: 20 }, scrollBeyondLastLine: false, smoothScrolling: true, cursorBlinking: 'smooth', renderLineHighlight: 'all', automaticLayout: true, tabSize: 4, wordWrap: wordWrap ? 'on' : 'off', lineNumbersMinChars: 3, glyphMargin: false, folding: true, bracketPairColorization: { enabled: true }, guides: { indentation: true } }} /></div>
        {terminalOpen && !editorFocus && <section className="terminal-panel">
          <div className="terminal-tabs"><button className={terminalTab === 'problems' ? 'active' : ''} onClick={() => setTerminalTab('problems')}>PROBLEMS <span className="tiny-count">0</span></button><button className={terminalTab === 'output' ? 'active' : ''} onClick={() => setTerminalTab('output')}>OUTPUT</button><button className={terminalTab === 'terminal' ? 'active' : ''} onClick={() => setTerminalTab('terminal')}>TERMINAL</button><button className="terminal-close" onClick={() => setTerminalOpen(false)} title="Close terminal"><X size={14}/></button></div>
          {terminalTab === 'terminal' ? <div className="terminal-content"><div><span className="terminal-prompt">➜</span> <span className="terminal-path">~/hello-bytedock</span> <span className="terminal-muted">$</span> <span>Ready for a runtime connection.</span></div><div className="terminal-hint">Execution is not connected in Phase 1. Commands entered here are not run.</div><form className="terminal-input-row" onSubmit={e => {e.preventDefault();runTerminalCommand()}}><span className="terminal-prompt">➜</span><input value={terminalInput} onChange={e => setTerminalInput(e.target.value)} placeholder="Type a command to preview…"/><button type="submit"><Send size={13}/></button></form></div> : terminalTab === 'output' ? <div className="output-content"><div className="output-heading"><span className="success-dot"/> ByteDock preview run #{runCount || 1}</div><p>{runCount ? 'Frontend interaction completed.' : 'Ready. Press Run to preview the workflow.'}</p><p className="terminal-muted">No code was executed. A secure runner will be added in a later phase.</p></div> : <div className="problems-content"><ShieldCheck size={16}/><span>No problems reported by the frontend preview.</span><small>Python/JavaScript diagnostics are not connected yet.</small></div>}
        </section>}
        <footer className="statusbar"><div className="status-left"><button onClick={() => setBranchMenu(v => !v)}><GitBranch size={12}/> main</button><span><CircleHelp size={12}/> 0</span><span><Activity size={12}/> Preview</span></div><div className="status-right"><span>Ln 1, Col 1</span><span>Spaces: 4</span><span>UTF-8</span><span>{currentFile.language}</span><span className="status-live"><span/> Local workspace</span></div></footer>
      </main>


      {agentOpen && !editorFocus && <aside className="agent-panel panel">
        <div className="agent-heading"><div className="agent-title-icon"><Sparkles size={15}/></div><div><strong>AI Agent</strong><span>YOUR PAIR PROGRAMMER</span></div><div className="agent-head-actions"><button title="New chat" onClick={() => setMessages([{role:'assistant',text:'Fresh context. Tell me what you want to build. Model integration is coming in Phase 2.'}])}><CirclePlus size={16}/></button><button title="Close AI panel" onClick={() => setAgentOpen(false)}><X size={16}/></button></div></div>
        <div className="agent-model"><span className="model-dot"/><span>Nemotron</span><span className="model-tag">PLANNED</span><ChevronDown size={13}/></div>
        <div className="agent-conversation">{messages.map((message, i) => <div key={i} className={`message ${message.role}`}><div className="message-avatar">{message.role === 'assistant' ? <Sparkles size={13}/> : 'H'}</div><div className="message-body">{message.role === 'assistant' && <div className="message-label">BYTEDOCK AGENT</div>}<p>{message.text}</p>{message.role === 'assistant' && i === 0 && <div className="suggestion-chips"><button onClick={() => setPrompt('Explain the current project')}>Explain this project <span>↗</span></button><button onClick={() => setPrompt('Suggest a useful feature for this project')}>Suggest a feature <span>↗</span></button></div>}</div></div>)}</div>
        <div className="agent-composer"><div className="composer-context"><span><FileCode2 size={12}/>{currentFile.name}</span><span>Workspace context</span></div><textarea value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => {if (e.key === 'Enter' && !e.shiftKey) {e.preventDefault();sendPrompt()}}} placeholder="Ask ByteDock to help with code…" rows={3}/><div className="composer-bottom"><div><button title="Attach context" onClick={() => setNotice('File context is attached automatically in this preview.')}><Plus size={15}/></button><span><Command size={11}/> Enter to send</span></div><button className="send-button" disabled={!prompt.trim()} onClick={sendPrompt}><Send size={14}/></button></div></div>
        <div className="agent-disclaimer"><ShieldCheck size={12}/> Review AI-generated code before running it.</div>
      </aside>}
    </div>

    <div className="resource-dock"><div className="resource-brand"><div className="resource-logo"><Zap size={13} fill="currentColor"/></div><span>RESOURCE METER</span><span className="demo-pill">DEMO</span></div><div className="resource-metric token-metric"><div className="metric-icon"><Sparkles size={14}/></div><div className="metric-copy"><span>AI credits</span><strong>{100 - creditUsed}<small> / 100 left</small></strong><div className="meter-track"><span style={{width: `${creditUsed}%`}}/></div></div></div><div className="resource-metric"><div className="metric-icon"><Cpu size={14}/></div><div className="metric-copy"><span>CPU</span><strong>1 vCPU <small>limit</small></strong><div className="meter-track"><span style={{width:'22%'}}/></div></div></div><div className="resource-metric"><div className="metric-icon"><Gauge size={14}/></div><div className="metric-copy"><span>Memory</span><strong>2 GB <small>limit</small></strong><div className="meter-track"><span style={{width:'34%'}}/></div></div></div><div className="resource-metric"><div className="metric-icon"><HardDrive size={14}/></div><div className="metric-copy"><span>Storage</span><strong>1.2 <small>/ 5 GB</small></strong><div className="meter-track"><span style={{width:'24%'}}/></div></div></div><div className="resource-spacer"/><button className="upgrade-button" onClick={() => setNotice('Upgrade flow preview: plans and billing will be implemented after usage enforcement.')}> <Zap size={13}/> Upgrade plan <span>↗</span></button><button className="resource-help" title="About resource usage" onClick={() => setNotice('Demo figures only. Real quotas must be measured and enforced by the backend.') }><CircleHelp size={15}/></button></div>
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
