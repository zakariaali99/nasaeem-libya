import { Compass, Flame, Flower2, Sparkles, Trees, Wind } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { cn } from '@/lib/utils'

interface NotesBrowserBarProps {
  currentQuery?: string
  onSelectNote?: (noteTerm: string) => void
  onOpenFinder?: () => void
}

const OLFACTORY_NOTES = [
  { id: 'oud', label: 'عطور العود الملكية', query: 'عود', icon: Trees },
  { id: 'musk', label: 'عطور المسك والنقاء', query: 'مسك', icon: Wind },
  { id: 'fresh', label: 'عطور الصيف والانتعاش', query: 'منعش', icon: Sparkles },
  { id: 'vanilla', label: 'عطور الفانيليا والغورماند', query: 'فانيليا', icon: Flower2 },
  { id: 'evening', label: 'عطور السهرات والمناسبات', query: 'سهرات', icon: Flame },
]

export function NotesBrowserBar({ currentQuery, onSelectNote, onOpenFinder }: NotesBrowserBarProps) {
  const navigate = useNavigate()

  const handleSelect = (q: string) => {
    if (onSelectNote) {
      onSelectNote(q)
    } else {
      navigate(`/search?q=${encodeURIComponent(q)}`)
    }
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
      {/* AI Fragrance Finder Trigger Pill */}
      {onOpenFinder && (
        <button
          type="button"
          onClick={onOpenFinder}
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-black text-primary hover:bg-primary/20 transition-all shadow-xs"
        >
          <Compass className="size-4 animate-spin duration-3000" />
          <span>مرشد العطور الذكي 🪄</span>
        </button>
      )}

      {OLFACTORY_NOTES.map((note) => {
        const Icon = note.icon
        const isActive = currentQuery === note.query
        return (
          <button
            key={note.id}
            type="button"
            onClick={() => handleSelect(note.query)}
            className={cn(
              'flex min-h-11 shrink-0 items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-xs font-bold transition-all shadow-2xs',
              isActive
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted/30',
            )}
          >
            <Icon className={cn('size-3.5', isActive ? 'text-primary-foreground' : 'text-primary')} />
            <span>{note.label}</span>
          </button>
        )
      })}
    </div>
  )
}
