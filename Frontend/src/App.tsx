import { lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import { AdminLayout } from './components/admin/AdminLayout'

const Home = lazy(() => import('./pages/Home'))
const Marketplace = lazy(() => import('./pages/Marketplace'))
const Categories = lazy(() => import('./pages/Categories'))
const ProductDetails = lazy(() => import('./pages/ProductDetails'))
const Cart = lazy(() => import('./pages/Cart'))
const Checkout = lazy(() => import('./pages/Checkout'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const AuthCallback = lazy(() => import('./pages/AuthCallback'))
const MyOrders = lazy(() => import('./pages/MyOrders'))
const OrderDetails = lazy(() => import('./pages/OrderDetails'))
const Shipping = lazy(() => import('./pages/Shipping'))
const Account = lazy(() => import('./pages/Account'))
const Wallet = lazy(() => import('./pages/Wallet'))
const Favorites = lazy(() => import('./pages/Favorites'))
const SellerProducts = lazy(() => import('./pages/seller/SellerProducts'))
const SellerLayout = lazy(() => import('./components/seller/SellerLayout').then((module) => ({ default: module.SellerLayout })))
const SellerDashboard = lazy(() => import('./pages/seller/SellerDashboard'))
const SellerStore = lazy(() => import('./pages/seller/SellerStore'))
const SellerProductForm = lazy(() => import('./pages/admin/ProductForm').then((module) => ({ default: module.AdminProductForm })))
const AccountLayout = lazy(() => import('./components/account/AccountLayout').then((module) => ({ default: module.AccountLayout })))

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard').then((module) => ({ default: module.Dashboard })))
const AdminProducts = lazy(() => import('./pages/admin/Products').then((module) => ({ default: module.AdminProducts })))
const AdminProductImport = lazy(() => import('./pages/admin/ProductImport').then((module) => ({ default: module.AdminProductImport })))
const AdminImportHistory = lazy(() => import('./pages/admin/ImportHistory').then((module) => ({ default: module.AdminImportHistory })))
const AdminImportDetail = lazy(() => import('./pages/admin/ImportDetail').then((module) => ({ default: module.AdminImportDetail })))
const AdminProductForm = lazy(() => import('./pages/admin/ProductForm').then((module) => ({ default: module.AdminProductForm })))
const AdminCategories = lazy(() => import('./pages/admin/Categories').then((module) => ({ default: module.AdminCategories })))
const AdminOrders = lazy(() => import('./pages/admin/Orders').then((module) => ({ default: module.AdminOrders })))
const AdminReports = lazy(() => import('./pages/admin/Reports').then((module) => ({ default: module.AdminReports })))
const AdminOrderDetail = lazy(() => import('./pages/admin/OrderDetail').then((module) => ({ default: module.AdminOrderDetail })))
const AdminWarehouse = lazy(() => import('./pages/admin/Warehouse').then((module) => ({ default: module.AdminWarehouse })))
const AdminShipping = lazy(() => import('./pages/admin/Shipping').then((module) => ({ default: module.AdminShipping })))
const AdminCustomers = lazy(() => import('./pages/admin/Customers').then((module) => ({ default: module.AdminCustomers })))
const AdminSettings = lazy(() => import('./pages/admin/Settings').then((module) => ({ default: module.AdminSettings })))
const AdminWallets = lazy(() => import('./pages/admin/Wallets').then((module) => ({ default: module.AdminWallets })))
const AdminDeposits = lazy(() => import('./pages/admin/Deposits').then((module) => ({ default: module.AdminDeposits })))
const AdminSellerApplications = lazy(() => import('./pages/admin/SellerApplications').then((module) => ({ default: module.AdminSellerApplications })))
const AdminOrderMessages = lazy(() => import('./pages/admin/OrderMessages').then((module) => ({ default: module.AdminOrderMessages })))
const AdminNotifications = lazy(() => import('./pages/admin/Notifications').then((module) => ({ default: module.AdminNotifications })))
const SellerMessages = lazy(() => import('./pages/seller/SellerMessages').then((module) => ({ default: module.SellerMessages })))
const SellerMessageThread = lazy(() => import('./pages/seller/SellerMessageThread').then((module) => ({ default: module.SellerMessageThread })))

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="marketplace" element={<Marketplace />} />
          <Route path="categories" element={<Categories />} />
          <Route path="product/:id" element={<ProductDetails />} />
          <Route path="cart" element={<Cart />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="auth/callback" element={<AuthCallback />} />
          {/* Account + Store share ONE persistent shell (AccountLayout) —
              sidebar stays; only the main content column changes. */}
          <Route path="account" element={<AccountLayout />}>
            <Route index element={<Account />} />
            <Route path="overview" element={<Account />} />
            <Route path="wallet" element={<Account />} />
            <Route path="addresses" element={<Account />} />
            <Route path="payments" element={<Account />} />
            <Route path="seller" element={<Account />} />
            <Route path="notifications" element={<Account />} />
            <Route path="support" element={<Account />} />
          </Route>
          <Route path="orders" element={<AccountLayout />}>
            <Route index element={<MyOrders />} />
            <Route path=":id" element={<OrderDetails />} />
          </Route>
          <Route path="shipping" element={<AccountLayout />}>
            <Route index element={<Shipping />} />
          </Route>
          <Route path="wallet" element={<Wallet />} />
          <Route path="favorites" element={<Favorites />} />
          {/* Seller area — same Account/Store sidebar, compact seller sub-nav
              inside the content column instead of a second full sidebar. */}
          <Route path="seller" element={<AccountLayout />}>
            <Route element={<SellerLayout />}>
              <Route index element={<SellerDashboard />} />
              <Route path="products" element={<SellerProducts />} />
              <Route path="products/new" element={<SellerProductForm scope="seller" />} />
              <Route path="products/:id/edit" element={<SellerProductForm scope="seller" />} />
              <Route path="store" element={<SellerStore />} />
              <Route path="messages" element={<SellerMessages />} />
              <Route path="messages/:id" element={<SellerMessageThread />} />
            </Route>
          </Route>
        </Route>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="products/import" element={<AdminProductImport />} />
          <Route path="products/import/history" element={<AdminImportHistory />} />
          <Route path="products/import/:runId" element={<AdminImportDetail />} />
          <Route path="products/new" element={<AdminProductForm />} />
          <Route path="products/:id/edit" element={<AdminProductForm />} />
          <Route path="categories" element={<AdminCategories />} />
<Route path="orders" element={<AdminOrders />} />
              <Route path="orders/:id" element={<AdminOrderDetail />} />
              <Route path="orders/:orderId/messages" element={<AdminOrderMessages />} />
              <Route path="notifications" element={<AdminNotifications />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="sellers" element={<AdminSellerApplications />} />
          <Route path="warehouse" element={<AdminWarehouse />} />
          <Route path="shipping" element={<AdminShipping />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="wallets" element={<AdminWallets />} />
          <Route path="deposits" element={<AdminDeposits />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Routes>
  )
}

export default App
