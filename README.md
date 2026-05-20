# Sentinel Backend API

**Complete traffic violation reporting system with Flutter mobile app, admin dashboard, and NestJS backend.**

## 📚 Documentation Quick Links

| Document | Purpose | Time |
|----------|---------|------|
| **[QUICK_START.md](./QUICK_START.md)** | 30-minute setup guide | 30 min ⚡ |
| **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** | Detailed step-by-step setup | 1 hour 📖 |
| **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** | Complete API reference | Reference 📖 |
| **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** | Database configuration | Reference 🗄️ |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | System design & data flows | Reference 🏗️ |
| **[FLUTTER_INTEGRATION_GUIDE.md](./FLUTTER_INTEGRATION_GUIDE.md)** | Mobile/web app integration | Reference 📱 |

**👉 New to the project? Start with [QUICK_START.md](./QUICK_START.md)**

---

## 🚀 Quick Start (5 Minutes)

```bash
# 1. Create .env file
cat > .env << EOF
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=3000
EOF

# 2. Install & run
npm install && npm run start:dev

# 3. Open API documentation
# http://localhost:3000/api/docs
```

---

## 📱 What's Included

### Backend
- NestJS API with authentication & authorization
- Supabase PostgreSQL database integration
- Real-time detection history tracking
- Admin dashboard endpoints
- File upload to cloud storage
- Swagger documentation
- Rate limiting & security

### Mobile App (Flutter)
- Location-based report creation
- Offline report queuing
- Real-time map visualization
- User authentication
- Report upvoting

### Admin Dashboard (Flutter Web)
- Live statistics dashboard
- Report management & verification
- User management
- Heatmap visualization
- Real-time updates

---

## 🎯 API Endpoints

```
Authentication
├─ POST   /auth/register
├─ POST   /auth/login
├─ POST   /auth/refresh
├─ GET    /auth/me
└─ POST   /auth/logout

Reports
├─ POST   /reports
├─ GET    /reports
├─ GET    /reports/nearby
├─ POST   /reports/{id}/upvote
└─ DELETE /reports/{id}

Detections
├─ POST   /detections/history
└─ GET    /detections/history

Admin (Protected)
├─ GET    /admin/dashboard/stats
├─ GET    /admin/reports
├─ PATCH  /admin/reports/{id}/status
├─ GET    /admin/users
└─ GET    /admin/history/heatmap

Upload
└─ POST   /upload/image
```

**See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete reference**

---

## 🔧 Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run start:dev

# Run tests
npm run test

# Build for production
npm build

# Run production
npm start
```

---

## 🗄️ Database Schema

Tables managed by Supabase:
- `profiles` - User profiles & admin roles
- `community_reports` - Traffic violation reports
- `distraction_history` - Detection history
- `report_updates` - Report status changes

**See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for complete schema**

---

## 🔒 Security

- ✅ JWT authentication via Supabase
- ✅ Role-based access control (RBAC)
- ✅ Row-level security (RLS) policies
- ✅ Rate limiting (10 req/s, 100 req/min)
- ✅ HTTPS in production
- ✅ CORS restrictions
- ✅ Input validation & sanitization

---

## 🚢 Deployment

### Backend
```bash
# Railway (recommended)
railway init && railway up

# Or Heroku
heroku create && git push heroku main
```

### Mobile App
```bash
# Android
flutter build apk --release

# iOS
flutter build ios --release
```

### Admin Dashboard
```bash
# Firebase
flutter build web && firebase deploy

# Or Netlify
flutter build web && netlify deploy --prod
```

**See [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Deployment section for details**

---

## 📊 Architecture

```
Flutter Mobile/Web
    ↓ (HTTP REST API)
NestJS Backend (http://localhost:3000/api/v1)
    ↓ (Service Role Key)
Supabase (PostgreSQL + Auth + Storage)
```

**See [ARCHITECTURE.md](./ARCHITECTURE.md) for system diagrams**

---

## 🧪 Testing

```bash
# Test backend API
curl http://localhost:3000/api/v1/reports

# Test Swagger docs
http://localhost:3000/api/docs

# Test mobile app
flutter run -d android

# Test web admin
flutter run -d chrome --web-port=3001
```

---

## 📞 Support

### Stuck?
1. Check [QUICK_START.md](./QUICK_START.md) - Debugging section
2. Read relevant documentation
3. Search [Supabase docs](https://supabase.com/docs)

### Need API Help?
- See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- Test with Swagger: http://localhost:3000/api/docs

### Database Questions?
- See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

### Mobile/Web Integration?
- See [FLUTTER_INTEGRATION_GUIDE.md](./FLUTTER_INTEGRATION_GUIDE.md)

---

## 📄 License

UNLICENSED
