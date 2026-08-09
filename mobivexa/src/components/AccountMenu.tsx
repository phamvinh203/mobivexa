import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import {
  Box,
  Divider,
  ListItemIcon,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import { MapPin, Package, User } from "lucide-react";
import { useAuth } from "../features/auth/hooks/useAuth";

/**
 * Tách riêng và lazy-load: MUI Menu kéo theo Popover + Modal + FocusTrap
 * (~40 kB) nhưng chỉ cần khi người dùng bấm vào avatar. Để chung trong
 * AppHeader — vốn render ở mọi trang — sẽ nhét đống đó vào chunk đầu tiên,
 * kể cả với khách chưa đăng nhập.
 */
export function AccountMenu({
  anchorEl,
  onClose,
}: {
  anchorEl: HTMLElement | null;
  onClose: () => void;
}): ReactElement {
  const { user, logout } = useAuth();

  // Không tự navigate: auth đổi → router invalidate → guard của /account đá về
  // /login. Gọi navigate ở đây sẽ chạy trước khi guard thấy trạng thái mới.
  const handleLogout = async (): Promise<void> => {
    onClose();
    await logout();
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={anchorEl !== null}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      slotProps={{ paper: { sx: { width: 224 } } }}
    >
      <Box sx={{ px: 2, py: 1 }}>
        <Typography noWrap sx={{ fontSize: 14, fontWeight: 600 }}>
          {user?.fullName}
        </Typography>
        <Typography noWrap variant="caption" color="text.secondary">
          {user?.email}
        </Typography>
      </Box>

      <Divider />

      <MenuItem component={Link} to="/account" onClick={onClose}>
        <ListItemIcon>
          <User size={16} aria-hidden />
        </ListItemIcon>
        Tài khoản của tôi
      </MenuItem>

      <MenuItem component={Link} to="/account/orders" onClick={onClose}>
        <ListItemIcon>
          <Package size={16} aria-hidden />
        </ListItemIcon>
        Đơn hàng của tôi
      </MenuItem>

      <MenuItem component={Link} to="/account/addresses" onClick={onClose}>
        <ListItemIcon>
          <MapPin size={16} aria-hidden />
        </ListItemIcon>
        Địa chỉ của tôi
      </MenuItem>

      <Divider />

      <MenuItem onClick={handleLogout} sx={{ color: "error.main" }}>
        Đăng xuất
      </MenuItem>
    </Menu>
  );
}
