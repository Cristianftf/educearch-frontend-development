'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Client } from '@stomp/stompjs'
import type { ChatMessage, ChatReadReceipt } from '@/lib/chat'

interface UseChatRealtimeOptions {
  token: string | null
  onMessage?: (message: ChatMessage) => void
  onReadReceipt?: (receipt: ChatReadReceipt) => void
}

interface UseChatRealtimeResult {
  isConnected: boolean
  connectionError: string | null
  sendRealtimeMessage: (recipientEmail: string, content: string) => boolean
}

function resolveWsUrl(): string | null {
  const explicitWs = process.env.NEXT_PUBLIC_WS_URL?.trim()
  if (explicitWs) {
    return explicitWs.endsWith('/ws-native')
      ? explicitWs
      : `${explicitWs.replace(/\/$/, '')}/ws-native`
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (apiUrl && /^https?:\/\//i.test(apiUrl)) {
    const parsed = new URL(apiUrl)
    parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
    parsed.pathname = '/ws-native'
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString()
  }

  if (apiUrl && apiUrl.startsWith('/api') && typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const hostname = window.location.hostname
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'
    if (isLocalhost) {
      return `${protocol}//${hostname}:8080/ws-native`
    }
    return `${protocol}//${window.location.host}/ws-native`
  }

  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/ws-native`
  }

  return null
}

export function useChatRealtime({
  token,
  onMessage,
  onReadReceipt,
}: UseChatRealtimeOptions): UseChatRealtimeResult {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const clientRef = useRef<Client | null>(null)

  const onMessageRef = useRef(onMessage)
  const onReadReceiptRef = useRef(onReadReceipt)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    onReadReceiptRef.current = onReadReceipt
  }, [onReadReceipt])

  const wsUrl = useMemo(resolveWsUrl, [])

  useEffect(() => {
    if (!token || !wsUrl) {
      setIsConnected(false)
      return
    }

    const client = new Client({
      brokerURL: wsUrl,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: () => {
        // Intentionally no-op in production UI
      },
    })

    client.onConnect = () => {
      setConnectionError(null)
      setIsConnected(true)

      client.subscribe('/user/queue/chat.messages', (frame) => {
        try {
          const parsed = JSON.parse(frame.body) as ChatMessage
          onMessageRef.current?.(parsed)
        } catch {
          // Ignore malformed payloads
        }
      })

      client.subscribe('/user/queue/chat.read', (frame) => {
        try {
          const parsed = JSON.parse(frame.body) as ChatReadReceipt
          onReadReceiptRef.current?.(parsed)
        } catch {
          // Ignore malformed payloads
        }
      })
    }

    client.onStompError = (frame) => {
      setConnectionError(frame.headers['message'] || 'Error de conexión STOMP')
      setIsConnected(false)
    }

    client.onWebSocketError = () => {
      setConnectionError('No se pudo establecer el canal de chat en tiempo real')
      setIsConnected(false)
    }

    client.onWebSocketClose = () => {
      setIsConnected(false)
    }

    client.activate()
    clientRef.current = client

    return () => {
      setIsConnected(false)
      clientRef.current = null
      void client.deactivate()
    }
  }, [token, wsUrl])

  const sendRealtimeMessage = useCallback((recipientEmail: string, content: string): boolean => {
    const client = clientRef.current
    if (!client || !client.connected) {
      return false
    }

    client.publish({
      destination: '/app/chat.send',
      body: JSON.stringify({
        recipientEmail,
        content,
      }),
    })

    return true
  }, [])

  return {
    isConnected,
    connectionError,
    sendRealtimeMessage,
  }
}
