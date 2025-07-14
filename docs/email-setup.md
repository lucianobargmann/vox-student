# Email Configuration for VoxStudent

This document explains how to configure email sending for magic link authentication in VoxStudent.

## Overview

VoxStudent uses SMTP for sending magic link emails with automatic fallback to Mailpit for local development when SMTP settings are not configured.

## Configuration Options

### Option 1: Local Development with Mailpit (Recommended for Development)

For local development, simply leave the SMTP environment variables blank in your `.env` file. The system will automatically use Mailpit.

**Start Mailpit:**
```bash
docker run -d --name mailpit -p 8025:8025 -p 1025:1025 axllent/mailpit
```

**Access Mailpit Web Interface:**
- URL: http://localhost:8025
- All emails sent during development will appear here

### Option 2: Production SMTP Configuration

For production, configure your SMTP provider settings in your `.env` file:

```env
# SMTP Server Settings
SMTP_HOST="smtp.your-provider.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-smtp-username"
SMTP_PASS="your-smtp-password"

# Email From Settings
SMTP_FROM_NAME="VoxStudent"
SMTP_FROM_EMAIL="noreply@yourdomain.com"
```

## Environment Variables

### Required Variables
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-super-secret-jwt-key"
NEXTAUTH_URL="http://localhost:3000"
```

### Email Configuration Variables
```env
# SMTP Settings (leave blank for Mailpit)
SMTP_HOST=""                    # SMTP server hostname
SMTP_PORT="587"                 # SMTP server port (587 for TLS, 465 for SSL)
SMTP_SECURE="false"             # true for SSL (port 465), false for TLS (port 587)
SMTP_USER=""                    # SMTP username
SMTP_PASS=""                    # SMTP password

# Email Appearance
SMTP_FROM_NAME="VoxStudent"     # Sender name
SMTP_FROM_EMAIL="noreply@voxstudent.com"  # Sender email

# Magic Link Settings
MAGIC_LINK_EXPIRY_MINUTES="15"  # How long magic links are valid
SESSION_EXPIRY_DAYS="30"        # How long sessions last
```

## Popular SMTP Providers

### Gmail
```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"  # Use App Password, not regular password
```

### SendGrid
```env
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="apikey"
SMTP_PASS="your-sendgrid-api-key"
```

### Brevo (Sendinblue)
```env
SMTP_HOST="smtp-relay.brevo.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-brevo-email"
SMTP_PASS="your-brevo-smtp-key"
```

## How It Works

1. **Automatic Detection**: The system checks if `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are configured
2. **Production Mode**: If all SMTP settings are present, uses the configured SMTP server
3. **Development Mode**: If SMTP settings are missing, automatically falls back to Mailpit on `localhost:1025`
4. **Email Template**: Uses a responsive HTML template with VoxStudent branding
5. **Fallback**: Includes plain text version for email clients that don't support HTML

## Testing Email Functionality

### Test with Mailpit (Local Development)
1. Start Mailpit: `docker run -d --name mailpit -p 8025:8025 -p 1025:1025 axllent/mailpit`
2. Start your Next.js app: `npm run dev`
3. Go to login page and request a magic link
4. Check emails at: http://localhost:8025

### Test with Production SMTP
1. Configure your SMTP settings in `.env`
2. Start your app
3. Request a magic link
4. Check your actual email inbox

## Troubleshooting

### Common Issues

**Email not sending:**
- Check SMTP credentials are correct
- Verify SMTP server settings (host, port, security)
- Check firewall/network restrictions
- Review application logs for error messages

**Mailpit not working:**
- Ensure Docker is running
- Check if ports 1025 and 8025 are available
- Restart Mailpit container: `docker restart mailpit`

**Magic links not working:**
- Verify `NEXTAUTH_URL` matches your application URL
- Check magic link expiry time
- Ensure database is accessible

### Debug Mode
Set `NODE_ENV=development` to see magic link URLs in console logs for testing.

## Security Considerations

- Never commit SMTP credentials to version control
- Use environment-specific `.env` files (`.env.production`, `.env.staging`)
- Use App Passwords for Gmail instead of regular passwords
- Consider using dedicated email services for production
- Regularly rotate SMTP credentials

## Email Template Customization

The email template is defined in `src/lib/email.ts` and includes:
- Responsive HTML design
- VoxStudent branding
- Portuguese language
- Magic link button
- Expiry information
- Plain text fallback

To customize the template, modify the `mailOptions.html` and `mailOptions.text` properties in the `sendMagicLink` method.
