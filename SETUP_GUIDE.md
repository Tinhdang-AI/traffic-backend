# Environment Setup Guide

## Backend Setup

### 1. Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account (https://supabase.com)

### 2. Create Supabase Project

1. Go to https://supabase.com and create a new project
2. Note your **Project URL** and **Project API Keys**
3. Create `.env` file in the backend root:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Server
PORT=3000
NODE_ENV=development

# Optional: CORS URLs for mobile/web apps
ALLOWED_ORIGINS=http://localhost:3001,https://yourdomain.com
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Create Database Tables

Run these SQL commands in Supabase SQL Editor:

```sql
-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR UNIQUE NOT NULL,
  display_name VARCHAR,
  avatar_url VARCHAR,
  phone VARCHAR,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Community Reports table
CREATE TABLE community_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  violation_type VARCHAR NOT NULL,
  description TEXT,
  image_url VARCHAR,
  status VARCHAR DEFAULT 'pending', -- verified, pending, rejected
  is_verified BOOLEAN DEFAULT FALSE,
  ai_confidence DECIMAL(3, 2),
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reports_user_id ON community_reports(user_id);
CREATE INDEX idx_reports_status ON community_reports(status);
CREATE INDEX idx_reports_location ON community_reports(latitude, longitude);

-- Distraction History table
CREATE TABLE distraction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  confidence DECIMAL(3, 2),
  detection_type VARCHAR,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_history_user_id ON distraction_history(user_id);
CREATE INDEX idx_history_location ON distraction_history(latitude, longitude);

-- Report Updates table
CREATE TABLE report_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES community_reports(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  update_type VARCHAR, -- status_change, comment, verification
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin roles (optional, for admin dashboard access)
CREATE TABLE admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR DEFAULT 'user', -- user, moderator, admin
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5. Set Up Storage Bucket

In Supabase dashboard:
1. Go to **Storage** → **Buckets**
2. Create bucket named `reports-images`
3. Set Public: ON (for image viewing)
4. Create policy:

```sql
CREATE POLICY "Allow authenticated uploads"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'reports-images' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Allow public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'reports-images');
```

### 6. Start Backend
```bash
npm run start:dev
```

Backend runs at: **http://localhost:3000/api/v1**

---

## Flutter Mobile App Setup

### 1. Install Dependencies

Add to `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  supabase_flutter: ^2.5.0
  http: ^1.1.0
  location: ^5.0.0
  image_picker: ^1.0.0
 C
  provider: ^6.0.0
  geolocator: ^10.0.0

dev_dependencies:
  flutter_test:
    sdk: flutter
```

```bash
flutter pub get
```

### 2. Initialize Supabase

In `lib/main.dart`:

```dart
import 'package:supabase_flutter/supabase_flutter.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await Supabase.initialize(
    url: 'https://your-project.supabase.co',
    anonKey: 'YOUR_ANON_KEY',
  );
  
  runApp(const MyApp());
}
```

### 3. Create API Service

Create `lib/services/api_service.dart`:

```dart
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'dart:convert';

class ApiService {
  static const String baseUrl = 'http://localhost:3000/api/v1';
  
  static Future<String?> getToken() async {
    try {
      final session = Supabase.instance.client.auth.currentSession;
      return session?.accessToken;
    } catch (e) {
      print('Error getting token: $e');
      return null;
    }
  }
  
  static Future<Map<String, String>> getHeaders() async {
    final token = await getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }
  
