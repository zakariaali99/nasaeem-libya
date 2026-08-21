import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ApiError, api } from '@/lib/api'
import type { LoginInput, RegisterInput, ResetConfirmInput, ResetRequestInput } from '@/lib/schemas/auth'
import type { User } from '@/types/api'

export const authKeys = {
  me: ['auth', 'me'] as const,
}

/** The current user, or null when signed out. A 401 is an answer, not an error. */
export function useMe() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: async () => {
      try {
        const { data } = await api.get<User>('/auth/me/')
        return data
      } catch (error) {
        if (error instanceof ApiError && error.isUnauthenticated) return null
        throw error
      }
    },
    staleTime: 60_000,
    retry: false,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: LoginInput) => (await api.post<User>('/auth/login/', input)).data,
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me, user)
      // The guest cart is merged server-side on login; drop the cached copy.
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: RegisterInput) => (await api.post<User>('/auth/register/', input)).data,
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me, user)
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout/')
    },
    onSuccess: () => {
      queryClient.setQueryData(authKeys.me, null)
      queryClient.clear()
    },
  })
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (input: ResetRequestInput) =>
      (await api.post<{ request_id: string | null }>('/auth/password-reset/request/', input)).data,
  })
}

export function useConfirmPasswordReset() {
  return useMutation({
    mutationFn: async (input: ResetConfirmInput & { request_id: string }) => {
      await api.post('/auth/password-reset/confirm/', input)
    },
  })
}
