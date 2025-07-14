import nodemailer from 'nodemailer';

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = this.createTransporter();
  }

  private createTransporter(): nodemailer.Transporter {
    // Check if SMTP settings are configured
    const hasSmtpConfig = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

    if (hasSmtpConfig) {
      // Production SMTP configuration
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      // Mailpit configuration for local development (when SMTP not configured)
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST || '127.0.0.1',
        port: parseInt(process.env.SMTP_PORT || '1025'),
        secure: false,
        // No auth needed for Mailpit
        ignoreTLS: true,
      });
    }
  }

  async sendMagicLink(email: string, magicLink: string): Promise<{ success: boolean; messageId?: string }> {
    const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const loginUrl = `${appUrl}/auth/verify?token=${magicLink}`;

    const mailOptions = {
      from: {
        name: process.env.SMTP_FROM_NAME || 'VoxStudent',
        address: process.env.SMTP_FROM_EMAIL || 'noreply@voxstudent.com'
      },
      to: email,
      subject: 'Seu link de acesso - VoxStudent',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Link de Acesso - VoxStudent</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">VoxStudent</h1>
            <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Sistema de Gestão Educacional</p>
          </div>

          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">Acesse sua conta</h2>
            <p>Olá! Você solicitou acesso ao VoxStudent. Clique no botão abaixo para fazer login:</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}"
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 15px 30px;
                        text-decoration: none;
                        border-radius: 5px;
                        font-weight: bold;
                        display: inline-block;
                        transition: transform 0.2s;">
                🔐 Acessar VoxStudent
              </a>
            </div>

            <p style="color: #666; font-size: 14px;">
              <strong>⏰ Este link expira em ${process.env.MAGIC_LINK_EXPIRY_MINUTES || 15} minutos.</strong>
            </p>

            <p style="color: #666; font-size: 14px;">
              Se você não solicitou este acesso, pode ignorar este email com segurança.
            </p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

            <p style="color: #999; font-size: 12px; text-align: center;">
              Este é um email automático. Por favor, não responda.<br>
              © ${new Date().getFullYear()} VoxStudent - Sistema de Gestão Educacional
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
        VoxStudent - Link de Acesso

        Olá! Você solicitou acesso ao VoxStudent.

        Acesse através do link: ${loginUrl}

        Este link expira em ${process.env.MAGIC_LINK_EXPIRY_MINUTES || 15} minutos.

        Se você não solicitou este acesso, pode ignorar este email com segurança.

        © ${new Date().getFullYear()} VoxStudent
      `
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Magic link email sent:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send magic link email:', error);
      throw new Error('Failed to send email');
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('✅ Email service connection verified');
      return true;
    } catch (error) {
      console.error('❌ Email service connection failed:', error);
      return false;
    }
  }
}

const emailService = new EmailService();

export async function sendMagicLinkEmail(email: string, magicLinkToken: string): Promise<{ success: boolean; messageId?: string }> {
  return emailService.sendMagicLink(email, magicLinkToken);
}

export async function verifyEmailConnection(): Promise<boolean> {
  return emailService.verifyConnection();
}

export default emailService;
