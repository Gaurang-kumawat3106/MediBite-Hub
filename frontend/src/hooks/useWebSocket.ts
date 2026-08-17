import { useEffect, useState, useRef } from 'react';

export const useWebSocket = (urlPath: string, onMessage: (data: any) => void) => {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return;
    
    const wsUrl = apiUrl.replace("http://", "ws://").replace("https://", "wss://");
    const fullUrl = `${wsUrl}${urlPath}`;
    
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
      
      socket.onclose = (e) => {
        if (isComponentMounted) setIsConnected(false);
        wsRef.current = null;
        
        // Exponential backoff reconnect
        if (isComponentMounted && e.code !== 1000) {
          const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000); // max 10s
          reconnectAttempts++;
          reconnectTimeoutRef.current = setTimeout(connect, timeout);
        }
      };
      
      socket.onerror = (err) => {
        console.error("WebSocket Error:", err);
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
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
