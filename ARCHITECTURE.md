# Sentinel Architecture & Implementation Summary

## Project Overview

**Sentinel** is a complete traffic violation reporting and admin management system with:
- ✅ NestJS Backend API
- ✅ Flutter Mobile App (iOS/Android)
- ✅ Flutter Web Admin Dashboard
- ✅ Supabase Database & Auth
- ✅ Real-time Synchronization

---

## System Architecture

### Complete Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           USER (Mobile Device)                                │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Flutter Mobile App                                                  │   │
│  │  ├─ Auth: Login/Register                                             │   │
│  │  ├─ Location Services                                               │   │
│  │  ├─ Camera (Take photos)                                            │   │
│  │  ├─ Create Reports                                                  │   │
│  │  ├─ View Nearby Reports (Map)                                       │   │
│  │  └─ View Detection History                                          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└──────────────┬───────────────────────────────────────────────────┬───────────┘
               │                                                   │
               │ HTTP REST API                                    │ Supabase Auth
               │ (NestJS Backend)                                 │ (JWT Tokens)
               ▼                                                   ▼
    ┌─────────────────────────┐                    ┌──────────────────────────┐
    │   NestJS Backend        │                    │  Supabase Cloud          │
    │   ├─ Auth Controller    │──────────────────▶ │  ├─ auth.users          │
    │   ├─ Reports Controller │                    │  ├─ JWT Token Gen       │
    │   ├─ Admin Controller   │                    │  ├─ Password Validation │
    │   ├─ Detections        │                    │  └─ User Management     │
    │   └─ Upload Service    │                    │                         │
    │                        │                    │                         │
    │   (http://localhost    │                    │  Real-time Subscriptions│
    │    :3000/api/v1)       │                    │  (WebSocket)            │
    └─────────────────────────┘                    └──────────────────────────┘
               │                                        │
               │ Service Role Key                      │ INSERT/UPDATE/DELETE
               │ Admin Operations                      │ on community_reports
               ▼                                        ▼
    ┌─────────────────────────────────────────────────────────────┐
    │              Supabase PostgreSQL Database                    │
    │  ┌────────────────────────────────────────────────────────┐ │
    │  │  Tables:                                               │ │
    │  │  ├─ profiles                (User profiles)            │ │
    │  │  ├─ community_reports       (Violation reports)        │ │
    │  │  ├─ distraction_history     (Detection events)         │ │
    │  │  └─ report_updates          (Status changes)           │ │
    │  │                                                        │ │
    │  │  Indexes:                                              │ │
    │  │  ├─ user_id (fast lookups)                            │ │
    │  │  ├─ status (filtering)                                │ │
    │  │  ├─ location (geo queries)                            │ │
    │  │  └─ created_at (sorting)                              │ │
    │  └────────────────────────────────────────────────────────┘ │
    │                                                              │
    │  Storage: reports-images bucket (Image files)               │
    └─────────────────────────────────────────────────────────────┘
               ▲
               │ Real-time Updates
               │ (Supabase Realtime)
               │
    ┌──────────┴──────────────────────────────────────────────────┐
    │                                                              │
