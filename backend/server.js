const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const adminSessions = new Set();

// Direct Credentials & Connection (Safe for local & deployment)
const adminUsername = process.env.ADMIN_USERNAME || 'laiba';
const adminPassword = process.env.ADMIN_PASSWORD || 'umeedcloth';
const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://lh433950_db_user:LlgzgQn1m35Cp1cp@cluster0.ktlfoxd.mongodb.net/umeed_db?retryWrites=true&w=majority';

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || true }));
app.use(express.json());
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

// MongoDB Connection
mongoose.connect(mongoUri)
    .then(() => console.log('MongoDB Connected Successfully to Umeed.pk DB'))
    .catch(err => console.error('MongoDB Connection Error:', err.message));

// Models Import
const Product = require('./models/Product');
const Order = require('./models/Order');
const Review = require('./models/review');

// Multer Setup for Image Uploads
const uploadDirectory = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDirectory);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed.'));
        cb(null, true);
    }
});

// --- ROUTES ---

// 1. Get All Products
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (err) {
        console.error("Get Products Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Add Product (Admin)
app.post('/api/products', (req, res, next) => {
    if (!requireAdmin(req, res)) return;
    upload.single('image')(req, res, err => {
        if (err) return res.status(400).json({ error: err.message });
        next();
    });
}, async (req, res) => {
    try {
        const { title, price, category, stock, description, sizes } = req.body;
        if (!req.file) return res.status(400).json({ error: 'Please choose a product image.' });
        const image = `/uploads/${req.file.filename}`;

        const newProduct = new Product({
            title,
            price,
            category,
            image,
            stock,
            description,
            sizes: typeof sizes === 'string' ? sizes.split(',').map(size => size.trim()).filter(Boolean) : []
        });

        await newProduct.save();
        res.status(201).json({ message: 'Product added successfully for Umeed.pk', newProduct });
    } catch (err) {
        console.error("ASAL BACKEND ERROR:", err);
        res.status(500).json({ error: err.message });
    }
});

// Update stock
app.patch('/api/products/:id/stock', async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const stock = Number(req.body.stock);
        if (!Number.isInteger(stock) || stock < 0) {
            return res.status(400).json({ error: 'Stock must be a whole number of zero or more.' });
        }
        const product = await Product.findByIdAndUpdate(req.params.id, { stock }, { new: true, runValidators: true });
        if (!product) return res.status(404).json({ error: 'Product not found.' });
        res.json(product);
    } catch (err) {
        console.error("Update Stock Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Purchase Route
app.post('/api/purchase/:id', async (req, res) => {
    try {
        const quantity = Number(req.body.quantity || 1);
        const product = await Product.findOneAndUpdate(
            { _id: req.params.id, stock: { $gte: quantity } },
            { $inc: { stock: -quantity } },
            { new: true }
        );
        if (!product) return res.status(409).json({ message: 'This piece does not have enough stock.' });
        res.json({ success: true, product });
    } catch (err) {
        console.error("Purchase Error:", err);
        res.status(500).json({ message: 'Unable to complete this purchase.' });
    }
});

// Orders Routes
app.post('/api/orders', async (req, res) => {
    try {
        const { customer, items } = req.body;
        if (!customer?.name || !customer?.phone || !customer?.address || !customer?.city || !Array.isArray(items) || !items.length) {
            return res.status(400).json({ message: 'Please provide your name, phone, delivery address, city, and at least one item.' });
        }
        const orderItems = [];
        for (const item of items) {
            const quantity = Number(item.quantity);
            if (!Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ message: 'Invalid item quantity.' });
            const product = await Product.findOneAndUpdate({ _id: item.id, stock: { $gte: quantity } }, {$inc: { stock: -quantity } }, { new: true });
            if (!product) return res.status(409).json({ message: 'One of your selected pieces is no longer available.' });
            orderItems.push({ productId: product._id, title: product.title, price: product.price, quantity });
        }
        const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const order = await Order.create({ customer, items: orderItems, total });
        res.status(201).json({ success: true, orderId: order._id });
    } catch (err) {
        console.error("Create Order Error:", err);
        res.status(500).json({ message: 'Unable to place the order.' });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        res.json(await Order.find().sort({ createdAt: -1 }));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Product
app.delete('/api/products/:id', async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: 'Product deleted successfully' });
    } catch (err) {
        console.error("Delete Product Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Admin Login Route
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === adminUsername && password === adminPassword) {
        const token = crypto.randomBytes(32).toString('hex');
        adminSessions.add(token);
        res.json({ success: true, message: 'Login successful', token });
    } else {
        res.json({ success: false, message: 'Invalid username or password' });
    }
});

function requireAdmin(req, res) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token || !adminSessions.has(token)) {
        res.status(401).json({ error: 'Admin login required.' });
        return false;
    }
    return true;
}

app.patch('/api/orders/:id/status', async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const allowed = ['New', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];
        if (!allowed.includes(req.body.status)) return res.status(0).json({ error: 'Invalid order status.' });
        const order = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
        if (!order) return res.status(404).json({ error: 'Order not found.' });
        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reviews Routes
app.get('/api/reviews', async (req, res) => {
    try {
        const reviews = await Review.find().sort({ createdAt: -1 });
        res.json(reviews);
    } catch (err) {
        console.error("Get Reviews Error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/reviews', async (req, res) => {
    try {
        const { name, comment, rating } = req.body;
        const newReview = new Review({ name, comment, rating });
        await newReview.save();
        res.status(201).json({ message: 'Review added successfully', newReview });
    } catch (err) {
        console.error("Add Review Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Umeed.pk Server running on port ${PORT}`));