import { memo, useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

/**
 * Optimized Sidebar - memoized for performance
 */

const NavItem = memo(({ icon, label, active, onClick, badge, collapsed }) => (
  <button
    onClick={onClick}
    className={`
      w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left
      transition-colors duration-100
      ${active 
        ? 'bg-spratt-blue text-white' 
        : 'text-slate-600 hover:bg-slate-100'
      }
    `}
    title={collapsed ? label : undefined}
  >
    <span className={`text-base w-5 text-center ${active ? '' : 'opacity-60'}`}>
      {icon}
    </span>
    {!collapsed && (
      <span className="font-medium text-sm flex-1 truncate">{label}</span>
    )}
    {!collapsed && badge && (
      <span className={`
        min-w-[20px] h-5 flex items-center justify-center
        text-xs font-semibold px-1.5 rounded-full
        ${active ? 'bg-white/20 text-white' : 'bg-spratt-blue text-white'}
      `}>
        {badge}
      </span>
    )}
  </button>
))

NavItem.displayName = 'NavItem'

export const Sidebar = memo(({ activeView, onViewChange, pendingActionsCount = 0 }) => {
  const { profile, signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  const handleSignOut = useCallback(async () => {
    try {
      await signOut()
      toast.success('Signed out')
    } catch {
      toast.error('Error signing out')
    }
  }, [signOut])

  const handleCollapse = useCallback(() => {
    setCollapsed(c => !c)
  }, [])

  const navItems = [
    { id: 'dashboard', icon: '◉', label: 'Dashboard' },
    { id: 'recordings', icon: '◎', label: 'Recordings' },
    { id: 'actions', icon: '☐', label: 'Actions', badge: pendingActionsCount > 0 ? pendingActionsCount : null },
  ]

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Logo - centered, refined sizing */}
      <div className="flex items-center justify-center h-14 border-b border-slate-100">
        {collapsed ? (
          <img 
            src="/Spratt_Icon.png" 
            alt="Spratt" 
            className="w-6 h-6 object-contain"
            loading="eager"
          />
        ) : (
          <img 
            src="/Spratt_Logo.png" 
            alt="Spratt Insurance Brokers" 
            className="h-7 object-contain"
            loading="eager"
          />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
        {navItems.map(item => (
          <NavItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeView === item.id}
            onClick={() => onViewChange(item.id)}
            badge={item.badge}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Quick actions hint */}
      {!collapsed && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
            <span>Quick actions</span>
            <div className="flex gap-0.5 ml-auto">
              <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 text-[10px]">⌘</kbd>
              <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 text-[10px]">K</kbd>
            </div>
          </div>
        </div>
      )}

      {/* User */}
      <div className="border-t border-slate-200 p-3">
        <div className={`flex items-center gap-3 p-2 rounded-xl ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 rounded-full bg-spratt-blue flex items-center justify-center text-white text-sm font-medium">
            {profile?.full_name?.charAt(0) || profile?.email?.charAt(0)?.toUpperCase() || '?'}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {profile?.full_name || 'User'}
                </p>
                <p className="text-xs text-slate-500">
                  {profile?.role === 'admin' ? 'Admin' : 'Adviser'}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-100"
                title="Sign out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={handleCollapse}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-slate-200 rounded-full shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-600"
        title={collapsed ? 'Expand' : 'Collapse'}
      >
        <svg className={`w-3 h-3 ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </aside>
  )
})

Sidebar.displayName = 'Sidebar'
