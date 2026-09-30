const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add product name'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Please add category'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Please add price'],
      min: [0, 'Price must be positive'],
    },
    stock: {
      type: Number,
      required: [true, 'Please add stock quantity'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    reorderLevel: {
      type: Number,
      required: true,
      default: 10,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
