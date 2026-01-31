import { useEffect, useState, useCallback, memo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { syncActionToAzureDevOps } from '../services/azureDevOps'
import toast from 'react-hot-toast'

/**
 * Actions List with edit functionality
 */

const ActionSkeleton = memo(() => (
  <div className="card p-5">
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 skeleton rounded-xl" />
      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-5 w-40 skeleton" />
          <div className="h-5 w-16 skeleton rounded-full" />
        </div>
        <div className="h-4 w-full skeleton" />
      </div>
    </div>
  </div>
))

ActionSkeleton.displayName = 'ActionSkeleton'

const ActionCard = memo(({ action, onStatusChange, onEdit, compact, onNavigateToEdit, startEditing, onClearEdit }) => {
  const [isEditing, setIsEditing] = useState(startEditing || false)
  
  // Auto-expand when startEditing becomes true
  useEffect(() => {
    if (startEditing && !isEditing) {
      setIsEditing(true)
    }
  }, [startEditing]) // eslint-disable-line react-hooks/exhaustive-deps
  const [title, setTitle] = useState(action.title || '')
  const [description, setDescription] = useState(action.description || '')
  const [metadata, setMetadata] = useState(action.metadata || {})
  const [saving, setSaving] = useState(false)

  // All actions are Salesforce Tasks
  const getIcon = () => '☐'

  // All possible metadata fields from AI extraction
  const metadataFields = [
    { key: 'contact', label: 'Contact Name', icon: '◉', placeholder: 'John Smith', type: 'text' },
    { key: 'email', label: 'Email', icon: '✉', placeholder: 'john@example.com', type: 'email' },
    { key: 'phone', label: 'Phone', icon: '☏', placeholder: '+1 234 567 8900', type: 'tel' },
    { key: 'company', label: 'Company', icon: '◈', placeholder: 'Acme Corp', type: 'text' },
    { key: 'due_date', label: 'Due Date & Time', icon: '◷', placeholder: '', type: 'datetime-local' },
    { key: 'priority', label: 'Priority', icon: '⚑', placeholder: '', type: 'select', options: ['high', 'medium', 'low'] },
    { key: 'notes', label: 'Additional Notes', icon: '✎', placeholder: 'Extra context...', type: 'text' },
  ]

  // Convert relative date strings to actual datetime
  const parseDueDateTime = (value) => {
    if (!value) return ''
    // If already a datetime-local format, return as-is
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value
    // If date only format, add default time (9:00 AM)
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T09:00`
    
    const today = new Date()
    const lowerValue = value.toLowerCase()
    
    // Set default time to 9:00 AM
    const formatDateTime = (date) => {
      const yyyy = date.getFullYear()
      const mm = String(date.getMonth() + 1).padStart(2, '0')
      const dd = String(date.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}T09:00`
    }
    
    if (lowerValue === 'today') {
      return formatDateTime(today)
    }
    if (lowerValue === 'tomorrow') {
      today.setDate(today.getDate() + 1)
      return formatDateTime(today)
    }
    if (lowerValue === 'next week') {
      today.setDate(today.getDate() + 7)
      return formatDateTime(today)
    }
    if (lowerValue === 'next month') {
      today.setMonth(today.getMonth() + 1)
      return formatDateTime(today)
    }
    
    // Try to parse day names
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayIndex = days.indexOf(lowerValue)
    if (dayIndex !== -1) {
      const currentDay = today.getDay()
      let daysToAdd = dayIndex - currentDay
      if (daysToAdd <= 0) daysToAdd += 7 // Next occurrence
      today.setDate(today.getDate() + daysToAdd)
      return formatDateTime(today)
    }
    
    return value // Return original if can't parse
  }

  // Format datetime for display
  const formatDateTimeForDisplay = (value) => {
    if (!value) return ''
    // Handle datetime-local format
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
      const date = new Date(value)
      return date.toLocaleString('en-AU', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    }
    // Handle date-only format
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const date = new Date(value + 'T00:00:00')
      return date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    }
    return value
  }
  
  const getBadge = (status) => ({ 
    pending: 'badge-warning', 
    approved: 'badge-success', 
    rejected: 'badge-error', 
    completed: 'badge-info' 
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

  const updateMetadata = (key, value) => {
    setMetadata(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Clean empty metadata values
      const cleanedMetadata = Object.fromEntries(
        Object.entries(metadata).filter(([, v]) => v && v.trim())
      )
      await onEdit(action.id, { 
        title, 
        description, 
        action_type: 'task', // Always task for Salesforce
        metadata: cleanedMetadata
      })
      setIsEditing(false)
      if (onClearEdit) onClearEdit(null)
      toast.success('Task updated')
    } catch {
      toast.error('Error saving')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setTitle(action.title || '')
    setDescription(action.description || '')
    setMetadata(action.metadata || {})
    if (onClearEdit) onClearEdit(null)
  }

  const handleEditClick = () => {
    if (compact && onNavigateToEdit) {
      // In compact mode, navigate to Actions page
      onNavigateToEdit(action.id)
    } else {
      setIsEditing(!isEditing)
    }
  }

  const canEdit = action.status === 'approved' || action.status === 'pending'


  return (
    <div className="card p-5">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-spratt-blue-50 flex items-center justify-center text-spratt-blue text-lg flex-shrink-0">
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              {!isEditing && <h3 className="font-medium text-slate-900">{action.title}</h3>}
              <span className={`badge ${getBadge(action.status)}`}>{action.status}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{formatTime(action.created_at)}</span>
              {canEdit && (
                <button
                  onClick={handleEditClick}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Edit"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Edit form */}
          {isEditing ? (
            <div className="p-4 bg-slate-50 rounded-xl space-y-4 animate-in">
              {/* Task badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 bg-spratt-blue-50 text-spratt-blue rounded font-medium">
                  ☐ Salesforce Task
                </span>
              </div>
              
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="input py-2 text-sm"
                  placeholder="Task title..."
                />
              </div>
              
              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  className="input py-2 text-sm resize-none"
                  placeholder="Add more details..."
                />
              </div>

              {/* Extracted Fields - Editable */}
              <div className="border-t border-slate-200 pt-4">
                <label className="block text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">
                  Details
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {metadataFields.map(field => (
                    <div key={field.key}>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
                        <span className="opacity-60">{field.icon}</span>
                        {field.label}
                      </label>
                      {field.type === 'datetime-local' ? (
                        <div className="relative">
                          <input
                            type="datetime-local"
                            value={parseDueDateTime(metadata[field.key]) || ''}
                            onChange={e => updateMetadata(field.key, e.target.value)}
                            className="input py-2 text-sm w-full"
                          />
                          {metadata[field.key] && !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(metadata[field.key]) && (
                            <p className="text-xs text-slate-400 mt-1">
                              Original: "{metadata[field.key]}" → {formatDateTimeForDisplay(parseDueDateTime(metadata[field.key]))}
                            </p>
                          )}
                        </div>
                      ) : field.type === 'select' ? (
                        <select
                          value={metadata[field.key] || ''}
                          onChange={e => updateMetadata(field.key, e.target.value)}
                          className="input py-2 text-sm"
                        >
                          <option value="">Select {field.label.toLowerCase()}</option>
                          {field.options.map(opt => (
                            <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type}
                          value={metadata[field.key] || ''}
                          onChange={e => updateMetadata(field.key, e.target.value)}
                          className="input py-2 text-sm"
                          placeholder={field.placeholder}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !title.trim()}
                  className="btn btn-primary text-sm py-2 px-4"
                >
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
                <button
                  onClick={handleCancel}
                  className="btn btn-ghost text-sm py-2 px-4"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {action.description && (
                <p className="text-sm text-slate-600 mb-3 line-clamp-2">{action.description}</p>
              )}

              {/* Metadata tags - show all AI extracted fields */}
              {action.metadata && Object.keys(action.metadata).length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {action.metadata.contact && (
                    <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">
                      ◉ {action.metadata.contact}
                    </span>
                  )}
                  {action.metadata.email && (
                    <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">
                      ✉ {action.metadata.email}
                    </span>
                  )}
                  {action.metadata.phone && (
                    <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">
                      ☏ {action.metadata.phone}
                    </span>
                  )}
                  {action.metadata.company && (
                    <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">
                      ◈ {action.metadata.company}
                    </span>
                  )}
                  {action.metadata.due_date && (
                    <span className="text-xs px-2.5 py-1 bg-spratt-blue-50 text-spratt-blue rounded-lg">
                      ◷ {formatDateTimeForDisplay(action.metadata.due_date)}
                    </span>
                  )}
                  {action.metadata.priority && (
                    <span className={`text-xs px-2.5 py-1 rounded-lg ${
                      action.metadata.priority === 'high' 
                        ? 'bg-red-50 text-red-600' 
                        : action.metadata.priority === 'medium'
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      ⚑ {action.metadata.priority}
                    </span>
                  )}
                  {action.metadata.notes && (
                    <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg max-w-xs truncate">
                      ✎ {action.metadata.notes}
                    </span>
                  )}
                </div>
              )}

              {/* Action buttons based on status */}
              {action.status === 'pending' && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => onStatusChange(action.id, 'approved')} 
                    className="btn btn-success text-sm py-2 px-4"
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => onStatusChange(action.id, 'rejected')} 
                    className="btn btn-ghost text-sm py-2 px-4"
                  >
                    Reject
                  </button>
                </div>
              )}

              {action.status === 'approved' && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => onStatusChange(action.id, 'completed')} 
                    className="btn btn-primary text-sm py-2 px-4"
                  >
                    Mark complete
                  </button>
                  <button 
                    onClick={() => onStatusChange(action.id, 'pending')} 
                    className="btn btn-ghost text-sm py-2 px-4"
                  >
                    Move to pending
                  </button>
                </div>
              )}

              {action.status === 'completed' && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => onStatusChange(action.id, 'approved')} 
                    className="btn btn-secondary text-sm py-2 px-4"
                  >
                    Re-open
                  </button>
                </div>
              )}

              {action.status === 'rejected' && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => onStatusChange(action.id, 'pending')} 
                    className="btn btn-secondary text-sm py-2 px-4"
                  >
                    Move to pending
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
})

ActionCard.displayName = 'ActionCard'

export const ActionsList = memo(({ filter: externalFilter, onFilterChange, limit, compact, onNavigateToEdit, editingActionId, onClearEdit }) => {
  useAuth() // Verify user is authenticated
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)
  const [internalFilter, setInternalFilter] = useState('pending')

  const filter = externalFilter || internalFilter
  const setFilter = onFilterChange || setInternalFilter

  const fetchActions = useCallback(async () => {
    try {
      setLoading(true)
      let query = supabase.from('actions').select('*').order('created_at', { ascending: false })
      if (filter !== 'all') query = query.eq('status', filter)
      if (limit) query = query.limit(limit)

      const { data, error } = await query
      if (error) throw error
      setActions(data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [filter, limit])

  useEffect(() => {
    fetchActions()
    
    const subscription = supabase
      .channel('actions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'actions' }, fetchActions)
      .subscribe()

    return () => subscription.unsubscribe()
  }, [fetchActions])

  const handleStatusChange = useCallback(async (actionId, newStatus) => {
    const prev = [...actions]
    setActions(a => a.map(x => x.id === actionId ? { ...x, status: newStatus } : x))
    
    try {
      const { data: action } = await supabase.from('actions').select('*').eq('id', actionId).single()
      await supabase.from('actions').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', actionId)

      if (newStatus === 'approved' && action) {
        try { await syncActionToAzureDevOps({ ...action, status: newStatus }) } catch { /* Azure DevOps sync optional */ }
      }
      
      const messages = { approved: 'Approved', rejected: 'Rejected', completed: 'Completed', pending: 'Moved to pending' }
      toast.success(messages[newStatus] || 'Updated')
      fetchActions()
    } catch {
      toast.error('Error')
      setActions(prev)
    }
  }, [actions, fetchActions])

  const handleEdit = useCallback(async (id, updates) => {
    await supabase
      .from('actions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    
    fetchActions()
  }, [fetchActions])

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(limit || 3)].map((_, i) => <ActionSkeleton key={i} />)}
      </div>
    )
  }

  const filters = ['pending', 'approved', 'completed', 'all']

  return (
    <div>
      {!compact && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Actions</h2>
            <p className="text-sm text-slate-500 mt-0.5">{actions.length} {filter === 'all' ? 'total' : filter}</p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            {filters.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-100 ${filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {actions.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-slate-100 flex items-center justify-center text-2xl opacity-40">✓</div>
          <p className="text-slate-900 font-medium mb-1">No actions</p>
          <p className="text-sm text-slate-500">{filter === 'pending' ? 'Record audio to extract actions' : 'Nothing matches this filter'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map(action => (
            <ActionCard 
              key={action.id} 
              action={action} 
              onStatusChange={handleStatusChange}
              onEdit={handleEdit}
              compact={compact}
              onNavigateToEdit={onNavigateToEdit}
              startEditing={editingActionId === action.id}
              onClearEdit={onClearEdit}
            />
          ))}
        </div>
      )}
    </div>
  )
})

ActionsList.displayName = 'ActionsList'
