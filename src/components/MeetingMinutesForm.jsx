/**
 * Meeting Minutes Form - AI-populated form with citations
 * Exportable as PDF
 */

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Form field definitions - configurable
const FORM_FIELDS = [
  {
    id: 'meeting_title',
    title: 'Meeting Title',
    description: 'The title or subject of the meeting',
    type: 'text'
  },
  {
    id: 'date_time',
    title: 'Date & Time',
    description: 'When the meeting took place',
    type: 'text'
  },
  {
    id: 'attendees',
    title: 'Attendees',
    description: 'People who participated in the meeting',
    type: 'list'
  },
  {
    id: 'summary',
    title: 'Meeting Summary',
    description: 'Brief overview of what was discussed',
    type: 'textarea'
  },
  {
    id: 'key_points',
    title: 'Key Discussion Points',
    description: 'Main topics and decisions discussed',
    type: 'list'
  },
  {
    id: 'action_items',
    title: 'Action Items',
    description: 'Tasks and follow-ups assigned during the meeting',
    type: 'actions'
  },
  {
    id: 'next_steps',
    title: 'Next Steps',
    description: 'Upcoming actions or follow-up meetings',
    type: 'textarea'
  },
  {
    id: 'notes',
    title: 'Additional Notes',
    description: 'Any other important information',
    type: 'textarea'
  }
]

const OPENAI_ENDPOINT = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT
const OPENAI_KEY = import.meta.env.VITE_AZURE_OPENAI_KEY
const OPENAI_DEPLOYMENT = import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT || 'gpt-4o'

/**
 * Generate meeting minutes from transcript using AI with citations
 */
