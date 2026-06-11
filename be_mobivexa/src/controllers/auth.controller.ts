import { Request, Response, NextFunction } from 'express'

// đăng ký
export const register = async (req: Request, res: Response, next: NextFunction) => {
  // Implementation for register
};

// đăng nhập
export const login = async (req: Request, res: Response, next: NextFunction) => {
  // Implementation for login
}

// làm mới access token
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  // Implementation for refresh token
}

// quên mật khẩu ==> gửi otp qua email
export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  // Implementation for forgot password
}


// đặt lại mật khẩu ==> xác thực otp + mật khẩu mới
export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  // Implementation for reset password
}

// đăng xuất ==> revoke token
export const logout = async (req: Request, res: Response, next: NextFunction) => {
  // Implementation for logout
}