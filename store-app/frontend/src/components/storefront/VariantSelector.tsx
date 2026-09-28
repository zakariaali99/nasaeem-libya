import { cn } from '@/lib/utils'
import type { ProductVariant } from '@/types/api'

export interface OptionGroup {
  id: string
  name: string
  values: { id: string; value: string }[]
}

export type VariantSelection = Record<string, string>

/** The option groups a product's variants actually use, in first-seen order. */
export function optionGroups(variants: ProductVariant[]): OptionGroup[] {
  const groups = new Map<string, OptionGroup>()
  for (const variant of variants) {
    for (const value of variant.values) {
      const group = groups.get(value.option) ?? {
        id: value.option,
        name: value.option_name,
        values: [],
      }
      if (!group.values.some((existing) => existing.id === value.id)) {
        group.values.push({ id: value.id, value: value.value })
      }
      groups.set(value.option, group)
    }
  }
  return [...groups.values()]
}

/** A product sold in a single active variant needs no choosing: that
 * variant's values, pre-selected. Otherwise an empty selection. */
export function soleVariantSelection(variants: ProductVariant[]): VariantSelection {
  const active = variants.filter((variant) => variant.is_active)
  const sole = active.length === 1 ? active[0] : undefined
  if (!sole) return {}
  return Object.fromEntries(sole.values.map((value) => [value.option, value.id]))
}

/** The variant matching every selected value, or null while a choice is open. */
export function matchVariant(
  variants: ProductVariant[],
  selection: VariantSelection,
  groups: OptionGroup[],
): ProductVariant | null {
  if (groups.some((group) => !selection[group.id])) return null
  return (
    variants.find((variant) =>
      groups.every((group) =>
        variant.values.some(
          (value) => value.option === group.id && value.id === selection[group.id],
        ),
      ),
    ) ?? null
  )
}

/**
 * True when choosing `valueId` for `optionId` leaves at least one variant that
 * is active and in stock, given everything else already chosen.
 *
 * Unavailable combinations are **disabled and still visible**. Hiding them, as
 * shops often do, leaves the customer unable to tell whether the size does not
 * exist or is merely sold out.
 */
export function isCombinationAvailable(
  variants: ProductVariant[],
  selection: VariantSelection,
  optionId: string,
  valueId: string,
): boolean {
  const candidate = { ...selection, [optionId]: valueId }
  return variants.some(
    (variant) =>
      variant.is_active &&
      variant.available_stock > 0 &&
      Object.entries(candidate).every(([option, value]) =>
        variant.values.some((item) => item.option === option && item.id === value),
      ),
  )
}

/** Active variants carrying any of the picked values — the lines a
 * multi-pick adds. Only meaningful for a single option axis (sizes). */
export function pickedVariants(variants: ProductVariant[], pickedValueIds: string[]): ProductVariant[] {
  return variants.filter(
    (variant) => variant.is_active && variant.values.some((value) => pickedValueIds.includes(value.id)),
  )
}

export interface VariantSelectorProps {
  variants: ProductVariant[]
  selection: VariantSelection
  onChange: (selection: VariantSelection) => void
  /** Multi-pick mode (single option axis): values toggle on and off freely. */
  picked?: string[]
  onTogglePick?: (valueId: string) => void
}

export function VariantSelector({ variants, selection, onChange, picked, onTogglePick }: VariantSelectorProps) {
  const groups = optionGroups(variants)
  if (groups.length === 0) return null
  const multi = picked !== undefined && onTogglePick !== undefined

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <fieldset key={group.id}>
          <legend className="mb-2 text-sm font-bold">{group.name}</legend>
          <div className="flex flex-wrap gap-2">
            {group.values.map((value) => {
              const isSelected = multi ? picked.includes(value.id) : selection[group.id] === value.id
              const available = isCombinationAvailable(variants, multi ? {} : selection, group.id, value.id)
              return (
                <button
                  key={value.id}
                  type="button"
                  disabled={!available}
                  aria-pressed={isSelected}
                  onClick={() => {
                    if (multi) {
                      onTogglePick(value.id)
                    } else if (isSelected) {
                      // Tapping the chosen value again un-chooses it.
                      const { [group.id]: _removed, ...rest } = selection
                      onChange(rest)
                    } else {
                      onChange({ ...selection, [group.id]: value.id })
                    }
                  }}
                  className={cn(
                    'inline-flex h-11 min-w-16 items-center justify-center rounded-xl border-2 px-4 text-base font-bold transition-colors duration-200',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-primary/30 bg-primary/5 text-foreground hover:border-primary',
                    !available && 'cursor-not-allowed line-through opacity-50',
                  )}
                >
                  {value.value}
                  {available ? null : <span className="sr-only"> — غير متوفر</span>}
                </button>
              )
            })}
          </div>
        </fieldset>
      ))}
    </div>
  )
}
