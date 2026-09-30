const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Please add sales quantity'],
      min: [1, 'Quantity must be at least 1'],
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Sale', saleSchema);
