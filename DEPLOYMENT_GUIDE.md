# 🚀 HƯỚNG DẪN DEPLOY RAILWAY.APP

## 1. RAILWAY.APP (KHUYẾN NGHỊ)

### Bước 1: Tạo tài khoản
1. Vào https://railway.app
2. Đăng nhập bằng GitHub
3. Click "New Project" → "Deploy from GitHub repo"

### Bước 2: Deploy
1. Chọn repository `webchatmm`
2. Railway sẽ auto-detect Python 3.9
3. Click "Deploy Now"
4. Chờ build hoàn thành (khoảng 2-3 phút)

### Bước 3: Cấu hình Environment Variables
Vào Settings → Variables và thêm:

```
JWT_SECRET_KEY=railway-super-secret-jwt-key-2024
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
DATABASE_URL=sqlite:///./app.db
DEBUG=false
ENVIRONMENT=production
LOG_LEVEL=INFO
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

### Bước 4: Kiểm tra
- Health check: `https://your-app.railway.app/health`
- API docs: `https://your-app.railway.app/docs`
- Main app: `https://your-app.railway.app/`

### Bước 5: Cấu hình Domain (Optional)
1. Vào Settings → Domains
2. Thêm custom domain nếu có
3. Cấu hình DNS records

---

## 2. FLY.IO

### Bước 1: Cài đặt Fly CLI
```bash
# Windows
iwr https://fly.io/install.ps1 -useb | iex

# Mac/Linux
curl -L https://fly.io/install.sh | sh
```

### Bước 2: Deploy
```bash
flyctl auth login
flyctl launch
flyctl deploy
```

---

## 3. DETA

### Bước 1: Cài đặt Deta CLI
```bash
pip install deta
```

### Bước 2: Deploy
```bash
deta auth
deta new
deta deploy
```

---

## 4. PYTHONANYWHERE

### Bước 1: Tạo tài khoản
1. Vào https://www.pythonanywhere.com
2. Đăng ký tài khoản free

### Bước 2: Upload code
1. Upload toàn bộ code lên PythonAnywhere
2. Cài đặt dependencies: `pip3.10 install -r requirements.txt`

### Bước 3: Cấu hình WSGI
1. Vào Web tab
2. Tạo web app mới
3. Cấu hình WSGI file

---

## 📋 SO SÁNH CÁC PLATFORM

| Platform | Free Tier | Ease of Use | Python Support | Auto Deploy |
|----------|-----------|-------------|----------------|-------------|
| Railway.app | $5 credit | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Fly.io | 3 VMs | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Deta | Unlimited | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| PythonAnywhere | 1 app | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |

---

## 🎯 KHUYẾN NGHỊ

**Railway.app** là lựa chọn tốt nhất vì:
- ✅ Hỗ trợ Python tốt
- ✅ Auto-deploy từ GitHub
- ✅ Không cần cấu hình phức tạp
- ✅ Free tier đủ cho app nhỏ
- ✅ Tương thích với FastAPI
