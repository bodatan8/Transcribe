/**
 * Azure Speech Service - Fast Transcription API
 * Uses GPU-accelerated Fast Transcription API - accepts WebM directly, no conversion needed!
 */

const SPEECH_KEY = import.meta.env.VITE_AZURE_SPEECH_KEY
const SPEECH_REGION = import.meta.env.VITE_AZURE_SPEECH_REGION

/**
 * Transcribe audio blob using Azure Fast Transcription API
 * Accepts WebM directly - no WAV conversion needed!
 */
export const transcribeWithAzureSpeech = async (audioBlob) => {
  if (!SPEECH_KEY || !SPEECH_REGION) {
    console.warn('Azure Speech credentials not configured')
    return null
  }

  console.log('Transcribing with Azure Fast Transcription API (no conversion)...')
  console.log('Audio - type:', audioBlob.type, 'size:', audioBlob.size)

  try {
    // Fast Transcription API endpoint - accepts WebM, MP3, WAV, OGG, etc.
    // Supported regions: eastus, westeurope, southeastasia, centralindia
    const url = `https://${SPEECH_REGION}.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=2025-10-15`
    
    // Create multipart form data
    const formData = new FormData()
    formData.append('audio', audioBlob, 'recording.webm')
    formData.append('definition', JSON.stringify({
      locales: ['en-AU', 'en-US'] // Support Australian and US English
    }))
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': SPEECH_KEY,
        'Accept': 'application/json'
      },
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Azure Fast Transcription API error:', response.status, errorText)
      
      // Fallback to old API if Fast Transcription not available in region
      if (response.status === 404 || response.status === 400) {
        console.log('Fast Transcription not available, falling back to standard API...')
        return await transcribeWithStandardAPI(audioBlob)
      }
      return null
    }

    const result = await response.json()
    console.log('Azure Fast Transcription result:', JSON.stringify(result, null, 2))

    // Fast Transcription API returns combinedPhrases with full text
    if (result.combinedPhrases && result.combinedPhrases.length > 0) {
      const fullText = result.combinedPhrases[0].text || ''
      const confidence = result.phrases?.[0]?.confidence || 0.9
      
      console.log('Transcription:', fullText)
      
      return {
        text: fullText,
        confidence: confidence,
        words: result.phrases?.flatMap(p => p.words || []) || []
      }
    } else if (result.phrases && result.phrases.length > 0) {
      // Fallback to phrases if combinedPhrases not available
      const fullText = result.phrases.map(p => p.text).join(' ')
      
      return {
        text: fullText,
        confidence: result.phrases[0]?.confidence || 0.9,
        words: result.phrases.flatMap(p => p.words || [])
      }
    } else {
      console.log('No speech detected in audio')
      return { text: '', confidence: 0, words: [] }
    }
  } catch (error) {
    console.error('Error transcribing with Azure Fast Transcription:', error)
    return null
  }
}

/**
 * Fallback to standard REST API (requires WAV conversion)
 * Only used if Fast Transcription API is not available in the region
 */
async function transcribeWithStandardAPI(audioBlob) {
  const { convertToWav } = await import('../utils/audioConverter')
  
  console.log('Converting to WAV for standard API...')
  let wavBlob
  try {
    wavBlob = await convertToWav(audioBlob)
  } catch {
    console.error('WAV conversion failed')
    return null
  }
  
  const url = `https://${SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-AU&format=detailed`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': SPEECH_KEY,
      'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
      'Accept': 'application/json'
    },
    body: wavBlob
  })

  if (!response.ok) {
    console.error('Standard API error:', response.status)
    return null
  }

  const result = await response.json()
  
  if (result.RecognitionStatus === 'Success') {
    return {
      text: result.DisplayText || result.NBest?.[0]?.Display || '',
      confidence: result.NBest?.[0]?.Confidence || 0,
      words: result.NBest?.[0]?.Words || []
    }
  }
  
  return { text: '', confidence: 0, words: [] }
}

/**
 * Check if Azure Speech is configured
 */
export const isAzureSpeechConfigured = () => {
  return Boolean(SPEECH_KEY && SPEECH_REGION)
}
