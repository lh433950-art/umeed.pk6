const API_URL = window.APP_API_URL || `${window.location.origin}/api`;
const MEDIA_URL = API_URL.replace('/api', '');
const imageUrl = image => image?.startsWith('data:') ? image : `${MEDIA_URL}${image}`;
let products = [];
let cart = JSON.parse(localStorage.getItem('umeed-cart') || '[]');

const money = value => `Rs. ${Number(value).toLocaleString('en-PK')}`;
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

async function fetchProducts() {
    const response = await fetch(`${API_URL}/products`);
    if (!response.ok) throw new Error('Unable to load the collection.');
    products = await response.json();
    populateCategories();
    renderProducts();
    renderCart();
}

function populateCategories() {
    const filter = document.getElementById('category-filter');
    const current = filter.value;
    filter.innerHTML = '<option value="all">All categories</option>';
    [...new Set(products.map(product => product.category))].sort().forEach(category => {
        filter.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`);
    });
    filter.value = [...new Set(products.map(product => product.category))].includes(current) ? current : 'all';
}

function renderProducts() {
    const search = document.getElementById('product-search').value.trim().toLowerCase();
    const category = document.getElementById('category-filter').value;
    const visible = products.filter(product => product.title.toLowerCase().includes(search) && (category === 'all' || product.category === category));
    const grid = document.getElementById('product-list');
    document.getElementById('empty-state').classList.toggle('hidden', visible.length !== 0);
    grid.innerHTML = visible.map(product => {
        const soldOut = product.stock < 1;
        const image = product.image ? imageUrl(product.image) : 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?q=80&w=700&auto=format&fit=crop';
        return `<article class="product-card">
            <div class="product-image-wrap"><img src="${image}" alt="${escapeHtml(product.title)}" loading="lazy">${soldOut ? '<span class="product-badge">Sold out</span>' : product.stock < 5 ? '<span class="product-badge">Low stock</span>' : ''}</div>
            <div class="product-info"><h3>${escapeHtml(product.title)}</h3><div class="product-meta"><span>${escapeHtml(product.category)}</span><span class="product-price">${money(product.price)}</span></div>
            <button class="buy-btn" onclick="showProduct('${product._id}')">View details</button>
            <button class="buy-btn" ${soldOut ? 'disabled' : ''} onclick="addToCart('${product._id}')">${soldOut ? 'Sold out' : 'Add to bag'}</button>
            <button class="buy-btn buy-now-btn" ${soldOut ? 'disabled' : ''} onclick="buyNow('${product._id}')">${soldOut ? 'Sold out' : 'Order now'}</button></div>
        </article>`;
    }).join('');
}

function showProduct(id) {
    const product = products.find(item => item._id === id);
    if (!product) return;
    const image = product.image ? imageUrl(product.image) : '';
    document.getElementById('product-modal').innerHTML = `<div class="product-modal-card"><button class="icon-button modal-close">×</button><img src="${image}" alt="${escapeHtml(product.title)}"><div><p class="eyebrow">${escapeHtml(product.category)}</p><h2>${escapeHtml(product.title)}</h2><strong class="modal-price">${money(product.price)}</strong><p class="modal-description">${escapeHtml(product.description || 'A considered Umeed piece, made for everyday wear.')}</p><p class="size-label">Available sizes</p><div class="size-list">${(product.sizes?.length ? product.sizes : ['One size']).map(size => `<span>${escapeHtml(size)}</span>`).join('')}</div><button class="checkout-btn" onclick="addToCart('${product._id}'); closeProductModal();">Add to bag <span>→</span></button></div></div>`;
    document.getElementById('product-modal').classList.remove('hidden');
    document.querySelector('#product-modal .modal-close').addEventListener('click', closeProductModal);
}
function closeProductModal() { document.getElementById('product-modal').classList.add('hidden'); }

function addToCart(id) {
    const product = products.find(item => item._id === id);
    if (!product || product.stock < 1) return showToast('This piece is currently sold out.');
    const existing = cart.find(item => item.id === id);
    if (existing) {
        if (existing.quantity >= product.stock) return showToast(`Only ${product.stock} available.`);
        existing.quantity += 1;
    } else cart.push({ id, quantity: 1 });
    persistCart();
    openCart();
    showToast('Added to your bag.');
}

function buyNow(id) {
    const product = products.find(item => item._id === id);
    if (!product || product.stock < 1) return showToast('This piece is currently sold out.');
    cart = [{ id, quantity: 1 }];
    persistCart();
    checkout();
    showToast('Order now — complete your delivery details.');
}

function updateQuantity(id, change) {
    const item = cart.find(entry => entry.id === id);
    const product = products.find(entry => entry._id === id);
    if (!item || !product) return;
    item.quantity = Math.min(product.stock, item.quantity + change);
    if (item.quantity < 1) cart = cart.filter(entry => entry.id !== id);
    persistCart();
}

function removeFromCart(id) { cart = cart.filter(item => item.id !== id); persistCart(); }
function persistCart() { localStorage.setItem('umeed-cart', JSON.stringify(cart)); renderCart(); }

function renderCart() {
    const count = cart.reduce((total, item) => total + item.quantity, 0);
    document.getElementById('cart-count').textContent = count;
    document.getElementById('drawer-count').textContent = count;
    const lines = cart.map(item => {
        const product = products.find(entry => entry._id === item.id);
        if (!product) return '';
        const image = product.image ? imageUrl(product.image) : '';
        return `<div class="cart-line"><img src="${image}" alt=""><div><h3>${escapeHtml(product.title)}</h3><p>${money(product.price)}</p><div class="qty-controls"><button onclick="updateQuantity('${item.id}', -1)" aria-label="Decrease quantity">−</button><span>${item.quantity}</span><button onclick="updateQuantity('${item.id}', 1)" aria-label="Increase quantity">+</button><button class="remove-item" onclick="removeFromCart('${item.id}')">Remove</button></div></div><strong>${money(product.price * item.quantity)}</strong></div>`;
    }).join('');
    document.getElementById('cart-items').innerHTML = lines;
    const subtotal = cart.reduce((total, item) => {
        const product = products.find(entry => entry._id === item.id);
        return total + (product ? product.price * item.quantity : 0);
    }, 0);
    document.getElementById('cart-subtotal').textContent = money(subtotal);
    document.getElementById('cart-empty').classList.toggle('hidden', count > 0);
    document.getElementById('cart-summary').classList.toggle('hidden', count === 0);
}

function openCart() { document.getElementById('cart-drawer').classList.add('open'); document.getElementById('cart-drawer').setAttribute('aria-hidden', 'false'); document.getElementById('cart-overlay').classList.remove('hidden'); }
function closeCart() { document.getElementById('cart-drawer').classList.remove('open'); document.getElementById('cart-drawer').setAttribute('aria-hidden', 'true'); document.getElementById('cart-overlay').classList.add('hidden'); }
function showToast(message) { const toast = document.getElementById('toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2500); }

async function checkout() {
    if (!cart.length) return;
    document.getElementById('checkout-modal').classList.remove('hidden');
}

async function submitOrder(event) {
    event.preventDefault();
    const button = event.target.querySelector('button[type="submit"]');
    const formData = new FormData(event.target);
    const error = document.getElementById('checkout-error');
    button.disabled = true;
    error.textContent = '';
    try {
        const response = await fetch(`${API_URL}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
            customer: Object.fromEntries(formData.entries()),
            items: cart.map(item => ({ id: item.id, quantity: item.quantity }))
        }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Unable to place your order.');
        cart = [];
        persistCart();
        await fetchProducts();
        closeCart();
        document.getElementById('checkout-modal').classList.add('hidden');
        event.target.reset();
        showToast(`Order placed successfully. Reference: ${result.orderId.slice(-6).toUpperCase()}`);
    } catch (submitError) { error.textContent = submitError.message; await fetchProducts(); } finally { button.disabled = false; }
}

