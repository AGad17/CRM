import Link from 'next/link'

/**
 * Breadcrumb — renders a simple trail of links.
 * @param {Array<{label: string, href?: string}>} items
 */
export function Breadcrumb({ items }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-1" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-gray-300">/</span>}
          {item.href ? (
            <Link href={item.href} className="hover:text-indigo-600 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-600 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
