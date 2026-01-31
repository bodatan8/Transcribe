/**
 * Audio format conversion utilities
 * Converts browser audio to formats Azure Speech supports
 */

/**
 * Convert audio blob to WAV format
 * Azure Speech works best with 16kHz mono WAV
 */
export async function convertToWav(audioBlob, targetSampleRate = 16000) {
  console.log('Converting audio to WAV format...')
  
  // Create audio context
  const audioContext = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: targetSampleRate
  })
  
  try {
    // Decode the audio blob
    const arrayBuffer = await audioBlob.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    
    console.log('Original audio:', {
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      duration: audioBuffer.duration
    })
    
    // Resample if needed
    let resampled = audioBuffer
    if (audioBuffer.sampleRate !== targetSampleRate) {
      resampled = await resampleAudio(audioContext, audioBuffer, targetSampleRate)
    }
    
    // Convert to mono if stereo
    const monoData = resampled.numberOfChannels > 1 
      ? mixToMono(resampled) 
      : resampled.getChannelData(0)
    
    // Create WAV blob
    const wavBlob = encodeWav(monoData, targetSampleRate)
    
    console.log('Converted to WAV:', {
      sampleRate: targetSampleRate,
      channels: 1,
      size: wavBlob.size
    })
    
    return wavBlob
  } finally {
    await audioContext.close()
  }
}

/**
 * Resample audio to target sample rate
 */
async function resampleAudio(audioContext, audioBuffer, targetSampleRate) {
  const offlineContext = new OfflineAudioContext(
    1, // mono
    Math.ceil(audioBuffer.duration * targetSampleRate),
    targetSampleRate
  )
  
  const source = offlineContext.createBufferSource()
  source.buffer = audioBuffer
  source.connect(offlineContext.destination)
  source.start(0)
  
  return await offlineContext.startRendering()
}

/**
 * Mix stereo channels to mono
 */
function mixToMono(audioBuffer) {
  const left = audioBuffer.getChannelData(0)
  const right = audioBuffer.getChannelData(1)
  const mono = new Float32Array(left.length)
  
  for (let i = 0; i < left.length; i++) {
    mono[i] = (left[i] + right[i]) / 2
  }
  
  return mono
}

/**
 * Encode audio data as WAV
 */
function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  
  // WAV header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeString(view, 36, 'data')
  view.setUint32(40, samples.length * 2, true)
  
  // Audio data
  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
  }
  
  return new Blob([buffer], { type: 'audio/wav' })
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}
