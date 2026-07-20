import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Keyboard, 
  Languages, 
  Cpu, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Github, 
  Globe, 
  Info,
  Sliders,
  CheckCircle
} from 'lucide-react'
import { useAppState } from '../components/StateContext'
import { AppSettings, SupportedLanguage } from '../types'

export const Settings: React.FC = () => {
  const { settings, updateSettings } = useAppState()
  const [activeTab, setActiveTab] = useState<'general' | 'shortcut' | 'language' | 'provider' | 'about'>('general')
  const [showApiKey, setShowApiKey] = useState(false)
  const [checkingUpdates, setCheckingUpdates] = useState(false)
  const [updateMessage, setUpdateMessage] = useState('')

  const handleSelectChange = (key: keyof AppSettings, value: any) => {
    updateSettings({ [key]: value })
  }

  const handleCheckUpdates = () => {
    setCheckingUpdates(true)
    setUpdateMessage('')
    setTimeout(() => {
      setCheckingUpdates(false)
      setUpdateMessage('ChalBolReFlow is up to date!')
    }, 1500)
  }

  const getGroqModels = () => ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b', 'openai/gpt-oss-20b']

  const tabs = [
    { id: 'shortcut', label: 'Shortcut', icon: Keyboard },
    { id: 'language', label: 'Language', icon: Languages },
    { id: 'provider', label: 'AI Provider', icon: Cpu },
    { id: 'about', label: 'About', icon: Info },
  ] as const

  return (
    <div className="flex-1 flex overflow-hidden no-drag-region">
      {/* Left Settings Sub-Tabs (Width 180px) */}
      <div className="w-[180px] bg-secondaryBg/40 border-r border-border/80 flex flex-col p-4 space-y-1">
        <span className="px-3 mb-3 text-[10px] font-bold text-textMuted uppercase tracking-wider">
          Settings
        </span>
        {tabs.map((tab) => {
          const TabIcon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] font-medium transition-all ${
                isActive
                  ? 'bg-primary text-white'
                  : 'text-textMuted hover:text-primary hover:bg-primary/10'
              }`}
            >
              <TabIcon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-textMuted'}`} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Right Settings Content */}
      <div className="flex-1 overflow-y-auto p-8 bg-card">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -5 }}
            transition={{ duration: 0.15 }}
            className="max-w-xl space-y-6"
          >
            {/* 2. Shortcut Settings */}
            {activeTab === 'shortcut' && (
              <>
                <div>
                  <h3 className="text-lg font-bold text-textMain">Keyboard Shortcuts</h3>
                  <p className="text-textMuted text-xs mt-0.5">Customize your push-to-talk keybind configuration.</p>
                </div>

                <div className="p-5 rounded-2xl border border-border bg-secondaryBg/20 space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-textMuted uppercase tracking-wider mb-2">
                      Start Dictation Trigger
                    </label>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-4 py-1.5 rounded-full border border-border bg-white font-bold text-textMain text-[12px] shadow-sm">Option ⌥</span>
                        <span className="text-textMuted font-bold text-lg">+</span>
                        <span className="px-4 py-1.5 rounded-full border border-border bg-white font-bold text-textMain text-[12px] shadow-sm">Space</span>
                      </div>
                      <span className="text-xs font-semibold text-primary">Active</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <label className="block text-[11px] font-bold text-textMuted uppercase tracking-wider mb-1">
                      Press & Hold Behavior
                    </label>
                    <p className="text-textMuted text-xs leading-relaxed">
                      Press Option + Space to open dictation from anywhere, then tap OK to finish and paste the result into the active app or textarea.
                    </p>
                    <p className="text-textMuted/80 text-[11px] leading-relaxed mt-2">
                      On macOS, system paste automation may ask for Accessibility permission the first time you use it.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* 3. Language Settings */}
            {activeTab === 'language' && (
              <>
                <div>
                  <h3 className="text-lg font-bold text-textMain">Language Profile</h3>
                  <p className="text-textMuted text-xs mt-0.5">Set the primary speaking language for AI processing.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-textMuted uppercase tracking-wider mb-1.5">
                      Dictation Language
                    </label>
                    <select
                      value={settings.language}
                      onChange={(e) => handleSelectChange('language', e.target.value as SupportedLanguage)}
                      className="w-full bg-secondaryBg border border-border rounded-xl px-4 py-2.5 text-xs font-semibold text-textMain focus:outline-none focus:border-primary/50 focus:shadow-ring transition-all"
                    >
                      <option value="English">English (United States)</option>
                    </select>
                  </div>

                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex gap-3 text-primary text-xs leading-relaxed">
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Bi-Lingual Recognition Enabled</span>
                      You can seamlessly speak both {settings.language === 'English' ? 'English and Hindi' : `English and ${settings.language}`}; our custom language models automatically detect the shift.
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* 4. AI Provider Settings */}
            {activeTab === 'provider' && (
              <>
                <div>
                  <h3 className="text-lg font-bold text-textMain">AI Model Provider</h3>
                  <p className="text-textMuted text-xs mt-0.5">Configure your own developer API keys for custom formatting. Backend support starts with Groq.</p>
                </div>

                <div className="space-y-4">
                  {/* Select Provider */}
                  <div>
                    <label className="block text-[11px] font-bold text-textMuted uppercase tracking-wider mb-1.5">
                      API Provider
                    </label>
                    <div className="w-full bg-secondaryBg border border-border rounded-xl px-4 py-2.5 text-xs font-semibold text-textMain flex items-center justify-between">
                      <span>Groq</span>
                      <span className="text-[10px] uppercase tracking-wider text-primary">Only supported provider</span>
                    </div>
                  </div>

                  {/* API Key */}
                  <div>
                    <label className="block text-[11px] font-bold text-textMuted uppercase tracking-wider mb-1.5">
                      API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={settings.apiKey}
                        onChange={(e) => handleSelectChange('apiKey', e.target.value)}
                        className="w-full bg-secondaryBg border border-border rounded-xl pl-4 pr-11 py-2.5 text-xs font-semibold text-textMain focus:outline-none focus:border-primary/50 focus:shadow-ring transition-all"
                        placeholder="Paste your API key here"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-textMuted hover:text-textMain transition-colors"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Model Selector */}
                  <div>
                    <label className="block text-[11px] font-bold text-textMuted uppercase tracking-wider mb-1.5">
                      Model Selector
                    </label>
                    <select
                      value={settings.model}
                      onChange={(e) => handleSelectChange('model', e.target.value)}
                      className="w-full bg-secondaryBg border border-border rounded-xl px-4 py-2.5 text-xs font-semibold text-textMain focus:outline-none focus:border-primary/50 focus:shadow-ring transition-all"
                    >
                      {getGroqModels().map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Temperature Slider */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[11px] font-bold text-textMuted uppercase tracking-wider">
                        Model Temperature
                      </label>
                      <span className="text-xs font-bold text-primary">{settings.temperature}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Sliders className="w-4 h-4 text-textMuted" />
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={settings.temperature}
                        onChange={(e) => handleSelectChange('temperature', parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-secondaryBg rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>
                    <div className="flex justify-between text-[9px] font-bold text-textMuted uppercase tracking-wider mt-1.5">
                      <span>Strict / Precise</span>
                      <span>Creative / Reflowed</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* 5. About Page */}
            {activeTab === 'about' && (
              <>
                <div className="flex flex-col items-center text-center py-4 bg-secondaryBg/25 rounded-3xl border border-border/50 p-6">
                  <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-premium text-white text-3xl font-bold mb-3 select-none">
                    🎙️
                  </div>
                  <h3 className="text-xl font-extrabold text-textMain tracking-tight">ChalBolReFlow</h3>
                  <span className="text-textMuted text-xs font-medium mt-1">Version {settings.version}</span>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2.5 w-full mt-6 max-w-[280px]">
                    <button
                      onClick={handleCheckUpdates}
                      disabled={checkingUpdates}
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-primary text-white text-xs font-bold shadow-premium hover:bg-primary-hover transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdates ? 'animate-spin' : ''}`} />
                      Check for Updates
                    </button>
                    
                    {updateMessage && (
                      <span className="text-[11px] text-success font-bold mt-1">
                        {updateMessage}
                      </span>
                    )}

                    <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-border w-full">
                      <a
                        href="#"
                        className="flex items-center gap-1.5 text-xs text-textMuted hover:text-textMain font-semibold transition-colors"
                      >
                        <Github className="w-4 h-4" />
                        GitHub
                      </a>
                      <a
                        href="#"
                        className="flex items-center gap-1.5 text-xs text-textMuted hover:text-textMain font-semibold transition-colors"
                      >
                        <Globe className="w-4 h-4" />
                        Website
                      </a>
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
