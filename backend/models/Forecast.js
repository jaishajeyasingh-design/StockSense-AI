const mongoose = require('mongoose');

const forecastSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    forecastDailyDemand: {
      type: Number,
      required: true,
    },
    forecastWeeklyDemand: {
      type: Number,
      required: true,
    },
    currentStock: {
      type: Number,
      required: true,
    },
    stockStatus: {
      type: String,
      enum: ['STOCKOUT_RISK', 'OVERSTOCK', 'HEALTHY'],
      required: true,
    },
    recommendedReorderQuantity: {
      type: Number,
      required: true,
      default: 0,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Forecast', forecastSchema);
