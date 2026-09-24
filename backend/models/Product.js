const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    title: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    image: { type: String, required: true },
    stock: { type: Number, required: true, default: 1 },
    description: { type: String, trim: true, default: '' },
    sizes: { type: [String], default: [] }
});

module.exports = mongoose.model('Product', productSchema);