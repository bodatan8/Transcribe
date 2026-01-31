import { useState, useEffect, useCallback, memo } from 'react'
import { AudioRecorder } from './AudioRecorder'
import { ActionsList } from './ActionsList'
import { RecordingsList } from './RecordingsList'
import { Sidebar } from './Sidebar'
import { supabase } from '../lib/supabase'

/**
 * Optimized Dashboard
 */

const StatCard = memo(({ label, value, icon, color = 'default', onClick, muted }) => {
  const colors = {
    default: 'text-spratt-blue bg-spratt-blue-50',
    warning: 'text-amber-600 bg-amber-50',
    success: 'text-emerald-600 bg-emerald-50',
  }

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`card p-5 text-left w-full ${onClick ? 'card-interactive cursor-pointer' : ''} ${muted ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">{label}</p>
          <p className="text-3xl font-semibold text-slate-900">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${colors[color]}`}>
          {icon}
        </div>
      </div>
    </button>
  )
})

StatCard.displayName = 'StatCard'

const SectionHeader = memo(({ title, badge, action, onAction }) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {badge && <span className="badge badge-warning">{badge}</span>}
    </div>
    {action && (
      <button onClick={onAction} className="text-sm font-medium text-spratt-blue hover:text-spratt-blue-700">
        {action} →
      </button>
    )}
  </div>
))

SectionHeader.displayName = 'SectionHeader'

export const Dashboard = memo(({ activeView, onViewChange, triggerRecord, actionFilter, onActionFilterChange }) => {
  const [pendingActionsCount, setPendingActionsCount] = useState(0)

  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await supabase.from('actions').select('*', { count: 'exact', head: true }).eq('status', 'pending')
      setPendingActionsCount(count || 0)
    }

    fetchCount()

    const subscription = supabase
      .channel('actions_count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'actions' }, fetchCount)
      .subscribe()

    return () => subscription.unsubscribe()
  }, [])

  const handleViewActions = useCallback(() => {
    onViewChange('actions')
    onActionFilterChange('pending')
  }, [onViewChange, onActionFilterChange])

  const renderContent = () => {
    switch (activeView) {
      case 'recordings':
        return <RecordingsList />
      case 'actions':
        return <ActionsList filter={actionFilter} onFilterChange={onActionFilterChange} />
      case 'dashboard':
      default:
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Pending Review" value={pendingActionsCount} icon="◷" color="warning" onClick={handleViewActions} />
              <StatCard label="Recordings" value="—" icon="◎" onClick={() => onViewChange('recordings')} />
              <StatCard label="Synced" value="—" icon="↗" color="success" muted />
            </div>

            <AudioRecorder triggerRecord={triggerRecord} />

            <section>
              <SectionHeader title="Recent Recordings" action="View all" onAction={() => onViewChange('recordings')} />
              <RecordingsList limit={3} compact />
            </section>

            {pendingActionsCount > 0 && (
              <section>
                <SectionHeader title="Needs Review" badge={pendingActionsCount} action="View all" onAction={handleViewActions} />
                <ActionsList filter="pending" limit={3} compact onFilterChange={onActionFilterChange} />
              </section>
            )}
          </div>
        )
    }
  }

  const pageMeta = {
    dashboard: { title: 'Dashboard', subtitle: 'Overview of your activity' },
    recordings: { title: 'Recordings', subtitle: 'Your audio recordings' },
    actions: { title: 'Actions', subtitle: 'Review and manage actions' },
  }[activeView] || { title: 'Dashboard', subtitle: '' }

  return (
    <div className="min-h-screen">
      <Sidebar activeView={activeView} onViewChange={onViewChange} pendingActionsCount={pendingActionsCount} />

      <main className="main-content">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 py-8">
          <header className="mb-8">
            <h1 className="text-2xl font-semibold text-slate-900">{pageMeta.title}</h1>
            <p className="text-sm text-slate-500 mt-1">{pageMeta.subtitle}</p>
          </header>

          <div className="animate-in">{renderContent()}</div>
        </div>
      </main>
    </div>
  )
})

Dashboard.displayName = 'Dashboard'
