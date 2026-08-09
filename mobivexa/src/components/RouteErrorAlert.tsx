import type { ReactElement } from "react";
import { useRouteError } from "react-router-dom";
import { Button, Stack } from "@mui/material";
import { ErrorAlert } from "./ErrorAlert";

/**
 * errorElement dùng chung cho vùng /account. Không có nó thì lỗi ném ra từ
 * useSuspenseQuery leo lên tận errorElement cấp root (AppErrorPage) và nuốt mất
 * cả khung tài khoản.
 */
export function RouteErrorAlert(): ReactElement {
  const error = useRouteError();

  return (
    <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
      <ErrorAlert error={error} />
      <Button variant="outlined" onClick={() => window.location.reload()}>
        Thử lại
      </Button>
    </Stack>
  );
}
