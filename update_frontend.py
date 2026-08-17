import re
import os

# 1. Update useWebSocket hook
hook_path = 'frontend/src/hooks/useWebSocket.ts'
hook_content = """import { useEffect, useState, useRef } from 'react';

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
"""
with open(hook_path, 'w') as f:
    f.write(hook_content)


# 2. Update outlet orders page (to call useWebSocket)
orders_path = 'frontend/src/app/outlet/orders/page.tsx'
with open(orders_path, 'r') as f:
    content = f.read()

ws_hook_code = """  useWebSocket("/ws/orders/", (data) => {
    if (data.type === 'new_order' || data.type === 'order_update' || data.type === 'token_update') {
      fetchOrders();
    }
  });"""

if 'useWebSocket("/ws/orders/"' not in content:
    content = re.sub(
        r'(const fetchOrders = async \(\) => \{.*?^\s*};\s*)(^\s*useEffect\(\(\) => \{.*?^\s*\}, \[\]\);)',
        r'\1' + ws_hook_code + r'\n\n\2',
        content,
        flags=re.MULTILINE | re.DOTALL
    )
    with open(orders_path, 'w') as f:
        f.write(content)


# 3. Update outlet home page (to call useWebSocket)
home_path = 'frontend/src/app/outlet/home/page.tsx'
with open(home_path, 'r') as f:
    content = f.read()

ws_hook_home_code = """  useWebSocket("/ws/orders/", (data) => {
    if (data.type === 'new_order' || (data.type === 'order_update' && data.status === 'delivered')) {
      fetchDashboard();
    }
  });"""

if 'useWebSocket("/ws/orders/"' not in content:
    content = re.sub(
        r'(const fetchDashboard = async \(\) => \{.*?^\s*};\s*)(^\s*useEffect\(\(\) => \{.*?^\s*\}, \[\]\);)',
        r'\1' + ws_hook_home_code + r'\n\n\2',
        content,
        flags=re.MULTILINE | re.DOTALL
    )
    with open(home_path, 'w') as f:
        f.write(content)

# 4. Update customer orders page (to call useWebSocket)
# (It might already have it from earlier, but let's make sure it's robust)
customer_orders_path = 'frontend/src/app/orders/page.tsx'
with open(customer_orders_path, 'r') as f:
    content = f.read()

if 'useWebSocket("/ws/orders/"' not in content:
    ws_hook_customer_code = """  useWebSocket("/ws/orders/", (data) => {
    if (data.type === 'order_update' || data.type === 'token_update') {
      fetchOrders();
    }
  });"""
    content = re.sub(
        r'(const fetchOrders = async \(\) => \{.*?^\s*};\s*)(^\s*useEffect\(\(\) => \{.*?^\s*\}, \[\]\);)',
        r'\1' + ws_hook_customer_code + r'\n\n\2',
        content,
        flags=re.MULTILINE | re.DOTALL
    )
    with open(customer_orders_path, 'w') as f:
        f.write(content)

# 5. Fix Add Product / Add Category form resets in outlet products page
products_path = 'frontend/src/app/outlet/products/page.tsx'
with open(products_path, 'r') as f:
    content = f.read()

content = content.replace(
    'setIsAddingProduct(false);\n      fetchProducts();',
    'setIsAddingProduct(false);\n      setFormName("");\n      setFormPrice("");\n      setFormCategory("");\n      setFormImage(null);\n      fetchProducts();'
)

content = content.replace(
    'setIsAddingCategory(false);\n      fetchProducts();',
    'setIsAddingCategory(false);\n      setFormName("");\n      fetchProducts();'
)

with open(products_path, 'w') as f:
    f.write(content)

print("Frontend patched successfully.")
