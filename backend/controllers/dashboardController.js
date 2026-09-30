const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Forecast = require('../models/Forecast');
const { forecastDemand } = require('../services/forecastingService');

// @desc    Get complete dashboard analytics
// @route   GET /api/dashboard
// @access  Public / Private
const getDashboardData = async (req, res) => {
  try {
    const products = await Product.find();
    const sales = await Sale.find().populate('productId', 'name category price');

    // Make sure we have fresh forecasts for all products
    let forecasts = await Forecast.find().populate('productId', 'name category stock reorderLevel');

    // If forecasts count doesn't match products, generate them
    if (forecasts.length < products.length) {
      for (const product of products) {
        const productSales = sales.filter(
          (s) => s.productId && s.productId._id.toString() === product._id.toString()
        );
        const computed = forecastDemand(productSales, product.stock);

        await Forecast.findOneAndUpdate(
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
      }
      forecasts = await Forecast.find().populate('productId', 'name category stock reorderLevel');
    }

    // Key metrics calculations
    const totalProducts = products.length;
    const totalInventory = products.reduce((sum, p) => sum + p.stock, 0);
    const lowStockProducts = products.filter((p) => p.stock <= p.reorderLevel).length;

    const stockoutRiskCount = forecasts.filter((f) => f.stockStatus === 'STOCKOUT_RISK').length;
    const overstockCount = forecasts.filter((f) => f.stockStatus === 'OVERSTOCK').length;
    const healthyProducts = forecasts.filter((f) => f.stockStatus === 'HEALTHY').length;

    const totalSalesAmount = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const recentSales = await Sale.find()
      .populate('productId', 'name category price')
      .sort({ date: -1 })
      .limit(6);

    // Sales Trend by day (last 7 days or aggregated)
    const salesTrendMap = {};
    sales.forEach((s) => {
      const dateStr = new Date(s.date).toISOString().split('T')[0];
      if (!salesTrendMap[dateStr]) {
        salesTrendMap[dateStr] = { date: dateStr, totalSales: 0, unitsSold: 0 };
      }
      salesTrendMap[dateStr].totalSales += s.totalAmount;
      salesTrendMap[dateStr].unitsSold += s.quantity;
    });

    const salesTrend = Object.values(salesTrendMap)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-7);

    // Alerts collection
    const alerts = forecasts
      .filter((f) => f.stockStatus === 'STOCKOUT_RISK' || f.stockStatus === 'OVERSTOCK')
      .map((f) => ({
        _id: f._id,
        productId: f.productId ? f.productId._id : null,
        productName: f.productId ? f.productId.name : 'Unknown Product',
        currentStock: f.currentStock,
        forecastWeeklyDemand: f.forecastWeeklyDemand,
        recommendedReorderQuantity: f.recommendedReorderQuantity,
        stockStatus: f.stockStatus,
        severity: f.stockStatus === 'STOCKOUT_RISK' ? 'HIGH' : 'MEDIUM',
      }));

    // Reorder recommendations table list
    const reorderRecommendations = forecasts
      .filter((f) => f.recommendedReorderQuantity > 0)
      .map((f) => ({
        productId: f.productId ? f.productId._id : null,
        productName: f.productId ? f.productId.name : 'Unknown',
        currentStock: f.currentStock,
        forecastWeeklyDemand: f.forecastWeeklyDemand,
        recommendedReorderQuantity: f.recommendedReorderQuantity,
        stockStatus: f.stockStatus,
      }));

    res.json({
      success: true,
      data: {
        summary: {
          totalProducts,
          totalInventory,
          lowStockProducts,
          stockoutRiskCount,
          overstockCount,
          healthyProducts,
          totalSalesAmount,
        },
        salesTrend,
        recentSales,
        forecastSummary: forecasts,
        alerts,
        reorderRecommendations,
      },
    });
  } catch (error) {
    console.error('getDashboardData error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

module.exports = {
  getDashboardData,
};
