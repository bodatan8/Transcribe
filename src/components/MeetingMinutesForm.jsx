/**
 * Meeting Minutes Form - Modern 2025/2026 Design
 * - Editable fields with inline editing
 * - AI-populated with citations
 * - Single-column layout
 * - Per-field status indicators
 * - Glass design elements
 * - PDF Export
 */

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Form field definitions - configurable
const FORM_FIELDS = [
  {
    id: 'meeting_title',
    title: 'Meeting Title',
    description: 'The title or subject of the meeting',
    type: 'text',
    required: true
  },
  {
    id: 'date_time',
    title: 'Date & Time',
    description: 'When the meeting took place',
    type: 'text',
    required: true
  },
  {
    id: 'attendees',
    title: 'Attendees',
    description: 'People who participated in the meeting',
    type: 'list',
    required: true
  },
  {
    id: 'summary',
    title: 'Meeting Summary',
    description: 'Brief overview of what was discussed',
    type: 'textarea',
    required: true
  },
  {
    id: 'key_points',
    title: 'Key Discussion Points',
    description: 'Main topics and decisions discussed',
    type: 'list',
    required: false
  },
  {
    id: 'action_items',
    title: 'Action Items',
    description: 'Tasks and follow-ups assigned during the meeting',
    type: 'actions',
    required: true
  },
  {
    id: 'next_steps',
    title: 'Next Steps',
    description: 'Upcoming actions or follow-up meetings',
    type: 'textarea',
    required: false
  },
  {
    id: 'notes',
    title: 'Additional Notes',
    description: 'Any other important information',
    type: 'textarea',
    required: false
  }
]

const OPENAI_ENDPOINT = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT
const OPENAI_KEY = import.meta.env.VITE_AZURE_OPENAI_KEY
const OPENAI_DEPLOYMENT = import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT || 'gpt-4o'

/**
 * Generate meeting minutes from transcript using AI with citations
 * Uses timestamped segments for precise citation timestamps
 */
async function generateMeetingMinutes(transcript, actions, segments) {
  if (!OPENAI_ENDPOINT || !OPENAI_KEY) {
    console.warn('Azure OpenAI not configured')
    return null
  }

  const apiVersion = '2024-08-01-preview'
  const url = `${OPENAI_ENDPOINT}openai/deployments/${OPENAI_DEPLOYMENT}/chat/completions?api-version=${apiVersion}`
  
  // Build timestamped transcript for AI
  const timestampedTranscript = segments && segments.length > 0
    ? segments.map(s => `[${s.timestamp}] ${s.speaker ? `Speaker ${s.speaker}: ` : ''}${s.text}`).join('\n')
    : transcript
  
  const systemPrompt = `You are a meeting minutes assistant. Generate structured meeting minutes from the timestamped transcript.

The transcript has timestamps in format [M:SS]. For EACH citation, include the EXACT timestamp from the transcript.

Return a JSON object:
{
  "meeting_title": { "value": "Concise title (max 60 chars)", "citation": { "text": "exact quote", "timestamp": "0:00" } },
  "date_time": { "value": "Date and time", "citation": { "text": "quote or inferred", "timestamp": "0:00" } },
  "attendees": { "value": ["Person 1", "Person 2"], "citation": { "text": "quotes mentioning names", "timestamp": "0:15" } },
  "summary": { "value": "2-3 sentence summary", "citation": { "text": "key quote", "timestamp": "0:30" } },
  "key_points": { "value": ["Point 1", "Point 2"], "citations": [{ "text": "quote 1", "timestamp": "1:00" }, { "text": "quote 2", "timestamp": "2:30" }] },
  "next_steps": { "value": "Next actions", "citation": { "text": "supporting quote", "timestamp": "3:00" } },
  "notes": { "value": "Additional context", "citation": { "text": "supporting quote", "timestamp": "3:30" } }
}

Rules:
- If info not found, set value to "" (empty string)
- Citations must include the EXACT timestamp from the transcript [M:SS] format
- Keep meeting_title under 60 chars
- Extract ALL names mentioned as attendees
- Max 5 key points, prioritize decisions made

Return ONLY valid JSON.`

  const userPrompt = `Generate meeting minutes from this timestamped transcript:

${timestampedTranscript}

${actions?.length > 0 ? `\nAction items already extracted:\n${actions.map(a => `- ${a.title}`).join('\n')}` : ''}`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': OPENAI_KEY
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      console.error('Azure OpenAI error:', response.status)
      return null
    }

    const result = await response.json()
    const content = result.choices?.[0]?.message?.content || '{}'
    
    let jsonStr = content.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '')
    }
    
    return JSON.parse(jsonStr)
  } catch (error) {
    console.error('Failed to generate meeting minutes:', error)
    return null
  }
}


