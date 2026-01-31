import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { saveRecordingLocally } from '../services/offlineStorage'
import { syncPendingRecordings, isOnline, addSyncListener } from '../services/syncService'
import { Waveform } from './Waveform'
import toast from 'react-hot-toast'

/**
 * Audio Recorder with prominent waveform
 */
export const AudioRecorder = memo(({ triggerRecord }) => {
  const { user } = useAuth()
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isOnlineStatus, setIsOnlineStatus] = useState(isOnline())
  const [pendingUploads, setPendingUploads] = useState(0)
  const [analyserNode, setAnalyserNode] = useState(null)
  
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerRef = useRef(null)
  const streamRef = useRef(null)
  const audioContextRef = useRef(null)

  useEffect(() => {
    if (triggerRecord && !isRecording && !isProcessing) {
      startRecording()
    }
  }, [triggerRecord])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnlineStatus(true)
      syncPendingRecordings()
    }
    const handleOffline = () => setIsOnlineStatus(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const removeListener = addSyncListener((status) => {
      setPendingUploads(status.pendingCount || 0)
    })

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      removeListener()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      
      if (e.key === 'r' && !isRecording && !isProcessing) {
        e.preventDefault()
        startRecording()
      }
      if ((e.key === 's' || e.key === 'Escape') && isRecording) {
        e.preventDefault()
        stopRecording()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isRecording, isProcessing])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 128
      source.connect(analyser)
      setAnalyserNode(analyser)

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setIsProcessing(true)
        
        try {
          await saveRecordingLocally(audioBlob, user.id, {
            duration: recordingTime,
            timestamp: new Date().toISOString()
          })
          
          if (isOnline()) {
            try {
              await syncPendingRecordings()
              toast.success('Recording saved')
            } catch {
              toast.success('Saved offline')
            }
          } else {
            toast.success('Saved offline')
          }
          
          audioChunksRef.current = []
          setRecordingTime(0)
        } catch (error) {
          console.error('Error:', error)
          toast.error('Error saving')
        } finally {
          setIsProcessing(false)
          setAnalyserNode(null)
          audioContextRef.current?.close()
          audioContextRef.current = null
          streamRef.current?.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (error) {
      console.error('Error:', error)
      toast.error(error.name === 'NotAllowedError' ? 'Microphone access denied' : 'Microphone error')
    }
  }, [user, recordingTime])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isRecording])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="card p-6 lg:p-8">
      <div className="flex flex-col items-center">
        {/* Timer */}
        <div className={`text-5xl font-light tracking-tight tabular-nums mb-4 ${isRecording ? 'text-red-500' : 'text-slate-200'}`}>
          {formatTime(recordingTime)}
        </div>

        {/* Waveform - Full width, prominent */}
        <div className="w-full h-20 mb-6 px-4">
          <Waveform 
            isRecording={isRecording}
            analyserNode={analyserNode}
            barCount={60}
          />
        </div>

        {/* Record button */}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className={`
            w-20 h-20 rounded-full flex items-center justify-center
            transition-transform duration-100
            ${isProcessing ? 'opacity-50' : 'hover:scale-105 active:scale-95'}
            ${isRecording ? 'bg-red-500 recording-pulse' : 'bg-spratt-blue'}
          `}
        >
          {isProcessing ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : isRecording ? (
            <div className="w-6 h-6 bg-white rounded-sm" />
          ) : (
            <div className="w-6 h-6 bg-white rounded-full" />
          )}
        </button>

        {/* Status */}
        <p className={`mt-4 text-sm font-medium ${isRecording ? 'text-red-500' : 'text-slate-400'}`}>
          {isProcessing ? 'Saving...' : isRecording ? 'Recording' : 'Tap to record'}
        </p>
        
        {!isRecording && !isProcessing && (
          <p className="text-xs text-slate-400 mt-1">
            or press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-medium">R</kbd>
          </p>
        )}
        {isRecording && (
          <p className="text-xs text-slate-400 mt-1">
            press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-medium">S</kbd> to stop
          </p>
        )}

        {/* Connection status */}
        <div className="mt-5 flex items-center gap-3 text-xs">
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${isOnlineStatus ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOnlineStatus ? 'bg-green-500' : 'bg-amber-500'}`} />
            {isOnlineStatus ? 'Online' : 'Offline'}
          </span>
          
          {pendingUploads > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">
              {pendingUploads} pending
            </span>
          )}
        </div>
      </div>
    </div>
  )
})

AudioRecorder.displayName = 'AudioRecorder'
