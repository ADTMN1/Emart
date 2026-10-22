import { lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import { AdminLayout } from './components/admin/AdminLayout'
import { SellerCenterLayout } from './components/seller/SellerLayout'
import { BuyerRoute, BuyerOutlet } from './components/auth/BuyerRoute'

const RedirectToSellerOrdersRequests = () => <Navigate to="/seller/orders/requests" replace />;
const SellerOrderDetail = lazy(() => import('./pages/seller/SellerOrderDetail').then((module) => ({ default: module.SellerOrderDetail })));

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
const SellerOverview = lazy(() => import('./pages/seller/SellerOverview'))
const SellerStore = lazy(() => import('./pages/seller/SellerStore'))
const SellerProductForm = lazy(() => import('./pages/admin/ProductForm').then((module) => ({ default: module.AdminProductForm })))
const SellerInventory = lazy(() => import('./pages/seller/SellerInventory'))
const SellerOrderRequests = lazy(() => import('./pages/seller/SellerOrderRequests'))
const SellerConfirmedOrders = lazy(() => import('./pages/seller/SellerConfirmedOrders'))
const SellerSales = lazy(() => import('./pages/seller/SellerSales'))
const SellerPayments = lazy(() => import('./pages/seller/SellerPayments'))
const SellerSettings = lazy(() => import('./pages/seller/SellerSettings'))
const SellerShopLogo = lazy(() => import('./pages/seller/SellerShopLogo'))
const SellerShopBanner = lazy(() => import('./pages/seller/SellerShopBanner'))
const SellerShopSettings = lazy(() => import('./pages/seller/SellerShopSettings'))
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
const AdminSupport = lazy(() => import('./pages/admin/Support').then((module) => ({ default: module.AdminSupport })))
const AdminLoanRequests = lazy(() => import('./pages/admin/LoanRequests').then((module) => ({ default: module.AdminLoanRequests })))
const SupplierCatalog = lazy(() => import('./pages/admin/SupplierCatalog').then((module) => ({ default: module.SupplierCatalog })))
const SellerMessages = lazy(() => import('./pages/seller/SellerMessages').then((module) => ({ default: module.SellerMessages })))
const SellerMessageThread = lazy(() => import('./pages/seller/SellerMessageThread').then((module) => ({ default: module.SellerMessageThread })))
const SellerNotifications = lazy(() => import('./pages/seller/SellerNotifications').then((module) => ({ default: module.SellerNotifications })))

function App() {
  return (
    <Routes>
      {/* path="/" element={<Layout />} — the buyer shell: marketplace navbar,
          search, cart and wishlist. Sellers can still BROWSE here; the guards
          below only strip the purchasing surfaces, so public pages keep working
          for every role. */}
      <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="marketplace" element={<Marketplace />} />
          <Route path="categories" element={<Categories />} />
          <Route path="product/:id" element={<ProductDetails />} />
          <Route path="cart" element={<BuyerRoute><Cart /></BuyerRoute>} />
          <Route path="checkout" element={<BuyerRoute><Checkout /></BuyerRoute>} />
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
            <Route path="usdc-policy" element={<Account />} />
            <Route path="support" element={<Account />} />
            <Route path="loans" element={<Account />} />
          </Route>
          {/* Buyer orders + shipping share the account shell, so they use the
              Outlet form of the guard. */}
          <Route path="orders" element={<AccountLayout />}>
            <Route element={<BuyerOutlet />}>
              <Route index element={<MyOrders />} />
              <Route path=":id" element={<OrderDetails />} />
            </Route>
          </Route>
          <Route path="shipping" element={<AccountLayout />}>
            <Route element={<BuyerOutlet />}>
              <Route index element={<Shipping />} />
            </Route>
          </Route>
          <Route path="wallet" element={<BuyerRoute><Wallet /></BuyerRoute>} />
          <Route path="favorites" element={<Favorites />} />
        </Route>
        {/* Dedicated Seller Center — a genuinely separate application shell
            (its own sidebar + header), OUTSIDE the customer Layout so the
            marketplace navbar/search/cart/wishlist/footer never render here.
            The same top-level architectural pattern the Admin Dashboard uses. */}
        <Route path="/seller" element={<SellerCenterLayout />}>
          <Route index element={<SellerOverview />} />
          <Route path="products" element={<SellerProducts />} />
          <Route path="products/new" element={<SellerProductForm scope="seller" />} />
          <Route path="products/:id/edit" element={<SellerProductForm scope="seller" />} />
          <Route path="products/inventory" element={<SellerInventory />} />
          <Route path="orders" element={<RedirectToSellerOrdersRequests />} />
          <Route path="orders/requests" element={<SellerOrderRequests />} />
          <Route path="orders/:id" element={<SellerOrderDetail />} />
          <Route path="orders/confirmed" element={<SellerConfirmedOrders />} />
          <Route path="messages" element={<SellerMessages />} />
          <Route path="messages/:id" element={<SellerMessageThread />} />
          <Route path="notifications" element={<SellerNotifications />} />
          <Route path="shop" element={<SellerStore />} />
          <Route path="store" element={<SellerStore />} />
          <Route path="shop/logo" element={<SellerShopLogo />} />
          <Route path="shop/banner" element={<SellerShopBanner />} />
          <Route path="shop/settings" element={<SellerShopSettings />} />
          <Route path="sales" element={<SellerSales />} />
          <Route path="payments" element={<SellerPayments />} />
          <Route path="settings" element={<SellerSettings />} />
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
          <Route path="loans" element={<AdminLoanRequests />} />
          <Route path="warehouse" element={<AdminWarehouse />} />
          <Route path="shipping" element={<AdminShipping />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="wallets" element={<AdminWallets />} />
          <Route path="deposits" element={<AdminDeposits />} />
          <Route path="support" element={<AdminSupport />} />
          <Route path="suppliers/cj" element={<SupplierCatalog />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Routes>
  )
}

export default App