  // Create Report
  static Future<Map<String, dynamic>> createReport({
    required String name,
    required double latitude,
    required double longitude,
    required String violationType,
    required String description,
    String? imageUrl,
  }) async {
    try {
      final headers = await getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/reports'),
        headers: headers,
        body: jsonEncode({
          'name': name,
          'latitude': latitude,
          'longitude': longitude,
          'violationType': violationType,
          'description': description,
          'imageUrl': imageUrl,
        }),
      );
      
      if (response.statusCode == 201 || response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Failed to create report: ${response.body}');
      }
    } catch (e) {
      print('Error creating report: $e');
      rethrow;
    }
  }
  
  // Get Nearby Reports
  static Future<List<dynamic>> getNearbyReports({
    required double latitude,
    required double longitude,
    double radiusKm = 5.0,
  }) async {
    try {
      final response = await http.get(
        Uri.parse(
          '$baseUrl/reports/nearby?latitude=$latitude&longitude=$longitude&radiusKm=$radiusKm'
        ),
      );
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['reports'] ?? [];
      } else {
        throw Exception('Failed to fetch reports');
      }
    } catch (e) {
      print('Error fetching nearby reports: $e');
      rethrow;
    }
  }
  
  // Upvote Report
  static Future<void> upvoteReport(String reportId) async {
    try {
      final headers = await getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/reports/$reportId/upvote'),
        headers: headers,
      );
      
      if (response.statusCode != 200) {
        throw Exception('Failed to upvote: ${response.body}');
      }
    } catch (e) {
      print('Error upvoting: $e');
      rethrow;
    }
  }
  
  // Get Current User
  static Future<Map<String, dynamic>> getCurrentUser() async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/auth/me'),
        headers: headers,
      );
      
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Failed to get user');
      }
    } catch (e) {
      print('Error getting user: $e');
      rethrow;
    }
  }
  
  // Upload Image
  static Future<String> uploadImage(String imagePath) async {
    try {
      final file = File(imagePath);
      final fileName = '${DateTime.now().millisecondsSinceEpoch}.jpg';
      
      final response = await Supabase.instance.client.storage
          .from('reports-images')
          .upload(fileName, file);
      
      final publicUrl = Supabase.instance.client.storage
          .from('reports-images')
          .getPublicUrl(fileName);
      
      return publicUrl;
    } catch (e) {
      print('Error uploading image: $e');
      rethrow;
    }
  }
  
  // Record Detection
  static Future<void> recordDetection({
    required double latitude,
    required double longitude,
    required double confidence,
    required String detectionType,
    Map<String, dynamic>? metadata,
  }) async {
    try {
      final headers = await getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/detections/history'),
        headers: headers,
        body: jsonEncode({
          'latitude': latitude,
          'longitude': longitude,
          'confidence': confidence,
          'detectionType': detectionType,
          'metadata': metadata,
        }),
      );
      
      if (response.statusCode != 201 && response.statusCode != 200) {
        throw Exception('Failed to record detection');
      }
    } catch (e) {
      print('Error recording detection: $e');
      rethrow;
    }
  }
}
```

### 4. Create Auth Service

Create `lib/services/auth_service.dart`:

```dart
import 'package:supabase_flutter/supabase_flutter.dart';

class AuthService {
  final supabase = Supabase.instance.client;
  
  Future<Map<String, dynamic>> register({
    required String email,
    required String password,
    required String displayName,
  }) async {
    try {
      final response = await supabase.auth.signUpWithPassword(
        email: email,
        password: password,
        data: {'display_name': displayName},
      );
      return {
        'success': true,
        'user': response.user,
        'session': response.session,
      };
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }
  
  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await supabase.auth.signInWithPassword(
        email: email,
        password: password,
      );
      return {
        'success': true,
        'user': response.user,
        'session': response.session,
      };
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }
  
  Future<void> logout() async {
    await supabase.auth.signOut();
  }
  
  User? getCurrentUser() {
    return supabase.auth.currentUser;
  }
  
  Session? getSession() {
    return supabase.auth.currentSession;
  }
}
```

---

## Flutter Web Admin Dashboard Setup

### 1. Create Flutter Web Project

```bash
flutter create --platforms=web admin_dashboard
cd admin_dashboard
```

### 2. Update `pubspec.yaml`

```yaml
dependencies:
  flutter:
    sdk: flutter
  supabase_flutter: ^2.5.0
  http: ^1.1.0
  provider: ^6.0.0
  fl_chart: ^0.64.0 # For charts/heatmaps
  syncfusion_flutter_datagrid: ^23.0.0 # For data tables
  intl: ^0.19.0

dev_dependencies:
  flutter_test:
    sdk: flutter
