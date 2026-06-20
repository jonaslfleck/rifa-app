import nodemailer from 'nodemailer'

// Configurado via variáveis de ambiente (SMTP do Gmail ou outro provedor).
// SMTP_SECURE=true para porta 465; false/omitido para 587 (STARTTLS).
export function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export const smtpConfigurado = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
