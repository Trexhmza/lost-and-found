export default function Avatar({ src, name, size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-24 h-24 text-3xl',
  }

  const ring = size === 'xl' ? 'ring-4 ring-border' : 'ring-2 ring-surface'

  return (
    <div className={`rounded-full ${sizes[size]} bg-white border border-border flex items-center justify-center font-bold text-text-muted overflow-hidden ${ring} shrink-0 ${className}`}>
      {src ? (
        <img src={src} className="w-full h-full object-cover" alt="" />
      ) : (
        name?.charAt(0)?.toUpperCase() || '?'
      )}
    </div>
  )
}
