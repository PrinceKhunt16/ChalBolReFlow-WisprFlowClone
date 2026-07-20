import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, 
  Trash2, 
  Copy, 
  Check, 
  Heart,
  Globe,
  Code2,
  MessageSquare,
  MousePointer2,
  Laptop,
  Inbox
} from 'lucide-react'
import { useAppState } from '../components/StateContext'
import { DictationActivity } from '../types'

export const History: React.FC = () => {
  const {
    dictations,
    deleteDictation,
    toggleFavoriteDictation
  } = useAppState()

  const [searchQuery, setSearchQuery] = useState('')
  const [appFilter, setAppFilter] = useState<string>('All')
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

  const filteredDictations = dictations.filter((d) => {
    const matchesSearch = d.text.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesApp = appFilter === 'All' || d.appName === appFilter
    return matchesSearch && matchesApp
  })

  const uniqueApps = ['All', 'VS Code', 'Chrome', 'Slack', 'Cursor']

  return (
    <div className="flex-1 overflow-y-auto px-10 py-8 no-drag-region">
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-textMain">Dictation History</h2>
          <p className="text-textMuted text-[14px] mt-1">Review and manage your voice-to-text logs.</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-textMuted absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search transcripts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border rounded-xl pl-11 pr-4 py-2.5 text-[13px] font-medium placeholder-textMuted/65 focus:outline-none focus:border-primary/50 focus:shadow-ring transition-all"
          />
        </div>

        {/* App Filter Pill Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {uniqueApps.map((app) => (
            <button
              key={app}
              onClick={() => setAppFilter(app)}
              className={`px-4 py-2 rounded-xl text-[12px] font-semibold transition-all shrink-0 ${
                appFilter === app
                  ? 'bg-primary text-white shadow-soft'
                  : 'bg-card border border-border text-textMuted hover:text-textMain'
              }`}
            >
              {app}
            </button>
          ))}
        </div>
      </div>

      {/* Dictations Grid List */}
      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {filteredDictations.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-card border border-border rounded-3xl p-12 text-center shadow-soft flex flex-col items-center justify-center min-h-[300px]"
            >
              <div className="w-16 h-16 rounded-full bg-secondaryBg flex items-center justify-center text-textMuted/60 mb-4 border border-border/40">
                <Inbox className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-[16px] text-textMain">No records found</h3>
              <p className="text-textMuted text-xs mt-1.5 max-w-[280px]">
                {searchQuery || appFilter !== 'All'
                  ? "We couldn't find any dictations matching your search filters."
                  : "You haven't recorded anything yet! Navigate to Home and press the microphone to start."}
              </p>
              {(searchQuery || appFilter !== 'All') && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setAppFilter('All')
                  }}
                  className="mt-4 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold shadow-premium hover:bg-primary-hover transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </motion.div>
          ) : (
            filteredDictations.map((dictation) => (
              <motion.div
                key={dictation.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="bg-card border border-border rounded-2xl p-5 shadow-soft hover:shadow-card transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-secondaryBg flex items-center justify-center border border-border/40 shrink-0">
                      {getAppIcon(dictation.appName)}
                    </div>
                    <div>
                      <h4 className="text-[13px] font-bold text-textMain">{dictation.appName}</h4>
                      <span className="text-[11px] text-textMuted font-medium block">
                        {dictation.timestamp} • {dictation.durationSeconds}s duration
                      </span>
                    </div>
                  </div>

                  {/* Actions Right */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleFavoriteDictation(dictation.id)}
                      className={`p-2 rounded-full hover:bg-secondaryBg transition-colors ${dictation.isFavorite ? 'text-rose-500' : 'text-textMuted'}`}
                      title="Favorite"
                    >
                      <Heart className={`w-3.5 h-3.5 ${dictation.isFavorite ? 'fill-rose-500' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleCopyText(dictation.text, dictation.id)}
                      className="p-2 rounded-full hover:bg-secondaryBg text-textMuted hover:text-textMain transition-colors"
                      title="Copy text"
                    >
                      {copiedId === dictation.id ? (
                        <Check className="w-3.5 h-3.5 text-success" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteDictation(dictation.id)}
                      className="p-2 rounded-full hover:bg-danger/10 text-textMuted hover:text-danger transition-colors"
                      title="Delete log"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="mt-3 text-[13.5px] text-textMain/90 leading-relaxed font-medium pl-11">
                  "{dictation.text}"
                </div>

                {/* Footer words count */}
                <div className="mt-3 flex justify-between items-center text-[10px] text-textMuted font-bold pl-11 uppercase tracking-wider">
                  <span>{dictation.wordsCount} words</span>
                  <span className="text-primary font-semibold">AI Transcribed</span>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
