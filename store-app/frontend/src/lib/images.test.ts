import { renditionUrl } from '@/lib/images'

describe('renditionUrl', () => {
  it('derives a sibling rendition for uploaded webp images', () => {
    expect(renditionUrl('/media/products/x-full.webp', 'medium')).toBe('/media/products/x-medium.webp')
    expect(renditionUrl('/media/banners/hero.webp', 'full')).toBe('/media/banners/hero-full.webp')
  })

  it('leaves images without renditions untouched', () => {
    expect(renditionUrl('/media/banners/hero.jpg', 'full')).toBe('/media/banners/hero.jpg')
    expect(renditionUrl('https://cdn.example.com/a.webp', 'full')).toBe('https://cdn.example.com/a.webp')
    expect(renditionUrl(undefined, 'full')).toBe('')
  })
})
