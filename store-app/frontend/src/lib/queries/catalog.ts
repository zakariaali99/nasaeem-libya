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
  product: (lookup: string) => ['product', lookup] as const,
  categories: () => ['categories'] as const,
  collections: () => ['collections'] as const,
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

export function useProduct(lookup: string | undefined) {
  return useQuery({
    queryKey: catalogKeys.product(lookup ?? ''),
    queryFn: async () => (await api.get<Product>(`/products/${encodeURIComponent(lookup!)}/`)).data,
    enabled: Boolean(lookup),
  })
}

export function useCategories() {
  return useQuery({
    queryKey: catalogKeys.categories(),
    queryFn: async () => (await api.get<Category[]>('/categories/')).data,
    staleTime: 5 * 60_000,
  })
}

export function useCollections() {
  return useQuery({
    queryKey: catalogKeys.collections(),
    queryFn: async () => (await api.get<Collection[]>('/collections/')).data,
    staleTime: 5 * 60_000,
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
      for (const key of ['products', 'product', 'categories', 'collections', 'inventory', 'inventory-logs']) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
    },
  })
}

export const useCreateProduct = () =>
  useCatalogMutation((input: Record<string, unknown>) => api.post<Product>('/products/', input))

export const useUpdateProduct = () =>
  useCatalogMutation(({ lookup, ...input }: { lookup: string } & Record<string, unknown>) =>
    api.patch<Product>(`/products/${encodeURIComponent(lookup)}/`, input),
  )

export const useDeleteProduct = () =>
  useCatalogMutation((lookup: string) => api.delete(`/products/${encodeURIComponent(lookup)}/`))

export const useCreateCategory = () =>
  useCatalogMutation((input: Record<string, unknown>) => api.post<Category>('/categories/', input))

export const useUpdateCategory = () =>
  useCatalogMutation(({ lookup, ...input }: { lookup: string } & Record<string, unknown>) =>
    api.patch<Category>(`/categories/${encodeURIComponent(lookup)}/`, input),
  )

export const useDeleteCategory = () =>
  useCatalogMutation((lookup: string) => api.delete(`/categories/${encodeURIComponent(lookup)}/`))

export const useCreateCollection = () =>
  useCatalogMutation((input: Record<string, unknown>) => api.post<Collection>('/collections/', input))

export const useUpdateCollection = () =>
  useCatalogMutation(({ lookup, ...input }: { lookup: string } & Record<string, unknown>) =>
    api.patch<Collection>(`/collections/${encodeURIComponent(lookup)}/`, input),
  )

export const useDeleteCollection = () =>
  useCatalogMutation((lookup: string) => api.delete(`/collections/${encodeURIComponent(lookup)}/`))

export const useAdjustInventory = () =>
  useCatalogMutation((input: {
    product_id: string
    variant_id?: string | null
    change: number
    reason: string
    note?: string
  }) => api.post('/admin/inventory/adjust/', input))

export const useGenerateVariantMatrix = () =>
  useCatalogMutation(({ lookup, ...input }: { lookup: string; value_groups: string[][]; defaults?: Record<string, unknown> }) =>
    api.post(`/products/${encodeURIComponent(lookup)}/variants/matrix/`, input),
  )

export async function uploadImage(file: File) {
  const body = new FormData()
  body.append('file', file)
  const response = await api.post<{ url: string; renditions: Record<string, string> }>('/images/', body)
  return response.data
}
