'use client'
import { createContext, useContext, useState, useEffect } from 'react'

const SidebarCtx = createContext(null)

export function SidebarProvider({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Restore persisted preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sb-collapsed')
      if (saved !== null) setCollapsed(saved === 'true')
    } catch {}
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v
      try { localStorage.setItem('sb-collapsed', String(next)) } catch {}
      return next
    })
    setMobileOpen(false)
  }

  const toggleMobile  = () => setMobileOpen((v) => !v)
  const closeMobile   = () => setMobileOpen(false)

  return (
    <SidebarCtx.Provider value={{ collapsed, toggleCollapsed, mobileOpen, toggleMobile, closeMobile }}>
      {children}
    </SidebarCtx.Provider>
  )
}

export const useSidebar = () => useContext(SidebarCtx)
