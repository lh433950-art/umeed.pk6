const API_URL = window.APP_API_URL || `${window.location.origin}/api`;
const MEDIA_URL = API_URL.replace('/api', '');
const imageUrl = image => image?.startsWith('data:') ? image : `${MEDIA_URL}${image}`;
const loginSection = document.getElementById('login-section');
const manageSection = document.getElementById('manage-section');
let adminToken = sessionStorage.getItem('umeed-admin-token');
let lastKnownOrderId = null;
let orderPoller = null;

const statusMessage = (id, message) => { document.getElementById(id).textContent = message; };
const adminFetch = (url, options = {}) => fetch(url, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${adminToken}` } });

function notifyAdminAboutOrder(order) {
    const orderTitle = `New order received #${order._id.slice(-6).toUpperCase()}`;
    const body = `${order.customer.name} · ${order.items.map(item => `${item.title} ×${item.quantity}`).join(', ')}`;
    const notifyBox = document.getElementById('order-notify');
    if (notifyBox) {
        notifyBox.textContent = `${orderTitle} — ${body}`;
        notifyBox.classList.remove('hidden');
    }

    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        new Notification(orderTitle, { body });
        return;
    }
    if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') new Notification(orderTitle, { body });
        });
    }
}

document.getElementById('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const response = await fetch(`${API_URL}/admin/login`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
            username: document.getElementById('username').value, 
            password: document.getElementById('password').value 
        }) 
    });
    const result = await response.json();
    if (!result.success) return statusMessage('login-status', result.message || 'Unable to sign in.');
    adminToken = result.token;
    sessionStorage.setItem('umeed-admin-token', adminToken);
    loginSection.classList.add('hidden');
    manageSection.classList.remove('hidden');
    if (!orderPoller) {
        orderPoller = setInterval(loadOrders, 5000);
    }
    loadAdminProducts();
    loadOrders();
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});

document.getElementById('productForm').addEventListener('submit', async event => {
    event.preventDefault();
    const formData = new FormData();
    ['title', 'price', 'category', 'stock', 'description', 'sizes'].forEach(field => formData.append(field, document.getElementById(field).value));
    formData.append('image', document.getElementById('image').files[0]);
    try {
        const response = await adminFetch(`${API_URL}/products`, { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) return statusMessage('form-status', result.error || 'Unable to publish this piece.');
        document.getElementById('productForm').reset();
        statusMessage('form-status', 'Piece published successfully.');
        loadAdminProducts();
    } catch (error) {
        statusMessage('form-status', 'The server is not running. Start it with: npm start');
    }
});

async function loadAdminProducts() {
    const response = await adminFetch(`${API_URL}/products`);
    const products = await response.json();
    document.getElementById('admin-product-list').innerHTML = `<table class="inventory-table"><thead><tr><th>Piece</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr></thead><tbody>${products.map(product => `<tr><td><img src="${imageUrl(product.image)}" alt="">${product.title}</td><td>${product.category}</td><td>Rs.${Number(product.price).toLocaleString('en-PK')}</td><td><input class="stock-input" type="number" min="0" value="${product.stock}" id="stock-${product._id}"><button class="action-btn" onclick="updateStock('${product._id}')">Save</button></td><td><button class="action-btn delete-btn" onclick="deleteProduct('${product._id}')">Remove</button></td></tr>`).join('')}</tbody></table>`;
}

async function updateStock(id) {
    const stock = document.getElementById(`stock-${id}`).value;
    const response = await adminFetch(`${API_URL}/products/${id}/stock`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stock }) });
    const result = await response.json();
    statusMessage('form-status', response.ok ? 'Stock updated.' : (result.error || 'Unable to update stock.'));
    if (response.ok) loadAdminProducts();
}

async function deleteProduct(id) {
    if (!window.confirm('Remove this piece from the collection?')) return;
    const response = await adminFetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
    if (response.ok) loadAdminProducts();
}

async function loadOrders() {
    const response = await adminFetch(`${API_URL}/orders`);
    const orders = await response.json();
    if (orders.length && lastKnownOrderId && orders[0]._id !== lastKnownOrderId) {
        notifyAdminAboutOrder(orders[0]);
    }
    lastKnownOrderId = orders.length ? orders[0]._id : lastKnownOrderId;
    document.getElementById('admin-order-list').innerHTML = orders.length ? orders.map(order => `<div class="order-row"><div><strong>#${order._id.slice(-6).toUpperCase()} · ${order.customer.name}</strong><p>${order.customer.phone} · ${order.customer.city} · ${order.customer.address}</p><p>${order.items.map(item => `${item.title} ×${item.quantity}`).join(', ')}</p></div><div><strong>Rs. ${Number(order.total).toLocaleString('en-PK')}</strong><select onchange="updateOrderStatus('${order._id}', this.value)">${['New', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(status => `<option ${status === order.status ? 'selected' : ''}>${status}</option>`).join('')}</select></div></div>`).join('') : '<p class="status">No customer orders yet.</p>';
}

async function updateOrderStatus(id, status) {
    await adminFetch(`${API_URL}/orders/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    loadOrders();
}