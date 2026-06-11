import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

export async function sendResetPasswordEmail(to: string, token: string): Promise<void> {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'Đặt lại mật khẩu - Mobivexa',
    html: `
      <p>Bạn đã yêu cầu đặt lại mật khẩu.</p>
      <p>Nhấn vào link bên dưới để đặt lại mật khẩu (hết hạn sau 15 phút):</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
    `,
  })
}
