'use client'
import { SidebarProvider, useSidebar } from './SidebarContext'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

function Shell({ children }) {
  const { collapsed } = useSidebar()

  return (
    <div className="flex min-h-screen bg-[#F5F2FF]">
      <Sidebar />

      {/*
        Content area:
        - Mobile (< lg): no margin — sidebar is a slide-over overlay
        - Desktop collapsed: ml-16 (4 rem / 64 px)
        - Desktop expanded: ml-64 (16 rem / 256 px)
        Both class strings are written out in full so Tailwind can scan them.
      */}
      <div className={
        collapsed
          ? 'flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ml-0 lg:ml-16'
          : 'flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ml-0 lg:ml-64'
      }>
        <Topbar />
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

export function AppShell({ children }) {
  return (
    <SidebarProvider>
      <Shell>{children}</Shell>
    </SidebarProvider>
  )
}
