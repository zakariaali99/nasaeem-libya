import { pickedVariants, soleVariantSelection } from '@/components/storefront/VariantSelector'
import type { ProductVariant } from '@/types/api'

const variant = (id: string, valueId: string, isActive = true) =>
  ({
    id,
    is_active: isActive,
    values: [{ id: valueId, option: 'size', option_name: 'الحجم', value: valueId }],
  }) as unknown as ProductVariant

describe('soleVariantSelection', () => {
  it('pre-selects the only active variant', () => {
    expect(soleVariantSelection([variant('a', '60'), variant('b', '100', false)])).toEqual({ size: '60' })
  })

  it('leaves the choice open when there are several', () => {
    expect(soleVariantSelection([variant('a', '60'), variant('b', '100')])).toEqual({})
  })
})

describe('pickedVariants', () => {
  it('returns one active variant per picked size', () => {
    const variants = [variant('a', '60'), variant('b', '100'), variant('c', '200', false)]
    expect(pickedVariants(variants, ['60', '100']).map((v) => v.id)).toEqual(['a', 'b'])
    expect(pickedVariants(variants, ['200'])).toEqual([]) // an inactive size is never added
  })
})
