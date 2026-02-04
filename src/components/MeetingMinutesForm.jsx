/**
 * Meeting Minutes Form - 2026 Design
 * - Warm, human aesthetic (not AI-ish)
 * - Micro-interactions & subtle animations
 * - Editable fields with inline editing
 * - Clickable citations that highlight full quotes
 * - PDF Export
 */

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Form field definitions
const FORM_FIELDS = [
  {
    id: 'meeting_title',
    title: 'Meeting Title',
    description: 'What was this meeting about?',
    type: 'text',
    required: true,
    icon: '📋'
  },
  {
    id: 'date_time',
    title: 'Date & Time',
    description: 'When did this take place?',
    type: 'text',
    required: true,
    icon: '📅'
  },
  {
    id: 'attendees',
    title: 'Who Was There',
    description: 'People in the meeting',
    type: 'list',
    required: true,
    icon: '👥'
  },
  {
    id: 'summary',
    title: 'Quick Summary',
    description: 'The main takeaway in a few sentences',
    type: 'textarea',
    required: true,
    icon: '💡'
  },
  {
    id: 'key_points',
    title: 'Key Discussion Points',
    description: 'What topics were covered?',
    type: 'list',
    required: false,
    icon: '🎯'
  },
  {
    id: 'action_items',
    title: 'Action Items',
    description: 'Tasks and next steps',
    type: 'actions',
    required: true,
    icon: '✅'
  },
  {
    id: 'next_steps',
    title: 'What Happens Next',
    description: 'Follow-up plans',
    type: 'textarea',
    required: false,
    icon: '🚀'
  },
  {
    id: 'notes',
    title: 'Additional Notes',
    description: 'Anything else worth noting',
    type: 'textarea',
    required: false,
    icon: '📝'
  }
]

const OPENAI_ENDPOINT = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT
const OPENAI_KEY = import.meta.env.VITE_AZURE_OPENAI_KEY
const OPENAI_DEPLOYMENT = import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT || 'gpt-4o'

/**
 * Generate meeting minutes with timestamped citations
 */
async function generateMeetingMinutes(transcript, actions, segments) {
  if (!OPENAI_ENDPOINT || !OPENAI_KEY) return null

  const apiVersion = '2024-08-01-preview'
  const url = `${OPENAI_ENDPOINT}openai/deployments/${OPENAI_DEPLOYMENT}/chat/completions?api-version=${apiVersion}`
  
  // Build timestamped transcript
  const timestampedTranscript = segments?.length > 0
    ? segments.map(s => `[${s.timestamp}] ${s.speaker ? `Speaker ${s.speaker}: ` : ''}${s.text}`).join('\n')
    : transcript
  
  const systemPrompt = `You are creating meeting minutes. Be natural and helpful, not robotic.

The transcript has timestamps [M:SS]. For citations, include the timestamp AND the exact quote.

Return JSON:
{
  "meeting_title": { "value": "Clear, human title", "citation": { "text": "exact words from transcript", "timestamp": "0:00" } },
  "date_time": { "value": "Friendly date format", "citation": { "text": "quote", "timestamp": "0:00" } },
  "attendees": { "value": ["Name 1", "Name 2"], "citation": { "text": "where names mentioned", "timestamp": "0:15" } },
  "summary": { "value": "Natural 2-3 sentence summary", "citation": { "text": "key quote", "timestamp": "0:30" } },
  "key_points": { "value": ["Point 1", "Point 2"], "citations": [{ "text": "quote", "timestamp": "1:00" }] },
  "next_steps": { "value": "What happens next", "citation": { "text": "quote", "timestamp": "3:00" } },
  "notes": { "value": "Extra context", "citation": { "text": "quote", "timestamp": "3:30" } }
}

Rules:
- Write naturally, as a helpful colleague would
- Citations must be EXACT words from the transcript
- If info not found, use empty string ""
- Timestamps in M:SS format

Return ONLY JSON.`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': OPENAI_KEY },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Create meeting minutes:\n\n${timestampedTranscript}${actions?.length ? `\n\nActions found:\n${actions.map(a => `- ${a.title}`).join('\n')}` : ''}` }
        ],
        temperature: 0.4,
        max_tokens: 2000
      })
    })

    if (!response.ok) return null

    const result = await response.json()
    let content = result.choices?.[0]?.message?.content || '{}'
    if (content.startsWith('```')) content = content.replace(/```json?\n?/g, '').replace(/```/g, '')
    
    return JSON.parse(content)
  } catch (error) {
    console.error('Failed to generate minutes:', error)
    return null
  }
}

