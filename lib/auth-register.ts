import type { User, UserRole } from '@/types'
import { api } from './api-client'

export const authRegisterApi = {
  register: (user: {
    name: string
    email: string
    password: string
    role: UserRole
    username?: string
    faculty?: string
    department?: string
  }) => {
    const endpoint = process.env.NEXT_PUBLIC_REGISTER_ENDPOINT || '/auth/register'
    return api.post<User>(endpoint, user)
  },
}
