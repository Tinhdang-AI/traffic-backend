# Sentinel Backend API Documentation

## Overview
Sentinel is a real-time traffic violation detection and reporting system with role-based access control. The API is built with NestJS and uses Supabase for authentication and data storage.

**Base URL**: `http://localhost:3000/api/v1` (development) or `https://your-production-domain.com/api/v1`

**Swagger Docs**: `/api/docs`

---

## Authentication

All protected endpoints require a Bearer token (JWT from Supabase) in the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

### Auth Endpoints

#### 1. Register
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "displayName": "John Doe"
}
```

**Response (201)**:
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "user_metadata": {
      "displayName": "John Doe"
    }
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_in": 3600
  }
}
```

#### 2. Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200)**:
```json
{
  "user": { ... },
  "session": { ... }
}
```

#### 3. Refresh Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "your_refresh_token"
}
```

#### 4. Get Current User
```http
GET /auth/me
Authorization: Bearer <token>
```

**Response (200)**:
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "displayName": "John Doe",
  "avatarUrl": "https://..."
}
```

#### 5. Logout
```http
POST /auth/logout
Authorization: Bearer <token>
```

---

## Reports Endpoints

### Create Report
```http
POST /reports
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Unauthorized Parking",
  "latitude": 21.0285,
  "longitude": 105.8542,
  "violationType": "parking",
  "description": "Double parked on main street",
  "imageUrl": "https://supabase.../image.jpg"
}
```

**Response (201)**:
```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "Unauthorized Parking",
  "latitude": 21.0285,
  "longitude": 105.8542,
  "violationType": "parking",
  "description": "...",
  "imageUrl": "...",
  "status": "pending",
  "isVerified": false,
  "aiConfidence": null,
  "upvotes": 0,
  "createdAt": "2026-05-20T10:30:00Z"
}
```

### Get All Reports
```http
GET /reports
```

### Get Nearby Reports (with location filter)
```http
GET /reports/nearby?latitude=21.0285&longitude=105.8542&radiusKm=5
```

**Query Parameters**:
- `latitude` (required): User latitude
- `longitude` (required): User longitude
- `radiusKm` (optional): Search radius in kilometers (default: 5)

**Response**:
```json
{
  "reports": [
    {
      "id": "uuid",
      "name": "...",
      "latitude": 21.0285,
      "longitude": 105.8542,
      "distance": 0.5,
      "upvotes": 12,
      "status": "verified",
      "createdAt": "..."
    }
  ],
  "total": 25
}
```

### Upvote Report
```http
POST /reports/{id}/upvote
Authorization: Bearer <token>
```

### Delete Report
```http
DELETE /reports/{id}
Authorization: Bearer <token>
```

---

## Detection History Endpoints

### Record Detection Event
```http
POST /detections/history
Authorization: Bearer <token>
Content-Type: application/json

{
  "latitude": 21.0285,
  "longitude": 105.8542,
  "confidence": 0.92,
  "detectionType": "speeding",
  "metadata": {
    "speed": 65,
    "speedLimit": 50
  }
}
```

### Get User Detection History
```http
GET /detections/history?limit=50&offset=0
Authorization: Bearer <token>
```

---

## Admin Dashboard Endpoints

> ⚠️ **Admin-only** - Requires admin role and authentication

### Dashboard Statistics
```http
GET /admin/dashboard/stats
Authorization: Bearer <admin_token>
```

**Response**:
```json
{
  "totalUsers": 1250,
  "totalReports": 890,
  "verifiedReports": 720,
  "pendingReports": 120,
  "rejectedReports": 50,
  "totalDetections": 15420,
  "weeklyReportTrend": [120, 135, 142, 138, 151, 165, 170],
  "violationTypeBreakdown": {
    "speeding": 340,
    "parking": 280,
    "running_red_light": 180,
    "other": 90
  }
}
```

### Get All Reports (Admin)
```http
GET /admin/reports?status=pending&violationType=parking&limit=50&offset=0
Authorization: Bearer <admin_token>
```

**Query Parameters**:
- `status`: 'verified', 'pending', 'rejected'
- `violationType`: Type of violation
- `limit`: Items per page (default: 50)
- `offset`: Pagination offset (default: 0)

### Update Report Status
```http
PATCH /admin/reports/{id}/status
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "status": "verified",
  "notes": "Confirmed via street camera"
}
```

### Get All Users
```http
GET /admin/users?limit=50&offset=0
Authorization: Bearer <admin_token>
```

### Delete User
```http
DELETE /admin/users/{id}
Authorization: Bearer <admin_token>
```

### Get Heatmap Data
```http
GET /admin/history/heatmap?limit=1000
Authorization: Bearer <admin_token>
```

**Response**:
```json
{
  "heatmapPoints": [
    {
      "latitude": 21.0285,
      "longitude": 105.8542,
      "intensity": 0.95,
      "count": 145,
      "violationType": "speeding"
    }
  ]
}
```

---

## File Upload Endpoints

### Upload Image to Storage
```http
POST /upload/image
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary_image_data>
```

**Response (201)**:
```json
{
  "url": "https://supabase.../reports/uuid/image.jpg",
  "path": "reports/uuid/image.jpg"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "statusCode": 400,
  "message": "Invalid credentials",
  "error": "BadRequest"
}
```

**Common Status Codes**:
- `200`: OK
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error

---

## Rate Limiting

The API implements two rate limiting tiers:

1. **Short-term**: 10 requests/second
2. **Long-term**: 100 requests/minute

Exceeding limits returns HTTP 429 with retry information in headers.

---

## Best Practices

1. **Token Management**:
   - Store refresh tokens securely (Flutter Secure Storage)
   - Refresh tokens 5 minutes before expiration
   - Clear tokens on logout

2. **Error Handling**:
   - Implement exponential backoff for 5xx errors
   - Handle 401 errors by prompting re-login
   - Log all 5xx errors for debugging

3. **Offline Support**:
   - Use `/reports/sync` endpoint to batch offline reports
   - Store reports locally with temporary UUIDs
   - Update local records after sync response

4. **Location-based Queries**:
   - Always include `radiusKm` parameter (default: 5km)
   - Update location data every 30-60 seconds
   - Cache nearby reports for 5 minutes to reduce API calls
