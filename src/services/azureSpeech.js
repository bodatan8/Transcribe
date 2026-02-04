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
      locales: ['en-AU', 'en-US'], // Support Australian and US English
      diarization: {
        enabled: true,
        maxSpeakers: 4 // Support up to 4 speakers in the conversation
      }
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

    // Fast Transcription API returns phrases with timestamps and speaker info
    if (result.phrases && result.phrases.length > 0) {
      const hasSpeakers = result.phrases.some(p => p.speaker !== undefined)
      
      // Build timestamped segments for citations
      const segments = result.phrases.map(phrase => ({
        text: phrase.text,
        startMs: phrase.offsetMilliseconds || 0,
        endMs: (phrase.offsetMilliseconds || 0) + (phrase.durationMilliseconds || 0),
        speaker: phrase.speaker !== undefined ? phrase.speaker + 1 : null,
        timestamp: formatTimestamp(phrase.offsetMilliseconds || 0)
      }))
      
      // Build formatted text with speaker labels
      let formattedText = ''
      if (hasSpeakers) {
        let currentSpeaker = null
        const textParts = []
        
        for (const seg of segments) {
          const speaker = seg.speaker ? `Speaker ${seg.speaker}` : null
          
          if (speaker && speaker !== currentSpeaker) {
            currentSpeaker = speaker
            textParts.push(`\n\n**${speaker}:** ${seg.text}`)
          } else {
            textParts.push(seg.text)
          }
        }
        
        formattedText = textParts.join(' ').trim()
      } else {
        formattedText = result.combinedPhrases?.[0]?.text || segments.map(s => s.text).join(' ')
      }
      
      console.log('Transcription with timestamps:', formattedText)
      
      return {
        text: formattedText,
        confidence: result.phrases[0]?.confidence || 0.9,
        words: result.phrases.flatMap(p => p.words || []),
        segments: segments, // Timestamped segments for citations
        hasSpeakers: hasSpeakers,
        speakerCount: hasSpeakers ? new Set(result.phrases.map(p => p.speaker)).size : 1
      }
    } else if (result.combinedPhrases && result.combinedPhrases.length > 0) {
      const fullText = result.combinedPhrases[0].text || ''
      
      return {
        text: fullText,
        confidence: 0.9,
        words: [],
        segments: [{ text: fullText, startMs: 0, endMs: 0, timestamp: '0:00' }],
        hasSpeakers: false,
        speakerCount: 1
      }
    } else {
      console.log('No speech detected in audio')
      return { text: '', confidence: 0, words: [], segments: [], hasSpeakers: false, speakerCount: 0 }
    }
  } catch (error) {
    console.error('Error transcribing with Azure Fast Transcription:', error)
    return null
  }
}

/**
 * Format milliseconds to MM:SS timestamp
 */
function formatTimestamp(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
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
