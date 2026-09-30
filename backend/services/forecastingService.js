/**
 * StockSense AI - Demand Forecasting Service
 * 
 * MVP Algorithm:
 * 1. Analyzes historical sales data for a specific product.
 * 2. Computes the average daily demand across the recorded sales timeframe.
 * 3. Projects daily demand and 7-day weekly demand.
 * 4. Compares forecast against current stock level to evaluate stock status:
 *    - STOCKOUT_RISK: currentStock < forecastWeeklyDemand
 *    - OVERSTOCK: currentStock > forecastWeeklyDemand * 2
 *    - HEALTHY: normal inventory range
 * 5. Recommends reorder quantity = Max(0, forecastWeeklyDemand - currentStock).
 * 
 * Note: Designed as a pluggable abstraction so advanced TensorFlow.js models
 * can easily override or supplement this statistical engine in future iterations.
 */

const forecastDemand = (salesHistory, currentStock) => {
  // If no sales history exists, fallback to baseline default assumptions
  if (!salesHistory || salesHistory.length === 0) {
    const defaultDaily = 2;
    const defaultWeekly = defaultDaily * 7;
    let status = 'HEALTHY';
    if (currentStock < defaultWeekly) {
      status = 'STOCKOUT_RISK';
    } else if (currentStock > defaultWeekly * 2) {
      status = 'OVERSTOCK';
    }
    const recommendedReorder = Math.max(0, defaultWeekly - currentStock);

    return {
      forecastDailyDemand: defaultDaily,
      forecastWeeklyDemand: defaultWeekly,
      currentStock,
      stockStatus: status,
      recommendedReorderQuantity: recommendedReorder,
      algorithm: 'Baseline (Default)',
    };
  }

  // Calculate total units sold
  const totalQuantity = salesHistory.reduce((sum, sale) => sum + sale.quantity, 0);

  // Determine span of days in sales history
  let daysSpan = 1;
  const dates = salesHistory
    .map((s) => new Date(s.date).getTime())
    .filter((d) => !isNaN(d));

  if (dates.length > 1) {
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const diffTime = Math.abs(maxDate - minDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    daysSpan = Math.max(1, diffDays);
  }

  // Calculate average daily demand
  const avgDailyDemandRaw = totalQuantity / daysSpan;
  // Ensure daily demand is at least 1 for active items
  const forecastDailyDemand = Math.max(1, Math.round(avgDailyDemandRaw));
  const forecastWeeklyDemand = forecastDailyDemand * 7;

  // Stock status determination based on thresholds
  let stockStatus = 'HEALTHY';
  if (currentStock < forecastWeeklyDemand) {
    stockStatus = 'STOCKOUT_RISK';
  } else if (currentStock > forecastWeeklyDemand * 2) {
    stockStatus = 'OVERSTOCK';
  }

  // Reorder calculation
  const recommendedReorderQuantity = Math.max(0, forecastWeeklyDemand - currentStock);

  return {
    forecastDailyDemand,
    forecastWeeklyDemand,
    currentStock,
    stockStatus,
    recommendedReorderQuantity,
    algorithm: 'Explainable Moving Average (MVP Engine)',
  };
};

module.exports = {
  forecastDemand,
};
