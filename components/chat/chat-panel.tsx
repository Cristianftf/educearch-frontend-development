'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useChatRealtime } from '@/hooks/use-chat-realtime'
import { chatApi, type ChatContact, type ChatMessage, type ChatReadReceipt } from '@/lib/chat'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, MessageCircle, Send, Wifi, WifiOff } from 'lucide-react'

const MAX_MESSAGE_LENGTH = 2000

interface ChatPanelProps {
  title: string
  description: string
}

function roleLabel(role: ChatContact['role']) {
  if (role === 'student') return 'Estudiante'
  if (role === 'professor') return 'Profesor'
  return 'Administrador'
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function formatHour(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

export function ChatPanel({ title, description }: ChatPanelProps) {
  const { user } = useAuth()

  const [authToken, setAuthToken] = useState<string | null>(null)
  const [contacts, setContacts] = useState<ChatContact[]>([])
  const [contactsLoading, setContactsLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedContactEmail, setSelectedContactEmail] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setAuthToken(window.localStorage.getItem('auth_token'))
  }, [])

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.email === selectedContactEmail) || null,
    [contacts, selectedContactEmail]
  )

  const appendMessage = useCallback((incoming: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((item) => item.id === incoming.id)) {
        return prev
      }
      return [...prev, incoming].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    })
  }, [])

  const handleReadReceipt = useCallback((receipt: ChatReadReceipt) => {
    if (!selectedContactEmail) return
    if (receipt.readBy.toLowerCase() !== selectedContactEmail.toLowerCase()) return

    setMessages((prev) =>
      prev.map((item) =>
        item.mine && item.recipientEmail.toLowerCase() === selectedContactEmail.toLowerCase()
          ? { ...item, readAt: receipt.readAt }
          : item
      )
    )
  }, [selectedContactEmail])

  const handleIncomingMessage = useCallback((incoming: ChatMessage) => {
    const currentEmail = user?.email?.toLowerCase()
    if (!currentEmail) return

    const incomingSender = incoming.senderEmail.toLowerCase()
    const incomingRecipient = incoming.recipientEmail.toLowerCase()
    const activeContact = selectedContactEmail?.toLowerCase()

    const belongsToActiveConversation =
      !!activeContact &&
      ((incomingSender === activeContact && incomingRecipient === currentEmail) ||
        (incomingSender === currentEmail && incomingRecipient === activeContact))

    if (belongsToActiveConversation) {
      appendMessage(incoming)
    }

    if (incomingRecipient === currentEmail) {
      if (activeContact && activeContact === incomingSender) {
        void chatApi.markRead(incoming.senderEmail)
      } else {
        setContacts((prev) =>
          prev.map((contact) =>
            contact.email.toLowerCase() === incomingSender
              ? { ...contact, unreadCount: (contact.unreadCount || 0) + 1 }
              : contact
          )
        )
      }
    }
  }, [appendMessage, selectedContactEmail, user?.email])

  const { isConnected, connectionError, sendRealtimeMessage } = useChatRealtime({
    token: authToken,
    onMessage: handleIncomingMessage,
    onReadReceipt: handleReadReceipt,
  })

  const loadContacts = useCallback(async () => {
    setContactsLoading(true)
    setError(null)
    try {
      const fetched = await chatApi.getContacts()
      setContacts(fetched)
      setSelectedContactEmail((prev) => {
        if (prev && fetched.some((item) => item.email === prev)) {
          return prev
        }
        return fetched[0]?.email || null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los contactos')
    } finally {
      setContactsLoading(false)
    }
  }, [])

  const loadMessages = useCallback(async (contactEmail: string) => {
    setMessagesLoading(true)
    try {
      const conversation = await chatApi.getMessages(contactEmail, 100)
      setMessages(conversation)
      await chatApi.markRead(contactEmail)
      setContacts((prev) =>
        prev.map((contact) =>
          contact.email === contactEmail ? { ...contact, unreadCount: 0 } : contact
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la conversación')
      setMessages([])
    } finally {
      setMessagesLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadContacts()
  }, [loadContacts])

  useEffect(() => {
    if (!selectedContactEmail) {
      setMessages([])
      return
    }
    void loadMessages(selectedContactEmail)
  }, [selectedContactEmail, loadMessages])

  const sendMessage = useCallback(async () => {
    if (!selectedContact) return
    const content = draft.trim()
    if (!content) return

    if (content.length > MAX_MESSAGE_LENGTH) {
      setError(`El mensaje no puede exceder ${MAX_MESSAGE_LENGTH} caracteres`)
      return
    }

    setSending(true)
    setDraft('')
    setError(null)

    try {
      const deliveredByWs = isConnected && sendRealtimeMessage(selectedContact.email, content)
      if (!deliveredByWs) {
        const saved = await chatApi.sendMessage(selectedContact.email, content)
        appendMessage(saved)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje')
      setDraft(content)
    } finally {
      setSending(false)
    }
  }, [appendMessage, draft, isConnected, selectedContact, sendRealtimeMessage])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      {(error || connectionError) && (
        <Alert variant="destructive">
          <AlertDescription>{error || connectionError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Mensajería interna</CardTitle>
              <CardDescription>
                Comunicación académica segura entre roles autorizados.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {isConnected ? (
                <Badge variant="outline" className="gap-1 text-green-700 border-green-200">
                  <Wifi className="h-3 w-3" />
                  En tiempo real
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-amber-700 border-amber-200">
                  <WifiOff className="h-3 w-3" />
                  Modo REST
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="border rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b text-sm font-medium">Contactos</div>
              <ScrollArea className="h-[58vh]">
                <div className="p-2 space-y-1">
                  {contactsLoading && (
                    <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando contactos...
                    </div>
                  )}

                  {!contactsLoading && contacts.length === 0 && (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      No hay contactos disponibles para tu rol.
                    </div>
                  )}

                  {contacts.map((contact) => {
                    const isActive = contact.email === selectedContactEmail
                    return (
                      <button
                        key={contact.email}
                        type="button"
                        className={cn(
                          'w-full text-left flex items-center gap-3 p-2 rounded-md transition-colors',
                          isActive ? 'bg-primary/10' : 'hover:bg-muted'
                        )}
                        onClick={() => setSelectedContactEmail(contact.email)}
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={contact.avatar || '/placeholder.svg'} />
                          <AvatarFallback>{initials(contact.name || contact.email)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{contact.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {roleLabel(contact.role)}
                          </p>
                        </div>
                        {contact.unreadCount > 0 && (
                          <Badge className="h-5 min-w-5 px-1.5 justify-center">
                            {contact.unreadCount}
                          </Badge>
                        )}
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>

            <div className="border rounded-lg flex flex-col overflow-hidden">
              {selectedContact ? (
                <>
                  <div className="border-b px-4 py-3 flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={selectedContact.avatar || '/placeholder.svg'} />
                      <AvatarFallback>{initials(selectedContact.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{selectedContact.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {roleLabel(selectedContact.role)}
                      </p>
                    </div>
                  </div>

                  <ScrollArea className="h-[48vh] px-4 py-3">
                    {messagesLoading ? (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando conversación...
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                        Aún no hay mensajes en esta conversación.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {messages.map((message) => (
                          <div
                            key={message.id}
                            className={cn('flex', message.mine ? 'justify-end' : 'justify-start')}
                          >
                            <div
                              className={cn(
                                'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                                message.mine
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-foreground'
                              )}
                            >
                              <p className="whitespace-pre-wrap break-words">{message.content}</p>
                              <div
                                className={cn(
                                  'mt-1 text-[11px] flex items-center gap-2',
                                  message.mine
                                    ? 'text-primary-foreground/80 justify-end'
                                    : 'text-muted-foreground justify-end'
                                )}
                              >
                                <span>{formatHour(message.createdAt)}</span>
                                {message.mine && message.readAt && <span>Leído</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>

                  <div className="border-t p-3 flex items-center gap-2">
                    <Input
                      placeholder="Escribe un mensaje..."
                      value={draft}
                      maxLength={MAX_MESSAGE_LENGTH}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault()
                          void sendMessage()
                        }
                      }}
                      disabled={sending}
                    />
                    <Button
                      type="button"
                      size="icon"
                      onClick={() => void sendMessage()}
                      disabled={sending || draft.trim().length === 0}
                    >
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="h-[58vh] flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <MessageCircle className="h-8 w-8 opacity-60" />
                  <p className="text-sm">Selecciona un contacto para iniciar la conversación.</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
