/** Khớp UserRole enum bên backend (generated/prisma/enums.ts). */
export type UserRole = "CUSTOMER" | "STAFF" | "ADMIN";

/** User an toàn (không có passwordHash) — khớp USER_PUBLIC_SELECT bên backend. */
export interface AuthUser {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  avatarUrl: string | null;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterPayload {
  email: string;
  fullName: string;
  password: string;
  phone?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

/** registerService chỉ select 5 trường này — KHÔNG phải AuthUser đầy đủ.
 *  Đừng nới thành AuthUser, các field còn lại là undefined lúc chạy. */
export type RegisteredUser = Pick<
  AuthUser,
  "id" | "email" | "fullName" | "role" | "createdAt"
>;

export interface RegisterResult {
  message: string;
  user: RegisteredUser;
}

export interface LoginResult {
  message: string;
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