┌───────────────────────────┐                   ┌──────────────────▼────────┐
│  ADMIN (Web Browser)      │                   │  Flutter Web App           │
│  ┌─────────────────────┐  │                   │  ├─ Admin Login           │
│  │ Flutter Web Admin   │  │                   │  ├─ Dashboard Stats       │
│  │ Dashboard           │  │                   │  ├─ Reports Management    │
│  │ ├─ Dashboard Stats  │  │                   │  ├─ User Management       │
│  │ ├─ Reports Table    │  │                   │  ├─ Heatmap Visualization│
│  │ ├─ Status Updates   │  │                   │  ├─ Real-time Updates     │
│  │ ├─ Heatmap          │  │                   │  └─ Report Verification   │
│  │ ├─ User Management  │  │                   │                           │
│  │ └─ Charts           │  │                   │ (http://localhost:3001)   │
│  └────────┬────────────┘  │                   └──────────────────┬────────┘
│           │               │                                      │
│           │ Admin API     │                                      │
│           │ /admin/*      │                                      │
│           │ (Protected)   │                                      │
│           └───────────────┘                                      │
└───────────────────────────────────────────────────────────────┬──┘
                                                                 │
                                                Realizes real-time
                                                updates via Supabase
```

---

## Data Flow Examples

### 1. User Creates a Report

```
Mobile App User
    │
    ├─ 1. Opens camera, takes photo
    │
    ├─ 2. Enters report details
    │     - Name: "Unauthorized Parking"
    │     - Type: "parking"
    │     - Description: "Double parked on main street"
    │     - Location: GPS coordinates
    │
    ├─ 3. Clicks "Submit"
    │
    ├─ 4. App uploads image to Supabase Storage
    │     - Request: POST /upload/image
    │     - Response: imageUrl = "https://...reports/uuid/image.jpg"
    │
    ├─ 5. App creates report via API
    │     - POST /reports
    │     - Headers: Authorization: Bearer <token>
    │     - Body: name, latitude, longitude, type, description, imageUrl
    │
    ├─ 6. Backend stores in database
    │     INSERT INTO community_reports (user_id, name, ...)
    │
    ├─ 7. Real-time notification
    │     - Supabase broadcasts: "New report created"
    │     - Admin dashboard receives update
    │     - Reports table refreshes automatically
    │
    └─ 8. Success! Report now visible to all users
```

### 2. Admin Verifies Report

```
Admin (Web Dashboard)
    │
    ├─ 1. Views pending reports
    │     - GET /admin/reports?status=pending
    │     - Displays: ID, Type, Location, Image, Confidence
    │
    ├─ 2. Clicks on report to review
    │     - Shows image
    │     - Shows AI confidence score
    │     - Shows user who reported
    │     - Shows other reports nearby
    │
    ├─ 3. Verifies or rejects report
    │     - PATCH /admin/reports/{id}/status
    │     - Body: status="verified" or "rejected"
    │
    ├─ 4. Backend updates database
    │     UPDATE community_reports
    │     SET status='verified', is_verified=true
    │
    ├─ 5. Real-time notification
    │     - All users receive update
    │     - Report now shows "verified" badge
    │     - Mobile app updates immediately
    │
    └─ 6. Dashboard stats update
          - "Verified Reports" count increases
```

### 3. User Views Nearby Reports

```
Mobile App User (Driving)
    │
    ├─ 1. Requests location permission
    │     - GPS: latitude, longitude, accuracy
    │
    ├─ 2. Gets current location
    │     - lat: 21.0285
    │     - lon: 105.8542
    │
    ├─ 3. Requests nearby reports
    │     - GET /reports/nearby?lat=21.0285&lon=105.8542&radiusKm=5
    │
    ├─ 4. Backend queries database
    │     SELECT * FROM community_reports
    │     WHERE earth_distance(...) < 5000m
    │
    ├─ 5. Returns nearby violations
    │     - Speeding (0.2km away)
    │     - Parking violation (0.8km away)
    │     - Red light runner (1.2km away)
    │
    ├─ 6. App displays on map
    │     - Marker at each location
    │     - Show violation type
    │     - Show upvotes
    │     - Show timestamp
    │
    ├─ 7. User taps report
    │     - Shows full details
    │     - Shows image
    │     - Shows reporter's name
    │
    ├─ 8. User can upvote
    │     - POST /reports/{id}/upvote
    │     - upvotes count increases
    │     - Updates in real-time
    │
    └─ 9. Map auto-updates every 30 seconds
          - Fetches new nearby reports
          - Filters out old ones
```

---

## API Endpoints Reference

### Authentication
```
POST   /api/v1/auth/register
       Request: { email, password, displayName }
       Response: { user, session }

POST   /api/v1/auth/login
       Request: { email, password }
       Response: { user, session }

GET    /api/v1/auth/me
       Headers: Authorization: Bearer <token>
       Response: { id, email, displayName, ... }

POST   /api/v1/auth/logout
       Headers: Authorization: Bearer <token>
       Response: { success: true }

POST   /api/v1/auth/refresh
       Request: { refreshToken }
       Response: { accessToken, expiresIn }
```

### Reports
```
POST   /api/v1/reports
       Create report
       Headers: Authorization: Bearer <token>
       Request: { name, latitude, longitude, violationType, description, imageUrl? }
       Response: { id, userId, name, status, ... }

GET    /api/v1/reports
       Get all reports (paginated)
       Response: { reports: [], total: 0 }

GET    /api/v1/reports/nearby
       Get reports within radius
       Query: latitude, longitude, radiusKm=5
       Response: { reports: [], total: 0 }

POST   /api/v1/reports/{id}/upvote
       Headers: Authorization: Bearer <token>
       Response: { upvotes: 10 }

DELETE /api/v1/reports/{id}
       Headers: Authorization: Bearer <token>
       Response: { success: true }

POST   /api/v1/reports/sync
       Batch sync offline reports
       Headers: Authorization: Bearer <token>
       Request: { reports: [...] }
       Response: { synced: [], failed: [] }
```

### Detections
```
POST   /api/v1/detections/history
       Record detection event
       Headers: Authorization: Bearer <token>
       Request: { latitude, longitude, confidence, detectionType, metadata? }
       Response: { id, ... }

GET    /api/v1/detections/history
       Get user's detection history
       Headers: Authorization: Bearer <token>
       Query: limit=50, offset=0
       Response: { events: [], total: 0 }
```

### Admin (Protected - requires admin role)
```
GET    /api/v1/admin/dashboard/stats
       Headers: Authorization: Bearer <admin_token>
       Response: { totalUsers, totalReports, verified, pending, ... }

GET    /api/v1/admin/reports
       Headers: Authorization: Bearer <admin_token>
       Query: status?, violationType?, limit=50, offset=0
       Response: { reports: [], total: 0 }

PATCH  /api/v1/admin/reports/{id}/status
       Headers: Authorization: Bearer <admin_token>
       Request: { status, notes? }
       Response: { id, status, ... }

GET    /api/v1/admin/users
       Headers: Authorization: Bearer <admin_token>
       Query: limit=50, offset=0
       Response: { users: [], total: 0 }

DELETE /api/v1/admin/users/{id}
       Headers: Authorization: Bearer <admin_token>
       Response: { success: true }

GET    /api/v1/admin/history/heatmap
       Headers: Authorization: Bearer <admin_token>
       Query: limit=1000
       Response: { heatmapPoints: [...] }
```

### Upload
```
POST   /api/v1/upload/image
       Headers: Authorization: Bearer <token>
       Body: FormData { file: <binary> }
       Response: { url, path }
```

---

## Database Schema

### Quick Reference

```
profiles
├─ id (UUID)
├─ email (VARCHAR)
├─ display_name (VARCHAR)
├─ avatar_url (VARCHAR)
├─ is_admin (BOOLEAN)
└─ created_at (TIMESTAMP)

community_reports
├─ id (UUID)
├─ user_id (UUID → profiles.id)
├─ name (VARCHAR)
├─ latitude (DECIMAL)
├─ longitude (DECIMAL)
├─ violation_type (VARCHAR)
├─ description (TEXT)
├─ image_url (VARCHAR)
├─ status (VARCHAR: pending|verified|rejected)
├─ is_verified (BOOLEAN)
├─ ai_confidence (DECIMAL 0-1)
├─ upvotes (INTEGER)
└─ created_at (TIMESTAMP)

distraction_history
├─ id (UUID)
├─ user_id (UUID → profiles.id)
├─ latitude (DECIMAL)
├─ longitude (DECIMAL)
├─ confidence (DECIMAL 0-1)
├─ detection_type (VARCHAR)
├─ metadata (JSONB)
└─ created_at (TIMESTAMP)

report_updates
├─ id (UUID)
├─ report_id (UUID → community_reports.id)
├─ user_id (UUID → profiles.id)
├─ update_type (VARCHAR)
├─ content (TEXT)
└─ created_at (TIMESTAMP)
```

---

## Setup Checklist

### Prerequisites
- [ ] Node.js 18+
- [ ] Flutter 3.0+
- [ ] Supabase account
- [ ] Git installed
- [ ] 1 hour free time

### Supabase Setup
- [ ] Create Supabase project
- [ ] Copy credentials (URL, anon key, service role key)
- [ ] Run SQL setup script
- [ ] Create `reports-images` storage bucket
- [ ] Enable RLS policies

### Backend Setup
- [ ] Clone/create project
- [ ] Create `.env` with Supabase credentials
- [ ] `npm install`
- [ ] `npm run start:dev`
- [ ] Test: curl http://localhost:3000/api/v1/reports
- [ ] Open Swagger: http://localhost:3000/api/docs

### Mobile App Setup
- [ ] Create Flutter project
- [ ] Add dependencies (supabase_flutter, http, location, image_picker, etc.)
- [ ] Initialize Supabase in main.dart
- [ ] Create AuthService
- [ ] Create ApiService
- [ ] Create screens: Login, CreateReport, Map, History
- [ ] Test: `flutter run -d android`

### Admin Dashboard Setup
- [ ] Create Flutter web project
- [ ] Add dependencies (same as mobile + fl_chart)
- [ ] Initialize Supabase
- [ ] Create AdminApiService
- [ ] Create dashboard screens
- [ ] Test: `flutter run -d chrome`

### Integration Testing
- [ ] Mobile: Register → Login → Create Report
- [ ] Backend: Report appears in database
- [ ] Admin: Dashboard shows new report
- [ ] Real-time: Dashboard updates without refresh
- [ ] Admin: Verify report → Mobile shows "verified" badge

---

## Performance Optimizations

### Mobile App
```dart
// 1. Cache nearby reports for 5 minutes
static const Duration reportsCacheDuration = Duration(minutes: 5);

// 2. Batch detection events every 30 seconds
Timer.periodic(Duration(seconds: 30), (_) => syncDetections());

// 3. Compress images before upload (80% quality)
imageFile.compress(quality: 80);

// 4. Lazy load images in list
CachedNetworkImage(imageUrl: report.imageUrl);

// 5. Use Hive for local database
final box = await Hive.openBox('reports');
```

### Backend
```typescript
// 1. Database indexes
CREATE INDEX idx_reports_location ON community_reports(latitude, longitude);
CREATE INDEX idx_reports_status ON community_reports(status);

// 2. Rate limiting
@UseGuards(ThrottlerGuard)
getReports() { ... }

// 3. Pagination
limit: 50, offset: 0

// 4. Compression
app.use(compression());

// 5. CORS optimization
enableCors({ origin: ALLOWED_ORIGINS })
```

### Admin Dashboard
```dart
// 1. Real-time subscriptions
_setupRealtimeListener();

// 2. Paginated tables
DataTable(rowsPerPage: 50);

// 3. Lazy load charts
FutureBuilder(future: getHeatmapData());

// 4. Cache dashboard stats
static const Duration statsCacheDuration = Duration(minutes: 1);
```

---

## Deployment Ready

### Backend Production
```bash
# Environment variables
SUPABASE_URL=https://prod.supabase.co
SUPABASE_SERVICE_ROLE_KEY=***
NODE_ENV=production
PORT=3000

# Deploy to Railway/Heroku/DigitalOcean
```

### Mobile App Production
```bash
# Android: flutter build apk --release
# iOS: flutter build ios --release
# Submit to stores
```

### Admin Dashboard Production
```bash
# flutter build web
# Deploy to Firebase, Netlify, or Vercel
```

---

## Next Steps

1. **Read**: Start with `QUICK_START.md`
2. **Setup**: Follow `SETUP_GUIDE.md`
3. **Learn**: Read `API_DOCUMENTATION.md`
4. **Build**: Follow `FLUTTER_INTEGRATION_GUIDE.md`
5. **Deploy**: Use deployment instructions above

**Estimated time to MVP: 1-2 weeks**
**Estimated time to production: 1 month**

---

## Support & Troubleshooting

See the following files for detailed help:
- `QUICK_START.md` - 30-minute setup
- `API_DOCUMENTATION.md` - All endpoints explained
- `SETUP_GUIDE.md` - Detailed setup steps
- `SUPABASE_SETUP.md` - Database configuration
- `FLUTTER_INTEGRATION_GUIDE.md` - Mobile/web integration

Visit backend Swagger docs at: **http://localhost:3000/api/docs**
