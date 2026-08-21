import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Price } from '@/components/storefront/Price'
import { DiscountBadge } from '@/components/storefront/DiscountBadge'
import { StockBadge } from '@/components/storefront/StockBadge'
import { clampQuantity } from '@/components/storefront/QuantityStepper'
import {
  isCombinationAvailable,
  matchVariant,
  optionGroups,
} from '@/components/storefront/VariantSelector'
import { discountPercent, formatPrice } from '@/lib/format'
import type { ProductVariant } from '@/types/api'

describe('money formatting', () => {
  it('always shows two decimals', () => {
    // The reference's formatter used minimumFractionDigits: 0 and displayed
    // 10.50 د.ل as "11 د.ل".
    expect(formatPrice('10.5')).toBe('10.50 د.ل')
    expect(formatPrice(1234.5)).toBe('1,234.50 د.ل')
  })

  it('treats a missing price as zero rather than NaN', () => {
    expect(formatPrice(null)).toBe('0.00 د.ل')
    expect(formatPrice('not a number')).toBe('0.00 د.ل')
  })
})

describe('the badge, the struck price and the charged price agree', () => {
  it('shows no badge when compare_at is absent or not higher', () => {
    expect(discountPercent('100', null)).toBeNull()
    expect(discountPercent('100', '100')).toBeNull()
    expect(discountPercent('100', '80')).toBeNull()
  })

  it('derives the percentage from the two prices it sits beside', () => {
    expect(discountPercent('80', '100')).toBe(20)
    expect(discountPercent('249.50', '320')).toBe(22)
  })

  it('renders no badge and no struck price when there is no discount', () => {
    const { container } = render(<Price price="100" compareAtPrice="100" />)
    expect(container.querySelector('s')).toBeNull()
    render(<DiscountBadge price="100" compareAtPrice="100" />)
    expect(screen.queryByText(/خصم/)).toBeNull()
  })

  it('renders all three consistently when there is one', () => {
    render(
      <div>
        <Price price="80" compareAtPrice="100" />
        <DiscountBadge price="80" compareAtPrice="100" />
      </div>,
    )
    expect(screen.getByText('80.00 د.ل')).toBeInTheDocument()
    expect(screen.getByText('100.00 د.ل')).toBeInTheDocument()
    expect(screen.getByText('خصم 20%')).toBeInTheDocument()
  })
})

describe('stock badge', () => {
  it('says out of stock when nothing is available', () => {
    render(<StockBadge trackQuantity availableStock={0} inStock={false} />)
    expect(screen.getByText('غير متوفر حالياً')).toBeInTheDocument()
  })

  it('warns when only a few are left', () => {
    render(<StockBadge trackQuantity availableStock={2} inStock />)
    expect(screen.getByText('بقي 2 فقط')).toBeInTheDocument()
  })

  it('treats an untracked product as always available', () => {
    render(<StockBadge trackQuantity={false} availableStock={0} inStock />)
    expect(screen.getByText('متوفر')).toBeInTheDocument()
  })
})

describe('quantity bounds', () => {
  it('never goes below the minimum', () => {
    expect(clampQuantity(0, 1)).toBe(1)
    expect(clampQuantity(-5, 1)).toBe(1)
  })

  it('never exceeds the available stock', () => {
    expect(clampQuantity(99, 1, 3)).toBe(3)
  })

  it('rejects fractions and rubbish', () => {
    expect(clampQuantity(2.7, 1)).toBe(2)
    expect(clampQuantity(Number.NaN, 1)).toBe(1)
  })

  it('stays at the minimum when nothing is in stock', () => {
    expect(clampQuantity(5, 1, 0)).toBe(1)
  })
})

// --------------------------------------------------------------------------

function variant(id: string, values: [string, string][], stock: number, active = true): ProductVariant {
  return {
    id,
    product: 'p',
    sku: `SKU-${id}`,
    price: '100.00',
    compare_at_price: null,
    stock,
    reserved_stock: 0,
    available_stock: stock,
    is_active: active,
    values: values.map(([option, value]) => ({
      id: `${option}:${value}`,
      option,
      option_name: option === 'size' ? 'الحجم' : 'اللون',
      value,
    })),
  }
}

describe('variant availability', () => {
  const variants = [
    variant('a', [['size', '50 مل'], ['color', 'ذهبي']], 4),
    variant('b', [['size', '50 مل'], ['color', 'فضي']], 0), // sold out
    variant('c', [['size', '100 مل'], ['color', 'ذهبي']], 2),
    variant('d', [['size', '100 مل'], ['color', 'فضي']], 9, false), // deactivated
  ]

  it('builds one group per option, without duplicating values', () => {
    const groups = optionGroups(variants)
    expect(groups.map((group) => group.name)).toEqual(['الحجم', 'اللون'])
    expect(groups[0]?.values.map((value) => value.value)).toEqual(['50 مل', '100 مل'])
  })

  it('marks a sold-out combination unavailable rather than hiding it', () => {
    const selection = { size: 'size:50 مل' }
    expect(isCombinationAvailable(variants, selection, 'color', 'color:ذهبي')).toBe(true)
    expect(isCombinationAvailable(variants, selection, 'color', 'color:فضي')).toBe(false)
  })

  it('treats a deactivated variant as unavailable', () => {
    const selection = { size: 'size:100 مل' }
    expect(isCombinationAvailable(variants, selection, 'color', 'color:فضي')).toBe(false)
  })

  it('resolves a variant only once every option is chosen', () => {
    const groups = optionGroups(variants)
    expect(matchVariant(variants, { size: 'size:50 مل' }, groups)).toBeNull()
    expect(
      matchVariant(variants, { size: 'size:100 مل', color: 'color:ذهبي' }, groups)?.id,
    ).toBe('c')
  })
})
