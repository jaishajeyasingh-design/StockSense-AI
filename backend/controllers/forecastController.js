const Forecast = require('../models/Forecast');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const { forecastDemand } = require('../services/forecastingService');

// @desc    Get demand forecast for a product
// @route   GET /api/forecast/:productId
// @access  Public / Private
const getForecast = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const salesHistory = await Sale.find({ productId }).sort({ date: 1 });
    const computed = forecastDemand(salesHistory, product.stock);

    // Save or update forecast record
    const forecast = await Forecast.findOneAndUpdate(
      { productId },
      {
        productId,
        forecastDailyDemand: computed.forecastDailyDemand,
        forecastWeeklyDemand: computed.forecastWeeklyDemand,
        currentStock: computed.currentStock,
        stockStatus: computed.stockStatus,
        recommendedReorderQuantity: computed.recommendedReorderQuantity,
        generatedAt: new Date(),
      },
      { upsert: true, new: true }
    ).populate('productId', 'name category price stock reorderLevel');

    res.json({
      success: true,
      data: {
        ...forecast.toObject(),
        salesHistoryCount: salesHistory.length,
        salesHistory,
      },
    });
  } catch (error) {
    console.error('getForecast error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// @desc    Generate & save fresh forecast for a product
// @route   POST /api/forecast/:productId
// @access  Private (ADMIN, MANAGER)
const generateForecast = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const salesHistory = await Sale.find({ productId }).sort({ date: 1 });
    const computed = forecastDemand(salesHistory, product.stock);

    const forecast = await Forecast.findOneAndUpdate(
      { productId },
      {
        productId,
        forecastDailyDemand: computed.forecastDailyDemand,
        forecastWeeklyDemand: computed.forecastWeeklyDemand,
        currentStock: computed.currentStock,
        stockStatus: computed.stockStatus,
        recommendedReorderQuantity: computed.recommendedReorderQuantity,
        generatedAt: new Date(),
      },
      { upsert: true, new: true }
    ).populate('productId', 'name category price stock');

    res.json({
      success: true,
      message: 'Demand forecast generated successfully',
      data: {
        ...forecast.toObject(),
        salesHistory,
      },
    });
  } catch (error) {
    console.error('generateForecast error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// @desc    Batch generate forecasts for all products
// @route   POST /api/forecast/generate-all
// @access  Private (ADMIN, MANAGER)
const generateAllForecasts = async (req, res) => {
  try {
    const products = await Product.find();
    const results = [];

    for (const product of products) {
      const salesHistory = await Sale.find({ productId: product._id });
      const computed = forecastDemand(salesHistory, product.stock);

      const forecast = await Forecast.findOneAndUpdate(
        { productId: product._id },
        {
          productId: product._id,
          forecastDailyDemand: computed.forecastDailyDemand,
          forecastWeeklyDemand: computed.forecastWeeklyDemand,
          currentStock: computed.currentStock,
          stockStatus: computed.stockStatus,
          recommendedReorderQuantity: computed.recommendedReorderQuantity,
          generatedAt: new Date(),
        },
        { upsert: true, new: true }
      );
      results.push(forecast);
    }

    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    console.error('generateAllForecasts error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

module.exports = {
  getForecast,
  generateForecast,
  generateAllForecasts,
};
