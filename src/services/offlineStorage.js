/**
 * Offline Storage Service using IndexedDB
 * Stores recordings locally when offline, syncs when online
 */

const DB_NAME = 'spratt-recordings'
const DB_VERSION = 1
const STORE_NAME = 'pendingRecordings'

let db = null

/**
 * Initialize IndexedDB
 */
const initDB = () => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = event.target.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: false })
        objectStore.createIndex('timestamp', 'timestamp', { unique: false })
        objectStore.createIndex('status', 'status', { unique: false })
      }
    }
  })
}

/**
 * Save recording locally
 */
export const saveRecordingLocally = async (audioBlob, userId, metadata = {}) => {
  try {
    const database = await initDB()
    const recordingId = `local_${Date.now()}_${Math.random().toString(36).substring(7)}`
    
    // Convert blob to ArrayBuffer for storage
    const arrayBuffer = await audioBlob.arrayBuffer()
    
    const recording = {
      id: recordingId,
      userId,
      audioData: arrayBuffer,
      mimeType: audioBlob.type || 'audio/webm',
      timestamp: Date.now(),
      status: 'pending', // pending, uploading, uploaded, failed
      metadata,
      retryCount: 0,
    }

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(recording)
      
      request.onsuccess = () => {
        console.log('Recording saved locally:', recordingId)
        resolve(recordingId)
      }
      request.onerror = () => {
        console.error('Error saving recording:', request.error)
        reject(request.error)
      }
    })
  } catch (error) {
    console.error('Error saving recording locally:', error)
    throw error
  }
}

/**
 * Get all pending recordings
 */
export const getPendingRecordings = async () => {
  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('status')
    
    return new Promise((resolve, reject) => {
      const request = index.getAll('pending')
      request.onsuccess = () => {
        // Convert ArrayBuffer back to Blob
        const recordings = request.result.map(rec => ({
          ...rec,
          audioBlob: new Blob([rec.audioData], { type: rec.mimeType })
        }))
        resolve(recordings)
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error getting pending recordings:', error)
    return []
  }
}

/**
 * Get all recordings (for UI display)
 */
export const getAllLocalRecordings = async () => {
  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    
    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => {
        const recordings = request.result.map(rec => ({
          ...rec,
          audioBlob: new Blob([rec.audioData], { type: rec.mimeType })
        }))
        resolve(recordings)
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error getting all recordings:', error)
    return []
  }
}

/**
 * Update recording status
 */
export const updateRecordingStatus = async (recordingId, status, error = null) => {
  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    const getRequest = store.get(recordingId)
    
    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
        const recording = getRequest.result
        if (!recording) {
          reject(new Error('Recording not found'))
          return
        }

        recording.status = status
        if (error) {
          recording.error = error.message
          recording.retryCount = (recording.retryCount || 0) + 1
        }

        const putRequest = store.put(recording)
        putRequest.onsuccess = () => resolve(recording)
        putRequest.onerror = () => reject(putRequest.error)
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  } catch (error) {
    console.error('Error updating recording status:', error)
    throw error
  }
}

/**
 * Delete recording from local storage
 */
export const deleteLocalRecording = async (recordingId) => {
  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    return new Promise((resolve, reject) => {
      const request = store.delete(recordingId)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error deleting local recording:', error)
    throw error
  }
}

/**
 * Get storage usage info
 */
export const getStorageInfo = async () => {
  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    
    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => {
        const recordings = request.result
        const totalSize = recordings.reduce((sum, rec) => sum + (rec.audioData?.byteLength || 0), 0)
        const pendingCount = recordings.filter(r => r.status === 'pending').length
        
        resolve({
          totalRecordings: recordings.length,
          pendingCount,
          totalSize,
          totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
        })
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error getting storage info:', error)
    return { totalRecordings: 0, pendingCount: 0, totalSize: 0, totalSizeMB: '0.00' }
  }
}
