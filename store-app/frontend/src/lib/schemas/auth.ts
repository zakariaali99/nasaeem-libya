import { z } from 'zod'
import { t } from '@/lib/i18n'

/**
 * Client-side rules mirror the server's. The server is still the authority —
 * these exist so a customer on a slow Libyan connection learns about a typo
 * without paying for a round trip.
 */
// The schemas are built when a form mounts, so the messages are in the page's language.
export const phoneSchema = () =>
  z
    .string()
    .min(1, t('validation.phoneRequired'))
    .transform((value) => value.replace(/[^\d+]/g, ''))
    .transform((value) =>
      value.startsWith('+218') ? `0${value.slice(4)}`
      : value.startsWith('00218') ? `0${value.slice(5)}`
      : value.startsWith('218') ? `0${value.slice(3)}`
      : value,
    )
    .refine((value) => /^09[1-5]\d{7}$/.test(value), t('validation.phoneInvalid'))

export const loginSchema = () =>
  z.object({
    phone_number: phoneSchema(),
    password: z.string().min(1, t('validation.passwordRequired')),
  })

export const registerSchema = () =>
  z.object({
    name: z.string().trim().min(2, t('validation.nameRequired')).max(255),
    phone_number: phoneSchema(),
    password: z
      .string()
      .min(8, t('validation.passwordShort'))
      .refine((v) => !/^\d+$/.test(v), t('validation.passwordDigits')),
  })

export type LoginInput = z.infer<ReturnType<typeof loginSchema>>
export type RegisterInput = z.infer<ReturnType<typeof registerSchema>>
