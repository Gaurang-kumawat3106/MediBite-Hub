// static/js/notifications.js

function connectOrderWebSocket() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/orders/`;
    
    console.log('Connecting to WebSocket:', wsUrl);
    const socket = new WebSocket(wsUrl);

    socket.onmessage = function(e) {
        const data = JSON.parse(e.data);
        console.log('WebSocket Message Received:', data);

        if (data.type === 'order_update') {
            showNotification(`Order #${data.order_id}: ${data.message}`, 'info');
            // Refresh order status in UI if on orders page
            updateOrderStatusUI(data.order_id, data.status);
        } else if (data.type === 'new_order') {
            showNotification(`New Order #${data.order_id} from ${data.customer_name}! Total: ₹${data.total_amount}`, 'success');
            // Refresh outlet orders if on outlet orders page
            if (typeof refreshOutletOrders === 'function') refreshOutletOrders();
        } else if (data.type === 'token_update') {
            showNotification(data.message, 'success');
            // Show token popup or refresh token page
            if (typeof showTokenUpdate === 'function') showTokenUpdate(data.token_no);
        }
    };

    socket.onclose = function(e) {
        console.error('Order WebSocket closed unexpectedly. Reconnecting in 5s...');
        setTimeout(connectOrderWebSocket, 5000);
    };

    socket.onerror = function(err) {
        console.error('WebSocket Error:', err);
    };

    return socket;
}

function showNotification(message, type = 'info') {
    // Basic toast notification implementation
    const toast = document.createElement('div');
    toast.className = `custom-toast toast-${type}`;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--surface-solid, #1a2332);
        color: white;
        padding: 15px 25px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        border-left: 5px solid ${type === 'success' ? '#10b981' : '#3b82f6'};
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 12px;
        animation: slideInRight 0.3s ease-out forwards;
    `;
    
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-info-circle';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease-out forwards';
        setTimeout(() => toast.remove(), 500);
    }, 5000);
}

// Add CSS for toast animations if not present
const style = document.createElement('style');
style.innerHTML = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(style);

function updateOrderStatusUI(orderId, status) {
    const statusBadge = document.querySelector(`[data-order-id="${orderId}"] .status-badge`);
    if (statusBadge) {
        statusBadge.textContent = status;
        statusBadge.className = `status-badge status-${status.toLowerCase()}`;
    }
}

// Automatically connect if user is logged in
document.addEventListener('DOMContentLoaded', () => {
    // We can check if a specific element exists to decide whether to connect
    // or just connect always (the consumer handles anonymous users by closing)
    connectOrderWebSocket();
});