/**
 * Editable Field Component - Modern inline editing with clickable timestamps
 */
function EditableField({ field, data, citation, onUpdate, actions, onCitationClick }) {
  const [isEditing, setIsEditing] = useState(false)
  const [localValue, setLocalValue] = useState('')
  const inputRef = useRef(null)
  
  const value = data?.value ?? data ?? ''
  const isEmpty = !value || (Array.isArray(value) && value.length === 0)
  const fieldCitation = citation || data?.citation
  
  // Extract timestamp from citation
  const citationData = typeof fieldCitation === 'object' && fieldCitation !== null
    ? fieldCitation
    : { text: fieldCitation, timestamp: null }

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  const handleStartEdit = () => {
    if (field.type === 'actions') return // Actions are managed separately
    setLocalValue(Array.isArray(value) ? value.join('\n') : value)
    setIsEditing(true)
  }

  const handleSave = () => {
    let newValue = localValue
    if (field.type === 'list') {
      newValue = localValue.split('\n').filter(line => line.trim())
    }
    onUpdate(field.id, newValue)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') handleCancel()
    if (e.key === 'Enter' && !e.shiftKey && field.type !== 'textarea' && field.type !== 'list') {
      e.preventDefault()
      handleSave()
    }
  }

  // Status indicator
  const getStatus = () => {
    if (isEmpty && field.required) return { color: 'amber', label: 'Needs info', icon: '!' }
    if (isEmpty) return { color: 'slate', label: 'Optional', icon: '○' }
    return { color: 'emerald', label: 'Complete', icon: '✓' }
  }
  const status = getStatus()

  return (
    <div className={`group relative rounded-2xl border-2 transition-all duration-200 ${
      isEditing 
        ? 'border-spratt-blue bg-white shadow-lg shadow-spratt-blue/10' 
        : isEmpty && field.required
          ? 'border-amber-200 bg-amber-50/50 hover:border-amber-300'
          : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-slate-900">{field.title}</h3>
            {field.required && <span className="text-xs text-slate-400">*</span>}
            {/* Status pill */}
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
              status.color === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
              status.color === 'amber' ? 'bg-amber-100 text-amber-700' :
              'bg-slate-100 text-slate-500'
            }`}>
              {status.icon} {status.label}
            </span>
          </div>
          <p className="text-xs text-slate-500">{field.description}</p>
        </div>
        
        {/* Edit button */}
        {!isEditing && field.type !== 'actions' && (
          <button
            onClick={handleStartEdit}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-spratt-blue hover:text-spratt-blue-700 font-medium px-3 py-1 rounded-lg hover:bg-spratt-blue-50"
          >
            Edit
          </button>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pb-4">
        {isEditing ? (
          <div className="space-y-3">
            {field.type === 'textarea' || field.type === 'list' ? (
              <textarea
                ref={inputRef}
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={field.type === 'list' ? 4 : 3}
                placeholder={field.type === 'list' ? 'One item per line...' : 'Enter text...'}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-spratt-blue focus:ring-2 focus:ring-spratt-blue/20 outline-none text-sm resize-none transition-all"
              />
            ) : (
              <input
                ref={inputRef}
                type="text"
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter value..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-spratt-blue focus:ring-2 focus:ring-spratt-blue/20 outline-none text-sm transition-all"
              />
            )}
            <div className="flex items-center gap-2">
              <button onClick={handleSave} className="btn btn-primary text-sm py-2">
                Save
              </button>
              <button onClick={handleCancel} className="btn btn-secondary text-sm py-2">
                Cancel
              </button>
              {field.type === 'list' && (
                <span className="text-xs text-slate-400 ml-2">One item per line</span>
              )}
            </div>
          </div>
        ) : (
          <div 
            onClick={field.type !== 'actions' ? handleStartEdit : undefined}
            className={field.type !== 'actions' ? 'cursor-text' : ''}
          >
            {/* Render value based on type */}
            {field.type === 'list' && Array.isArray(value) && value.length > 0 ? (
              <ul className="space-y-1.5">
                {value.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-spratt-blue mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : field.type === 'actions' ? (
              <div className="space-y-2">
                {actions && actions.length > 0 ? actions.map((action, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                    <span className="text-emerald-500 text-lg">☐</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 text-sm">{action.title}</p>
                      <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-500">
                        {action.metadata?.contact && (
                          <span>👤 {action.metadata.contact}</span>
                        )}
                        {action.metadata?.due_date && (
                          <span>📅 {action.metadata.due_date}</span>
                        )}
                        {action.metadata?.priority && (
                          <span className={
                            action.metadata.priority === 'High' ? 'text-red-500' :
                            action.metadata.priority === 'Low' ? 'text-slate-400' : ''
                          }>
                            ⚡ {action.metadata.priority}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )) : (
                  <p className="text-slate-400 text-sm italic py-2">No action items extracted yet</p>
                )}
              </div>
            ) : isEmpty ? (
              <p className="text-slate-400 text-sm italic py-2">
                {field.required ? 'Click to add...' : 'Optional - click to add'}
              </p>
            ) : (
              <p className="text-slate-700 text-sm whitespace-pre-wrap">{value}</p>
            )}
          </div>
        )}

        {/* Citation with clickable timestamp */}
        {fieldCitation && !isEditing && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-start gap-2 text-xs">
              {/* Clickable timestamp badge */}
              {citationData.timestamp && (
                <button
                  onClick={() => onCitationClick && onCitationClick(citationData.timestamp)}
                  className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-spratt-blue-50 text-spratt-blue hover:bg-spratt-blue-100 transition-colors font-medium"
                  title="Jump to this moment in transcript"
                >
                  <span>⏱</span>
                  <span>{citationData.timestamp}</span>
                </button>
              )}
              {!citationData.timestamp && (
                <span className="text-slate-400 shrink-0">📎</span>
              )}
              <p className="text-slate-500 italic line-clamp-2">
                &ldquo;{citationData.text || (Array.isArray(fieldCitation) ? fieldCitation[0]?.text || fieldCitation[0] : fieldCitation)}&rdquo;
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Progress indicator showing form completion
 */
function FormProgress({ minutes, actions }) {
  const requiredFields = FORM_FIELDS.filter(f => f.required)
  const filledCount = requiredFields.filter(f => {
    if (f.type === 'actions') return actions && actions.length > 0
    const val = minutes?.[f.id]?.value ?? minutes?.[f.id]
    return val && (Array.isArray(val) ? val.length > 0 : val.trim())
  }).length
  
  const percentage = Math.round((filledCount / requiredFields.length) * 100)
  
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-500 ${
            percentage === 100 ? 'bg-emerald-500' : 'bg-spratt-blue'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={`text-sm font-medium ${
        percentage === 100 ? 'text-emerald-600' : 'text-slate-600'
      }`}>
        {filledCount}/{requiredFields.length} required
      </span>
    </div>
  )
}

/**
 * Meeting Minutes Form Component
 */
export function MeetingMinutesForm({ recordingId, onClose }) {
  const [recording, setRecording] = useState(null)
  const [actions, setActions] = useState([])
  const [minutes, setMinutes] = useState({})
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [highlightedTimestamp, setHighlightedTimestamp] = useState(null)
  const [transcriptExpanded, setTranscriptExpanded] = useState(false)
  const formRef = useRef(null)
  const transcriptRef = useRef(null)

  // Get segments from recording metadata
  const segments = recording?.metadata?.segments || []

  // Load recording and actions
  useEffect(() => {
    async function loadData() {
      try {
        const [recordingRes, actionsRes] = await Promise.all([
          supabase.from('recordings').select('*').eq('id', recordingId).single(),
          supabase.from('actions').select('*').eq('recording_id', recordingId)
        ])
        
        if (recordingRes.data) setRecording(recordingRes.data)
        if (actionsRes.data) setActions(actionsRes.data)
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    if (recordingId) loadData()
  }, [recordingId])

  // Generate minutes with timestamped segments
  const handleGenerate = async () => {
    if (!recording?.transcription) return
    
    setGenerating(true)
    try {
      const result = await generateMeetingMinutes(recording.transcription, actions, segments)
      if (result) {
        setMinutes(result)
      }
    } finally {
      setGenerating(false)
    }
  }

  // Handle citation click - scroll to and highlight that part of transcript
  const handleCitationClick = (timestamp) => {
    setHighlightedTimestamp(timestamp)
    setTranscriptExpanded(true)
    
    // Scroll to transcript section after a brief delay for expansion
    setTimeout(() => {
      if (transcriptRef.current) {
        transcriptRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
    
    // Clear highlight after 3 seconds
    setTimeout(() => setHighlightedTimestamp(null), 3000)
  }

  // Update a field value
  const handleUpdateField = (fieldId, newValue) => {
    setMinutes(prev => ({
      ...prev,
      [fieldId]: {
        ...(typeof prev[fieldId] === 'object' ? prev[fieldId] : {}),
        value: newValue
      }
    }))
  }

  // Export to PDF
  const handleExportPDF = async () => {
    setExporting(true)
    try {
      const html2pdf = (await import('html2pdf.js')).default
      
      const element = formRef.current
      const opt = {
        margin: [15, 15, 15, 15],
        filename: `meeting-minutes-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }
      
      await html2pdf().set(opt).from(element).save()
    } catch (error) {
      console.error('PDF export failed:', error)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-spratt-blue/30 border-t-spratt-blue rounded-full animate-spin" />
            <span className="text-slate-600">Loading...</span>
          </div>
        </div>
      </div>
    )
  }

  const hasMinutes = Object.keys(minutes).length > 0

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-50 rounded-3xl max-w-3xl w-full shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header - Glass effect */}
        <div className="bg-white/80 backdrop-blur-md rounded-t-3xl border-b border-slate-200 p-6 sticky top-0 z-10">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Meeting Minutes</h2>
              <p className="text-sm text-slate-500 mt-1">
                AI-generated • Editable • Export to PDF
              </p>
            </div>
            <button 
              onClick={onClose} 
              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Progress bar */}
          {hasMinutes && <FormProgress minutes={minutes} actions={actions} />}

          {/* Action buttons */}
          <div className="flex items-center gap-3 mt-4">
            {!hasMinutes ? (
              <button
                onClick={handleGenerate}
                disabled={generating || !recording?.transcription}
                className="btn btn-primary flex items-center gap-2 shadow-lg shadow-spratt-blue/25"
              >
                {generating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>✨ Generate with AI</>
                )}
              </button>
            ) : (
              <>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  {generating ? 'Regenerating...' : '🔄 Regenerate'}
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={exporting}
                  className="btn btn-primary flex items-center gap-2 shadow-lg shadow-spratt-blue/25"
                >
                  {exporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>📄 Export PDF</>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Form Content */}
        <div ref={formRef} className="flex-1 overflow-y-auto p-6 bg-white">
          {/* PDF Header (hidden until export) */}
          <div className="text-center mb-8 pb-6 border-b border-slate-200 print:block">
            <h1 className="text-2xl font-bold text-slate-900">
              {minutes.meeting_title?.value || 'Meeting Minutes'}
            </h1>
            <p className="text-sm text-slate-500 mt-2">
              Generated {new Date().toLocaleDateString('en-AU', { 
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
              })}
            </p>
          </div>

          {!hasMinutes ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-spratt-blue-50 to-purple-50 flex items-center justify-center text-3xl">
                ✨
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Generate Meeting Minutes</h3>
              <p className="text-slate-500 max-w-md mx-auto">
                Click &ldquo;Generate with AI&rdquo; to automatically create structured meeting minutes from your transcript with citations.
              </p>
              {!recording?.transcription && (
                <p className="text-amber-600 mt-4 text-sm">
                  ⚠️ No transcription available for this recording
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {FORM_FIELDS.map(field => (
                <EditableField
                  key={field.id}
                  field={field}
                  data={minutes[field.id]}
                  citation={minutes[field.id]?.citation || minutes[field.id]?.citations}
                  onUpdate={handleUpdateField}
                  actions={field.type === 'actions' ? actions : null}
                  onCitationClick={handleCitationClick}
                />
              ))}

              {/* Full Transcript with timestamps (collapsible) */}
              <div className="mt-8" ref={transcriptRef}>
                <button 
                  onClick={() => setTranscriptExpanded(!transcriptExpanded)}
                  className="w-full text-left cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-2 py-2"
                >
                  <span className={`transition-transform ${transcriptExpanded ? 'rotate-90' : ''}`}>▸</span>
                  Full Transcript
                  {highlightedTimestamp && (
                    <span className="ml-2 text-xs bg-spratt-blue text-white px-2 py-0.5 rounded-full animate-pulse">
                      Showing {highlightedTimestamp}
                    </span>
                  )}
                </button>
                
                {transcriptExpanded && (
                  <div className="mt-3 p-4 bg-slate-50 rounded-xl text-sm text-slate-600 max-h-64 overflow-y-auto border border-slate-100">
                    {segments.length > 0 ? (
                      <div className="space-y-2">
                        {segments.map((seg, idx) => {
                          const isHighlighted = highlightedTimestamp === seg.timestamp
                          return (
                            <div 
                              key={idx}
                              className={`flex gap-3 p-2 rounded-lg transition-all duration-300 ${
                                isHighlighted 
                                  ? 'bg-spratt-blue-100 border border-spratt-blue-300 shadow-sm' 
                                  : 'hover:bg-slate-100'
                              }`}
                            >
                              <span className={`shrink-0 font-mono text-xs px-2 py-1 rounded ${
                                isHighlighted 
                                  ? 'bg-spratt-blue text-white' 
                                  : 'bg-slate-200 text-slate-600'
                              }`}>
                                {seg.timestamp}
                              </span>
                              <div className="flex-1">
                                {seg.speaker && (
                                  <span className="font-semibold text-spratt-blue mr-1">
                                    Speaker {seg.speaker}:
                                  </span>
                                )}
                                <span className={isHighlighted ? 'text-slate-900' : ''}>
                                  {seg.text}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">
                        {recording?.transcription || 'No transcript available'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MeetingMinutesForm
