/**
 * Extract structured actions from transcription text using Azure OpenAI
 */

const OPENAI_ENDPOINT = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT
const OPENAI_KEY = import.meta.env.VITE_AZURE_OPENAI_KEY
const OPENAI_DEPLOYMENT = import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT || 'gpt-4o'

export const extractActionsFromTranscript = async (transcript) => {
  if (!transcript || transcript.trim().length === 0) {
    return []
  }

  // Try AI extraction first
  if (OPENAI_ENDPOINT && OPENAI_KEY) {
    try {
      console.log('Using Azure OpenAI for action extraction...')
      const aiActions = await extractWithAI(transcript)
      if (aiActions && aiActions.length > 0) {
        console.log('AI extracted actions:', aiActions)
        return aiActions
      }
    } catch (error) {
      console.error('AI extraction failed, falling back to pattern matching:', error)
    }
  }

  // Fallback to pattern matching
  return extractWithPatterns(transcript)
}

/**
 * Extract actions using Azure OpenAI GPT-4o
 */
async function extractWithAI(transcript) {
  const apiVersion = '2024-08-01-preview'
  const url = `${OPENAI_ENDPOINT}openai/deployments/${OPENAI_DEPLOYMENT}/chat/completions?api-version=${apiVersion}`
  
  const systemPrompt = `You are an action extraction assistant for a meeting notes app. 
Extract actionable items from the transcript and return them as JSON.

For each action, identify:
- action_type: one of "call", "email", "meeting", "task"
- title: short action title (max 50 chars)
- description: the original sentence
- metadata: object with contact (person name), recipient (email), due_date (tomorrow, today, next week, or specific date)

Only extract clear, actionable items. Do NOT extract:
- Vague statements
- Past actions already completed
- Context or background information

Return ONLY a JSON array, no markdown, no explanation.
Example: [{"action_type":"email","title":"Send message to John","description":"I need to send a message to John","metadata":{"contact":"John","due_date":"tomorrow"}}]

If no actions found, return: []`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': OPENAI_KEY
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Extract actions from this transcript:\n\n${transcript}` }
      ],
      temperature: 0.3,
      max_tokens: 1000
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Azure OpenAI error:', response.status, errorText)
    throw new Error(`Azure OpenAI error: ${response.status}`)
  }

  const result = await response.json()
  const content = result.choices?.[0]?.message?.content || '[]'
  
  console.log('AI response:', content)
  
  // Parse JSON response
  try {
    // Clean up response (remove markdown code blocks if present)
    let jsonStr = content.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '')
    }
    
    const actions = JSON.parse(jsonStr)
    
    // Validate and clean actions
    return actions.filter(action => 
      action.action_type && 
      action.title && 
      ['call', 'email', 'meeting', 'task'].includes(action.action_type)
    ).map(action => ({
      action_type: action.action_type,
      title: action.title.substring(0, 50),
      description: action.description || '',
      metadata: action.metadata || {}
    }))
  } catch (parseError) {
    console.error('Failed to parse AI response:', parseError)
    return []
  }
}

/**
 * Fallback: Extract actions using pattern matching
 */
function extractWithPatterns(transcript) {
  const actions = []
  const sentences = transcript.split(/[.!?]\s+/).filter(s => s.trim().length > 0)

  sentences.forEach(sentence => {
    const dueDate = extractDate(sentence)
    
    // Look for message/send patterns with names
    const sendMatch = sentence.match(/(?:send|message|contact)\s+(?:to\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)
    if (sendMatch) {
      actions.push({
        action_type: 'email',
        title: `Send message to ${sendMatch[1]}`,
        description: sentence.trim(),
        metadata: { contact: sendMatch[1], due_date: dueDate }
      })
      return
    }
    
    // Look for call patterns
    const callMatch = sentence.match(/(?:call|phone|ring)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)
    if (callMatch) {
      actions.push({
        action_type: 'call',
        title: `Call ${callMatch[1]}`,
        description: sentence.trim(),
        metadata: { contact: callMatch[1], due_date: dueDate }
      })
      return
    }
    
    // Look for need to / have to patterns
    const needMatch = sentence.match(/(?:need to|have to|must|should)\s+(.{5,50}?)(?:\.|$)/i)
    if (needMatch) {
      actions.push({
        action_type: 'task',
        title: needMatch[1].trim().substring(0, 50),
        description: sentence.trim(),
        metadata: { due_date: dueDate }
      })
    }
  })

  return actions
}

/**
 * Extract date references from text
 */
const extractDate = (text) => {
  const lowerText = text.toLowerCase()
  
  if (lowerText.includes('tomorrow')) return 'tomorrow'
  if (lowerText.includes('today')) return 'today'
  if (lowerText.includes('next week')) return 'next week'
  if (lowerText.includes('next month')) return 'next month'
  
  const dayMatch = lowerText.match(/(?:on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/)
  if (dayMatch) return dayMatch[1]
  
  const dateMatch = text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/)
  if (dateMatch) return dateMatch[0]
  
  return null
}


/**
 * Validate action structure
 */
export const validateAction = (action) => {
  const required = ['action_type', 'title']
  const validTypes = ['call', 'email', 'meeting', 'task', 'contact', 'other']
  
  for (const field of required) {
    if (!action[field]) {
      throw new Error(`Missing required field: ${field}`)
    }
  }
  
  if (!validTypes.includes(action.action_type)) {
    throw new Error(`Invalid action_type: ${action.action_type}`)
  }
  
  return true
}
