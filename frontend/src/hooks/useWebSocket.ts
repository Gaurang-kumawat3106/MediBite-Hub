import { useEffect, useState, useRef } from 'react';
import { getWsUrl } from '@/lib/utils';
import { invalidateCachesForEvent } from '@/lib/apiCache';

export type WebSocketEvent =
  | { type: "new_order"; order_id: number; customer_name: string; total_amount: string }
  | { type: "order_update"; order_id: number; status: string; token_no?: number | null; message?: string }
  | { type: "token_update"; order_id: number; token_no: number; message?: string }
  | { type: "product_deactivated"; product_id: number; product_name: string };

export const useWebSocket = (urlPath: string, onMessage: (data: WebSocketEvent) => void) => {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const fullUrl = getWsUrl(urlPath);
    
    let reconnectAttempts = 0;
    let isComponentMounted = true;

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
        return;
      }
      
      const socket = new WebSocket(fullUrl);
      wsRef.current = socket;
      
      socket.onopen = () => {
        if (isComponentMounted) setIsConnected(true);
        reconnectAttempts = 0;
      };
      
      socket.onclose = () => {
        if (isComponentMounted) {
          setIsConnected(false);
          wsRef.current = null;
          const timeout = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 8000);
          reconnectAttempts++;
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isComponentMounted) connect();
          }, timeout);
        }
      };
      
      socket.onerror = (err) => {
        console.warn("WebSocket non-fatal error, connection will retry:", err);
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketEvent;
          invalidateCachesForEvent(data);
          onMessageRef.current(data);
        } catch (err) {
          console.error(err);
        }
      };
    };

    connect();
    
    return () => {
      isComponentMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000);
        wsRef.current = null;
      }
    };
  }, [urlPath]);

  return { isConnected };
};