/**
 * Compact, clean field component - 2026 minimal design
 */
function FormField({ field, data, onUpdate, actions, onCitationClick }) {
  const [isEditing, setIsEditing] = useState(false)
  const [localValue, setLocalValue] = useState('')
  const inputRef = useRef(null)
  
  const value = data?.value ?? data ?? ''
  const isEmpty = !value || (Array.isArray(value) && value.length === 0)
  const citation = data?.citation || data?.citations

  const getCitationData = () => {
    if (!citation) return { text: '', timestamp: null }
    if (Array.isArray(citation)) {
      const first = citation[0]
      return typeof first === 'object' ? { text: first?.text || '', timestamp: first?.timestamp } : { text: String(first || ''), timestamp: null }
    }
    if (typeof citation === 'object') return { text: citation.text || '', timestamp: citation.timestamp }
    return { text: String(citation), timestamp: null }
  }
  const citationData = getCitationData()

  useEffect(() => {
    if (isEditing && inputRef.current) inputRef.current.focus()
  }, [isEditing])

  const handleStartEdit = () => {
    if (field.type === 'actions') return
    setLocalValue(Array.isArray(value) ? value.join('\n') : value)
    setIsEditing(true)
  }

  const handleSave = () => {
    const newValue = field.type === 'list' ? localValue.split('\n').filter(l => l.trim()) : localValue
    onUpdate(field.id, newValue)
    setIsEditing(false)
  }

  return (
    <div className="group">
      {/* Clean row layout */}
      <div className={`flex items-start gap-4 py-4 border-b border-stone-100 last:border-0 ${
        isEmpty && field.required ? 'bg-gradient-to-r from-amber-50/50 to-transparent -mx-4 px-4 rounded-lg' : ''
      }`}>
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center text-lg shrink-0">
          {field.icon}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400">{field.title}</span>
            {field.required && isEmpty && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 font-medium">Required</span>
            )}
            {field.required && !isEmpty && (
              <span className="text-emerald-500 text-xs">✓</span>
            )}
          </div>
          
          {isEditing ? (
            <div className="space-y-2 mt-2">
              {field.type === 'textarea' || field.type === 'list' ? (
                <textarea
                  ref={inputRef}
                  value={localValue}
                  onChange={(e) => setLocalValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setIsEditing(false)}
                  rows={3}
                  placeholder={field.type === 'list' ? 'One item per line...' : 'Type here...'}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none text-stone-800 resize-none text-sm"
                />
              ) : (
                <input
                  ref={inputRef}
                  type="text"
                  value={localValue}
                  onChange={(e) => setLocalValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setIsEditing(false)
                    if (e.key === 'Enter') handleSave()
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none text-stone-800 text-sm"
                />
              )}
              <div className="flex gap-2">
                <button onClick={handleSave} className="px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-medium hover:bg-stone-800">
                  Save
                </button>
                <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 rounded-lg text-stone-500 hover:bg-stone-100 text-xs">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div 
              onClick={field.type !== 'actions' ? handleStartEdit : undefined} 
              className={field.type !== 'actions' ? 'cursor-pointer hover:bg-stone-50 -mx-2 px-2 py-1 rounded-lg transition-colors' : ''}
            >
              {field.type === 'list' && Array.isArray(value) && value.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {value.map((item, i) => (
                    <span key={i} className="px-2.5 py-1 bg-stone-100 rounded-full text-sm text-stone-700">
                      {item}
                    </span>
                  ))}
                </div>
              ) : field.type === 'actions' ? (
                <div className="space-y-2 mt-1">
                  {actions?.length > 0 ? actions.map((action, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-teal-50 border border-teal-100">
                      <span className="w-5 h-5 rounded border-2 border-teal-400 flex items-center justify-center text-teal-500 text-xs">✓</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-stone-800 text-sm truncate">{action.title}</p>
                        {(action.metadata?.contact || action.metadata?.due_date) && (
                          <p className="text-xs text-stone-500 mt-0.5">
                            {[action.metadata?.contact, action.metadata?.due_date].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                  )) : (
                    <p className="text-stone-400 text-sm italic">No action items</p>
                  )}
                </div>
              ) : isEmpty ? (
                <p className="text-stone-400 text-sm">Click to add...</p>
              ) : (
                <p className="text-stone-800 text-sm leading-relaxed">{value}</p>
              )}
            </div>
          )}

          {/* Citation badge */}
          {citationData.text && !isEditing && (
            <button
              onClick={() => onCitationClick && onCitationClick(citationData.text, citationData.timestamp)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-2 py-1 rounded-md transition-colors"
            >
              {citationData.timestamp && <span className="font-mono bg-teal-100 px-1.5 py-0.5 rounded text-[10px]">{citationData.timestamp}</span>}
              <span className="truncate max-w-[200px]">&ldquo;{citationData.text}&rdquo;</span>
              <span className="text-stone-400">→</span>
            </button>
          )}
        </div>
        
        {/* Edit trigger */}
        {!isEditing && field.type !== 'actions' && (
          <button
            onClick={handleStartEdit}
            className="opacity-0 group-hover:opacity-100 p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Progress ring - visual completion indicator
 */
function ProgressRing({ progress }) {
  const radius = 20
  const stroke = 4
  const normalizedRadius = radius - stroke / 2
  const circumference = normalizedRadius * 2 * Math.PI
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
      <circle
        stroke="#e7e5e4"
        fill="transparent"
        strokeWidth={stroke}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
      />
      <circle
        stroke={progress === 100 ? '#059669' : '#f59e0b'}
        fill="transparent"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference + ' ' + circumference}
        style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease' }}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
      />
    </svg>
  )
}

/**
 * Main Form Component
 */
export function MeetingMinutesForm({ recordingId, onClose }) {
  const [recording, setRecording] = useState(null)
  const [actions, setActions] = useState([])
  const [minutes, setMinutes] = useState({})
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [highlightedQuote, setHighlightedQuote] = useState(null)
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const formRef = useRef(null)
  const transcriptRef = useRef(null)

  const segments = recording?.metadata?.segments || []
  const hasMinutes = Object.keys(minutes).length > 0

  // Calculate progress
  const requiredFields = FORM_FIELDS.filter(f => f.required)
  const filledCount = requiredFields.filter(f => {
    if (f.type === 'actions') return actions?.length > 0
    const val = minutes?.[f.id]?.value ?? minutes?.[f.id]
    return val && (Array.isArray(val) ? val.length > 0 : String(val).trim())
  }).length
  const progress = Math.round((filledCount / requiredFields.length) * 100)

  useEffect(() => {
    async function loadData() {
      try {
        const [rec, act] = await Promise.all([
          supabase.from('recordings').select('*').eq('id', recordingId).single(),
          supabase.from('actions').select('*').eq('recording_id', recordingId)
        ])
        if (rec.data) setRecording(rec.data)
        if (act.data) setActions(act.data)
      } finally {
        setLoading(false)
      }
    }
    if (recordingId) loadData()
  }, [recordingId])

  const handleGenerate = async () => {
    if (!recording?.transcription) return
    setGenerating(true)
    try {
      const result = await generateMeetingMinutes(recording.transcription, actions, segments)
      if (result) setMinutes(result)
    } finally {
      setGenerating(false)
    }
  }

  const handleUpdateField = (fieldId, newValue) => {
    setMinutes(prev => ({
      ...prev,
      [fieldId]: { ...(typeof prev[fieldId] === 'object' ? prev[fieldId] : {}), value: newValue }
    }))
  }

  const handleCitationClick = (quoteText, timestamp) => {
    setHighlightedQuote(quoteText)
    setTranscriptOpen(true)
    setTimeout(() => transcriptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
    setTimeout(() => setHighlightedQuote(null), 5000)
  }

  const handleExportPDF = async () => {
    setExporting(true)
    try {
      const html2pdf = (await import('html2pdf.js')).default
      await html2pdf().set({
        margin: 15,
        filename: `meeting-minutes-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(formRef.current).save()
    } finally {
      setExporting(false)
    }
  }

  // Highlight matching text in transcript
  const highlightText = (text) => {
    if (!highlightedQuote || !text) return text
    const lowerQuote = highlightedQuote.toLowerCase()
    const lowerText = text.toLowerCase()
    const index = lowerText.indexOf(lowerQuote)
    if (index === -1) return text
    
    return (
      <>
        {text.slice(0, index)}
        <mark className="bg-amber-300 text-amber-900 px-1 rounded">{text.slice(index, index + highlightedQuote.length)}</mark>
        {text.slice(index + highlightedQuote.length)}
      </>
    )
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-6 shadow-2xl flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          <span className="text-stone-600 font-medium text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex flex-col">
      {/* STICKY HEADER - Always visible */}
      <div className="sticky top-0 z-10 bg-white border-b border-stone-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Title + Progress */}
            <div className="flex items-center gap-4 min-w-0">
              {hasMinutes && (
                <div className="relative shrink-0">
                  <ProgressRing progress={progress} />
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-stone-600">
                    {progress}%
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-stone-900 truncate">Meeting Minutes</h1>
                <p className="text-xs text-stone-500">
                  {hasMinutes ? `${filledCount}/${requiredFields.length} complete` : 'Generate from recording'}
                </p>
              </div>
            </div>
            
            {/* Right: Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {!hasMinutes ? (
                <button
                  onClick={handleGenerate}
                  disabled={generating || !recording?.transcription}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                  {generating ? (
                    <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating...</>
                  ) : (
                    <>✨ Generate</>
                  )}
                </button>
              ) : (
                <>
                  <button 
                    onClick={handleGenerate} 
                    disabled={generating} 
                    className="px-3 py-2 rounded-lg text-stone-600 hover:bg-stone-100 text-sm font-medium transition-colors"
                  >
                    {generating ? '...' : '↻'}
                  </button>
                  <button
                    onClick={handleExportPDF}
                    disabled={exporting}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors"
                  >
                    {exporting ? 'Exporting...' : '📄 Export PDF'}
                  </button>
                </>
              )}
              <button 
                onClick={onClose}
                className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors ml-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-stone-50 to-white">
        <div ref={formRef} className="max-w-4xl mx-auto px-6 py-8">
          
          {!hasMinutes ? (
            /* Empty state */
            <div className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center text-3xl">
                📝
              </div>
              <h2 className="text-xl font-semibold text-stone-900 mb-2">Ready to create minutes?</h2>
              <p className="text-stone-500 max-w-sm mx-auto text-sm">
                Click &ldquo;Generate&rdquo; to create a structured summary from your recording. Everything is editable.
              </p>
            </div>
          ) : (
            <>
              {/* Document header for PDF */}
              <div className="text-center mb-8 pb-6 border-b border-stone-200">
                <h1 className="text-2xl font-bold text-stone-900">
                  {minutes.meeting_title?.value || 'Meeting Minutes'}
                </h1>
                <p className="text-stone-500 mt-1 text-sm">
                  {minutes.date_time?.value || new Date().toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>

              {/* Form Fields - Clean card layout */}
              <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="px-4">
                  {FORM_FIELDS.map(field => (
                    <FormField
                      key={field.id}
                      field={field}
                      data={minutes[field.id]}
                      onUpdate={handleUpdateField}
                      actions={field.type === 'actions' ? actions : null}
                      onCitationClick={handleCitationClick}
                    />
                  ))}
                </div>
              </div>

              {/* Transcript section */}
              <div ref={transcriptRef} className="mt-6 bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => setTranscriptOpen(!transcriptOpen)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-stone-50 transition-colors"
                >
                  <span className="font-medium text-stone-700 text-sm flex items-center gap-2">
                    📜 Full Transcript
                    {highlightedQuote && (
                      <span className="text-[10px] bg-teal-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                        Highlighted
                      </span>
                    )}
                  </span>
                  <svg className={`w-4 h-4 text-stone-400 transition-transform ${transcriptOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {transcriptOpen && (
                  <div className="border-t border-stone-100 p-4 max-h-[400px] overflow-y-auto bg-stone-50">
                    {segments.length > 0 ? (
                      <div className="space-y-2">
                        {segments.map((seg, idx) => {
                          const hasMatch = highlightedQuote && seg.text.toLowerCase().includes(highlightedQuote.toLowerCase())
                          return (
                            <div 
                              key={idx}
                              className={`flex gap-3 p-2.5 rounded-lg transition-all ${
                                hasMatch ? 'bg-teal-100 border border-teal-300 shadow-sm' : 'hover:bg-white'
                              }`}
                            >
                              <span className={`shrink-0 font-mono text-[10px] px-1.5 py-0.5 rounded ${
                                hasMatch ? 'bg-teal-600 text-white' : 'bg-stone-200 text-stone-500'
                              }`}>
                                {seg.timestamp}
                              </span>
                              <div className="flex-1 text-sm">
                                {seg.speaker && <span className="font-semibold text-teal-700 mr-1">Speaker {seg.speaker}:</span>}
                                <span className={hasMatch ? 'text-teal-900' : 'text-stone-600'}>
                                  {highlightText(seg.text)}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-stone-600 text-sm whitespace-pre-wrap leading-relaxed">
                        {recording?.transcription || 'No transcript available'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default MeetingMinutesForm
