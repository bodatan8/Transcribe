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
 * Editable Field with warm, human design
 */
function EditableField({ field, data, onUpdate, actions, onCitationClick, highlightedQuote }) {
  const [isEditing, setIsEditing] = useState(false)
  const [localValue, setLocalValue] = useState('')
  const [isHovered, setIsHovered] = useState(false)
  const inputRef = useRef(null)
  
  const value = data?.value ?? data ?? ''
  const isEmpty = !value || (Array.isArray(value) && value.length === 0)
  const citation = data?.citation || data?.citations

  // Safe citation extraction
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

  const isCitationHighlighted = highlightedQuote && citationData.text && 
    citationData.text.toLowerCase().includes(highlightedQuote.toLowerCase())

  return (
    <div 
      className={`group relative transition-all duration-300 ${isEditing ? 'z-10' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Card with warm gradient border on hover */}
      <div className={`relative rounded-2xl transition-all duration-300 ${
        isEditing 
          ? 'bg-white shadow-xl shadow-amber-100 ring-2 ring-amber-400' 
          : isEmpty && field.required
            ? 'bg-gradient-to-br from-amber-50 to-orange-50 hover:shadow-md'
            : 'bg-white hover:shadow-md'
      } ${isHovered && !isEditing ? 'translate-y-[-2px]' : ''}`}>
        
        {/* Subtle gradient overlay for depth */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/80 to-transparent pointer-events-none" />
        
        <div className="relative p-5">
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <span className="text-2xl">{field.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-stone-800">{field.title}</h3>
                {field.required && !isEmpty && (
                  <span className="text-emerald-500 text-sm">✓</span>
                )}
                {field.required && isEmpty && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Needs info</span>
                )}
              </div>
              <p className="text-sm text-slate-500">{field.description}</p>
            </div>
            
            {/* Edit button - appears on hover */}
            {!isEditing && field.type !== 'actions' && (
              <button
                onClick={handleStartEdit}
                className={`text-sm font-medium px-3 py-1.5 rounded-xl transition-all duration-200 ${
                  isHovered 
                    ? 'opacity-100 bg-slate-100 text-slate-700 hover:bg-slate-200' 
                    : 'opacity-0'
                }`}
              >
                Edit
              </button>
            )}
          </div>

          {/* Content */}
          <div className="ml-9">
            {isEditing ? (
              <div className="space-y-3 animate-in fade-in duration-200">
                {field.type === 'textarea' || field.type === 'list' ? (
                  <textarea
                    ref={inputRef}
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setIsEditing(false)}
                    rows={4}
                    placeholder={field.type === 'list' ? 'One item per line...' : 'Type here...'}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none text-slate-700 resize-none transition-all bg-slate-50 focus:bg-white"
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
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none text-slate-700 transition-all bg-slate-50 focus:bg-white"
                  />
                )}
                <div className="flex gap-2">
                  <button onClick={handleSave} className="px-4 py-2 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors">
                    Save
                  </button>
                  <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div onClick={field.type !== 'actions' ? handleStartEdit : undefined} className={field.type !== 'actions' ? 'cursor-text' : ''}>
                {field.type === 'list' && Array.isArray(value) && value.length > 0 ? (
                  <ul className="space-y-1">
                    {value.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-slate-700">
                        <span className="text-amber-500 mt-1">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : field.type === 'actions' ? (
                  <div className="space-y-2">
                    {actions?.length > 0 ? actions.map((action, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100">
                        <span className="text-emerald-500 text-lg mt-0.5">☐</span>
                        <div className="flex-1">
                          <p className="font-medium text-slate-800">{action.title}</p>
                          <div className="flex flex-wrap gap-3 mt-1 text-sm text-slate-500">
                            {action.metadata?.contact && <span>👤 {action.metadata.contact}</span>}
                            {action.metadata?.due_date && <span>📅 {action.metadata.due_date}</span>}
                          </div>
                        </div>
                      </div>
                    )) : (
                      <p className="text-slate-400 italic">No action items yet</p>
                    )}
                  </div>
                ) : isEmpty ? (
                  <p className="text-slate-400 italic py-1">Click to add...</p>
                ) : (
                  <p className="text-slate-700 leading-relaxed">{value}</p>
                )}
              </div>
            )}

            {/* Citation - clickable to show in transcript */}
            {citationData.text && !isEditing && (
              <button
                onClick={() => onCitationClick && onCitationClick(citationData.text, citationData.timestamp)}
                className={`mt-4 w-full text-left p-3 rounded-xl transition-all duration-300 group/cite ${
                  isCitationHighlighted
                    ? 'bg-amber-100 border-2 border-amber-400 shadow-md'
                    : 'bg-slate-50 hover:bg-slate-100 border border-slate-100'
                }`}
              >
                <div className="flex items-start gap-2">
                  {citationData.timestamp && (
                    <span className={`shrink-0 text-xs font-mono px-2 py-1 rounded-lg transition-colors ${
                      isCitationHighlighted 
                        ? 'bg-amber-500 text-white' 
                        : 'bg-slate-200 text-slate-600 group-hover/cite:bg-amber-100 group-hover/cite:text-amber-700'
                    }`}>
                      {citationData.timestamp}
                    </span>
                  )}
                  <p className={`text-sm italic flex-1 ${isCitationHighlighted ? 'text-amber-900' : 'text-slate-500'}`}>
                    &ldquo;{citationData.text}&rdquo;
                  </p>
                  <span className="text-slate-400 text-xs shrink-0">Click to see in transcript →</span>
                </div>
              </button>
            )}
          </div>
        </div>
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
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-3xl p-8 shadow-2xl flex items-center gap-4">
          <div className="w-8 h-8 border-3 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-slate-600 font-medium">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-orange-50 via-white to-amber-50 rounded-3xl max-w-3xl w-full shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header - warm gradient */}
        <div className="relative p-6 border-b border-amber-100 bg-white/80 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {hasMinutes && (
                <div className="relative">
                  <ProgressRing progress={progress} />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-700">
                    {progress}%
                  </span>
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Meeting Minutes</h2>
                <p className="text-slate-500 text-sm">
                  {hasMinutes ? `${filledCount} of ${requiredFields.length} sections complete` : 'Generate from your recording'}
                </p>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-all hover:scale-105"
            >
              ✕
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mt-4">
            {!hasMinutes ? (
              <button
                onClick={handleGenerate}
                disabled={generating || !recording?.transcription}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30 transition-all hover:scale-[1.02] disabled:opacity-50"
              >
                {generating ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating...</>
                ) : (
                  <>✨ Generate Minutes</>
                )}
              </button>
            ) : (
              <>
                <button onClick={handleGenerate} disabled={generating} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-all">
                  {generating ? 'Regenerating...' : '🔄 Regenerate'}
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={exporting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition-all"
                >
                  {exporting ? 'Exporting...' : '📄 Export PDF'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div ref={formRef} className="flex-1 overflow-y-auto p-6">
          {/* PDF Header */}
          <div className="text-center mb-8 pb-6 border-b border-slate-200">
            <h1 className="text-2xl font-bold text-slate-900">
              {minutes.meeting_title?.value || 'Meeting Minutes'}
            </h1>
            <p className="text-slate-500 mt-2">
              {new Date().toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {!hasMinutes ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-4xl shadow-lg shadow-amber-100">
                📝
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Ready to create minutes?</h3>
              <p className="text-slate-500 max-w-md mx-auto">
                Click &ldquo;Generate Minutes&rdquo; and we&apos;ll create a structured summary from your recording. You can edit everything afterwards.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {FORM_FIELDS.map(field => (
                <EditableField
                  key={field.id}
                  field={field}
                  data={minutes[field.id]}
                  onUpdate={handleUpdateField}
                  actions={field.type === 'actions' ? actions : null}
                  onCitationClick={handleCitationClick}
                  highlightedQuote={highlightedQuote}
                />
              ))}

              {/* Transcript with highlighting */}
              <div ref={transcriptRef} className="mt-8 rounded-2xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setTranscriptOpen(!transcriptOpen)}
                  className="w-full p-4 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between"
                >
                  <span className="font-medium text-slate-700 flex items-center gap-2">
                    📜 Full Transcript
                    {highlightedQuote && (
                      <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                        Quote highlighted below
                      </span>
                    )}
                  </span>
                  <span className={`transition-transform ${transcriptOpen ? 'rotate-180' : ''}`}>▼</span>
                </button>
                
                {transcriptOpen && (
                  <div className="p-4 bg-white max-h-80 overflow-y-auto">
                    {segments.length > 0 ? (
                      <div className="space-y-3">
                        {segments.map((seg, idx) => {
                          const hasMatch = highlightedQuote && seg.text.toLowerCase().includes(highlightedQuote.toLowerCase())
                          return (
                            <div 
                              key={idx}
                              className={`flex gap-3 p-3 rounded-xl transition-all duration-500 ${
                                hasMatch ? 'bg-amber-100 border-2 border-amber-400 shadow-md scale-[1.01]' : 'hover:bg-slate-50'
                              }`}
                            >
                              <span className={`shrink-0 font-mono text-xs px-2 py-1 rounded-lg ${
                                hasMatch ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {seg.timestamp}
                              </span>
                              <div className="flex-1">
                                {seg.speaker && <span className="font-semibold text-amber-700 mr-1">Speaker {seg.speaker}:</span>}
                                <span className={hasMatch ? 'text-amber-900' : 'text-slate-600'}>
                                  {highlightText(seg.text)}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">
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
