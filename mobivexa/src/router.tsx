import { Suspense, lazy, type ReactElement } from "react";
import {
  Navigate,
  Outlet,
  RouterProvider,
  createBrowserRouter,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { useAuth } from "./features/auth/hooks/useAuth";
import { LoadingScreen } from "./components/LoadingScreen";
import { ClientLayout } from "./layouts/ClientLayout";
import { AuthLayout } from "./layouts/AuthLayout";
import { AccountLayout } from "./layouts/AccountLayout";
import { AppErrorPage } from "./components/AppErrorPage";
import { NotFoundPage } from "./components/NotFoundPage";
import { RouteErrorAlert } from "./components/RouteErrorAlert";

// Mỗi page nạp thành chunk riêng — thay cho autoCodeSplitting của TanStack. Để
// import tĩnh thì cả 8 trang dồn vào một bundle (~670 kB), khách vào trang chủ
// vẫn phải tải luôn code trang tài khoản.
const HomePage = lazy(() =>
  import("./pages/HomePage").then((m) => ({ default: m.HomePage })),
);
const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import("./pages/RegisterPage").then((m) => ({ default: m.RegisterPage })),
);
const ProfilePage = lazy(() =>
  import("./pages/account/ProfilePage").then((m) => ({
    default: m.ProfilePage,
  })),
);
const AddressesPage = lazy(() =>
  import("./pages/account/AddressesPage").then((m) => ({
    default: m.AddressesPage,
  })),
);
const OrdersPage = lazy(() =>
  import("./pages/account/OrdersPage").then((m) => ({ default: m.OrdersPage })),
);
const PasswordPage = lazy(() =>
  import("./pages/account/PasswordPage").then((m) => ({
    default: m.PasswordPage,
  })),
);
const ReviewsPage = lazy(() =>
  import("./pages/account/ReviewsPage").then((m) => ({
    default: m.ReviewsPage,
  })),
);

/**
 * Guard "khách": đã đăng nhập thì không có lý do gì xem /login, /register nữa →
 * đưa về ?redirect (route định vào trước khi bị chặn) hoặc trang chủ. Vì guard
 * là component đọc useAuth, nó tự render lại khi auth đổi: đăng nhập xong,
 * <Navigate> ở đây tự bắn — không nơi nào phải tự navigate sau login.
 */
function GuestGuard(): ReactElement {
  const { isAuthenticated } = useAuth();
  const [params] = useSearchParams();

  if (isAuthenticated) {
    return <Navigate to={params.get("redirect") ?? "/"} replace />;
  }
  return <AuthLayout />;
}

/**
 * Guard vùng /account: chưa đăng nhập thì đá về /login kèm ?redirect để đăng
 * nhập xong quay lại đúng chỗ. Cùng lý do trên: logout ở /account → guard render
 * lại → tự chuyển về /login, khỏi cần invalidate thủ công.
 */
function RequireAuth(): ReactElement {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  return <AccountLayout />;
}

// Suspense ở root lo fallback lúc tải chunk cho trang chủ/đăng nhập/đăng ký;
// riêng các trang tài khoản có Suspense gần hơn trong AccountLayout (ListSkeleton)
// nên chúng dùng fallback đó, không rơi về LoadingScreen toàn trang.
function Root(): ReactElement {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Outlet />
    </Suspense>
  );
}

// Root chỉ mở Outlet cho hai nhóm layout _client / _auth; nó là nơi duy nhất bắt
// lỗi cấp app (errorElement) và URL sai (route "*").
const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
    errorElement: <AppErrorPage />,
    children: [
      // ── Nhóm mua sắm: navbar + footer ────────────────────────────────────
      {
        element: <ClientLayout />,
        children: [
          { index: true, element: <HomePage /> },
          {
            path: "account",
            // Guard + Suspense (trong AccountLayout) + errorElement đặt ở đây nên
            // mọi route con /account/* thừa hưởng đủ cả ba.
            element: <RequireAuth />,
            errorElement: <RouteErrorAlert />,
            children: [
              { index: true, element: <ProfilePage /> },
              { path: "addresses", element: <AddressesPage /> },
              { path: "orders", element: <OrdersPage /> },
              { path: "password", element: <PasswordPage /> },
              { path: "reviews", element: <ReviewsPage /> },
            ],
          },
        ],
      },

      // ── Nhóm xác thực: khung tối giản + guard khách ──────────────────────
      {
        element: <GuestGuard />,
        children: [
          { path: "login", element: <LoginPage /> },
          { path: "register", element: <RegisterPage /> },
        ],
      },

      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

/**
 * Có token nhưng chưa dựng được user từ cache → chờ getMe() xong rồi mới dựng
 * router, nếu không guard sẽ hiểu nhầm là chưa đăng nhập và đá người dùng ra.
 */
export function AppRouter(): ReactElement {
  const { isRestoring } = useAuth();
  if (isRestoring) return <LoadingScreen />;

  return <RouterProvider router={router} />;
}
