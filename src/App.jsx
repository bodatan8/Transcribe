import { useEffect, useState, useCallback } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './hooks/useAuth'
import { Login } from './components/Login'
import { Dashboard } from './components/Dashboard'
import { ToastProvider } from './components/Toast'
import { CommandPalette } from './components/CommandPalette'
import { useCommandPalette } from './hooks/useCommandPalette'
import { initSyncService } from './services/syncService'
import './App.css'

function AppContent() {
  const { user, loading } = useAuth()
  const { isOpen, close } = useCommandPalette()
  const [triggerRecord, setTriggerRecord] = useState(false)
  const [activeView, setActiveView] = useState('dashboard')
  const [actionFilter, setActionFilter] = useState('pending')
  const [editingActionId, setEditingActionId] = useState(null)

  const handleEditAction = useCallback((actionId) => {
    setEditingActionId(actionId || null)
  }, [])

  const handleCommand = useCallback((commandId) => {
    switch (commandId) {
      case 'record':
        setTriggerRecord(true)
        setTimeout(() => setTriggerRecord(false), 100)
        break
      case 'view-dashboard':
        setActiveView('dashboard')
        break
      case 'view-recordings':
        setActiveView('recordings')
        break
      case 'view-actions':
        setActiveView('actions')
        break
      case 'filter-pending':
        setActiveView('actions')
        setActionFilter('pending')
        break
      case 'filter-approved':
        setActiveView('actions')
        setActionFilter('approved')
        break
      case 'filter-all':
        setActiveView('actions')
        setActionFilter('all')
        break
      default:
        break
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <div className="text-center">
          <img 
            src="/Spratt_Logo.png" 
            alt="Spratt" 
            className="h-10 mx-auto mb-6 opacity-60"
          />
          {/* Minimal loading indicator - Ive principle: restraint */}
          <div className="flex items-center justify-center gap-1">
            <div className="w-2 h-2 rounded-full bg-spratt-blue animate-pulse" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-spratt-blue animate-pulse" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-spratt-blue animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <>
      <Dashboard 
        activeView={activeView}
        onViewChange={setActiveView}
        triggerRecord={triggerRecord}
        actionFilter={actionFilter}
        onActionFilterChange={setActionFilter}
        editingActionId={editingActionId}
        onEditAction={handleEditAction}
      />
      <CommandPalette 
        isOpen={isOpen} 
        onClose={close} 
        onCommand={handleCommand}
      />
    </>
  )
}

function App() {
  // Initialize sync service on app startup
  useEffect(() => {
    initSyncService()
  }, [])

  return (
    <AuthProvider>
      <ToastProvider />
      <AppContent />
    </AuthProvider>
  )
}

export default App