async function trackOrder(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const resultBox = document.getElementById('track-result');
    resultBox.textContent = 'Looking up your order...';
    const response = await fetch(`${API_URL}/orders/${encodeURIComponent(formData.get('orderId').trim())}?phone=${encodeURIComponent(formData.get('phone').trim())}`);
    const result = await response.json();
    resultBox.textContent = response.ok ? `Order #${result._id.slice(-6).toUpperCase()} is ${result.status}. Total: ${money(result.total)}` : result.message;
}

document.getElementById('product-search').addEventListener('input', renderProducts);
document.getElementById('category-filter').addEventListener('change', renderProducts);
document.getElementById('cart-trigger').addEventListener('click', openCart);
document.getElementById('cart-close').addEventListener('click', closeCart);
document.getElementById('cart-overlay').addEventListener('click', closeCart);
document.getElementById('continue-shopping').addEventListener('click', closeCart);
document.getElementById('checkout-button').addEventListener('click', checkout);
document.getElementById('checkout-form').addEventListener('submit', submitOrder);
document.getElementById('checkout-close').addEventListener('click', () => document.getElementById('checkout-modal').classList.add('hidden'));
document.getElementById('track-order-trigger').addEventListener('click', () => document.getElementById('track-modal').classList.remove('hidden'));
document.querySelector('#track-modal .modal-close').addEventListener('click', () => document.getElementById('track-modal').classList.add('hidden'));
document.getElementById('track-form').addEventListener('submit', trackOrder);
fetchProducts().catch(error => showToast(error.message));
