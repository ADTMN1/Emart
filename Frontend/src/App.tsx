import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'

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
const Warehouse = lazy(() => import('./pages/Warehouse'))
const Shipping = lazy(() => import('./pages/Shipping'))
const Account = lazy(() => import('./pages/Account'))
const Wallet = lazy(() => import('./pages/Wallet'))
const Favorites = lazy(() => import('./pages/Favorites'))

const AdminLayout = lazy(() => import('./components/admin/AdminLayout').then((module) => ({ default: module.AdminLayout })))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard').then((module) => ({ default: module.Dashboard })))
const AdminProducts = lazy(() => import('./pages/admin/Products').then((module) => ({ default: module.AdminProducts })))
const AdminProductForm = lazy(() => import('./pages/admin/ProductForm').then((module) => ({ default: module.AdminProductForm })))
const AdminCategories = lazy(() => import('./pages/admin/Categories').then((module) => ({ default: module.AdminCategories })))
const AdminOrders = lazy(() => import('./pages/admin/Orders').then((module) => ({ default: module.AdminOrders })))
const AdminOrderDetail = lazy(() => import('./pages/admin/OrderDetail').then((module) => ({ default: module.AdminOrderDetail })))
const AdminWarehouse = lazy(() => import('./pages/admin/Warehouse').then((module) => ({ default: module.AdminWarehouse })))
const AdminShipping = lazy(() => import('./pages/admin/Shipping').then((module) => ({ default: module.AdminShipping })))
const AdminCustomers = lazy(() => import('./pages/admin/Customers').then((module) => ({ default: module.AdminCustomers })))
const AdminSettings = lazy(() => import('./pages/admin/Settings').then((module) => ({ default: module.AdminSettings })))

function App() {
  return (
    <Suspense fallback={null}>
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
          <Route path="orders" element={<MyOrders />} />
          <Route path="orders/:id" element={<OrderDetails />} />
          <Route path="warehouse" element={<Warehouse />} />
          <Route path="shipping" element={<Shipping />} />
          <Route path="account" element={<Account />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="favorites" element={<Favorites />} />
        </Route>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="products/new" element={<AdminProductForm />} />
          <Route path="products/:id/edit" element={<AdminProductForm />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/:id" element={<AdminOrderDetail />} />
          <Route path="warehouse" element={<AdminWarehouse />} />
          <Route path="shipping" element={<AdminShipping />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
