# 🚀 DEPLOY WEBCHAT LÊN RENDER

## 📋 Các bước deploy

### 1. Chuẩn bị
- Đảm bảo code đã được commit và push lên Git repository
- Có tài khoản Render.com

### 2. Deploy sử dụng Render Blueprint (Khuyến nghị)

#### Bước 1: Tạo Blueprint
- Truy cập [render.com](https://render.com)
- Click "New +" → "Blueprint"
- Connect Git repository của bạn
- Chọn repository chứa code webchat

#### Bước 2: Deploy
- Render sẽ tự động detect `render.yaml`
- Click "Apply" để tạo services
- Đợi build và deploy hoàn tất

### 3. Deploy thủ công

#### Bước 1: Tạo Web Service
- Click "New +" → "Web Service"
- Connect Git repository
- Chọn branch và root directory

#### Bước 2: Cấu hình
```
Name: webchat-backend
Environment: Python
Build Command: pip install -r requirements.txt
Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

#### Bước 3: Tạo Database
- Click "New +" → "PostgreSQL"
- Chọn plan Starter ($7/month)
- Copy connection string

#### Bước 4: Environment Variables
```
DATABASE_URL: [PostgreSQL connection string]
SECRET_KEY: [Generated secret key]
ENVIRONMENT: production
```

### 4. Kiểm tra
- Health check: `https://your-app.onrender.com/health`
- API docs: `https://your-app.onrender.com/docs`

## 🔧 Troubleshooting

### Lỗi thường gặp:
1. **Database connection failed** → Kiểm tra DATABASE_URL
2. **Build failed** → Kiểm tra requirements.txt
3. **Runtime errors** → Xem logs trong Render dashboard

## 💰 Chi phí
- **Web Service**: $7/month (Starter plan)
- **Database**: $7/month (Starter plan)
- **Tổng**: $14/month

## 📞 Hỗ trợ
- Render Docs: [docs.render.com](https://docs.render.com)
- Render Community: [community.render.com](https://community.render.com)
