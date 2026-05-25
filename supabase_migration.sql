-- ============================================================
-- SENTINEL AI — Supabase SQL Migration
-- Project: aeigibdspuzwcwsthfhg
-- Chạy toàn bộ script này trong:
--   Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- ─── 1. PROFILES (thông tin người dùng) ─────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT,
  display_name TEXT,
  avatar_url   TEXT,
  phone        TEXT,
  is_admin     BOOLEAN DEFAULT FALSE,
  is_banned    BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Tự động tạo profile khi user đăng ký
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 2. ADMIN_USERS (danh sách admin) ───────────────────────
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id)
);

-- ─── 3. HISTORY (lịch sử phát hiện biển báo) ────────────────
CREATE TABLE IF NOT EXISTS public.history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude       DOUBLE PRECISION NOT NULL,
  longitude      DOUBLE PRECISION NOT NULL,
  detection_type TEXT NOT NULL,
  description    TEXT,
  image_url      TEXT,
  timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index để truy vấn nhanh theo user
CREATE INDEX IF NOT EXISTS idx_history_user_id ON public.history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON public.history(created_at DESC);

-- ─── 4. COMMUNITY_REPORTS (báo cáo vi phạm giao thông) ──────
CREATE TABLE IF NOT EXISTS public.community_reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  latitude       DOUBLE PRECISION NOT NULL,
  longitude      DOUBLE PRECISION NOT NULL,
  violation_type TEXT NOT NULL,
  description    TEXT,
  image_url      TEXT,
  status         TEXT DEFAULT 'pending', -- pending, verified, rejected
  is_verified    BOOLEAN DEFAULT FALSE,
  ai_confidence  DOUBLE PRECISION,
  upvotes        INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_location ON public.community_reports(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.community_reports(created_at DESC);

-- Bật RLS cho tất cả bảng
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

-- PROFILES: User chỉ xem/sửa profile của mình
DROP POLICY IF EXISTS "Users can view own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role bypasses RLS"    ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- HISTORY: User chỉ xem/tạo history của mình
DROP POLICY IF EXISTS "Users can view own history"   ON public.history;
DROP POLICY IF EXISTS "Users can insert own history" ON public.history;

CREATE POLICY "Users can view own history"
  ON public.history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history"
  ON public.history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own history"
  ON public.history FOR DELETE
  USING (auth.uid() = user_id);

-- COMMUNITY_REPORTS: Mọi người đọc được, user tạo được báo cáo
DROP POLICY IF EXISTS "Anyone can view reports" ON public.community_reports;
DROP POLICY IF EXISTS "Users can create reports" ON public.community_reports;
DROP POLICY IF EXISTS "Users can delete own reports" ON public.community_reports;

CREATE POLICY "Anyone can view reports"
  ON public.community_reports FOR SELECT
  USING (true);

CREATE POLICY "Users can create reports"
  ON public.community_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports"
  ON public.community_reports FOR DELETE
  USING (auth.uid() = user_id);

-- ADMIN_USERS: Chỉ service_role mới đọc được
DROP POLICY IF EXISTS "Only service role can read admin_users" ON public.admin_users;
CREATE POLICY "Only service role can read admin_users"
  ON public.admin_users FOR SELECT
  USING (false); -- Backend dùng service_role key, tự bypass RLS

-- ─── 6. THÊM ADMIN USER ─────────────────────────────────────
-- ⚠️ THAY THẾ 'YOUR-USER-UUID-HERE' bằng UUID thực của admin
-- Lấy UUID tại: Authentication → Users → Copy User UID
--
-- INSERT INTO public.admin_users (user_id)
-- VALUES ('YOUR-USER-UUID-HERE')
-- ON CONFLICT (user_id) DO NOTHING;

-- ─── KIỂM TRA ───────────────────────────────────────────────
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- ORDER BY table_name;
