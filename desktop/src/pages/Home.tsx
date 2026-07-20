import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Mic,
  Code2,
  Globe,
  MessageSquare,
  MousePointer2,
  Laptop,
  Copy,
  Check,
  Heart
} from 'lucide-react'
import { useAppState } from '../components/StateContext'
import { DictationActivity } from '../types'

export const Home: React.FC = () => {
  const {
    dictationState,
    startListening,
    currentTranscript,
    dictations,
    lastCompletedDictation,
    toggleFavoriteDictation,
    isPaused
  } = useAppState()

  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getAppIcon = (appName: DictationActivity['appName']) => {
    switch (appName) {
      case 'VS Code':
        return <Code2 className="w-4 h-4 text-blue-500" />
      case 'Chrome':
        return <Globe className="w-4 h-4 text-green-500" />
      case 'Slack':
        return <MessageSquare className="w-4 h-4 text-pink-500" />
      case 'Cursor':
        return <MousePointer2 className="w-4 h-4 text-indigo-500" />
      default:
        return <Laptop className="w-4 h-4 text-gray-500" />
    }
  }

  // Get last 5 dictations
  const recentDictations = dictations.slice(0, 5)

  // Home now mirrors dictation status only. Start/stop lives in floating window.
  const getMicStyles = () => {
    if (isPaused) return 'bg-gray-200 border-gray-300 text-gray-400'
    switch (dictationState) {
      case 'listening':
        return 'bg-danger text-white shadow-lg shadow-danger/25'
      case 'processing':
        return 'bg-primary-hover text-white shadow-lg shadow-primary/25'
      default:
        return 'bg-primary text-white shadow-premium'
    }
  }

  const latestOutputText = (lastCompletedDictation?.text || currentTranscript || '').trim()

  return (
    <div className="flex-1 overflow-y-auto px-10 py-8 no-drag-region">
      {/* Top Welcome Title */}
      <div className="mb-8">
        <motion.h2
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold tracking-tight text-textMain"
        >
          Speak Naturally.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-textMuted text-[14px] mt-1"
        >
          AI-powered voice typing for every application.
        </motion.p>
      </div>

      {/* Main Microphone Card Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        <div className="lg:col-span-8 bg-card border border-border rounded-3xl p-8 flex flex-col items-center justify-center relative overflow-hidden shadow-soft min-h-[320px]">
          {/* Animated Background Gradients */}
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent opacity-60 pointer-events-none" />

          {/* Center Status Circle */}
          <div className="relative flex items-center justify-center w-40 h-40 mb-4 z-10">
            <button
              type="button"
              onClick={() => {
                console.log(`[home] mic-button:clicked state=${dictationState} paused=${isPaused}`)
                if (dictationState === 'idle' && !isPaused) {
                  startListening()
                } else {
                  console.log('[home] mic-button:ignored')
                }
              }}
              className={`w-28 h-28 rounded-full flex flex-col items-center justify-center border-4 border-white transition-colors duration-300 relative z-20 ${getMicStyles()} ${dictationState === 'idle' && !isPaused ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {dictationState === 'processing' ? (
                <svg className="animate-spin h-8 w-8 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <Mic className="w-8 h-8" />
              )}
            </button>
          </div>

          {/* Result Panel */}
          <div className="z-10 text-center mb-4 w-full">
            {latestOutputText ? (
              <>
                <span className="text-[11px] font-bold uppercase tracking-wider text-textMuted">
                  Latest Output
                </span>
                <p className="text-[14px] text-textMain max-w-[90%] mx-auto mt-2">
                  "{latestOutputText}"
                </p>
                {lastCompletedDictation && (
                  <button
                    type="button"
                    onClick={() => handleCopyText(lastCompletedDictation.text, lastCompletedDictation.id)}
                    className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-border bg-card text-textMuted hover:text-textMain hover:bg-secondaryBg transition-colors"
                  >
                    {copiedId === lastCompletedDictation.id ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span className="text-[11px] font-semibold">
                      {copiedId === lastCompletedDictation.id ? 'Copied' : 'Copy'}
                    </span>
                  </button>
                )}
              </>
            ) : (
              <span className="text-[13px] font-bold uppercase tracking-wider text-textMuted">
                {isPaused ? 'System Paused' : 'Ready'}
              </span>
            )}
          </div>
        </div>

        {/* Shortcut Card */}
        <div className="lg:col-span-4 flex flex-col justify-between bg-card border border-border rounded-3xl p-6 shadow-soft relative overflow-hidden">
          <div>
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest py-1">
              # Global Shortcut
            </span>
            <h3 className="text-lg font-bold text-textMain mt-3">Dictate Anywhere</h3>
            <p className="text-textMuted text-xs mt-1 leading-relaxed">
              Use the shortcut keys to quickly activate dictation and start typing in any document, search box, or chat interface.
            </p>
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-2">
              <span className="px-4 py-1.5 rounded-full border border-border bg-secondaryBg font-semibold text-textMain text-[14px] shadow-sm">⌥ Option</span>
              <span className="text-textMuted font-bold text-lg">+</span>
              <span className="px-4 py-1.5 rounded-full border border-border bg-secondaryBg font-semibold text-textMain text-[14px] shadow-sm">Space</span>
            </div>
            <p className="text-[11px] text-textMuted font-medium mt-3 italic">
              "Press to open, click OK to format"
            </p>
          </div>
        </div>
      </div>

      {/* Recent Activity Card */}
      <div className="bg-card border border-border rounded-3xl p-6 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[16px] text-textMain">Recent Activity</h3>
          <span className="text-[10px] font-bold text-primary uppercase tracking-widest py-1">
            # Auto-Reflowed
          </span>
        </div>

        <div className="divide-y divide-border/60">
          {recentDictations.length === 0 ? (
            <div className="py-6 text-center text-textMuted text-xs">
              No recent dictations. Press the microphone button to start!
            </div>
          ) : (
            recentDictations.map((dictation) => (
              <div key={dictation.id} className="py-3.5 flex items-center justify-between gap-4 group">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-xl bg-secondaryBg flex items-center justify-center shrink-0 shadow-sm border border-border/40">
                    {getAppIcon(dictation.appName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] text-textMain font-medium truncate pr-4">
                      {dictation.text}
                    </p>
                    <span className="text-[11px] text-textMuted mt-0.5 inline-flex items-center gap-1.5 font-medium">
                      {dictation.appName} • {dictation.timestamp} • {dictation.wordsCount} words
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => toggleFavoriteDictation(dictation.id)}
                    className={`p-2 rounded-full hover:bg-secondaryBg transition-colors ${dictation.isFavorite ? 'text-rose-500' : 'text-textMuted'}`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${dictation.isFavorite ? 'fill-rose-500' : ''}`} />
                  </button>
                  <button
                    onClick={() => handleCopyText(dictation.text, dictation.id)}
                    className="p-2 rounded-full hover:bg-secondaryBg text-textMuted hover:text-textMain transition-colors"
                  >
                    {copiedId === dictation.id ? (
                      <Check className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
