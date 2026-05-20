# Quick Start Guide - Sentinel App Stack

## 🚀 30-Minute Setup

### Phase 1: Supabase Setup (5 min)

```bash
1. Go to https://supabase.com → Create Project
2. Name it 'sentinel', generate password, click Create
3. Wait ~2 minutes
4. Go to Settings → API
5. Copy: Project URL, anon key, service role key
```

### Phase 2: Backend Setup (10 min)

```bash
cd c:\sentinel-backend

# Create .env file
cat > .env << EOF
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=3000
NODE_ENV=development
EOF

# Install & run
npm install
npm run start:dev
```

**✅ Backend running at: http://localhost:3000/api/v1**

### Phase 3: Database Setup (5 min)

1. Go to Supabase Dashboard → **SQL Editor**
2. Copy entire SQL setup from `SUPABASE_SETUP.md`
3. Paste → Click **Execute**
4. Go to **Storage** → Create bucket `reports-images` (Public: ON)

**✅ Database ready**

### Phase 4: Flutter Mobile App (5 min)

```bash
# Create new Flutter project
flutter create sentinel_mobile
cd sentinel_mobile

# Update pubspec.yaml with dependencies from SETUP_GUIDE.md
flutter pub get

# Copy auth_service.dart and api_service.dart
cp ../sentinel-backend/API_DOCUMENTATION.md .

# Update lib/main.dart with Supabase initialization
flutter run -d android
```

### Phase 5: Flutter Web Admin (5 min)

```bash
# Create web project
flutter create --platforms=web admin_dashboard
cd admin_dashboard

# Update pubspec.yaml
flutter pub get

# Copy admin_api_service.dart
# Copy admin dashboard screen

flutter run -d chrome --web-port=3001
```

---

## 📱 Architecture at a Glance

```
┌─────────────────────────────────────────────────┐
│           Supabase (Cloud)                       │
│  ├─ Authentication (JWT)                         │
│  ├─ PostgreSQL Database                          │
│  ├─ Real-time Subscriptions                      │
│  └─ Storage (Images)                             │
└──────────────────┬──────────────────────────────┘
                   │
      ┌────────────┼────────────┐
      │            │            │
      ▼            ▼            ▼
  Mobile App   Web Admin    Backend API
  (Flutter)   (Flutter)    (NestJS)
   iOS/Android  Browser     Node.js
```

---

## 🔐 Authentication Flow

```
User Login
    │
    ├─ Email + Password
    │
    ▼
Supabase Auth
    │
    ├─ Validates user
    ├─ Creates JWT token
    │
    ▼
App Stores Token
    │
    ├─ Mobile: Secure Storage
    ├─ Web: LocalStorage/SessionStorage
    │
    ▼
Include in API Calls
    │
    └─ Authorization: Bearer <JWT>
```

---

## 📡 API Endpoints Summary

### Authentication
```
POST   /auth/register        - Create account
POST   /auth/login           - Get tokens
POST   /auth/refresh         - Refresh JWT
GET    /auth/me              - Current user
POST   /auth/logout          - Invalidate token
```

### Reports
```
POST   /reports              - Create report
GET    /reports              - All reports
GET    /reports/nearby       - Nearby reports
POST   /reports/{id}/upvote  - Upvote
DELETE /reports/{id}         - Delete report
POST   /reports/sync         - Batch sync offline
```

### Detections
```
POST   /detections/history   - Record detection
GET    /detections/history   - User's detections
```

### Admin (Protected)
```
GET    /admin/dashboard/stats      - Dashboard data
GET    /admin/reports              - All reports with filters
PATCH  /admin/reports/{id}/status  - Verify/reject
GET    /admin/users                - User list
DELETE /admin/users/{id}           - Delete user
GET    /admin/history/heatmap      - Heatmap data
```

### Upload
```
POST   /upload/image         - Upload to storage
```

---

## 🗄️ Database Structure

```
auth.users (Supabase)
    │
    ├─ id (UUID)
    ├─ email
    ├─ password (encrypted)
    └─ created_at

profiles (Your table)
    │
    ├─ id (FK: auth.users.id)
    ├─ email
    ├─ display_name
    ├─ avatar_url
    ├─ is_admin
    └─ created_at

community_reports
    │
    ├─ id
    ├─ user_id (FK: auth.users.id)
    ├─ name
    ├─ latitude / longitude
    ├─ violation_type
    ├─ image_url (Storage URL)
    ├─ status (pending/verified/rejected)
    └─ created_at

distraction_history
    │
    ├─ id
    ├─ user_id
    ├─ latitude / longitude
    ├─ confidence
    ├─ detection_type
    └─ created_at

report_updates
    │
    ├─ id
    ├─ report_id
    ├─ user_id
    ├─ update_type
    └─ created_at
```

---

## 🎯 Common Tasks

### Create a Report (Mobile App)

```dart
// 1. Get user location
final location = await Location().getLocation();

// 2. Upload image
final imageUrl = await ApiService.uploadImage(imagePath);

// 3. Create report
final report = await ApiService.createReport(
  name: 'Unauthorized Parking',
  latitude: location.latitude,
  longitude: location.longitude,
  violationType: 'parking',
  description: 'Double parked on main street',
  imageUrl: imageUrl,
);

// 4. Show success
print('Report created: ${report['id']}');
```

### View Reports on Map (Mobile App)

```dart
// Get nearby reports
final reports = await ApiService.getNearbyReports(
  latitude: 21.0285,
  longitude: 105.8542,
  radiusKm: 5.0,
);

// Display on map
reports.forEach((report) {
  // Add marker at report['latitude'], report['longitude']
});
```

### Verify Report (Admin Dashboard)

