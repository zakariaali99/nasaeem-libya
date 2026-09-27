import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type {
  Category,
  Collection,
  InventoryLog,
  InventoryRow,
  Paginated,
  Product,
  VariantOption,
} from '@/types/api'

export const catalogKeys = {
  products: (params: Record<string, unknown>) => ['products', params] as const,
  product: (id: string) => ['product', id] as const,
  productBySlug: (slug: string) => ['product-by-slug', slug] as const,
  categories: () => ['categories'] as const,
  categoryBySlug: (slug: string) => ['category-by-slug', slug] as const,
  collections: () => ['collections'] as const,
  collectionBySlug: (slug: string) => ['collection-by-slug', slug] as const,
  options: () => ['options'] as const,
  inventory: (params: Record<string, unknown>) => ['inventory', params] as const,
  inventoryLogs: (params: Record<string, unknown>) => ['inventory-logs', params] as const,
}

type Params = Record<string, string | number | boolean | undefined>

/** `enabled` is a query option, deliberately NOT part of `params` — anything in
 * `params` is serialised into the query string and would be sent to the API. */
export function useProducts(params: Params, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: catalogKeys.products(params),
    queryFn: async () => {
      const response = await api.get<Product[]>('/products/', { params })
      return { items: response.data, meta: response.meta } as Paginated<Product>
    },
    placeholderData: (previous) => previous,
    enabled: options.enabled ?? true,
  })
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: catalogKeys.product(id ?? ''),
    queryFn: async () => (await api.get<Product>(`/products/${id}/`)).data,
    enabled: Boolean(id),
  })
}

export function useProductBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: catalogKeys.productBySlug(slug ?? ''),
    queryFn: async () => (await api.get<Product>(`/products/by-slug/${encodeURIComponent(slug!)}/`)).data,
    enabled: Boolean(slug),
  })
}

export function useCategories() {
  return useQuery({
    queryKey: catalogKeys.categories(),
    queryFn: async () => (await api.get<Category[]>('/categories/')).data,
    staleTime: 5 * 60_000,
  })
}

export function useCategoryBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: catalogKeys.categoryBySlug(slug ?? ''),
    queryFn: async () => (await api.get<Category>(`/categories/by-slug/${encodeURIComponent(slug!)}/`)).data,
    enabled: Boolean(slug),
  })
}

export function useCollections() {
  return useQuery({
    queryKey: catalogKeys.collections(),
    queryFn: async () => (await api.get<Collection[]>('/collections/')).data,
    staleTime: 5 * 60_000,
  })
}

export function useCollectionBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: catalogKeys.collectionBySlug(slug ?? ''),
    queryFn: async () => (await api.get<Collection>(`/collections/by-slug/${encodeURIComponent(slug!)}/`)).data,
    enabled: Boolean(slug),
  })
}

export function useVariantOptions() {
  return useQuery({
    queryKey: catalogKeys.options(),
    queryFn: async () => (await api.get<VariantOption[]>('/options/')).data,
  })
}

export function useInventory(params: Params) {
  return useQuery({
    queryKey: catalogKeys.inventory(params),
    queryFn: async () => {
      const response = await api.get<InventoryRow[]>('/admin/inventory/', { params })
      return { items: response.data, meta: response.meta } as Paginated<InventoryRow>
    },
    placeholderData: (previous) => previous,
  })
}

export function useInventoryLogs(params: Params) {
  return useQuery({
    queryKey: catalogKeys.inventoryLogs(params),
    queryFn: async () => {
      const response = await api.get<InventoryLog[]>('/admin/inventory/logs/', { params })
      return { items: response.data, meta: response.meta } as Paginated<InventoryLog>
    },
    placeholderData: (previous) => previous,
  })
}

/** Every catalogue mutation invalidates the same keys, so a write is visible
 * everywhere it appears without each screen remembering to refetch. */
function useCatalogMutation<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of ['products', 'product', 'product-by-slug', 'categories', 'category-by-slug', 'collections', 'collection-by-slug', 'inventory', 'inventory-logs']) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
    },
  })
}

export const useCreateProduct = () =>
  useCatalogMutation((input: Record<string, unknown>) => api.post<Product>('/products/', input))

export const useUpdateProduct = () =>
  useCatalogMutation(({ id, ...input }: { id: string } & Record<string, unknown>) => {
    return api.patch<Product>(`/products/${id}/`, input)
  })

export const useDeleteProduct = () =>
  useCatalogMutation((id: string) => {
    return api.delete(`/products/${id}/`)
  })

export const useCreateCategory = () =>
  useCatalogMutation((input: Record<string, unknown>) => api.post<Category>('/categories/', input))

export const useUpdateCategory = () =>
  useCatalogMutation(({ id, ...input }: { id: string } & Record<string, unknown>) => {
    return api.patch<Category>(`/categories/${id}/`, input)
  })

export const useDeleteCategory = () =>
  useCatalogMutation((id: string) => {
    return api.delete(`/categories/${id}/`)
  })

export const useCreateCollection = () =>
  useCatalogMutation((input: Record<string, unknown>) => api.post<Collection>('/collections/', input))

export const useUpdateCollection = () =>
  useCatalogMutation(({ id, ...input }: { id: string } & Record<string, unknown>) => {
    return api.patch<Collection>(`/collections/${id}/`, input)
  })

export const useDeleteCollection = () =>
  useCatalogMutation((id: string) => {
    return api.delete(`/collections/${id}/`)
  })

export const useAdjustInventory = () =>
  useCatalogMutation((input: {
    product_id: string
    variant_id?: string | null
    change: number
    reason: string
    note?: string
  }) => api.post('/admin/inventory/adjust/', input))

export const useGenerateVariantMatrix = () =>
  useCatalogMutation(({ id, ...input }: { id: string; value_groups: string[][]; defaults?: Record<string, unknown> }) => {
    return api.post(`/products/${id}/variants/matrix/`, input)
  })

export async function uploadImage(file: File) {
  const body = new FormData()
  body.append('file', file)
  const response = await api.post<{ url: string; renditions: Record<string, string> }>('/images/', body)
  return response.data
}

export interface ProductSizeItem {
  id?: string
  size: string
  price: string
  compare_at_price?: string | null
  stock: number
  reserved_stock?: number
  available_stock?: number
  sku?: string
  is_active?: boolean
}

export interface ProductSizesResponse {
  data: ProductSizeItem[]
  product_id: string
  product_name: string
  has_variants: boolean
}

export function useProductSizes(id: string | undefined) {
  return useQuery({
    queryKey: ['product-sizes', id],
    queryFn: async () => {
      if (!id) return null
      const res = await api.get<ProductSizesResponse>(`/products/${id}/sizes/`)
      return res.data
    },
    enabled: !!id,
  })
}

export function useManageProductSizes() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string
      action: 'add_size' | 'batch_adjust' | 'sync_sizes'
      size?: string
      price?: string
      compare_at_price?: string | null
      stock?: number
      sku?: string
      adjustments?: { variant_id: string; change: number; reason?: string; note?: string }[]
      sizes?: ProductSizeItem[]
    }) => {
      const res = await api.post<{ message: string; variant_id?: string }>(
        `/products/${id}/sizes/`,
        data,
      )
      return res.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-sizes', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['product', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}
