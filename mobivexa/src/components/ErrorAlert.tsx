import type { ReactElement } from "react";
import { Alert } from "@mui/material";
import { extractErrorMessage } from "../lib/errorMessage";

/** Hiện lỗi bất kỳ (AxiosError, Error, unknown) — không có lỗi thì không hiện gì. */
export function ErrorAlert({ error }: { error: unknown }): ReactElement | null {
  if (!error) return null;
  return <Alert severity="error">{extractErrorMessage(error)}</Alert>;
}
