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
 * Returns Salesforce Task-compatible structure
 */
async function extractWithAI(transcript) {
  const apiVersion = '2024-08-01-preview'
  const url = `${OPENAI_ENDPOINT}openai/deployments/${OPENAI_DEPLOYMENT}/chat/completions?api-version=${apiVersion}`
  
  // Salesforce Task-compatible extraction prompt
  const systemPrompt = `You are an action extraction assistant that creates Salesforce Tasks from meeting notes.
Extract actionable items from the transcript and return them as JSON.

For each action, extract these Salesforce Task-compatible fields:
- action_type: always "task" (all items become Salesforce Tasks)
- title: short task subject (max 50 chars) - maps to Salesforce Subject field
- description: the original sentence - maps to Salesforce Description field
- metadata object with Salesforce-compatible fields:
  - contact: person name (used to lookup WhoId - Contact/Lead in Salesforce)
  - contact_email: email if mentioned (helps identify Contact)
  - contact_phone: phone if mentioned (helps identify Contact)
  - account: company/account name (used to lookup WhatId - Account in Salesforce)
  - due_date: relative date (today, tomorrow, next week) or specific date - maps to ActivityDate
  - priority: "High", "Normal", or "Low" - maps to Salesforce Priority field

Only extract clear, actionable items. Do NOT extract:
- Vague statements
- Past actions already completed
- Context or background information

Return ONLY a JSON array, no markdown, no explanation.
Example: [{"action_type":"task","title":"Send proposal to John","description":"I need to send the proposal to John at Acme Corp","metadata":{"contact":"John","account":"Acme Corp","due_date":"tomorrow","priority":"High"}}]

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
    
    // Validate and clean actions - all become Salesforce Tasks
    return actions.filter(action => 
      action.title && action.title.trim().length > 0
    ).map(action => ({
      action_type: 'task', // Always task for Salesforce
      title: action.title.substring(0, 50),
      description: action.description || '',
      metadata: {
        contact: action.metadata?.contact || '',
        contact_email: action.metadata?.contact_email || action.metadata?.email || '',
        contact_phone: action.metadata?.contact_phone || action.metadata?.phone || '',
        account: action.metadata?.account || action.metadata?.company || '',
        due_date: action.metadata?.due_date || '',
        priority: action.metadata?.priority || 'Normal',
        notes: action.metadata?.notes || ''
      }
    }))
  } catch (parseError) {
    console.error('Failed to parse AI response:', parseError)
    return []
  }
}

/**
 * Fallback: Extract actions using pattern matching
 * Returns Salesforce Task-compatible structure
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
        action_type: 'task', // All become Salesforce Tasks
        title: `Send message to ${sendMatch[1]}`,
        description: sentence.trim(),
        metadata: { 
          contact: sendMatch[1], 
          due_date: dueDate,
          priority: 'Normal'
        }
      })
      return
    }
    
    // Look for call patterns
    const callMatch = sentence.match(/(?:call|phone|ring)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)
    if (callMatch) {
      actions.push({
        action_type: 'task', // All become Salesforce Tasks
        title: `Call ${callMatch[1]}`,
        description: sentence.trim(),
        metadata: { 
          contact: callMatch[1], 
          due_date: dueDate,
          priority: 'Normal'
        }
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
        metadata: { 
          due_date: dueDate,
          priority: 'Normal'
        }
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
 * Validate action structure for Salesforce Task compatibility
 */
export const validateAction = (action) => {
  const required = ['action_type', 'title']
  
  for (const field of required) {
    if (!action[field]) {
      throw new Error(`Missing required field: ${field}`)
    }
  }
  
  // All actions must be tasks for Salesforce
  if (action.action_type !== 'task') {
    throw new Error(`Invalid action_type: ${action.action_type}. Must be 'task' for Salesforce.`)
  }
  
  // Validate priority if present
  if (action.metadata?.priority && !['High', 'Normal', 'Low'].includes(action.metadata.priority)) {
    console.warn(`Non-standard priority value: ${action.metadata.priority}. Salesforce uses High/Normal/Low.`)
  }
  
  return true
}

/**
 * Convert our action to Salesforce Task format
 * Use this when pushing to Salesforce API
 */
export const toSalesforceTask = (action, salesforceIds = {}) => {
  const meta = action.metadata || {}
  
  return {
    // Required Salesforce Task fields
    Subject: action.title,
    Status: mapStatusToSalesforce(action.status),
    Priority: meta.priority || 'Normal',
    
    // Optional fields
    Description: [action.description, meta.notes].filter(Boolean).join('\n\n'),
    ActivityDate: formatDateForSalesforce(meta.due_date),
    
    // Lookup fields (require actual Salesforce IDs)
    WhoId: salesforceIds.contactId || salesforceIds.leadId || null, // Contact or Lead
    WhatId: salesforceIds.accountId || salesforceIds.opportunityId || null, // Account, Opportunity, etc.
    OwnerId: salesforceIds.ownerId || null, // Assigned user
    
    // Metadata for reference (not sent to Salesforce, used for lookup)
    _lookupHints: {
      contactName: meta.contact,
      contactEmail: meta.contact_email,
      contactPhone: meta.contact_phone,
      accountName: meta.account
    }
  }
}

/**
 * Map our status to Salesforce Task Status
 */
function mapStatusToSalesforce(status) {
  const statusMap = {
    'pending': 'Not Started',
    'approved': 'In Progress', 
    'completed': 'Completed',
    'rejected': 'Deferred'
  }
  return statusMap[status] || 'Not Started'
}

/**
 * Format date for Salesforce (YYYY-MM-DD)
 */
function formatDateForSalesforce(dateValue) {
  if (!dateValue) return null
  
  // Already in correct format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue
  }
  
  // Handle datetime-local format
  if (/^\d{4}-\d{2}-\d{2}T/.test(dateValue)) {
    return dateValue.split('T')[0]
  }
  
  // Handle relative dates
  const today = new Date()
  const lowerValue = dateValue.toLowerCase()
  
  if (lowerValue === 'today') {
    return today.toISOString().split('T')[0]
  }
  if (lowerValue === 'tomorrow') {
    today.setDate(today.getDate() + 1)
    return today.toISOString().split('T')[0]
  }
  if (lowerValue === 'next week') {
    today.setDate(today.getDate() + 7)
    return today.toISOString().split('T')[0]
  }
  
  return null
}
