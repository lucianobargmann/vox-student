# 🔒 Security Guidelines

## ⚠️ **CRITICAL: Never Commit Credentials to Git**

### ❌ **What NOT to do:**
- Never commit `.env` files with real credentials
- Never commit API keys, passwords, or secrets
- Never commit database connection strings with credentials
- Never commit JWT secrets or encryption keys

### ✅ **What TO do:**
1. **Use `.env.example`** for template files (safe to commit)
2. **Add `.env*` to `.gitignore`** (already done)
3. **Use environment variables** in production
4. **Rotate secrets** if accidentally committed

## 🛡️ **Current Security Issues Fixed**

### 1. **Authentication Token Missing**
**Problem:** API calls were missing Authorization headers
**Solution:** Added proper token handling:

```typescript
const token = localStorage.getItem('auth_token');
if (!token) {
  toast.error('Sessão expirada. Faça login novamente.');
  router.push('/login');
  return;
}

const response = await fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### 2. **Environment Variables**
**Problem:** `.env` file was tracked in Git
**Solution:** 
- Use `.env.example` for templates
- Keep actual `.env` local only
- Use secure secrets in production

## 🔐 **Security Best Practices**

### **JWT Secrets**
```bash
# Generate secure JWT secret
openssl rand -base64 32
```

### **Environment Variables**
```bash
# Development
cp .env.example .env
# Edit .env with your local values

# Production
# Set environment variables in your hosting platform
```

### **Database Security**
- Use connection pooling
- Implement proper access controls
- Regular backups
- Monitor for suspicious activity

### **API Security**
- Always verify authentication
- Implement rate limiting
- Validate all inputs
- Use HTTPS in production

## 🚨 **If Credentials Are Compromised**

1. **Immediately rotate all secrets**
2. **Revoke compromised tokens**
3. **Update environment variables**
4. **Monitor for unauthorized access**
5. **Consider Git history cleanup** (if needed)

## 📋 **Security Checklist**

- [ ] `.env` files not committed to Git
- [ ] JWT secrets are secure and unique
- [ ] API endpoints require authentication
- [ ] Input validation implemented
- [ ] Error messages don't leak sensitive info
- [ ] HTTPS enabled in production
- [ ] Regular security audits
- [ ] Dependencies kept up to date

## 🔍 **Monitoring**

The application includes security event logging:
- Authentication attempts
- Data access patterns
- Failed authorization attempts
- Suspicious activities

Check `/admin/security` dashboard for security events.
