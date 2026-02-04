import { useEffect, useState, useCallback, memo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { StaticWaveform } from './Waveform'
import { extractActionsFromTranscript } from '../services/actionExtraction'
import { MeetingMinutesForm } from './MeetingMinutesForm'
import toast from 'react-hot-toast'

/**
 * Recordings List with edit transcription, show actions, and re-extract
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

const RecordingCard = memo(({ recording, expandedSection, onToggleSection, onEdit, onRetranscribe, actions, onNavigateToAction, onViewMinutes }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(recording.title || '')
  const [notes, setNotes] = useState(recording.notes || '')
  const [transcription, setTranscription] = useState(recording.transcription || '')
  const [saving, setSaving] = useState(false)
  const [extracting, setExtracting] = useState(false)

  // Get actions for this recording
  const recordingActions = actions.filter(a => a.recording_id === recording.id)
  const actionsCount = recordingActions.length

  const getBadge = (status) => ({ 
    pending: 'badge-warning', 
    processing: 'badge-info', 
    completed: 'badge-success', 
    failed: 'badge-error' 
  }[status] || 'badge-neutral')

  const getStatusSteps = () => {
    const status = recording.transcription_status
    if (status === 'pending') return { step: 1, text: 'Waiting to process...' }
    if (status === 'processing') return { step: 2, text: 'Transcribing audio...' }
    if (status === 'completed' && actionsCount === 0) return { step: 3, text: 'Transcription complete' }
    if (status === 'completed' && actionsCount > 0) return { step: 4, text: `${actionsCount} action${actionsCount !== 1 ? 's' : ''} extracted` }
    if (status === 'failed') return { step: 0, text: 'Transcription failed' }
    return { step: 0, text: status }
  }
  
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

  // Format due date/time for display
  const formatDueDate = (value) => {
    if (!value) return value
    // Handle datetime-local format
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
      const date = new Date(value)
      return date.toLocaleString('en-AU', { 
        day: 'numeric', 
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    }
    // Handle date-only format
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const date = new Date(value + 'T00:00:00')
      return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
    }
    return value
  }

  const handleSave = async (andExtract = false) => {
    setSaving(true)
    try {
      await onEdit(recording.id, { title, notes, transcription })
      
      if (andExtract && transcription) {
        setExtracting(true)
        toast.loading('Extracting actions...', { id: 'extract' })
        
        // Delete old actions for this recording
        await supabase.from('actions').delete().eq('recording_id', recording.id)
        
        // Extract new actions
        const extractedActions = await extractActionsFromTranscript(transcription)
        
        if (extractedActions.length > 0) {
          const actionsToInsert = extractedActions.map(action => ({
            recording_id: recording.id,
            user_id: recording.user_id,
            ...action,
            status: 'pending',
          }))
          
          await supabase.from('actions').insert(actionsToInsert)
          toast.success(`${extractedActions.length} action${extractedActions.length !== 1 ? 's' : ''} extracted`, { id: 'extract' })
        } else {
          toast.success('No actions found in transcription', { id: 'extract' })
        }
        
        setExtracting(false)
      } else {
        toast.success('Recording updated')
      }
      
      setIsEditing(false)
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error saving', { id: 'extract' })
    } finally {
      setSaving(false)
      setExtracting(false)
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

  const statusInfo = getStatusSteps()
  const isTranscriptionExpanded = expandedSection === `transcription-${recording.id}`
  const isActionsExpanded = expandedSection === `actions-${recording.id}`

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
          {actionsCount > 0 && (
            <span className="text-xs px-2.5 py-0.5 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 rounded-full font-semibold border border-amber-100/50">
              {actionsCount} action{actionsCount !== 1 ? 's' : ''}
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
          {/* Show retry button for completed, pending, or failed recordings */}
          {['completed', 'pending', 'failed'].includes(recording.transcription_status) && (
            <button
              onClick={handleRetranscribe}
              className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
              title={recording.transcription_status === 'completed' ? 'Re-transcribe' : 'Retry transcription'}
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

      {/* Edit form with transcription editing - warmer */}
      {isEditing && (
        <div className="mb-4 p-4 bg-gradient-to-br from-stone-50 to-amber-50/20 rounded-xl space-y-3 animate-in border border-stone-100/50">
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
              rows={2}
              className="input py-2 text-sm resize-none"
            />
          </div>
          {recording.transcription && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Transcription
                <span className="text-slate-400 font-normal ml-1">(edit to fix errors)</span>
              </label>
              <textarea
                value={transcription}
                onChange={e => setTranscription(e.target.value)}
                placeholder="Transcription text..."
                rows={4}
                className="input py-2 text-sm resize-none font-mono"
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => handleSave(false)}
              disabled={saving || extracting}
              className="btn btn-primary text-sm py-2 px-4"
            >
              {saving && !extracting ? 'Saving...' : 'Save'}
            </button>
            {recording.transcription && (
              <button
                onClick={() => handleSave(true)}
                disabled={saving || extracting}
                className="btn btn-secondary text-sm py-2 px-4"
              >
                {extracting ? 'Extracting...' : 'Save & Re-extract Actions'}
              </button>
            )}
            <button
              onClick={() => {
                setIsEditing(false)
                setTranscription(recording.transcription || '')
              }}
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

      {/* Status indicator - warmer */}
      {recording.transcription_status === 'processing' && (
        <div className="flex items-center gap-2 text-sm text-teal-700 mb-3">
          <div className="w-3 h-3 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          {statusInfo.text}
        </div>
      )}

      {/* Actions created indicator - warmer, friendlier */}
      {actionsCount > 0 && recording.transcription_status === 'completed' && (
        <div className="flex items-center gap-2 text-sm mb-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-100/50">
          <span className="w-5 h-5 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">✓</span>
          <span className="font-medium text-teal-800">{actionsCount} Action{actionsCount !== 1 ? 's' : ''} & Minutes created from transcript</span>
        </div>
      )}

      {/* Toggle buttons */}
      <div className="flex flex-wrap gap-4">
        {/* Transcription toggle - warmer teal */}
        {recording.transcription && (
          <button 
            onClick={() => onToggleSection(`transcription-${recording.id}`)} 
            className="text-sm font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1.5 transition-colors"
          >
            <span className={`transition-transform duration-150 ${isTranscriptionExpanded ? 'rotate-90' : ''}`}>▸</span>
            {isTranscriptionExpanded ? 'Hide' : 'Show'} transcription
          </button>
        )}

        {/* Actions toggle - warm amber */}
        {actionsCount > 0 && (
          <button 
            onClick={() => onToggleSection(`actions-${recording.id}`)} 
            className="text-sm font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1.5 transition-colors"
          >
            <span className={`transition-transform duration-150 ${isActionsExpanded ? 'rotate-90' : ''}`}>▸</span>
            {isActionsExpanded ? 'Hide' : 'Show'} actions ({actionsCount})
          </button>
        )}

        {/* View Minutes / Export PDF - warm coral */}
        {recording.transcription && recording.transcription_status === 'completed' && (
          <button 
            onClick={() => onViewMinutes && onViewMinutes(recording.id)} 
            className="text-sm font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1.5 transition-colors"
          >
            📄 View Minutes / Export PDF
          </button>
        )}
      </div>

      {/* Expanded transcription - with timestamps from segments */}
      {isTranscriptionExpanded && recording.transcription && (
        <div className="mt-3 bg-gradient-to-br from-stone-50 to-amber-50/30 rounded-xl text-sm animate-in border border-stone-100/50 overflow-hidden">
          {recording.metadata?.segments?.length > 0 ? (
            /* Timestamped segments view */
            <div className="max-h-80 overflow-y-auto p-3 space-y-2">
              {recording.metadata.segments.map((seg, idx) => (
                <div key={idx} className="flex gap-2.5 p-2 rounded-lg hover:bg-white/60 transition-colors">
                  <span className="shrink-0 font-mono text-[10px] px-1.5 py-0.5 rounded bg-stone-200 text-stone-500 h-fit">
                    {seg.timestamp}
                  </span>
                  <div className="flex-1 min-w-0">
                    {seg.speaker && (
                      <span className="font-semibold text-teal-700 mr-1.5">Speaker {seg.speaker}:</span>
                    )}
                    <span className="text-stone-700">{seg.text}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Fallback: plain text with speaker labels */
            <div className="p-4 text-stone-700 leading-relaxed whitespace-pre-wrap">
              {recording.transcription.split(/\*\*([^*]+)\*\*/).map((part, i) => 
                i % 2 === 1 
                  ? <strong key={i} className="text-teal-700 font-semibold">{part}</strong>
                  : part
              )}
            </div>
          )}
        </div>
      )}

      {/* Expanded actions - warmer, clickable to navigate */}
      {isActionsExpanded && actionsCount > 0 && (
        <div className="mt-3 space-y-2 animate-in">
          {recordingActions.map(action => (
            <button
              key={action.id}
              onClick={() => onNavigateToAction && onNavigateToAction(action.id)}
              className="w-full p-3.5 bg-gradient-to-br from-amber-50/50 to-orange-50/30 rounded-xl text-left hover:from-amber-50 hover:to-orange-50/50 transition-all cursor-pointer border border-amber-100/30 hover:border-amber-200/50 hover:shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-stone-800 text-sm">{action.title}</span>
                    <span className={`badge text-[10px] ${
                      action.status === 'pending' ? 'badge-warning' : 
                      action.status === 'approved' ? 'badge-success' : 
                      action.status === 'completed' ? 'badge-info' : 'badge-neutral'
                    }`}>
                      {action.status}
                    </span>
                  </div>
                  {action.metadata && (
                    <div className="text-xs text-stone-500">
                      {[
                        action.metadata.contact,
                        action.metadata.account || action.metadata.company,
                        action.metadata.due_date ? formatDueDate(action.metadata.due_date) : null,
                        action.metadata.priority
                      ].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
})

RecordingCard.displayName = 'RecordingCard'

export const RecordingsList = memo(({ limit, compact, onNavigateToAction }) => {
  useAuth() // Verify user is authenticated
  const [recordings, setRecordings] = useState([])
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedSection, setExpandedSection] = useState(null)
  const [minutesRecordingId, setMinutesRecordingId] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Fetch recordings and actions in parallel
      const [recordingsResult, actionsResult] = await Promise.all([
        supabase
          .from('recordings')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit || 20),
        supabase
          .from('actions')
          .select('*')
          .order('created_at', { ascending: false })
      ])

      if (recordingsResult.error) throw recordingsResult.error
      if (actionsResult.error) throw actionsResult.error
      
      setRecordings(recordingsResult.data || [])
      setActions(actionsResult.data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetchData()
    
    const recordingsSubscription = supabase
      .channel('recordings_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recordings' }, fetchData)
      .subscribe()

    const actionsSubscription = supabase
      .channel('actions_changes_recordings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'actions' }, fetchData)
      .subscribe()

    window.addEventListener('recordings-updated', fetchData)
    window.addEventListener('actions-updated', fetchData)

    return () => {
      recordingsSubscription.unsubscribe()
      actionsSubscription.unsubscribe()
      window.removeEventListener('recordings-updated', fetchData)
      window.removeEventListener('actions-updated', fetchData)
    }
  }, [fetchData])

  const handleEdit = useCallback(async (id, updates) => {
    await supabase
      .from('recordings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    
    fetchData()
  }, [fetchData])

  const handleRetranscribe = useCallback(async (id) => {
    try {
      // Get the recording to find audio URL
      const recording = recordings.find(r => r.id === id)
      if (!recording?.audio_url) {
        toast.error('No audio file found')
        return
      }

      // Set status to processing
      await supabase
        .from('recordings')
        .update({ 
          transcription_status: 'processing',
          updated_at: new Date().toISOString() 
        })
        .eq('id', id)
      
      fetchData()
      toast.loading('Fetching audio...', { id: 'retranscribe' })

      // Fetch audio from storage URL
      const audioResponse = await fetch(recording.audio_url)
      if (!audioResponse.ok) {
        throw new Error('Failed to fetch audio')
      }
      const audioBlob = await audioResponse.blob()
      
      toast.loading('Transcribing...', { id: 'retranscribe' })
      
      // Import and run transcription
      const { processTranscription } = await import('../services/transcription')
      await processTranscription(id, audioBlob)
      
      toast.success('Transcription complete!', { id: 'retranscribe' })
      fetchData()
    } catch (error) {
      console.error('Re-transcribe error:', error)
      toast.error('Transcription failed', { id: 'retranscribe' })
      
      // Update status to failed
      await supabase
        .from('recordings')
        .update({ transcription_status: 'failed' })
        .eq('id', id)
      
      fetchData()
    }
  }, [recordings, fetchData])

  const handleToggleSection = useCallback((sectionId) => {
    setExpandedSection(prev => prev === sectionId ? null : sectionId)
  }, [])

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
              actions={actions}
              expandedSection={expandedSection}
              onToggleSection={handleToggleSection}
              onEdit={handleEdit}
              onRetranscribe={handleRetranscribe}
              onNavigateToAction={onNavigateToAction}
              onViewMinutes={setMinutesRecordingId}
            />
          ))}
        </div>
      )}

      {/* Meeting Minutes Modal */}
      {minutesRecordingId && (
        <MeetingMinutesForm 
          recordingId={minutesRecordingId} 
          onClose={() => setMinutesRecordingId(null)} 
        />
      )}
    </div>
  )
})

RecordingsList.displayName = 'RecordingsList'
