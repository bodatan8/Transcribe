import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react'

/**
 * Command Palette
 */

const commands = [
  { id: 'record', icon: '●', label: 'Start recording', shortcut: 'R', category: 'Actions' },
  { id: 'stop', icon: '■', label: 'Stop recording', shortcut: 'S', category: 'Actions' },
  { id: 'view-dashboard', icon: '⌂', label: 'Go to Dashboard', shortcut: '1', category: 'Navigation' },
  { id: 'view-recordings', icon: '◎', label: 'Go to Recordings', shortcut: '2', category: 'Navigation' },
  { id: 'view-actions', icon: '✓', label: 'Go to Actions', shortcut: '3', category: 'Navigation' },
  { id: 'filter-pending', icon: '◷', label: 'Filter: Pending', category: 'Filters' },
  { id: 'filter-approved', icon: '✓', label: 'Filter: Approved', category: 'Filters' },
  { id: 'filter-all', icon: '◇', label: 'Filter: All', category: 'Filters' },
]

const CommandItem = memo(({ cmd, isSelected, onClick }) => (
  <button
    onClick={onClick}
    className={`
      w-full flex items-center gap-3 px-4 py-2.5 text-left
      ${isSelected ? 'bg-spratt-blue text-white' : 'text-slate-700 hover:bg-slate-50'}
    `}
  >
    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-sm ${isSelected ? 'bg-white/20' : 'bg-slate-100'}`}>
      {cmd.icon}
    </span>
    <span className="flex-1 text-sm font-medium">{cmd.label}</span>
    {cmd.shortcut && (
      <kbd className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${isSelected ? 'bg-white/20' : 'bg-slate-100 border border-slate-200'}`}>
        {cmd.shortcut}
      </kbd>
    )}
  </button>
))

CommandItem.displayName = 'CommandItem'

export const CommandPalette = memo(({ isOpen, onClose, onCommand }) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)

  const filteredCommands = useMemo(() => 
    query === ''
      ? commands
      : commands.filter(cmd => cmd.label.toLowerCase().includes(query.toLowerCase())),
    [query]
  )

  const groupedCommands = useMemo(() => 
    filteredCommands.reduce((acc, cmd) => {
      if (!acc[cmd.category]) acc[cmd.category] = []
      acc[cmd.category].push(cmd)
      return acc
    }, {}),
    [filteredCommands]
  )

  // Reset state and focus when opening
  // This pattern is intentional - resetting state when modal opens is valid
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      // Focus after a small delay to ensure the input is rendered
      const timer = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(timer)
    }
  }, [isOpen])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Handle query changes - reset selection
  const handleQueryChange = useCallback((newQuery) => {
    setQuery(newQuery)
    setSelectedIndex(0)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(i => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (filteredCommands[selectedIndex]) {
            onCommand(filteredCommands[selectedIndex].id)
            onClose()
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredCommands, selectedIndex, onCommand, onClose])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 overlay-backdrop flex items-start justify-center pt-[12vh]"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Search */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder="Search commands..."
            className="flex-1 text-base bg-transparent outline-none"
          />
          <kbd className="px-2 py-1 text-xs text-slate-400 bg-slate-100 rounded border border-slate-200">esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500">No commands found</div>
          ) : (
            Object.entries(groupedCommands).map(([category, cmds]) => (
              <div key={category}>
                <div className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {category}
                </div>
                {cmds.map((cmd) => {
                  const index = filteredCommands.indexOf(cmd)
                  return (
                    <CommandItem
                      key={cmd.id}
                      cmd={cmd}
                      isSelected={index === selectedIndex}
                      onClick={() => {
                        onCommand(cmd.id)
                        onClose()
                      }}
                    />
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center gap-4 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-white rounded border border-slate-200">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200">↵</kbd> select
          </span>
        </div>
      </div>
    </div>
  )
})

CommandPalette.displayName = 'CommandPalette'
