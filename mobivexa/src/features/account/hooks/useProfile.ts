import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useAuth } from "../../auth/hooks/useAuth";
import { accountApi } from "../api/accountApi";
import type { AuthUser } from "../../auth/types";
import type {
  AvatarUploadResult,
  ChangePasswordPayload,
  UpdateProfilePayload,
} from "../types";

export interface UseProfileResult {
  user: AuthUser | null;
  updateProfile: UseMutationResult<AuthUser, Error, UpdateProfilePayload>;
  changePassword: UseMutationResult<
    { message: string },
    Error,
    ChangePasswordPayload
  >;
  uploadAvatar: UseMutationResult<AvatarUploadResult, Error, File>;
}

/** Hồ sơ cá nhân. Kết quả được đẩy ngược vào cache auth để header cập nhật ngay. */
export function useProfile(): UseProfileResult {
  const { user, setUser, patchUser } = useAuth();

  const updateProfile = useMutation({
    mutationFn: (payload: UpdateProfilePayload) => accountApi.updateMe(payload),
    onSuccess: setUser,
  });

  const changePassword = useMutation({
    mutationFn: (payload: ChangePasswordPayload) =>
      accountApi.changePassword(payload),
  });

  // Backend chỉ trả avatarUrl chứ không trả user đầy đủ → patch đúng field đó
  // thay vì ghi đè cả object.
  const uploadAvatar = useMutation({
    mutationFn: (file: File) => accountApi.uploadAvatar(file),
    onSuccess: (result) => patchUser({ avatarUrl: result.avatarUrl }),
  });

  return { user, updateProfile, changePassword, uploadAvatar };
}
