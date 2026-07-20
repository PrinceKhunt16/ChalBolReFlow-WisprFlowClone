import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { DictationState, DictationActivity, AppSettings } from '../types'
import { resolveBackendBaseUrl } from '@/lib/backend'

interface StateContextType {
  dictationState: DictationState;
  dictations: DictationActivity[];
  lastCompletedDictation: DictationActivity | null;
  settings: AppSettings;
  activePage: string;
  setPage: (page: string) => void;
  timer: number;
  currentTranscript: string;
  micError: string | null;
  isPaused: boolean;
  setIsPaused: (val: boolean) => void;
  startListening: () => void;
  stopListening: () => void;
  cancelListening: () => void;
  toggleFavoriteDictation: (id: string) => void;
  deleteDictation: (id: string) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  stats: {
    todaysDictations: number;
    wordsTyped: number;
    timeSavedMinutes: number;
    accuracy: number;
  };
}

const StateContext = createContext<StateContextType | undefined>(undefined)

const MASKED_API_KEY = '••••••••••••••••••••••••••••••••'
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b'
const GROQ_MODEL_OPTIONS = [
  'openai/gpt-oss-120b',
  'qwen/qwen3.6-27b',
  'openai/gpt-oss-20b'
]

type BackendDictation = {
  id: string
  text: string
  durationSeconds: number
  wordsCount: number
  appName: DictationActivity['appName']
  timestamp: string
  isFavorite: boolean
}

type BackendSettings = AppSettings

const normalizeSettings = (incoming?: Partial<AppSettings> | null): AppSettings => {
  const next = { ...DEFAULT_SETTINGS, ...(incoming || {}) }
  next.aiProvider = 'Groq'
  next.model = GROQ_MODEL_OPTIONS.includes(next.model) ? next.model : DEFAULT_GROQ_MODEL
  next.apiKey = next.apiKey === MASKED_API_KEY ? '' : next.apiKey
  return next
}

const mapBackendDictation = (item: BackendDictation): DictationActivity => ({
  id: item.id,
  text: item.text,
  durationSeconds: item.durationSeconds,
  wordsCount: item.wordsCount,
  appName: item.appName,
  timestamp: item.timestamp,
  isFavorite: item.isFavorite,
})

const DEFAULT_SETTINGS: AppSettings = {
  launchAtStartup: true,
  minimizeToTray: true,
  notifications: true,
  language: 'English',
  aiProvider: 'Groq',
  apiKey: '',
  model: DEFAULT_GROQ_MODEL,
  temperature: 0.2,
  version: '1.0.0'
}

