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

export interface VariantSelectorProps {
  variants: ProductVariant[]
  selection: VariantSelection
  onChange: (selection: VariantSelection) => void
}

export function VariantSelector({ variants, selection, onChange }: VariantSelectorProps) {
  const groups = optionGroups(variants)
  if (groups.length === 0) return null

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <fieldset key={group.id}>
          <legend className="mb-2 text-sm font-medium">{group.name}</legend>
          <div className="flex flex-wrap gap-2">
            {group.values.map((value) => {
              const isSelected = selection[group.id] === value.id
              const available = isCombinationAvailable(variants, selection, group.id, value.id)
              return (
                <button
                  key={value.id}
                  type="button"
                  disabled={!available}
                  aria-pressed={isSelected}
                  onClick={() => onChange({ ...selection, [group.id]: value.id })}
                  className={cn(
                    'inline-flex h-11 min-w-11 items-center justify-center rounded-md border px-4 text-base transition-colors duration-200',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-background text-foreground hover:bg-muted',
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