```dart
// 1. Get reports list
final reports = await AdminApiService.getReports(
  status: 'pending',
);

// 2. Review report details
// - View image
// - Check AI confidence
// - Read description

// 3. Update status
await AdminApiService.updateReportStatus(
  reportId: report['id'],
  status: 'verified',
  notes: 'Confirmed via street camera',
);

// 4. Dashboard updates in real-time
```

### Sync Offline Reports (Mobile App)

```dart
// 1. Create reports offline (stored locally)
final offlineReports = [
  {'name': 'Speeding', 'lat': 21.01, 'lon': 105.85, ...},
  {'name': 'Red Light', 'lat': 21.02, 'lon': 105.86, ...},
];

// 2. When online, sync
await ApiService.syncReports(offlineReports);

// 3. Backend returns success
// 4. Clear local cache
```

---

## 🔍 Debugging Checklist

### Backend Not Starting
```bash
# Check Node.js version
node --version  # Should be 18+

# Check Supabase credentials in .env
echo $SUPABASE_URL

# Check port not in use
lsof -i :3000

# View full error
npm run start:dev  # Should show detailed error
```

### Mobile App Won't Connect
```bash
# Check backend is running
curl http://localhost:3000/api/v1/reports

# Check Supabase credentials in main.dart
# Print all errors to console
ApiService.getToken().then(print);

# Check CORS is enabled
# (main.ts should have app.enableCors())
```

### Admin Dashboard Not Loading Data
```dart
// 1. Check authentication
print(Supabase.instance.client.auth.currentUser);

// 2. Check token
final session = Supabase.instance.client.auth.currentSession;
print(session?.accessToken);

// 3. Test API call directly
http.get(Uri.parse('http://localhost:3000/api/v1/admin/reports'))
    .then(print);

// 4. Check admin role
// In Supabase, verify is_admin = true in profiles table
```

### Images Not Uploading
```bash
# 1. Check storage bucket exists
# Supabase → Storage → reports-images should exist

# 2. Check RLS policy
# Storage → Policies → "Authenticated users can upload images"

# 3. Check image format
# Supported: JPG, PNG, WEBP

# 4. Check file size
# Max: 50MB per file
```

---

## 📊 Performance Tips

### Mobile App
- Cache nearby reports for 5 minutes
- Batch sync reports every 30 seconds
- Use pagination (limit: 50 per page)
- Lazy load images

### Backend
- Database indexes on: user_id, status, location, created_at
- Rate limiting: 10 req/sec, 100 req/min
- Gzip compression enabled
- CORS enabled for all origins

### Admin Dashboard
- Real-time updates via Supabase
- Paginated report table
- Chart animations (optional)
- Lazy load heatmap data

---

## 🚢 Deployment

### Backend to Production

**Option 1: Railway** (Recommended for beginners)
```bash
npm install -g @railway/cli
railway login
railway init
railway up

# Sets environment variables automatically
# Provides PostgreSQL database link
```

**Option 2: Heroku**
```bash
npm install -g heroku
heroku login
heroku create sentinel-api
git push heroku main
```

**Option 3: DigitalOcean App Platform**
1. Connect GitHub repo
2. Set environment variables
3. Deploy

### Mobile App to Stores

**Android (Google Play)**
```bash
flutter build apk --release
# Upload to Google Play Console
```

**iOS (App Store)**
```bash
flutter build ios --release
# Open in Xcode, submit to App Store
```

### Web Admin Dashboard

**Firebase Hosting**
```bash
firebase init
flutter build web
firebase deploy
```

**Netlify**
```bash
netlify init
netlify deploy --prod --dir=build/web
```

---

## 📞 Support & Resources

### Documentation
- **Backend API**: `API_DOCUMENTATION.md`
- **Setup Guide**: `SETUP_GUIDE.md`
- **Database**: `SUPABASE_SETUP.md`
- **Flutter Integration**: `FLUTTER_INTEGRATION_GUIDE.md`
- **Swagger Docs**: http://localhost:3000/api/docs

### Official Docs
- NestJS: https://docs.nestjs.com
- Supabase: https://supabase.com/docs
- Flutter: https://flutter.dev/docs
- Supabase Flutter: https://supabase.com/docs/reference/flutter/overview

### Community
- Supabase Discord: https://discord.supabase.com
- Flutter Community: https://flutter.dev/community
- NestJS Discussions: https://github.com/nestjs/nest/discussions

---

## ✅ Verification Checklist

- [ ] Supabase project created
- [ ] Database tables created
- [ ] Storage bucket created
- [ ] `.env` configured
- [ ] Backend runs: `npm run start:dev`
- [ ] Swagger docs accessible: http://localhost:3000/api/docs
- [ ] Can register user via Supabase Auth
- [ ] Mobile app can login
- [ ] Mobile app can create report
- [ ] Admin dashboard loads stats
- [ ] Real-time updates working
- [ ] Image upload working

**All checkmarks? 🎉 You're ready to build!**

---

## 🔑 Environment Variables Reference

```env
# Backend (.env)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGc...
PORT=3000
NODE_ENV=development

# Flutter Mobile (lib/main.dart hardcoded)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=same-as-backend

# Flutter Web Admin (lib/main.dart hardcoded)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=same-as-backend
API_BASE_URL=http://localhost:3000/api/v1
```

---

## 🎓 Learning Path

1. **Understand the API**: Read `API_DOCUMENTATION.md`
2. **Set up Supabase**: Follow `SUPABASE_SETUP.md`
3. **Run the backend**: Follow `SETUP_GUIDE.md`
4. **Build Flutter app**: Follow `FLUTTER_INTEGRATION_GUIDE.md`
5. **Deploy**: Choose deployment option above
6. **Optimize**: Use performance tips above

**Time to first report: ~1 hour**
**Time to production: ~1 week**
