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

export async function sendResetPasswordEmail(to: string, otp: string): Promise<void> {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'Mã OTP đặt lại mật khẩu - Mobivexa',
    html: `
      <p>Bạn đã yêu cầu đặt lại mật khẩu.</p>
      <p>Mã OTP của bạn là:</p>
      <h2 style="letter-spacing:6px;font-size:36px;color:#333">${otp}</h2>
      <p>Mã có hiệu lực trong <strong>15 phút</strong>. Không chia sẻ mã này với ai.</p>
      <p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
    `,
  })
}
