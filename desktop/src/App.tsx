import React, { useEffect } from 'react'
import { StateProvider, useAppState } from './components/StateContext'
import { Sidebar } from './components/Sidebar'
import { Home } from './pages/Home'
import { History } from './pages/History'
import { Analytics } from './pages/Analytics'
import { Settings } from './pages/Settings'
import { FloatingWidget } from './pages/FloatingWidget'
import { motion } from 'framer-motion'

const AppContent: React.FC = () => {
  const { 
    activePage, 
    dictationState, 
    isPaused 
  } = useAppState()

  // Detect floating window route
  const isFloatingRoute = 
    window.location.hash === '#/floating' || 
    window.location.hash.includes('floating') ||
    window.location.pathname.includes('/floating')

  // Listen to window location hash changes to support Electron multi-route loading
  useEffect(() => {
    const handleHashChange = () => {
      window.location.reload()
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // If this window is the dedicated floating widget window, render only the widget
  if (isFloatingRoute) {
    return (
      <div className="w-screen h-screen overflow-hidden bg-transparent p-3 box-border">
        <FloatingWidget />
      </div>
    )
  }

  // Render Page Content based on navigation selection
  const renderPage = () => {
    switch (activePage) {
      case 'home':
        return <Home />
      case 'history':
        return <History />
      case 'analytics':
        return <Analytics />
      case 'settings':
        return <Settings />
      default:
        return <Home />
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background select-none relative rounded-xl border border-border/80">
      {/* Sidebar Menu Panel */}
      <Sidebar />

      {/* Main Panel Content */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-card">
        
        {/* Custom Window Header for macOS frameless controls spacing */}
        <div className="h-12 drag-region flex items-center justify-end px-4 gap-2 border-b border-border/20 shrink-0">
          
          {/* Custom Window Controls (Visible in non-macOS or Web Preview) */}
          {!window.electronAPI && (
            <div className="flex items-center gap-1.5 no-drag-region">
              <button
                onClick={() => alert('Minimize Mock Window')}
                className="w-3 h-3 rounded-full bg-amber-400 hover:bg-amber-500 transition-colors flex items-center justify-center text-[8px] text-amber-900 font-bold"
              >
                –
              </button>
              <button
                onClick={() => alert('Close Mock Window')}
                className="w-3 h-3 rounded-full bg-rose-500 hover:bg-rose-600 transition-colors flex items-center justify-center text-[8px] text-rose-900 font-bold"
              >
                ×
              </button>
            </div>
          )}

          {/* System Pause Status Bar Banner */}
          {isPaused && (
            <div className="mx-auto bg-amber-500/10 border border-amber-500/20 text-amber-600 font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-wider animate-pulse">
              System Paused (Tray Option Selected)
            </div>
          )}
        </div>

        {/* Page Render Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {renderPage()}
        </div>
      </div>

      {/* Browser/Web Mode Floating Widget Simulator overlay */}
      {/* If we are running in the browser and the user toggles dictation, we overlay the floating widget */}
      {!window.electronAPI && dictationState !== 'idle' && (
        <div className="absolute bottom-6 right-6 z-50 shadow-2xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 15 }}
            className="border border-border/80 rounded-3xl"
          >
            {/* Display Simulator Header */}
            <div className="bg-primary px-3.5 py-1 text-[9px] font-bold text-white uppercase tracking-widest text-center rounded-t-3xl">
              Web Sandbox Simulator
            </div>
            <FloatingWidget />
          </motion.div>
        </div>
      )}
    </div>
  )
}

export const App: React.FC = () => {
  return (
    <StateProvider>
      <AppContent />
    </StateProvider>
  )
}
export default App
