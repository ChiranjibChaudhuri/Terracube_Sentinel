import { useEffect, useEffectEvent, useRef, useState } from 'react'

export type WebSocketStatus = 'connecting' | 'open' | 'closed' | 'error'

interface UseWebSocketOptions<TMessage> {
  enabled?: boolean
  heartbeatMessage?: string
  heartbeatIntervalMs?: number
  maxReconnectDelayMs?: number
  onMessage?: (message: TMessage) => void
  parseMessage?: (raw: string) => TMessage
}

export function useWebSocket<TMessage = string>(
  url: string,
  {
    enabled = true,
    heartbeatMessage = 'ping',
    heartbeatIntervalMs = 30_000,
    maxReconnectDelayMs = 15_000,
    onMessage,
    parseMessage,
  }: UseWebSocketOptions<TMessage> = {},
) {
  const [status, setStatus] = useState<WebSocketStatus>(enabled ? 'connecting' : 'closed')
  const [lastMessage, setLastMessage] = useState<TMessage | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const heartbeatTimerRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)

  const handleMessage = useEffectEvent((message: TMessage) => {
    setLastMessage(message)
    onMessage?.(message)
  })

  useEffect(() => {
    if (!enabled) {
      setStatus('closed')
      return
    }

    let isDisposed = false

    const clearTimers = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (heartbeatTimerRef.current !== null) {
        window.clearInterval(heartbeatTimerRef.current)
        heartbeatTimerRef.current = null
      }
    }

    const scheduleReconnect = () => {
      if (isDisposed) return
      const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, maxReconnectDelayMs)
      reconnectAttemptRef.current += 1
      reconnectTimerRef.current = window.setTimeout(connect, delay)
    }

    const connect = () => {
      clearTimers()
      setStatus('connecting')

      const socket = new WebSocket(url)
      socketRef.current = socket

      socket.onopen = () => {
        reconnectAttemptRef.current = 0
        setStatus('open')
        heartbeatTimerRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(heartbeatMessage)
          }
        }, heartbeatIntervalMs)
      }

      socket.onmessage = (event) => {
        const message = parseMessage
          ? parseMessage(event.data)
          : (event.data as TMessage)
        handleMessage(message)
      }

      socket.onerror = () => {
        setStatus('error')
      }

      socket.onclose = () => {
        if (isDisposed) return
        setStatus('closed')
        scheduleReconnect()
      }
    }

    connect()

    return () => {
      isDisposed = true
      clearTimers()
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [enabled, heartbeatIntervalMs, heartbeatMessage, maxReconnectDelayMs, parseMessage, url, handleMessage])

  return {
    status,
    lastMessage,
    isConnected: status === 'open',
  }
}

export default useWebSocket
