import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;
let testAccount: { user: string; pass: string } | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) {
    return transporter;
  }

  // In development, use Ethereal (nodemailer's free test email service)
  testAccount = await nodemailer.createTestAccount();
  console.log('Ethereal test account created:', testAccount.user);

  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  return transporter;
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  const transport = await getTransporter();

  const mailOptions = {
    from: '"Peerzle" <noreply@peerzle.com>',
    to,
    subject: 'Reset your Peerzle password',
    text: `Hi,

You requested to reset your Peerzle password. Click the link below to set a new password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request this, you can safely ignore this email.

- The Peerzle Team`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1E3A5F; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #2B7CF6; margin: 0;">Peerzle</h1>
  </div>

  <p>Hi,</p>

  <p>You requested to reset your Peerzle password. Click the button below to set a new password:</p>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${resetUrl}" style="display: inline-block; background-color: #2B7CF6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 24px; font-weight: 600;">Reset Password</a>
  </div>

  <p style="color: #64748B; font-size: 14px;">This link will expire in 1 hour.</p>

  <p style="color: #64748B; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>

  <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 30px 0;">

  <p style="color: #94A3B8; font-size: 12px; text-align: center;">
    - The Peerzle Team
  </p>
</body>
</html>
`,
  };

  const info = await transport.sendMail(mailOptions);

  // Log the Ethereal preview URL so we can verify emails in dev
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log('========================================');
    console.log('Email Preview URL:', previewUrl);
    console.log('========================================');
  }
}
