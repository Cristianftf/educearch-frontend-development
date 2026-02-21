import { api } from './api-client'

export interface ChatContact {
  email: string
  name: string
  role: 'student' | 'professor' | 'admin'
  avatar?: string | null
  faculty?: string | null
  unreadCount: number
}

export interface ChatMessage {
  id: string
  senderEmail: string
  recipientEmail: string
  content: string
  createdAt: string
  readAt?: string | null
  mine: boolean
}

export interface ChatReadReceipt {
  readBy: string
  readAt: string
}

export const chatApi = {
  getContacts: () => api.get<ChatContact[]>('/chat/contacts'),

  getMessages: (contactEmail: string, limit = 100) =>
    api.get<ChatMessage[]>(
      `/chat/messages?contactEmail=${encodeURIComponent(contactEmail)}&limit=${limit}`
    ),

  sendMessage: (recipientEmail: string, content: string) =>
    api.post<ChatMessage>('/chat/send', { recipientEmail, content }),

  markRead: (contactEmail: string) =>
    api.post<{ updated: number }>('/chat/read', { contactEmail }),
}
