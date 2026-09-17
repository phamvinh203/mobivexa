export interface RegisterBody {
  email: string
  fullName: string
  password: string
  phone?: string
}

export interface LoginBody {
  email: string
  password: string
}

export interface RefreshTokenBody {
  refreshToken: string
}

export interface ForgotPasswordBody {
  email: string
}

export interface ResetPasswordBody {
  otp: string
  newPassword: string
  // Tùy chọn: có thì bật đếm số lần đoán OTP sai theo user (chống brute-force)
  email?: string
}

export interface LogoutBody {
  refreshToken: string
}

export interface JwtPayload {
  userId: string
  email: string
  role: string
  // 'access' cho token đăng nhập, 'guest_chat' cho token sở hữu phiên chat khách
  typ?: string
}
