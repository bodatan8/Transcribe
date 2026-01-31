import { useEffect, useState, useCallback, memo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { StaticWaveform } from './Waveform'
import toast from 'react-hot-toast'

/**
 * Recordings List with edit and re-transcribe
 */

const RecordingSkeleton = memo(() => (
  <div className="card p-5">
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 skeleton rounded-xl" />
      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-4 w-24 skeleton" />
          <div className="h-5 w-20 skeleton rounded-full" />
        </div>
        <div className="h-10 w-full skeleton" />
      </div>
    </div>
  </div>
))

RecordingSkeleton.displayName = 'RecordingSkeleton'

const RecordingCard = memo(({ recording, isExpanded, onToggle, onEdit, onRetranscribe }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(recording.title || '')
  const [notes, setNotes] = useState(recording.notes || '')
  const [saving, setSaving] = useState(false)

  const getBadge = (status) => ({ 
    pending: 'badge-warning', 
    processing: 'badge-info', 
    completed: 'badge-success', 
    failed: 'badge-error' 
  }[status] || 'badge-neutral')
  
  const formatTime = (date) => {
    const diff = Date.now() - new Date(date)
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  const formatDuration = (seconds) => {
    if (!seconds) return null
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onEdit(recording.id, { title, notes })
      setIsEditing(false)
      toast.success('Recording updated')
    } catch {
      toast.error('Error saving')
    } finally {
      setSaving(false)
    }
  }

  const handleRetranscribe = async () => {
    try {
      await onRetranscribe(recording.id)
      toast.success('Re-transcription started')
    } catch {
      toast.error('Error starting re-transcription')
    }
  }

  return (
    <div className="card p-5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-slate-700">
            {formatTime(recording.created_at)}
          </span>
          <span className={`badge ${getBadge(recording.transcription_status)}`}>
            {recording.transcription_status}
          </span>
          {formatDuration(recording.duration) && (
            <span className="text-xs text-slate-400 tabular-nums">
              {formatDuration(recording.duration)}
            </span>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Edit details"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          {recording.transcription_status === 'completed' && (
            <button
              onClick={handleRetranscribe}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Re-transcribe"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Title (if set) */}
      {recording.title && !isEditing && (
        <h3 className="font-medium text-slate-900 mb-3">{recording.title}</h3>
      )}

      {/* Edit form */}
      {isEditing && (
        <div className="mb-4 p-4 bg-slate-50 rounded-xl space-y-3 animate-in">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Add a title..."
              className="input py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes or context..."
              rows={3}
              className="input py-2 text-sm resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary text-sm py-2 px-4"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="btn btn-ghost text-sm py-2 px-4"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Notes (if set) */}
      {recording.notes && !isEditing && (
        <p className="text-sm text-slate-600 mb-3">{recording.notes}</p>
      )}

      {/* Waveform - Full width, edge to edge */}
      <div className="w-full h-14 mb-4">
        <StaticWaveform barCount={100} height={56} />
      </div>

      {/* Processing indicator */}
      {recording.transcription_status === 'processing' && (
        <div className="flex items-center gap-2 text-sm text-spratt-blue">
          <div className="w-3 h-3 border-2 border-spratt-blue/30 border-t-spratt-blue rounded-full animate-spin" />
          Transcribing...
        </div>
      )}

      {/* Transcription toggle */}
      {recording.transcription && (
        <div>
          <button 
            onClick={onToggle} 
            className="text-sm font-medium text-spratt-blue hover:text-spratt-blue-700 flex items-center gap-1"
          >
            <span className={`transition-transform duration-100 ${isExpanded ? 'rotate-90' : ''}`}>▸</span>
            {isExpanded ? 'Hide' : 'Show'} transcription
          </button>
          
          {isExpanded && (
            <div className="mt-3 p-4 bg-slate-50 rounded-xl text-sm text-slate-700 leading-relaxed animate-in">
              {recording.transcription}
            </div>
          )}
        </div>
      )}
    </div>
  )
})

RecordingCard.displayName = 'RecordingCard'

export const RecordingsList = memo(({ limit, compact }) => {
  useAuth() // Verify user is authenticated
  const [recordings, setRecordings] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  const fetchRecordings = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit || 20)

      if (error) throw error
      setRecordings(data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetchRecordings()
    
    const subscription = supabase
      .channel('recordings_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recordings' }, fetchRecordings)
      .subscribe()

    window.addEventListener('recordings-updated', fetchRecordings)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('recordings-updated', fetchRecordings)
    }
  }, [fetchRecordings])

  const handleEdit = useCallback(async (id, updates) => {
    await supabase
      .from('recordings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    
    fetchRecordings()
  }, [fetchRecordings])

  const handleRetranscribe = useCallback(async (id) => {
    // Update status to processing to trigger re-transcription
    await supabase
      .from('recordings')
      .update({ 
        transcription_status: 'processing',
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
    
    fetchRecordings()
    
    // In a real app, this would trigger the transcription service
    // For now, we just update the status
  }, [fetchRecordings])

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(limit || 3)].map((_, i) => <RecordingSkeleton key={i} />)}
      </div>
    )
  }

  return (
    <div>
      {!compact && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-900">Recordings</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {recordings.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-slate-100 flex items-center justify-center text-2xl opacity-40">◎</div>
          <p className="text-slate-900 font-medium mb-1">No recordings</p>
          <p className="text-sm text-slate-500">Record audio to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recordings.map(recording => (
            <RecordingCard
              key={recording.id}
              recording={recording}
              isExpanded={expandedId === recording.id}
              onToggle={() => setExpandedId(expandedId === recording.id ? null : recording.id)}
              onEdit={handleEdit}
              onRetranscribe={handleRetranscribe}
            />
          ))}
        </div>
      )}
    </div>
  )
})

RecordingsList.displayName = 'RecordingsList'
