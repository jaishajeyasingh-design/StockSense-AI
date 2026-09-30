# STOCKSENSE AI
## AI-Powered Demand Forecasting & Smart Inventory Optimization

StockSense AI is an intelligent web-based inventory management and demand forecasting platform built on the **MERN (MongoDB, Express, React, Node.js)** stack.

The system addresses critical retail inventory challenges by tracking historical sales, monitoring current stock, predicting future product demand, identifying stockout/overstock risks, and recommending optimal reorder quantities.

---

## 🌟 Key Features

1. **Executive Dashboard**: Interactive analytics with real-time stat cards, revenue trend charts, demand forecast comparisons, active risk alerts, and recent transaction feeds.
2. **Product Catalog Management (CRUD)**: Create, view, search, filter, update, and delete products with automatic safety threshold status indicators.
3. **Sales Checkout & Automated Stock Reduction**: Record transactions with real-time stock deduction, preventing over-selling beyond available inventory.
4. **AI Demand Forecasting Engine**: Pluggable explainable moving-average demand forecasting calculating predicted daily demand, weekly demand, and reorder recommendations.
5. **Stockout & Overstock Risk Detection**: Automated classification:
   - 🔴 `STOCKOUT_RISK`: `currentStock < forecastWeeklyDemand`
   - 🔵 `OVERSTOCK`: `currentStock > forecastWeeklyDemand * 2`
   - 🟢 `HEALTHY`: Stock within normal operational boundaries
6. **Reorder Recommendation Engine**: Computes exact replenishment needed: `Max(0, forecastWeeklyDemand - currentStock)`.
7. **Role-Based JWT Authentication**: Secure role access for `ADMIN`, `MANAGER`, and `STAFF`.

---

## 🛠️ Technology Stack

- **Frontend**: React (Vite), React Router v7, Axios, Recharts, Lucide Icons, Tailwind CSS
- **Backend**: Node.js, Express.js, JWT (`jsonwebtoken`), `bcryptjs`, REST APIs
- **Database**: MongoDB & Mongoose ORM

---

## 🏗️ Architecture & Data Flow

```
[ Historical Sales Data ]
           │
           ▼
[ Sales Data Processing & Moving Average ]
           │
           ▼
[ Daily & Weekly Demand Forecast ]
           │
           ▼
[ Inventory Comparison vs Stock Levels ]
           │
           ▼
[ Stockout Risk / Overstock Classification ]
           │
           ▼
[ Reorder Quantity Recommendation ]
           │
           ▼
[ Executive Dashboard & Interactive Charts ]
```

---

## 📁 Project Structure

```
StockSense-AI/
├── backend/
│   ├── config/
│   │   └── db.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Product.js
│   │   ├── Sale.js
│   │   └── Forecast.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── productRoutes.js
│   │   ├── salesRoutes.js
│   │   ├── forecastRoutes.js
│   │   └── dashboardRoutes.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── productController.js
│   │   ├── salesController.js
│   │   ├── forecastController.js
│   │   └── dashboardController.js
│   ├── services/
│   │   └── forecastingService.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── seed.js
│   ├── server.js
│   ├── package.json
│   └── .env
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   ├── Sidebar.jsx
    │   │   ├── StatCard.jsx
    │   │   ├── StockAlert.jsx
    │   │   └── ProductTable.jsx
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Dashboard.jsx
    │   │   ├── Products.jsx
    │   │   ├── Sales.jsx
    │   │   ├── Forecast.jsx
    │   │   └── Alerts.jsx
    │   ├── services/
    │   │   └── api.js
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── package.json
    └── vite.config.js
```

---

## 🔑 Demo Login Credentials

For instant demonstration during project review, use the 1-click login buttons on the login screen or enter:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@stocksense.ai` | `admin123` | Full Access (Create, Edit, Delete Products, Sales, Forecasts, Alerts) |
| **MANAGER** | `manager@stocksense.ai` | `manager123` | Create & Edit Products, View Dashboard, Sales, Forecasts, Alerts |
| **STAFF** | `staff@stocksense.ai` | `staff123` | View Products, Enter Sales |

---

## ⚡ Quick Start Guide

### Prerequisites
- Node.js (v18+)
- Local MongoDB running on `mongodb://127.0.0.1:27017`

### Step 1: Start Backend Server & Seed Data

```bash
cd backend
npm install
npm run seed     # Populates products, sales history, and forecasts
npm run dev      # Starts Express server on http://localhost:5000
```

### Step 2: Start Frontend Application

In a new terminal window:

```bash
cd frontend
npm install
npm run dev      # Starts Vite React dev server on http://localhost:3000
```

Open your browser at `http://localhost:3000`.

---

## 📡 API Endpoint Reference

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user & return JWT token
- `GET /api/auth/me` - Get current user profile

### Products
- `GET /api/products` - List products (supports `?search=` and `?category=`)
- `POST /api/products` - Create new product SKU
- `GET /api/products/:id` - Get product details
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Sales
- `GET /api/sales` - Get sales history
- `POST /api/sales` - Record new sale & automatically reduce stock
- `GET /api/sales/product/:productId` - Get sales history for specific product

### Forecasts
- `GET /api/forecast/:productId` - Get demand forecast for a product
- `POST /api/forecast/:productId` - Generate & save fresh forecast
- `POST /api/forecast/generate-all` - Batch generate forecasts for all products

### Dashboard
- `GET /api/dashboard` - Get executive analytics, sales trend, forecast charts & alerts

---

## 🎓 Viva Questions & Answers

**Q1: How does StockSense AI predict product demand?**
> *Answer*: The system analyzes historical sales transactions recorded in MongoDB over time. It calculates the moving daily average consumption (`totalQuantity / daysSpan`), projects 7-day weekly demand (`dailyDemand * 7`), compares it against current stock levels, and flags stockout risk (`stock < weeklyDemand`) or overstock (`stock > 2 * weeklyDemand`).

**Q2: How does the system handle concurrent stock deduction during sales?**
> *Answer*: When a sale is posted (`POST /api/sales`), the backend verifies available stock (`product.stock >= quantity`). It then atomically decrements the stock in MongoDB (`product.stock -= quantity`) and immediately triggers forecast recalculation to update stock risk status in real-time.

**Q3: How is security handled for different user roles?**
> *Answer*: Passwords are encrypted using `bcryptjs` before storage. Authentication uses JSON Web Tokens (JWT) signed with a secret key. Middleware inspects the token on protected routes and verifies user role authorization (`ADMIN`, `MANAGER`, `STAFF`) before granting access to privileged operations like deleting products.

**Q4: Can TensorFlow.js or a Machine Learning neural network be integrated into this architecture?**
> *Answer*: Yes. The forecasting logic is encapsulated within `services/forecastingService.js`. The current statistical moving average serves as an explainable MVP baseline. A TensorFlow.js sequential LSTM model can be dropped directly into `forecastingService.js` without modifying any API routes or UI components.