export const StateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Detect if this React instance is running in the floating route
  const isFloatingRoute =
    window.location.hash.includes('floating') ||
    window.location.hash.includes('#/floating') ||
    window.location.pathname.includes('/floating')

  const [dictationState, setDictationState] = useState<DictationState>('idle')
  const [dictations, setDictations] = useState<DictationActivity[]>([])
  const [lastCompletedDictation, setLastCompletedDictation] = useState<DictationActivity | null>(null)
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('cbr_settings')
    const parsed = saved ? JSON.parse(saved) : DEFAULT_SETTINGS
    return normalizeSettings(parsed)
  })
  const [activePage, setActivePage] = useState<string>('home')
  const [timer, setTimer] = useState<number>(0)
  const [currentTranscript, setCurrentTranscript] = useState<string>('')
  const [micError, setMicError] = useState<string | null>(null)
  const [isPaused, setIsPaused] = useState<boolean>(false)

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const transcriptIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const selectedTemplateRef = useRef<{ text: string; app: string } | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<BlobPart[]>([])
  const isUsingRealAudioRef = useRef(false)

  // References to keep callbacks inside Electron listeners from getting stale closure values
  const dictationStateRef = useRef(dictationState)
  const currentTranscriptRef = useRef(currentTranscript)
  const timerRef = useRef(timer)
  const settingsRef = useRef(settings)
  const isPausedRef = useRef(isPaused)

  useEffect(() => { dictationStateRef.current = dictationState }, [dictationState])
  useEffect(() => { currentTranscriptRef.current = currentTranscript }, [currentTranscript])
  useEffect(() => { timerRef.current = timer }, [timer])
  useEffect(() => { settingsRef.current = settings }, [settings])
  useEffect(() => { isPausedRef.current = isPaused }, [isPaused])

  const logFlow = (step: string, details?: Record<string, unknown>) => {
    const prefix = isFloatingRoute ? '[dictation:floating]' : '[dictation:main]'
    if (details) {
      console.log(`${prefix} ${step} ${JSON.stringify(details)}`)
    } else {
      console.log(`${prefix} ${step}`)
    }
  }

  useEffect(() => {
    let cancelled = false

    const loadInitialState = async () => {
      try {
        logFlow('loadInitialState:start')
        const backendBaseUrl = await resolveBackendBaseUrl()
        logFlow('loadInitialState:backend-url', { backendBaseUrl })

        if (cancelled) return

        const [settingsResponse, historyResponse] = await Promise.all([
          fetch(`${backendBaseUrl}/api/v1/settings`),
          fetch(`${backendBaseUrl}/api/v1/history`),
        ])
        logFlow('loadInitialState:responses', {
          settingsStatus: settingsResponse.status,
          historyStatus: historyResponse.status,
        })

        if (cancelled) return

        if (settingsResponse.ok) {
          const backendSettings = (await settingsResponse.json()) as BackendSettings
          logFlow('loadInitialState:settings-loaded', {
            provider: backendSettings.aiProvider,
            model: backendSettings.model,
            hasApiKey: Boolean(backendSettings.apiKey),
          })
          setSettings(normalizeSettings(backendSettings))
        }

        if (historyResponse.ok) {
          const historyItems = (await historyResponse.json()) as BackendDictation[]
          logFlow('loadInitialState:history-loaded', { count: historyItems.length })
          setDictations(historyItems.map(mapBackendDictation))
        }
      } catch (error) {
        console.warn('Failed to load backend state, using local defaults.', error)
      }
    }

    void loadInitialState()

    return () => {
      cancelled = true
    }
  }, [])

  const stopAudioTracks = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null
    mediaRecorderRef.current = null
  }

  const getAudioMimeType = () => {
    if (typeof MediaRecorder === 'undefined') return ''
    const preferredTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus'
    ]
    return preferredTypes.find((type) => MediaRecorder.isTypeSupported(type)) || ''
  }

  const startAudioCapture = async () => {
    logFlow('startAudioCapture:called')

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      const reason = 'getUserMedia/MediaRecorder is not available in this window (insecure context or unsupported).'
      console.error(`[audio-capture] Real transcription disabled: ${reason}`)
      isUsingRealAudioRef.current = false
      setMicError(reason)
      return
    }

    isUsingRealAudioRef.current = true

    try {
      logFlow('startAudioCapture:mic-debug-start')

      logFlow('startAudioCapture:secure-context', { isSecureContext: window.isSecureContext })

      logFlow('startAudioCapture:media-devices-present', { hasMediaDevices: Boolean(navigator.mediaDevices) })

      try {
        const permission = await navigator.permissions.query({
          name: "microphone" as PermissionName,
        });

        logFlow('startAudioCapture:permission-state', { state: permission.state })
      } catch (err) {
        console.error('[audio-capture] Permission API Error:', err);
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        logFlow('startAudioCapture:devices', {
          devices: devices.map((device) => ({
            kind: device.kind,
            label: device.label,
            deviceId: device.deviceId ? '[present]' : '',
          })),
        })
      } catch (err) {
        console.error('[audio-capture] Enumerate Devices Error:', err);
      }

      let stream: MediaStream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

        logFlow('startAudioCapture:stream-created', { trackCount: stream.getTracks().length })

        stream.getTracks().forEach((track) => {
          logFlow('startAudioCapture:track', {
            label: track.label,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
          })
        });

      } catch (err) {
        console.error("❌ getUserMedia Error:", err);
        setMicError(String(err));
        
        return;
      }

      const mimeType = getAudioMimeType();
      logFlow('startAudioCapture:mime-type', { mimeType: mimeType || 'browser-default' })

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );

      audioChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      isUsingRealAudioRef.current = true;

      recorder.ondataavailable = (event) => {
        logFlow('recorder:dataavailable', { size: event.data.size, type: event.data.type })
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onerror = (event) => {
        console.error('[audio-capture] MediaRecorder error:', event)
      }

      recorder.onstart = () => logFlow('recorder:start', { state: recorder.state, mimeType: recorder.mimeType })
      recorder.onpause = () => logFlow('recorder:pause', { state: recorder.state })
      recorder.onresume = () => logFlow('recorder:resume', { state: recorder.state })

      recorder.start()
      setCurrentTranscript('Listening to your microphone...')
    } catch (error) {
      // This is the most common cause of "/api/v1/dictation/transcribe never gets called":
      // getUserMedia rejected (mic permission denied at the OS level, no mic device, or
      // the packaged app is missing NSMicrophoneUsageDescription / the audio-input
      // entitlement on macOS). We fall back to mock dictation, but we now surface *why*
      // instead of failing silently.
      const reason = error instanceof Error ? error.message : String(error)
      console.error('[audio-capture] getUserMedia failed, falling back to mock dictation. Reason:', reason, error)
      isUsingRealAudioRef.current = false
      setMicError(reason)
      setCurrentTranscript('')
    }
  }

  const stopAudioCapture = async () => {
    const recorder = mediaRecorderRef.current
    logFlow('stopAudioCapture:called', {
      hasRecorder: Boolean(recorder),
      recorderState: recorder?.state,
      chunkCount: audioChunksRef.current.length,
    })

    if (!recorder || recorder.state === 'inactive') {
      const mimeType = getAudioMimeType() || 'audio/webm'
      stopAudioTracks()
      const blob = new Blob(audioChunksRef.current, { type: mimeType })
      logFlow('stopAudioCapture:no-active-recorder', { size: blob.size, type: blob.type })
      return blob
    }

    return new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || getAudioMimeType() || 'audio/webm'
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        logFlow('recorder:stop', { size: blob.size, type: blob.type, chunkCount: audioChunksRef.current.length })
        stopAudioTracks()
        resolve(blob)
      }
      recorder.stop()
    })
  }

  const transcribeAudio = async (audioBlob: Blob) => {
    const backendBaseUrl = await resolveBackendBaseUrl()
    const activeSettings = settingsRef.current

    if (!audioBlob.size) {
      throw new Error('No audio was recorded.')
    }

    const formData = new FormData()
    const extension = audioBlob.type.includes('mp4') ? 'm4a' : audioBlob.type.includes('ogg') ? 'ogg' : 'webm'
    const apiKey = activeSettings.apiKey && activeSettings.apiKey !== MASKED_API_KEY ? activeSettings.apiKey : ''

    formData.append('audio', audioBlob, `dictation.${extension}`)
    formData.append('provider', activeSettings.aiProvider)
    formData.append('model', activeSettings.model)
    formData.append('language', activeSettings.language)
    formData.append('temperature', String(activeSettings.temperature))
    if (apiKey) formData.append('api_key', apiKey)

    logFlow('transcribeAudio:request', {
      backendBaseUrl,
      audioSize: audioBlob.size,
      audioType: audioBlob.type,
      provider: activeSettings.aiProvider,
      model: activeSettings.model,
      language: activeSettings.language,
      hasApiKey: Boolean(apiKey),
    })

    const response = await fetch(`${backendBaseUrl}/api/v1/dictation/transcribe`, {
      method: 'POST',
      body: formData,
    })
    logFlow('transcribeAudio:response', { status: response.status, ok: response.ok })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null)
      const message = errorBody?.detail || `Backend returned ${response.status}`
      console.error(`[transcribe] POST ${backendBaseUrl}/api/v1/dictation/transcribe failed:`, message)
      throw new Error(message)
    }

    return response.json() as Promise<{ text: string; raw_text: string }>
  }

  const persistDictation = async (dictation: DictationActivity) => {
    const backendBaseUrl = await resolveBackendBaseUrl()

    const response = await fetch(`${backendBaseUrl}/api/v1/history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dictation),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null)
      throw new Error(errorBody?.detail || `Backend returned ${response.status}`)
    }

    const savedDictation = (await response.json()) as BackendDictation
    const mappedDictation = mapBackendDictation(savedDictation)
    setDictations((prev) => [mappedDictation, ...prev.filter((item) => item.id !== mappedDictation.id)])
    setLastCompletedDictation(mappedDictation)
    return mappedDictation
  }

  const syncSettings = async (nextSettings: AppSettings) => {
    const backendBaseUrl = await resolveBackendBaseUrl()

    const response = await fetch(`${backendBaseUrl}/api/v1/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(nextSettings),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null)
      throw new Error(errorBody?.detail || `Backend returned ${response.status}`)
    }

    const savedSettings = (await response.json()) as BackendSettings
    setSettings(normalizeSettings(savedSettings))
  }

  // Sync settings to localStorage
  useEffect(() => {
    localStorage.setItem('cbr_settings', JSON.stringify(settings))
  }, [settings])

  // Handle Electron-specific global tray and shortcut integrations
  useEffect(() => {
    if (window.electronAPI) {
      const unsubPause = window.electronAPI.onTrayPauseToggle((paused: boolean) => {
        logFlow('ipc:tray-pause-toggle', { paused })
        setIsPaused(paused)
      })

      const unsubNavigate = window.electronAPI.onNavigateTo((page: string) => {
        logFlow('ipc:navigate-to', { page })
        setActivePage(page)
      })

      let unsubShortcutStart = () => { }
      let unsubShortcutStop = () => { }
      let unsubCompleted = () => { }
      let unsubCancelled = () => { }

      if (isFloatingRoute) {
        // Floating window owns the active recorder lifecycle.
        unsubShortcutStart = window.electronAPI.onGlobalShortcutStart(() => {
          logFlow('ipc:global-shortcut-start', { state: dictationStateRef.current })
          if (dictationStateRef.current === 'idle') {
            startListening()
          }
        })

        unsubShortcutStop = window.electronAPI.onGlobalShortcutStop(() => {
          logFlow('ipc:global-shortcut-stop', { state: dictationStateRef.current })
          if (dictationStateRef.current === 'listening') {
            stopListening()
          }
        })

        logFlow('ipc:floating-renderer-ready')
        window.electronAPI.floatingReady()
      } else {
        // Main window mirrors shortcut state; the floating window owns recording.
        unsubShortcutStart = window.electronAPI.onGlobalShortcutStart(() => {
          logFlow('ipc:global-shortcut-start-main')
          setDictationState('listening')
          setLastCompletedDictation(null)
          setCurrentTranscript('Recording in floating widget...')
        })

        // Main window listens to dictation completions sent from the floating window
        unsubCompleted = window.electronAPI.onDictationCompleted((data) => {
          logFlow('ipc:dictation-completed', {
            hasText: Boolean(data.text?.trim()),
            duration: data.duration,
            app: data.app,
          })
          const text = data.text?.trim()
          if (!text) {
            setDictationState('idle')
            return
          }

          const newDictation: DictationActivity = {
            id: Date.now().toString(),
            text,
            durationSeconds: data.duration,
            wordsCount: text.split(/\s+/).filter(Boolean).length,
            appName: data.app as any,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isFavorite: false
          }
          void persistDictation(newDictation).catch((error) => {
            console.error('Failed to persist Electron dictation to SQLite backend.', error)
            setDictations((prev) => [newDictation, ...prev.filter((item) => item.id !== newDictation.id)])
            setLastCompletedDictation(newDictation)
          })
          setCurrentTranscript(text)
          setActivePage('home')
          setDictationState('idle')
        })

        // Main window listens to cancellations
        unsubCancelled = window.electronAPI.onDictationCancelled(() => {
          logFlow('ipc:dictation-cancelled')
          setDictationState('idle')
          setCurrentTranscript('')
        })
      }

      return () => {
        unsubPause()
        unsubNavigate()
        unsubShortcutStart()
        unsubShortcutStop()
        unsubCompleted()
        unsubCancelled()
      }
    }
  }, [isFloatingRoute])

  // Timer effect when listening
  useEffect(() => {
    if (dictationState === 'listening') {
      timerIntervalRef.current = setInterval(() => {
        setTimer((prev) => prev + 1)
      }, 1000)
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      setTimer(0)
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    }
  }, [dictationState])

  // Mock Streaming transcription effect
  useEffect(() => {
    if (dictationState === 'listening') {
      const startStreaming = () => {
        if (isUsingRealAudioRef.current) return
        if (!selectedTemplateRef.current) return
        const fullText = selectedTemplateRef.current.text
        const words = fullText.split(' ')
        let wordIdx = 0

        setCurrentTranscript('')

        transcriptIntervalRef.current = setInterval(() => {
          if (wordIdx < words.length) {
            setCurrentTranscript((prev) => {
              const next = prev ? prev + ' ' + words[wordIdx] : words[wordIdx]
              wordIdx++
              return next
            })
          } else {
            if (transcriptIntervalRef.current) clearInterval(transcriptIntervalRef.current)
          }
        }, 600) // stream a word every 600ms
      }

      // Small delay on mount for floating route, or immediate for main route button click
      if (isFloatingRoute) {
        const timeout = setTimeout(startStreaming, 300)
        return () => clearTimeout(timeout)
      } else {
        startStreaming()
      }
    } else {
      if (transcriptIntervalRef.current) clearInterval(transcriptIntervalRef.current)
    }

    return () => {
      if (transcriptIntervalRef.current) clearInterval(transcriptIntervalRef.current)
    }
  }, [dictationState])

  const startListening = () => {
    logFlow('startListening:called', {
      state: dictationStateRef.current,
      isPaused: isPausedRef.current,
      isElectron: Boolean(window.electronAPI),
      isFloatingRoute,
    })

    if (isPausedRef.current) {
      logFlow('startListening:blocked-paused')
      return
    }

    setDictationState("listening");
    setLastCompletedDictation(null);
    setMicError(null);
    setCurrentTranscript("Requesting microphone access...");

    if (window.electronAPI && !isFloatingRoute) {
      logFlow('startListening:delegating-to-floating-window')
      window.electronAPI.startDictation()
      return
    }

    logFlow('startListening:calling-startAudioCapture')
    void startAudioCapture()
  }

  const stopListening = () => {
    logFlow('stopListening:called', {
      state: dictationStateRef.current,
      isUsingRealAudio: isUsingRealAudioRef.current,
      timer: timerRef.current,
    })
    setDictationState('processing')

    const timerVal = timerRef.current
    const templateVal = selectedTemplateRef.current
    const wasUsingRealAudio = isUsingRealAudioRef.current

    setTimeout(async () => {
      let textVal = currentTranscriptRef.current
      let appVal = templateVal?.app || 'Slack'

      if (wasUsingRealAudio) {
        try {
          const audioBlob = await stopAudioCapture()
          const result = await transcribeAudio(audioBlob)
          textVal = result.text || result.raw_text
          appVal = 'System'
          logFlow('stopListening:transcription-complete', { hasText: Boolean(textVal.trim()) })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error('Real dictation failed.', error)
          setMicError(errorMessage)
          setCurrentTranscript('')
          textVal = ''
          if (isFloatingRoute) {
            setDictationState('idle')
            return
          }
        } finally {
          isUsingRealAudioRef.current = false
        }
      }

      const finalWordCount = textVal.split(/\s+/).filter(Boolean).length

      if (isFloatingRoute) {
        if (window.electronAPI) {
          logFlow('stopListening:sending-dictation-complete', {
            hasText: Boolean(textVal.trim()),
            duration: Math.max(1, timerVal),
            app: appVal,
          })
          window.electronAPI.completeDictation({
            text: textVal,
            duration: Math.max(1, timerVal),
            app: appVal
          })
        }
        setDictationState('idle')
      } else {
        // Main window / Browser mode fallback complete saving
        if (finalWordCount > 0) {
          const newDictation: DictationActivity = {
            id: Date.now().toString(),
            text: textVal,
            durationSeconds: Math.max(1, timerVal),
            wordsCount: finalWordCount,
            appName: appVal as any,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isFavorite: false
          }
          try {
            await persistDictation(newDictation)
          } catch (error) {
            console.error('Failed to persist dictation to SQLite backend.', error)
            setDictations((prev) => [newDictation, ...prev.filter((item) => item.id !== newDictation.id)])
            setLastCompletedDictation(newDictation)
          }
        }

        setDictationState('idle')
        setCurrentTranscript('')

        if (window.electronAPI) {
          logFlow('stopListening:telling-main-process-to-stop')
          window.electronAPI.stopDictation()
        }
      }
    }, 1800)
  }

  const cancelListening = () => {
    logFlow('cancelListening:called')
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    stopAudioTracks()
    audioChunksRef.current = []
    isUsingRealAudioRef.current = false
    setDictationState('idle')
    setCurrentTranscript('')

    if (window.electronAPI) {
      window.electronAPI.cancelDictation()
    }
  }

  const toggleFavoriteDictation = (id: string) => {
    const nextValue = dictations.find((item) => item.id === id)?.isFavorite ? false : true
    setDictations((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isFavorite: !d.isFavorite } : d))
    )
    void (async () => {
      const backendBaseUrl = await resolveBackendBaseUrl()

      await fetch(`${backendBaseUrl}/api/v1/history/${id}/favorite`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isFavorite: nextValue }),
      })
    })().catch((error) => {
      console.error('Failed to update dictation favorite state.', error)
    })
  }

  const deleteDictation = (id: string) => {
    setDictations((prev) => prev.filter((d) => d.id !== id))
    void (async () => {
      const backendBaseUrl = await resolveBackendBaseUrl()

      await fetch(`${backendBaseUrl}/api/v1/history/${id}`, {
        method: 'DELETE',
      })
    })().catch((error) => {
      console.error('Failed to delete dictation from backend.', error)
    })
  }

  const updateSettings = (updated: Partial<AppSettings>) => {
    setSettings((prev) => {
      const nextSettings = normalizeSettings({ ...prev, ...updated })
      void syncSettings(nextSettings).catch((error) => {
        console.error('Failed to persist settings to SQLite backend.', error)
      })
      return nextSettings
    })
  }

  const setPage = (page: string) => {
    setActivePage(page)
  }

  // Statistics calculation
  const stats = React.useMemo(() => {
    const todaysDictations = dictations.filter(d => d.timestamp !== 'Yesterday').length
    const wordsTyped = dictations.reduce((acc, curr) => acc + curr.wordsCount, 0)
    const timeSavedSeconds = dictations.reduce((acc, curr) => acc + (curr.durationSeconds * 2.5), 0)
    const timeSavedMinutes = Math.round(timeSavedSeconds / 60)
    const accuracy = 98.4

    return {
      todaysDictations,
      wordsTyped,
      timeSavedMinutes: Math.max(1, timeSavedMinutes),
      accuracy
    }
  }, [dictations])

  return (
    <StateContext.Provider
      value={{
        dictationState,
        dictations,
        lastCompletedDictation,
        settings,
        activePage,
        setPage,
        timer,
        currentTranscript,
        micError,
        isPaused,
        setIsPaused,
        startListening,
        stopListening,
        cancelListening,
        toggleFavoriteDictation,
        deleteDictation,
        updateSettings,
        stats
      }}
    >
      {children}
    </StateContext.Provider>
  )
}

export const useAppState = () => {
  const context = useContext(StateContext)
  if (!context) throw new Error('useAppState must be used within a StateProvider')
  return context
}
