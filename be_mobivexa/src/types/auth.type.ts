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

export interface JwtPayload {
  userId: string
  email: string
  role: string
}
