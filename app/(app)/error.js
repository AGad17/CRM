'use client'
// Global error boundary for the (app) layout — catches unhandled rendering errors
// while keeping the sidebar intact. For API/query errors, use PageError inline.
import { useEffect } from 'react'

export default function AppError({ error, reset }) {
  useEffect(() => {
    // Log to console in dev; swap for Sentry/etc. in production
    console.error('[AppError boundary]', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-red-100 shadow-sm px-8 py-12 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mb-5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2} aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" d="M12 8v4M12 16h.01" />
          </svg>
        </div>
        <h2 className="text-base font-bold text-gray-800 mb-2">Something went wrong</h2>
        <p className="text-sm text-gray-400 mb-6">
          An unexpected error occurred. You can try refreshing the page or go back to the dashboard.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-500 rounded-lg hover:bg-indigo-600 transition-colors"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
