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
            // Announce order via browser SpeechSynthesis
            announceNewOrderSpeech(data);
            // Refresh outlet orders if on outlet orders page
            if (typeof refreshOutletOrders === 'function') refreshOutletOrders();
        } else if (data.type === 'token_update') {
            showNotification(data.message, 'success');
            // Show token popup or refresh token page
            if (typeof showTokenUpdate === 'function') showTokenUpdate(data.token_no);
        } else if (data.type === 'product_deactivated') {
            showNotification(`⚠️ Product unavailable: ${data.product_name} has just been deactivated. Please do not proceed with payment.`, 'error');
            
            // If on cart/checkout page, disable checkout buttons and possibly remove the item
            const checkoutBtn = document.getElementById('checkout-btn');
            if (checkoutBtn) {
                checkoutBtn.disabled = true;
                checkoutBtn.textContent = 'Product Unavailable';
                checkoutBtn.style.opacity = '0.5';
                checkoutBtn.style.cursor = 'not-allowed';
            }
            
            const rzpBtn = document.getElementById('rzp-button1');
            if (rzpBtn) {
                rzpBtn.disabled = true;
                rzpBtn.textContent = 'Product Unavailable';
                rzpBtn.style.opacity = '0.5';
                rzpBtn.style.cursor = 'not-allowed';
            }
            
            // Optionally refresh the page after a delay to reflect changes
            setTimeout(() => {
                window.location.reload();
            }, 3000);
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
        border-left: 5px solid ${type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#3b82f6')};
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 12px;
        animation: slideInRight 0.3s ease-out forwards;
    `;
    
    const icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle');
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

// Voice announcement for new paid orders
const bbAnnouncedOrderIds = new Set();

function announceNewOrderSpeech(data) {
    if (!data || !data.order_id || bbAnnouncedOrderIds.has(data.order_id)) return;
    bbAnnouncedOrderIds.add(data.order_id);

    if (!('speechSynthesis' in window)) return;

    const orderNum = data.token_number || data.order_id;
    let itemsText = data.items_summary;
    if (!itemsText && Array.isArray(data.items) && data.items.length > 0) {
        const parts = data.items.map(i => `${i.quantity || 1} ${i.name || 'item'}`);
        itemsText = parts.join(' and ');
    }
    if (!itemsText) itemsText = "food items";

    const speechText = `New order number ${orderNum}. ${itemsText}.`;
    console.log("🔊 Speaking new order:", speechText);

    try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(speechText);
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        utterance.lang = "en-US";
        window.speechSynthesis.speak(utterance);
    } catch (e) {
        console.warn("SpeechSynthesis error:", e);
    }
}

// Automatically connect if user is logged in
document.addEventListener('DOMContentLoaded', () => {
    // We can check if a specific element exists to decide whether to connect
    // or just connect always (the consumer handles anonymous users by closing)
    connectOrderWebSocket();
});
