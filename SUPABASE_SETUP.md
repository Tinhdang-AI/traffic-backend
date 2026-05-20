# Supabase Configuration & Database Schema

## Quick Start

### 1. Create Supabase Project

1. Go to https://supabase.com
2. Click **New Project**
3. Fill in project details:
   - **Name**: `sentinel`
   - **Database Password**: Generate strong password
   - **Region**: Choose closest to your users
4. Click **Create**
5. Wait ~2 minutes for setup

### 2. Get Credentials

In **Project Settings** → **API**:
- Copy **Project URL** → `SUPABASE_URL`
- Copy **anon (public) key** → `SUPABASE_ANON_KEY`
- Copy **service_role (secret) key** → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Add to `.env`

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Database Schema

### Authentication Flow

Supabase uses PostgreSQL with built-in auth. Users are created in `auth.users` table, which is **automatically managed** by Supabase.

```
User Signs Up/Logs In
    ↓
Supabase Auth Service
    ↓
Creates entry in auth.users (automatic)
    ↓
Backend creates profile in profiles table
```

---

## Tables & Relationships

### 1. Profiles Table

Stores user profile information.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR UNIQUE NOT NULL,
  display_name VARCHAR,
  avatar_url VARCHAR,
  phone VARCHAR,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Public can view profiles"
  ON profiles FOR SELECT
  USING (true);

-- Index for faster queries
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_is_admin ON profiles(is_admin);
```

**Fields**:
- `id`: User UUID (links to Supabase auth)
- `email`: User email
- `display_name`: User's display name
- `avatar_url`: URL to user's profile picture
- `phone`: Phone number (optional)
- `is_admin`: Whether user is admin
- `created_at`: Account creation timestamp
- `updated_at`: Last profile update

---

### 2. Community Reports Table

Stores traffic violation reports submitted by users.

```sql
CREATE TABLE community_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  violation_type VARCHAR NOT NULL,
  description TEXT,
  image_url VARCHAR,
  status VARCHAR DEFAULT 'pending',
  is_verified BOOLEAN DEFAULT FALSE,
  ai_confidence DECIMAL(3, 2),
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX idx_reports_user_id ON community_reports(user_id);
CREATE INDEX idx_reports_status ON community_reports(status);
CREATE INDEX idx_reports_location ON community_reports(latitude, longitude);
CREATE INDEX idx_reports_violation_type ON community_reports(violation_type);
CREATE INDEX idx_reports_created_at ON community_reports(created_at DESC);

-- Row Level Security
ALTER TABLE community_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reports"
  ON community_reports FOR SELECT
  USING (true);

CREATE POLICY "Users can create reports"
  ON community_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports"
  ON community_reports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports"
  ON community_reports FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any report"
  ON community_reports FOR UPDATE
  USING (
    (SELECT is_admin FROM profiles WHERE id = auth.uid()) = TRUE
  );
```

**Fields**:
- `id`: Unique report UUID
- `user_id`: Report author
- `name`: Report title (e.g., "Unauthorized Parking on Main St")
- `latitude`/`longitude`: GPS coordinates (8 decimal places = ~1cm accuracy)
- `violation_type`: Type of violation (speeding, parking, red_light, etc.)
- `description`: Detailed description
- `image_url`: URL to image in Supabase Storage
- `status`: 'pending', 'verified', or 'rejected'
- `is_verified`: Admin verified the report
- `ai_confidence`: AI confidence score (0-1)
- `upvotes`: User upvotes on report

---

### 3. Distraction History Table

Records detected distractions/violations for analytics.

```sql
CREATE TABLE distraction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  confidence DECIMAL(3, 2) NOT NULL,
  detection_type VARCHAR NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_history_user_id ON distraction_history(user_id);
CREATE INDEX idx_history_location ON distraction_history(latitude, longitude);
CREATE INDEX idx_history_detection_type ON distraction_history(detection_type);
CREATE INDEX idx_history_created_at ON distraction_history(created_at DESC);

-- Row Level Security
ALTER TABLE distraction_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own history"
  ON distraction_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history"
  ON distraction_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all history"
  ON distraction_history FOR SELECT
  USING (
    (SELECT is_admin FROM profiles WHERE id = auth.uid()) = TRUE
  );
```

**Fields**:
- `id`: Event UUID
- `user_id`: User who was monitored
- `latitude`/`longitude`: Detection location
- `confidence`: Detection confidence (0-1)
- `detection_type`: Type of distraction detected
- `metadata`: Additional JSON data (speed, phone use, etc.)

---

### 4. Report Updates Table

Track status changes and comments on reports.

```sql
CREATE TABLE report_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES community_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  update_type VARCHAR NOT NULL,
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_updates_report_id ON report_updates(report_id);
CREATE INDEX idx_updates_created_at ON report_updates(created_at DESC);

-- Row Level Security
ALTER TABLE report_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view updates"
  ON report_updates FOR SELECT
  USING (true);

CREATE POLICY "Users can create updates"
  ON report_updates FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

---

