const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    customer: {
        name: { type: String, required: true, trim: true },
        phone: { type: String, required: true, trim: true },
        email: { type: String, trim: true },
        address: { type: String, required: true, trim: true },
        city: { type: String, required: true, trim: true }
    },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, required: true },
        title: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true, min: 1 }
    }],
    total: { type: Number, required: true },
    paymentMethod: { type: String, default: 'Cash on delivery' },
    status: { type: String, enum: ['New', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'], default: 'New' }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
