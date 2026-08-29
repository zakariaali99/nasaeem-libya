import { Citrus, Flame, Flower2, Sparkles, Trees, Wind } from 'lucide-react'
import * as React from 'react'

import type { PerfumeDetails, PerfumeNote } from '@/types/api'

interface FragrancePyramidProps {
  details?: PerfumeDetails
}

function getNoteIcon(name: string, iconType?: string) {
  const text = (name + ' ' + (iconType || '')).toLowerCase()
  if (text.includes('برغموت') || text.includes('حمض') || text.includes('ليمون') || text.includes('citrus')) {
    return Citrus
  }
  if (text.includes('عود') || text.includes('خشب') || text.includes('صندل') || text.includes('wood') || text.includes('oud')) {
    return Trees
  }
  if (text.includes('ورد') || text.includes('ياسمين') || text.includes('زهر') || text.includes('rose') || text.includes('flower')) {
    return Flower2
  }
  if (text.includes('فلفل') || text.includes('توابل') || text.includes('هيل') || text.includes('spice')) {
    return Flame
  }
  if (text.includes('مسك') || text.includes('عنبر') || text.includes('تونكا') || text.includes('musk') || text.includes('amber')) {
    return Wind
  }
  return Sparkles
}

export function FragrancePyramid({ details }: FragrancePyramidProps) {
  if (!details) return null

  const topNotes = details.top_notes || []
  const heartNotes = details.heart_notes || []
  const baseNotes = details.base_notes || []

  if (!topNotes.length && !heartNotes.length && !baseNotes.length) {
    return null
  }

  const [activeNote, setActiveNote] = React.useState<PerfumeNote | null>(null)

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-2xs space-y-6">
      {/* Title & Category Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </span>
            <h3 className="text-base font-black text-foreground">الهرم العطري الملكي (Olfactory Pyramid)</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            رحلة تحول وتطور النوتات العطرية من اللحظة الأولى وحتى استقرار الأثر
          </p>
        </div>

        {details?.fragrance_family && (
          <span className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-1 font-bold text-xs text-primary shadow-2xs">
            {details.fragrance_family}
          </span>
        )}
      </div>

      {/* Pyramid Stack Sections */}
      <div className="space-y-3">
        {/* 1. Top Notes (قمة العطر) */}
        <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 transition-all hover:bg-muted/40 hover:border-primary/40">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-lg bg-primary/15 text-primary text-xs font-black">
                ▲
              </span>
              <h4 className="text-xs font-black text-foreground">قمة العطر (Top Notes)</h4>
            </div>
            <span className="text-[11px] font-bold text-muted-foreground">
              الانطباع الأول: أول 15 - 30 دقيقة
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {topNotes.map((note) => {
              const Icon = getNoteIcon(note.name, note.icon)
              return (
                <button
                  key={note.name}
                  type="button"
                  onClick={() => setActiveNote(note)}
                  className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors shadow-2xs"
                >
                  <Icon className="size-4 text-primary" />
                  <span>{note.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 2. Heart Notes (قلب العطر) */}
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 transition-all hover:border-primary/50">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-black">
                ◆
              </span>
              <h4 className="text-xs font-black text-foreground">قلب العطر (Heart Notes)</h4>
            </div>
            <span className="text-[11px] font-bold text-primary">
              روح العطر وسحره: 4 - 6 ساعات
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {heartNotes.map((note) => {
              const Icon = getNoteIcon(note.name, note.icon)
              return (
                <button
                  key={note.name}
                  type="button"
                  onClick={() => setActiveNote(note)}
                  className="flex min-h-11 items-center gap-2 rounded-xl border border-primary/30 bg-card px-3.5 py-2 text-xs font-bold text-foreground hover:border-primary hover:bg-primary/10 transition-colors shadow-2xs"
                >
                  <Icon className="size-4 text-primary" />
                  <span>{note.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 3. Base Notes (قاعدة العطر) */}
        <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 transition-all hover:bg-muted/40 hover:border-primary/40">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-lg bg-muted text-foreground text-xs font-black border border-border">
                ■
              </span>
              <h4 className="text-xs font-black text-foreground">قاعدة العطر (Base Notes)</h4>
            </div>
            <span className="text-[11px] font-bold text-muted-foreground">
              الأثر والعمق الدائم: 12 - 24 ساعة
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {baseNotes.map((note) => {
              const Icon = getNoteIcon(note.name, note.icon)
              return (
                <button
                  key={note.name}
                  type="button"
                  onClick={() => setActiveNote(note)}
                  className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors shadow-2xs"
                >
                  <Icon className="size-4 text-primary" />
                  <span>{note.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Note Inspection Popover / Description Banner */}
      {activeNote && (
        <div className="flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/10 p-3.5 text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary shrink-0" />
            <span className="text-foreground">
              <strong className="text-primary font-bold">{activeNote.name}:</strong> {activeNote.desc || 'نوتة عطرية طبيعية فاخرة تعزز توازن وثبات التركيبة.'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveNote(null)}
            className="flex min-h-11 items-center px-3 text-xs font-bold text-primary hover:underline ms-2 shrink-0"
          >
            إغلاق
          </button>
        </div>
      )}
    </div>
  )
}