## Setup SQL

Copy and run this complete setup script in **Supabase Dashboard** → **SQL Editor**:

```sql
-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR UNIQUE NOT NULL,
  display_name VARCHAR,
  avatar_url VARCHAR,
  phone VARCHAR,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_is_admin ON profiles(is_admin);

-- ============================================
-- COMMUNITY REPORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS community_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  violation_type VARCHAR NOT NULL,
  description TEXT,
  image_url VARCHAR,
  status VARCHAR DEFAULT 'pending',
  is_verified BOOLEAN DEFAULT FALSE,
  ai_confidence DECIMAL(3, 2),
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE community_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view reports"
  ON community_reports FOR SELECT USING (true);

CREATE POLICY "Users can create reports"
  ON community_reports FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports"
  ON community_reports FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports"
  ON community_reports FOR DELETE 
  USING (auth.uid() = user_id);

CREATE INDEX idx_reports_user_id ON community_reports(user_id);
CREATE INDEX idx_reports_status ON community_reports(status);
CREATE INDEX idx_reports_location ON community_reports(latitude, longitude);
CREATE INDEX idx_reports_created_at ON community_reports(created_at DESC);

-- ============================================
-- DISTRACTION HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS distraction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  confidence DECIMAL(3, 2) NOT NULL,
  detection_type VARCHAR NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE distraction_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own history"
  ON distraction_history FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history"
  ON distraction_history FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_history_user_id ON distraction_history(user_id);
CREATE INDEX idx_history_created_at ON distraction_history(created_at DESC);

-- ============================================
-- REPORT UPDATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS report_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES community_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  update_type VARCHAR NOT NULL,
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE report_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view updates"
  ON report_updates FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create updates"
  ON report_updates FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_updates_report_id ON report_updates(report_id);
```

---

## Storage Setup

### Create Storage Bucket

1. In **Supabase Dashboard** → **Storage** → **Buckets**
2. Click **New Bucket**
3. Name: `reports-images`
4. Public: **ON** (allows public image viewing)
5. Click **Create**

### Create Storage Policy

Run in SQL Editor:

```sql
-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'reports-images' 
    AND auth.role() = 'authenticated'
  );

-- Allow public to view images
CREATE POLICY "Public can view images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'reports-images');

-- Users can delete own images
CREATE POLICY "Users can delete own images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'reports-images' 
    AND auth.uid()::text = owner
  );
```

---

## Query Examples

### Get All Reports Near Location

```sql
-- Find reports within 5km of coordinates (using PostGIS)
SELECT * FROM community_reports
WHERE 
  earth_distance(
    ll_to_earth(latitude, longitude),
    ll_to_earth(21.0285, 105.8542)
  ) < 5000  -- 5km in meters
ORDER BY created_at DESC;
```

### Get Verified Reports by Type

```sql
SELECT 
  violation_type,
  COUNT(*) as count,
  AVG(ai_confidence) as avg_confidence
FROM community_reports
WHERE status = 'verified'
GROUP BY violation_type
ORDER BY count DESC;
```

### Heatmap Data

```sql
SELECT
  ROUND(latitude::numeric, 4) as lat_bucket,
  ROUND(longitude::numeric, 4) as lon_bucket,
  COUNT(*) as intensity,
  violation_type
FROM community_reports
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY lat_bucket, lon_bucket, violation_type
ORDER BY intensity DESC;
```

### User Statistics

```sql
SELECT
  p.id,
  p.display_name,
  COUNT(cr.id) as report_count,
  COUNT(dh.id) as detection_count
FROM profiles p
LEFT JOIN community_reports cr ON p.id = cr.user_id
LEFT JOIN distraction_history dh ON p.id = dh.user_id
GROUP BY p.id
ORDER BY report_count DESC;
```

---

## Security Best Practices

### 1. Row Level Security (RLS)

✅ **Enabled on all tables** - only users can see their own data unless public

### 2. API Key Management

```env
# Frontend/Mobile apps use ANON_KEY
SUPABASE_ANON_KEY=eyJ... (limited permissions)

# Backend uses SERVICE_ROLE_KEY
SUPABASE_SERVICE_ROLE_KEY=eyJ... (full permissions, never expose)
```

### 3. Storage Access

- Images are public (anyone can view)
- Upload restricted to authenticated users
- Delete restricted to image owner

### 4. Sensitive Data

- Passwords: Never stored (Supabase Auth handles)
- Tokens: Stored in secure storage (mobile) or session (web)
- Admin role: Stored in `profiles.is_admin`

---

## Backups & Monitoring

### Automatic Backups

Supabase automatically backs up daily. To restore:
1. **Project Settings** → **Database** → **Backups**
2. Select restore point
3. Click **Restore**

### Monitor Performance

In **Database** → **Diagnostics**:
- Check slow queries
- Review cache hit rates
- Monitor connection count

### Scale the Database

If hitting limits:
1. **Project Settings** → **Database** → **Size**
2. Choose larger tier
3. Scales automatically during maintenance window
