import { supabase } from '../lib/supabase'
import { transcribeWithAzureSpeech, isAzureSpeechConfigured } from './azureSpeech'

/**
 * Upload audio file to Supabase Storage and trigger transcription
 */
export const uploadAndTranscribe = async (audioBlob, userId) => {
  try {
    // Generate unique filename
    const filename = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.webm`
    
    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(filename, audioBlob, {
        contentType: 'audio/webm',
        upsert: false,
      })

    if (uploadError) throw uploadError

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('recordings')
      .getPublicUrl(filename)

    // Create recording record
    const { data: recording, error: recordingError } = await supabase
      .from('recordings')
      .insert({
        user_id: userId,
        audio_url: publicUrl,
        transcription_status: 'processing',
      })
      .select()
      .single()

    if (recordingError) throw recordingError

    // Trigger transcription (in a real app, this would call an API or Edge Function)
    // For now, we'll simulate it with a timeout
    setTimeout(async () => {
      await processTranscription(recording.id, audioBlob)
    }, 1000)

    return recording
  } catch (error) {
    console.error('Error uploading and transcribing:', error)
    throw error
  }
}

/**
 * Process transcription using Azure Speech with WAV conversion
 */
export const processTranscription = async (recordingId, audioBlob) => {
  try {
    let transcriptText = ''
    let segments = []
    
    if (isAzureSpeechConfigured()) {
      console.log('Using Azure Speech for transcription...')
      const result = await transcribeWithAzureSpeech(audioBlob)
      
      if (result && result.text) {
        transcriptText = result.text
        segments = result.segments || []
        console.log('Transcription successful:', transcriptText)
        console.log('Segments with timestamps:', segments.length)
      } else {
        console.log('No speech detected in audio')
        transcriptText = '[No speech detected - try speaking more clearly]'
      }
    } else {
      console.warn('Azure Speech not configured')
      transcriptText = '[Transcription not available - Azure Speech not configured]'
    }
    
    // Update recording with transcription and timestamped segments
    const { error } = await supabase
      .from('recordings')
      .update({
        transcription: transcriptText,
        transcription_status: 'completed',
        metadata: { segments } // Store timestamped segments for citations
      })
      .eq('id', recordingId)

    if (error) throw error
    
    // Dispatch event to notify UI of transcription update
    window.dispatchEvent(new CustomEvent('recordings-updated'))

    // Extract actions if we have real speech
    if (transcriptText && !transcriptText.startsWith('[')) {
      await extractActions(recordingId, transcriptText)
    }
  } catch (error) {
    console.error('Error processing transcription:', error)
    await supabase
      .from('recordings')
      .update({ transcription_status: 'failed' })
      .eq('id', recordingId)
  }
}

/**
 * Extract actions from transcription using pattern matching
 * In production, this would call OpenAI GPT-4 or similar for better extraction
 */
const extractActions = async (recordingId, transcript) => {
  try {
    // Get recording to find user_id
    const { data: recording, error: recError } = await supabase
      .from('recordings')
      .select('user_id')
      .eq('id', recordingId)
      .single()

    if (recError) throw recError

    // Import action extraction function
    const { extractActionsFromTranscript } = await import('./actionExtraction')
    
    // Extract actions from the actual transcript
    const extractedActions = await extractActionsFromTranscript(transcript)

    if (extractedActions.length === 0) {
      console.log('No actions extracted from transcript')
      return
    }

    // Insert actions into database
    const actionsToInsert = extractedActions.map(action => ({
      recording_id: recordingId,
      user_id: recording.user_id,
      ...action,
      status: 'pending',
    }))

    const { error: actionsError } = await supabase
      .from('actions')
      .insert(actionsToInsert)

    if (actionsError) throw actionsError
    
    console.log(`Successfully extracted ${extractedActions.length} actions from transcript`)
    
    // Dispatch event to notify UI components to refresh
    window.dispatchEvent(new CustomEvent('actions-updated'))
    window.dispatchEvent(new CustomEvent('recordings-updated'))
  } catch (error) {
    console.error('Error extracting actions:', error)
  }
}

