export function PageError({ message, onRetry }) {
  return (
    <div className="bg-white rounded-2xl border border-red-100 shadow-sm px-6 py-14 text-center">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-50 mb-4">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2} aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" d="M12 8v4M12 16h.01" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-gray-700 mb-1">Something went wrong</p>
      <p className="text-xs text-gray-400 mb-5">
        {message || 'Failed to load data. Please try again.'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-500 rounded-lg hover:bg-indigo-600 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M4.582 9a8 8 0 0115.356 2M19.418 15a8 8 0 01-15.356-2" />
          </svg>
          Retry
        </button>
      )}
    </div>
  )
}