```

### 3. Initialize App

In `lib/main.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await Supabase.initialize(
    url: 'https://your-project.supabase.co',
    anonKey: 'YOUR_ANON_KEY',
  );
  
  runApp(const AdminDashboardApp());
}

class AdminDashboardApp extends StatelessWidget {
  const AdminDashboardApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Sentinel Admin',
      theme: ThemeData(primarySwatch: Colors.blue),
      home: const AdminDashboard(),
    );
  }
}
```

### 4. Create Admin API Service

Create `lib/services/admin_api_service.dart`:

```dart
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'dart:convert';

class AdminApiService {
  static const String baseUrl = 'http://localhost:3000/api/v1';
  
  static Future<String?> getAdminToken() async {
    final session = Supabase.instance.client.auth.currentSession;
    return session?.accessToken;
  }
  
  static Future<Map<String, String>> getHeaders() async {
    final token = await getAdminToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${token ?? ''}',
    };
  }
  
  // Get Dashboard Stats
  static Future<Map<String, dynamic>> getDashboardStats() async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/admin/dashboard/stats'),
        headers: headers,
      );
      
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Failed to load stats');
      }
    } catch (e) {
      print('Error: $e');
      rethrow;
    }
  }
  
  // Get All Reports
  static Future<Map<String, dynamic>> getReports({
    String? status,
    String? violationType,
    int limit = 50,
    int offset = 0,
  }) async {
    try {
      final headers = await getHeaders();
      String query = '?limit=$limit&offset=$offset';
      if (status != null) query += '&status=$status';
      if (violationType != null) query += '&violationType=$violationType';
      
      final response = await http.get(
        Uri.parse('$baseUrl/admin/reports$query'),
        headers: headers,
      );
      
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Failed to load reports');
      }
    } catch (e) {
      print('Error: $e');
      rethrow;
    }
  }
  
  // Update Report Status
  static Future<Map<String, dynamic>> updateReportStatus({
    required String reportId,
    required String status,
    String? notes,
  }) async {
    try {
      final headers = await getHeaders();
      final response = await http.patch(
        Uri.parse('$baseUrl/admin/reports/$reportId/status'),
        headers: headers,
        body: jsonEncode({
          'status': status,
          'notes': notes,
        }),
      );
      
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Failed to update report');
      }
    } catch (e) {
      print('Error: $e');
      rethrow;
    }
  }
  
  // Get Heatmap Data
  static Future<Map<String, dynamic>> getHeatmapData({int limit = 1000}) async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/admin/history/heatmap?limit=$limit'),
        headers: headers,
      );
      
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Failed to load heatmap');
      }
    } catch (e) {
      print('Error: $e');
      rethrow;
    }
  }
  
  // Get Users
  static Future<Map<String, dynamic>> getUsers({
    int limit = 50,
    int offset = 0,
  }) async {
    try {
      final headers = await getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/admin/users?limit=$limit&offset=$offset'),
        headers: headers,
      );
      
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Failed to load users');
      }
    } catch (e) {
      print('Error: $e');
      rethrow;
    }
  }
}
```

---

## Running Your Apps

### Backend
```bash
cd sentinel-backend
npm run start:dev
# Access at http://localhost:3000/api/v1
```

### Flutter Mobile App
```bash
cd mobile_app
flutter pub get
flutter run -d android  # or -d ios
```

### Flutter Web Admin
```bash
cd admin_dashboard
flutter pub get
flutter run -d chrome --web-port=3001
# Access at http://localhost:3001
```

---

## Deployment

### Backend (NestJS)

**Deploy to Heroku/Railway**:
```bash
# Using Railway (recommended)
railway init
railway up
```

**Environment variables for production**:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NODE_ENV=production
PORT=3000
```

### Flutter Apps

**Mobile App (Google Play/App Store)**:
- Use Firebase Distribution for beta testing
- Configure signing certificates
- Submit to stores

**Web Dashboard**:
- Build: `flutter build web`
- Deploy to: Firebase Hosting, Netlify, or Vercel
  ```bash
  firebase deploy
  # or
  netlify deploy --prod --dir=build/web
  ```
