/**
 * Azure Speech Service - Real transcription using Azure Cognitive Services
 * Converts audio to WAV format for reliable transcription
 */

import { convertToWav } from '../utils/audioConverter'

const SPEECH_KEY = import.meta.env.VITE_AZURE_SPEECH_KEY
const SPEECH_REGION = import.meta.env.VITE_AZURE_SPEECH_REGION

/**
 * Transcribe audio blob using Azure Speech Service REST API
 */
export const transcribeWithAzureSpeech = async (audioBlob) => {
  if (!SPEECH_KEY || !SPEECH_REGION) {
    console.warn('Azure Speech credentials not configured')
    return null
  }

  console.log('Transcribing audio with Azure Speech...')
  console.log('Original audio - type:', audioBlob.type, 'size:', audioBlob.size)

  try {
    // Convert to WAV format (16kHz mono) which Azure Speech handles perfectly
    let wavBlob
    try {
      wavBlob = await convertToWav(audioBlob)
      console.log('Converted to WAV - size:', wavBlob.size)
    } catch (conversionError) {
      console.error('Audio conversion failed:', conversionError)
      // Try with original format as fallback
      wavBlob = audioBlob
    }
    
    // Azure Speech REST API for speech-to-text
    const url = `https://${SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-AU&format=detailed`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': SPEECH_KEY,
        'Content-Type': wavBlob.type === 'audio/wav' ? 'audio/wav; codecs=audio/pcm; samplerate=16000' : 'audio/wav',
        'Accept': 'application/json'
      },
      body: wavBlob
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Azure Speech API error:', response.status, errorText)
      return null
    }

    const result = await response.json()
    console.log('Azure Speech result:', JSON.stringify(result, null, 2))

    if (result.RecognitionStatus === 'Success') {
      const displayText = result.DisplayText || ''
      const nBestText = result.NBest?.[0]?.Display || result.NBest?.[0]?.Lexical || ''
      const finalText = displayText || nBestText
      
      console.log('Transcription:', finalText)
      
      return {
        text: finalText,
        confidence: result.NBest?.[0]?.Confidence || 0,
        words: result.NBest?.[0]?.Words || []
      }
    } else if (result.RecognitionStatus === 'NoMatch') {
      console.log('No speech detected in audio')
      return { text: '', confidence: 0, words: [] }
    } else if (result.RecognitionStatus === 'InitialSilenceTimeout') {
      console.log('Audio was silent or too short')
      return { text: '', confidence: 0, words: [] }
    } else {
      console.log('Recognition status:', result.RecognitionStatus)
      return { text: '', confidence: 0, words: [] }
    }
  } catch (error) {
    console.error('Error transcribing with Azure Speech:', error)
    return null
  }
}

/**
 * Check if Azure Speech is configured
 */
export const isAzureSpeechConfigured = () => {
  return Boolean(SPEECH_KEY && SPEECH_REGION)
}