async function generateMeetingMinutes(transcript, actions) {
  if (!OPENAI_ENDPOINT || !OPENAI_KEY) {
    console.warn('Azure OpenAI not configured')
    return null
  }

  const apiVersion = '2024-08-01-preview'
  const url = `${OPENAI_ENDPOINT}openai/deployments/${OPENAI_DEPLOYMENT}/chat/completions?api-version=${apiVersion}`
  
  const systemPrompt = `You are a meeting minutes assistant. Generate structured meeting minutes from the transcript.

For EACH field you populate, you MUST include a citation to the exact quote from the transcript that supports it.

Return a JSON object with these fields:
{
  "meeting_title": { "value": "...", "citation": "exact quote from transcript" },
  "date_time": { "value": "...", "citation": "exact quote or 'Inferred from context'" },
  "attendees": { "value": ["Person 1", "Person 2"], "citation": "quotes mentioning each person" },
  "summary": { "value": "2-3 sentence summary", "citation": "key quotes that form the summary" },
  "key_points": { "value": ["Point 1", "Point 2"], "citations": ["quote for point 1", "quote for point 2"] },
  "next_steps": { "value": "...", "citation": "quote about next steps" },
  "notes": { "value": "any additional context", "citation": "supporting quote" },
  "missing_info": ["list of important fields that couldn't be filled from the transcript"]
}

Rules:
- If you cannot find information for a field, set value to null and explain in missing_info
- Citations must be EXACT quotes from the transcript (word for word)
- Keep the meeting_title concise (max 60 chars)
- For attendees, extract all names mentioned as participants
- For key_points, summarize main discussion topics (max 5 points)

Return ONLY valid JSON, no markdown.`

  const userPrompt = `Generate meeting minutes from this transcript:

${transcript}

${actions?.length > 0 ? `\nExtracted action items for reference:\n${actions.map(a => `- ${a.title}`).join('\n')}` : ''}`

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
    
    // Parse JSON
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
 * Meeting Minutes Form Component
 */
export function MeetingMinutesForm({ recordingId, onClose }) {
  const [recording, setRecording] = useState(null)
  const [actions, setActions] = useState([])
  const [minutes, setMinutes] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const formRef = useRef(null)

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

  // Generate minutes when recording is loaded
  const handleGenerate = async () => {
    if (!recording?.transcription) return
    
    setGenerating(true)
    try {
      const result = await generateMeetingMinutes(recording.transcription, actions)
      if (result) {
        setMinutes(result)
      }
    } finally {
      setGenerating(false)
    }
  }

  // Export to PDF
  const handleExportPDF = async () => {
    setExporting(true)
    try {
      const html2pdf = (await import('html2pdf.js')).default
      
      const element = formRef.current
      const opt = {
        margin: [10, 10, 10, 10],
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
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-3xl w-full mx-4 shadow-xl">
          <div className="flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-spratt-blue/30 border-t-spratt-blue rounded-full animate-spin" />
            <span>Loading...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Meeting Minutes</h2>
            <p className="text-sm text-slate-500 mt-1">AI-generated form with transcript citations</p>
          </div>
          <div className="flex items-center gap-3">
            {!minutes && (
              <button
                onClick={handleGenerate}
                disabled={generating || !recording?.transcription}
                className="btn btn-primary flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>✨ Generate Minutes</>
                )}
              </button>
            )}
            {minutes && (
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="btn btn-primary flex items-center gap-2"
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
            )}
            <button onClick={onClose} className="btn btn-secondary">
              Close
            </button>
          </div>
        </div>

        {/* Form Content */}
        <div ref={formRef} className="p-6 max-h-[70vh] overflow-y-auto bg-white">
          {/* Logo/Header for PDF */}
          <div className="text-center mb-8 pb-6 border-b">
            <h1 className="text-2xl font-bold text-slate-900">Meeting Minutes</h1>
            <p className="text-sm text-slate-500 mt-1">
              Generated {new Date().toLocaleDateString('en-AU', { 
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
              })}
            </p>
          </div>

          {!minutes ? (
            <div className="text-center py-12 text-slate-500">
              <p className="mb-4">Click "Generate Minutes" to create AI-populated meeting minutes from the transcript.</p>
              {!recording?.transcription && (
                <p className="text-amber-600">⚠️ No transcription available for this recording.</p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Missing Info Warning */}
              {minutes.missing_info?.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <h3 className="font-medium text-amber-800 mb-2">ℹ️ Additional Information Needed</h3>
                  <ul className="text-sm text-amber-700 list-disc list-inside">
                    {minutes.missing_info.map((info, i) => (
                      <li key={i}>{info}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Form Fields */}
              {FORM_FIELDS.map(field => {
                const fieldData = minutes[field.id]
                const value = fieldData?.value
                const citation = fieldData?.citation || fieldData?.citations
                
                if (!value && field.id !== 'action_items') return null

                return (
                  <div key={field.id} className="border-b pb-6 last:border-0">
                    <div className="mb-2">
                      <h3 className="font-semibold text-slate-900">{field.title}</h3>
                      <p className="text-xs text-slate-500">{field.description}</p>
                    </div>
                    
                    {/* Field Value */}
                    <div className="bg-slate-50 rounded-lg p-4 mb-2">
                      {field.type === 'list' && Array.isArray(value) ? (
                        <ul className="list-disc list-inside space-y-1">
                          {value.map((item, i) => (
                            <li key={i} className="text-slate-800">{item}</li>
                          ))}
                        </ul>
                      ) : field.type === 'actions' ? (
                        <div className="space-y-2">
                          {actions.length > 0 ? actions.map((action, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="text-emerald-500 mt-1">☐</span>
                              <div>
                                <p className="font-medium text-slate-800">{action.title}</p>
                                {action.metadata?.contact && (
                                  <p className="text-sm text-slate-500">Assigned to: {action.metadata.contact}</p>
                                )}
                                {action.metadata?.due_date && (
                                  <p className="text-sm text-slate-500">Due: {action.metadata.due_date}</p>
                                )}
                              </div>
                            </div>
                          )) : (
                            <p className="text-slate-500 italic">No action items extracted</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-slate-800 whitespace-pre-wrap">{value || 'Not available'}</p>
                      )}
                    </div>
                    
                    {/* Citation */}
                    {citation && (
                      <div className="bg-blue-50 rounded-lg p-3 text-xs">
                        <span className="font-medium text-blue-700">📎 Citation: </span>
                        <span className="text-blue-600 italic">
                          {Array.isArray(citation) ? citation.join(' | ') : `"${citation}"`}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Transcript Reference */}
              <div className="mt-8 pt-6 border-t">
                <h3 className="font-semibold text-slate-900 mb-2">Full Transcript</h3>
                <div className="bg-slate-100 rounded-lg p-4 text-sm text-slate-700 max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {recording?.transcription || 'No transcript available'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MeetingMinutesForm
