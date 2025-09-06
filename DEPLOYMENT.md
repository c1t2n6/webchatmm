# 🚀 Deployment Guide - WebChat App

## 📋 Prerequisites

- GitHub repository with the code
- Render.com account
- Domain name (optional)

## 🔧 Render.com Deployment Steps

### **Step 1: Connect Repository**
1. Go to [Render.com](https://render.com)
2. Sign in with your GitHub account
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Select the repository containing this code

### **Step 2: Configure Service**
1. **Name**: `webchat-app` (or your preferred name)
2. **Environment**: `Python 3`
3. **Plan**: `Starter` (free tier)
4. **Region**: Choose closest to your users

### **Step 3: Build & Deploy Settings**
```yaml
Build Command: pip install -r requirements.txt && python scripts/init_db.py
Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### **Step 4: Environment Variables**
Set these in Render dashboard:

```env
# Required
JWT_SECRET_KEY=your-super-secret-key-here
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
DATABASE_URL=sqlite:///./app.db
DEBUG=false
ENVIRONMENT=production

# Optional
PYTHON_VERSION=3.11.0
```

### **Step 5: Deploy**
1. Click "Create Web Service"
2. Wait for build to complete (5-10 minutes)
3. Your app will be available at `https://your-app-name.onrender.com`

## 🔍 Post-Deployment Verification

### **Health Check**
Visit: `https://your-app-name.onrender.com/health`

Expected response:
```json
{
  "status": "healthy",
  "service": "WebChat App",
  "database": "connected",
  "version": "1.0.0",
  "timestamp": "2025-01-25T00:00:00Z"
}
```

### **API Documentation**
Visit: `https://your-app-name.onrender.com/docs`

### **Test Endpoints**
1. **Register**: `POST /auth/register`
2. **Login**: `POST /auth/login`
3. **Create Room**: `POST /chat/rooms`
4. **WebSocket**: `WS /ws/chat/{room_id}`

## 🛠️ Troubleshooting

### **Common Issues**

#### **1. Build Fails**
- Check Python version (3.11.0 recommended)
- Verify all dependencies in requirements.txt
- Check build logs for specific errors

#### **2. Database Issues**
- Ensure `python scripts/init_db.py` runs successfully
- Check DATABASE_URL format
- Verify database file permissions

#### **3. WebSocket Issues**
- Check if WebSocket connections are allowed
- Verify CORS settings
- Test with browser developer tools

#### **4. Authentication Issues**
- Verify JWT_SECRET_KEY is set
- Check token expiration settings
- Test with Postman or curl

### **Debug Commands**

#### **Check Logs**
```bash
# In Render dashboard, go to "Logs" tab
# Look for error messages and stack traces
```

#### **Test Database**
```bash
# Visit: https://your-app-name.onrender.com/health
# Check if database status is "connected"
```

#### **Test WebSocket**
```javascript
// In browser console
const ws = new WebSocket('wss://your-app-name.onrender.com/ws/chat/1');
ws.onopen = () => console.log('Connected');
ws.onerror = (e) => console.error('Error:', e);
```

## 🔄 Updates & Maintenance

### **Deploying Updates**
1. Push changes to your GitHub repository
2. Render will automatically detect changes
3. New deployment will start automatically
4. Monitor logs for any issues

### **Database Migrations**
If you need to update database schema:
1. Update models in `app/models/`
2. Create migration script
3. Add migration to build command
4. Deploy

### **Environment Variable Updates**
1. Go to Render dashboard
2. Navigate to "Environment" tab
3. Update variables as needed
4. Redeploy service

## 📊 Monitoring

### **Render Dashboard**
- **Metrics**: CPU, Memory, Response Time
- **Logs**: Real-time application logs
- **Deployments**: Deployment history

### **Health Monitoring**
- Set up external monitoring for `/health` endpoint
- Monitor response times and availability
- Set up alerts for failures

## 🔒 Security Considerations

### **Production Security**
- Use strong JWT_SECRET_KEY
- Enable HTTPS (automatic on Render)
- Set DEBUG=false
- Monitor for suspicious activity

### **Database Security**
- Regular backups
- Monitor database size
- Consider upgrading to PostgreSQL for production

## 📈 Scaling

### **Upgrade Plan**
- **Starter**: Free tier, good for testing
- **Standard**: $7/month, better performance
- **Pro**: $25/month, production ready

### **Database Upgrade**
- Consider PostgreSQL for production
- Set up database backups
- Monitor database performance

## 🆘 Support

### **Render Support**
- [Render Documentation](https://render.com/docs)
- [Render Community](https://community.render.com)

### **Application Support**
- Check application logs
- Review API documentation
- Test with health check endpoint

---

**Happy Deploying! 🚀**
