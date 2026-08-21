import { z } from 'zod'

/**
 * Client-side rules mirror the server's. The server is still the authority —
 * these exist so a customer on a slow Libyan connection learns about a typo
 * without paying for a round trip.
 */
const PHONE_MESSAGE = 'رقم الهاتف غير صحيح، يجب أن يبدأ بـ 09 ويتكوّن من 10 أرقام'

export const phoneSchema = z
  .string()
  .min(1, 'رقم الهاتف مطلوب')
  .transform((value) => value.replace(/[^\d+]/g, ''))
  .transform((value) =>
    value.startsWith('+218') ? `0${value.slice(4)}`
    : value.startsWith('00218') ? `0${value.slice(5)}`
    : value.startsWith('218') ? `0${value.slice(3)}`
    : value,
  )
  .refine((value) => /^09[1-5]\d{7}$/.test(value), PHONE_MESSAGE)

export const loginSchema = z.object({
  phone_number: phoneSchema,
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
})

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'الاسم مطلوب').max(255),
  phone_number: phoneSchema,
  password: z
    .string()
    .min(8, 'كلمة المرور يجب أن تتكوّن من 8 أحرف على الأقل')
    .refine((v) => !/^\d+$/.test(v), 'كلمة المرور لا يمكن أن تكون أرقاماً فقط'),
})

export const resetRequestSchema = z.object({ phone_number: phoneSchema })

export const resetConfirmSchema = z.object({
  code: z.string().min(4, 'رمز التحقق مطلوب').max(12),
  password: z
    .string()
    .min(8, 'كلمة المرور يجب أن تتكوّن من 8 أحرف على الأقل')
    .refine((v) => !/^\d+$/.test(v), 'كلمة المرور لا يمكن أن تكون أرقاماً فقط'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ResetRequestInput = z.infer<typeof resetRequestSchema>
export type ResetConfirmInput = z.infer<typeof resetConfirmSchema>
