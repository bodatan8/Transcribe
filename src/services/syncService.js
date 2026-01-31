/**
 * Sync Service - Handles uploading pending recordings when online
 */

import { supabase } from '../lib/supabase'
import { 
  getPendingRecordings, 
  updateRecordingStatus, 
  deleteLocalRecording 
} from './offlineStorage'
import { processTranscription } from './transcription'

// Re-export for backward compatibility
export { processTranscription }

let isSyncing = false
let syncListeners = []
let syncTimeout = null

// Reset sync lock after 30 seconds to prevent permanent lock
const resetSyncLock = () => {
  if (syncTimeout) clearTimeout(syncTimeout)
  syncTimeout = setTimeout(() => {
    if (isSyncing) {
      console.log('Resetting stuck sync lock')
      isSyncing = false
    }
  }, 30000)
}

/**
 * Check if online
 */
export const isOnline = () => {
  return navigator.onLine
}

/**
 * Add sync status listener
 */
export const addSyncListener = (callback) => {
  syncListeners.push(callback)
  return () => {
    syncListeners = syncListeners.filter(cb => cb !== callback)
  }
}

/**
 * Notify listeners of sync status
 */
const notifyListeners = (status) => {
  syncListeners.forEach(cb => cb(status))
}

/**
 * Upload a single recording
 */
const uploadRecording = async (recording) => {
  console.log('Uploading recording:', recording.id)
  
  try {
    // Update status to uploading
    await updateRecordingStatus(recording.id, 'uploading')

    // Generate unique filename
    const filename = `${recording.userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.webm`
    
    console.log('Uploading to storage:', filename)
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(filename, recording.audioBlob, {
        contentType: recording.mimeType,
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      throw uploadError
    }
    
    console.log('Storage upload success:', uploadData)

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('recordings')
      .getPublicUrl(filename)

    console.log('Public URL:', publicUrl)

    // Create recording record
    const { data: dbRecording, error: recordingError } = await supabase
      .from('recordings')
      .insert({
        user_id: recording.userId,
        audio_url: publicUrl,
        transcription_status: 'processing',
      })
      .select()
      .single()

    if (recordingError) {
      console.error('Database insert error:', recordingError)
      throw recordingError
    }
    
    console.log('Database record created:', dbRecording.id)

    // Trigger transcription
    setTimeout(async () => {
      try {
        await processTranscription(dbRecording.id, recording.audioBlob)
      } catch (err) {
        console.error('Transcription error:', err)
      }
    }, 1000)

    // Mark as uploaded and delete from local storage
    await updateRecordingStatus(recording.id, 'uploaded')
    await deleteLocalRecording(recording.id)
    
    console.log('Recording uploaded successfully:', dbRecording.id)

    // Trigger UI refresh
    window.dispatchEvent(new CustomEvent('recordings-updated'))
    window.dispatchEvent(new CustomEvent('actions-updated'))

    return { success: true, recordingId: dbRecording.id }
  } catch (error) {
    console.error('Error uploading recording:', error)
    
    // Mark as failed (will retry later)
    try {
      await updateRecordingStatus(recording.id, 'failed', error)
    } catch (updateErr) {
      console.error('Error updating status to failed:', updateErr)
    }
    
    // Don't delete - keep for retry
    throw error
  }
}

/**
 * Sync all pending recordings
 */
export const syncPendingRecordings = async () => {
  if (!isOnline()) {
    console.log('Offline - skipping sync')
    notifyListeners({ status: 'offline', pendingCount: 0 })
    return { synced: 0, failed: 0 }
  }

  if (isSyncing) {
    console.log('Sync already in progress - skipping')
    return { synced: 0, failed: 0 }
  }

  console.log('Starting sync...')
  isSyncing = true
  resetSyncLock()
  notifyListeners({ status: 'syncing', pendingCount: 0 })

  try {
    const pending = await getPendingRecordings()
    
    if (pending.length === 0) {
      isSyncing = false
      notifyListeners({ status: 'idle', pendingCount: 0 })
      return { synced: 0, failed: 0 }
    }

    notifyListeners({ status: 'syncing', pendingCount: pending.length })

    let synced = 0
    let failed = 0

    // Upload recordings one at a time to avoid overwhelming the server
    for (const recording of pending) {
      try {
        // Skip if retry count is too high (max 3 retries)
        if (recording.retryCount >= 3) {
          console.log(`Skipping recording ${recording.id} - too many retries`)
          failed++
          continue
        }

        await uploadRecording(recording)
        synced++
        
        // Update pending count
        const remaining = await getPendingRecordings()
        notifyListeners({ status: 'syncing', pendingCount: remaining.length })
      } catch (error) {
        console.error(`Failed to upload recording ${recording.id}:`, error)
        failed++
      }
    }

    isSyncing = false
    
    const remaining = await getPendingRecordings()
    notifyListeners({ 
      status: remaining.length > 0 ? 'pending' : 'idle', 
      pendingCount: remaining.length 
    })

    return { synced, failed }
  } catch (error) {
    console.error('Error syncing recordings:', error)
    isSyncing = false
    notifyListeners({ status: 'error', pendingCount: 0 })
    throw error
  }
}

/**
 * Initialize sync service - set up online/offline listeners
 */
export const initSyncService = () => {
  // Sync when coming online
  window.addEventListener('online', () => {
    console.log('Online - starting sync')
    syncPendingRecordings()
  })

  // Try to sync immediately if online
  if (isOnline()) {
    syncPendingRecordings()
  }

  // Auto-sync every 30 seconds when online
  setInterval(() => {
    if (isOnline() && !isSyncing) {
      syncPendingRecordings()
    }
  }, 30000)
}
