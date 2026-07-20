import React from 'react'
import { Home, History, Settings, BarChart3 } from 'lucide-react'
import { useAppState } from './StateContext'

export const Sidebar: React.FC = () => {
  const { activePage, setPage } = useAppState()

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'history', label: 'History', icon: History },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="w-[220px] bg-secondaryBg border-r border-border flex flex-col h-full select-none">
      {/* Draggable window area for macOS frameless window */}
      <div className="h-12 drag-region flex items-center px-4" />

      {/* App Brand Logo */}
      <div className="px-6 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-premium">
          🎙️
        </div>
        <div>
          <h1 className="font-semibold text-[15px] tracking-tight text-textMain">ChalBolReFlow</h1>
          <p className="text-[10px] text-textMuted font-medium uppercase tracking-wider">AI Voice Typing</p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 no-drag-region">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activePage === item.id

          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-full text-[14px] font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-primary text-white shadow-premium'
                  : 'text-textMuted hover:text-primary hover:bg-primary/10'
              }`}
            >
              <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-white' : 'text-textMuted'}`} />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Small version info footer */}
      <div className="p-6 text-[11px] text-textMuted border-t border-border no-drag-region">
        <div className="flex items-center justify-between font-medium">
          <span>v1.0.0</span>
        </div>
      </div>
    </div>
  )
}
