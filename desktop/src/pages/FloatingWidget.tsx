import React, { useEffect, useRef } from 'react'
import { Check, X } from 'lucide-react'
import { useAppState } from '../components/StateContext'

export const FloatingWidget: React.FC = () => {
  const {
    timer,
    currentTranscript,
    micError,
    dictationState,
    stopListening,
    cancelListening
  } = useAppState()

  const transcriptEndRef = useRef<HTMLDivElement>(null)

  // Auto scroll transcript to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentTranscript])

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="w-full h-full bg-card/95 backdrop-blur-xl border border-border rounded-3xl p-4 flex flex-col justify-between overflow-hidden select-none drag-region">
      {/* Top row: Status indicator & timer */}
      <div className="flex items-center justify-between no-drag-region">
        <div className="flex items-center gap-2">
          {/* Pulsing Red Dot */}
          <div className="relative w-2.5 h-2.5 flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-danger"></span>
          </div>
          <span className="text-[11px] font-bold text-textMain uppercase tracking-wider">
            {dictationState === 'processing' ? 'Processing...' : 'Listening'}
          </span>
        </div>
        
        {/* Timer */}
        <span className="text-[12px] font-bold text-primary tabular-nums bg-primary/10 px-2 py-0.5 tracking-wider rounded-full border border-primary/10">
          {formatTimer(timer)}
        </span>
      </div>

      {/* Middle row: Live Transcript */}
      <div className="flex-1 my-2 overflow-y-auto pr-1 no-drag-region flex items-center">
        <p className="text-[12px] text-textMain font-medium leading-snug italic max-h-[48px] overflow-hidden line-clamp-2 w-full">
          {dictationState === 'processing' ? (
            <span className="flex items-center gap-1.5 text-primary not-italic font-bold">
              <svg className="animate-spin h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              AI is formatting your voice...
            </span>
          ) : micError ? (
            <span className="text-danger not-italic font-semibold">
              Transcription failed: {micError}
            </span>
          ) : (
            currentTranscript || 'Recording audio...'
          )}
        </p>
        <div ref={transcriptEndRef} />
      </div>

      {/* Bottom row: Control buttons */}
      <div className="flex items-center justify-between border-t border-border/50 pt-2 no-drag-region">
        {/* Drag handle hint */}
        <span className="text-[9px] font-bold text-textMuted/60 uppercase tracking-widest drag-region cursor-move select-none">
          ⋮⋮ Drag widget
        </span>

        {/* Action button triggers */}
        <div className="flex items-center gap-2">
          {/* Cancel button */}
          <button
            onClick={() => {
              console.log(`[floating] cancel-button:clicked state=${dictationState}`)
              cancelListening()
            }}
            className="p-1.5 rounded-xl border border-border hover:bg-danger/10 hover:text-danger hover:border-danger/20 transition-all text-textMuted"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          
          {/* Stop / Complete button */}
          <button
            onClick={() => {
              console.log(`[floating] ok-button:clicked state=${dictationState}`)
              stopListening()
            }}
            disabled={dictationState === 'processing'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white text-[11px] font-bold shadow-premium hover:bg-primary-hover transition-colors disabled:opacity-50"
            title="Done / Formatting"
          >
            <Check className="w-3 h-3" />
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
