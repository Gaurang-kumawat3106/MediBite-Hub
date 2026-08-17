import { useEffect, useState } from 'react';

export const useWebSocket = (urlPath: string, onMessage: (data: any) => void) => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return;
    
    const wsUrl = apiUrl.replace("http://", "ws://").replace("https://", "wss://");
    const socket = new WebSocket(`${wsUrl}${urlPath}`);
    
    socket.onopen = () => setIsConnected(true);
    socket.onclose = () => setIsConnected(false);
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (err) {
        console.error(err);
      }
    };
    
    return () => {
      socket.close();
    };
  }, [urlPath]);

  return { isConnected };
};
