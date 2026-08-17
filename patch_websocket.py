import os

# 1. Create useWebSocket hook
hook_dir = 'frontend/src/hooks'
os.makedirs(hook_dir, exist_ok=True)
hook_path = os.path.join(hook_dir, 'useWebSocket.ts')

hook_content = """import { useEffect, useState } from 'react';

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
"""
with open(hook_path, 'w') as f:
    f.write(hook_content)

# 2. Patch outlet orders page
orders_path = 'frontend/src/app/outlet/orders/page.tsx'
with open(orders_path, 'r') as f:
    content = f.read()

if 'useWebSocket' not in content:
    content = content.replace(
        'import { fetchWithCSRF } from "@/lib/csrf";',
        'import { fetchWithCSRF } from "@/lib/csrf";\nimport { useWebSocket } from "@/hooks/useWebSocket";'
    )
    
    ws_hook = """  useWebSocket("/ws/orders/", (data) => {
    if (data.type === 'new_order' || data.type === 'order_update' || data.type === 'token_update') {
      fetchOrders();
    }
  });

"""
    content = content.replace(
        'const interval = setInterval(fetchOrders, 10000); // Polling every 10s\n    return () => clearInterval(interval);',
        ''
    )
    content = content.replace(
        'useEffect(() => {\n    fetchOrders();\n  }, []);',
        'useEffect(() => {\n    fetchOrders();\n  }, []);\n\n' + ws_hook
    )
    # The previous code might have had polling on lines 25-29, let's just do a robust replace
    import re
    content = re.sub(
        r'useEffect\(\(\) => \{\s*fetchOrders\(\);\s*const interval = setInterval\(fetchOrders, 10000\);\s*// Polling every 10s\s*return \(\) => clearInterval\(interval\);\s*\}, \[\]\);',
        'useEffect(() => { fetchOrders(); }, []);\n\n' + ws_hook,
        content
    )

with open(orders_path, 'w') as f:
    f.write(content)

# 3. Patch customer orders page
customer_orders_path = 'frontend/src/app/orders/page.tsx'
with open(customer_orders_path, 'r') as f:
    content = f.read()

if 'useWebSocket' not in content:
    content = content.replace(
        'import { fetchWithCSRF } from "@/lib/csrf";',
        'import { fetchWithCSRF } from "@/lib/csrf";\nimport { useWebSocket } from "@/hooks/useWebSocket";'
    )
    ws_hook_customer = """  useWebSocket("/ws/orders/", (data) => {
    if (data.type === 'order_update' || data.type === 'token_update') {
      fetchOrders();
    }
  });

"""
    content = re.sub(
        r'useEffect\(\(\) => \{\s*fetchOrders\(\);\s*\}, \[\]\);',
        'useEffect(() => { fetchOrders(); }, []);\n\n' + ws_hook_customer,
        content
    )
with open(customer_orders_path, 'w') as f:
    f.write(content)

# 4. Patch outlet dashboard (home)
home_path = 'frontend/src/app/outlet/home/page.tsx'
with open(home_path, 'r') as f:
    content = f.read()

if 'useWebSocket' not in content:
    content = content.replace(
        'import { fetchWithCache } from "@/lib/apiCache";',
        'import { fetchWithCache } from "@/lib/apiCache";\nimport { useWebSocket } from "@/hooks/useWebSocket";'
    )
    ws_hook_home = """  useWebSocket("/ws/orders/", (data) => {
    if (data.type === 'new_order' || (data.type === 'order_update' && data.status === 'delivered')) {
      fetchDashboard();
    }
  });

"""
    content = re.sub(
        r'useEffect\(\(\) => \{\s*fetchDashboard\(\);\s*\}, \[\]\);',
        'useEffect(() => { fetchDashboard(); }, []);\n\n' + ws_hook_home,
        content
    )
with open(home_path, 'w') as f:
    f.write(content)

print("WebSockets patched successfully.")
