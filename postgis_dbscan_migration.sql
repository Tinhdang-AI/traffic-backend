-- =========================================================================
-- SENTINEL AI — PostGIS & DBSCAN Clustering Supabase Migration
-- Project: aeigibdspuzwcwsthfhg
--
-- Chạy toàn bộ script này trong:
--   Supabase Dashboard → SQL Editor → New Query → Run
-- =========================================================================

-- 1. Kích hoạt extension PostGIS để xử lý dữ liệu địa lý không gian
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Thêm cột 'location' kiểu GEOMETRY vào bảng 'community_reports'
ALTER TABLE public.community_reports 
ADD COLUMN IF NOT EXISTS location GEOMETRY(Point, 4326);

-- 3. Tạo bảng 'approved_signs' để lưu trữ biển báo đã gom cụm & phê duyệt
CREATE TABLE IF NOT EXISTS public.approved_signs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label          TEXT NOT NULL,
  latitude       DOUBLE PRECISION NOT NULL,
  longitude      DOUBLE PRECISION NOT NULL,
  location       GEOMETRY(Point, 4326),
  status         TEXT DEFAULT 'approved', -- approved, removed
  upvotes        INTEGER DEFAULT 1,
  reports_count  INTEGER DEFAULT 1,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Đánh chỉ mục địa lý GIST để tăng tốc độ truy vấn không gian
CREATE INDEX IF NOT EXISTS idx_reports_location_gist ON public.community_reports USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_approved_signs_location_gist ON public.approved_signs USING GIST(location);

-- 5. Trigger tự động chuyển đổi Latitude & Longitude sang Geometry Point cho community_reports
CREATE OR REPLACE FUNCTION update_community_report_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_report_location ON public.community_reports;
CREATE TRIGGER trigger_update_report_location
  BEFORE INSERT OR UPDATE OF latitude, longitude
  ON public.community_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_community_report_location();

-- 6. Trigger tự động chuyển đổi Latitude & Longitude sang Geometry Point cho approved_signs
CREATE OR REPLACE FUNCTION update_approved_sign_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_approved_sign_location ON public.approved_signs;
CREATE TRIGGER trigger_update_approved_sign_location
  BEFORE INSERT OR UPDATE OF latitude, longitude
  ON public.approved_signs
  FOR EACH ROW
  EXECUTE FUNCTION update_approved_sign_location();

-- 7. Cập nhật dữ liệu hiện tại để điền cột location nếu có sẵn lat/lng
UPDATE public.community_reports
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND location IS NULL;

-- 8. Hàm tìm kiếm biển báo đã được phê duyệt bằng PostGIS ST_DWithin (Truy vấn không gian siêu nhanh)
-- Gọi qua API NestJS: client.rpc('get_nearby_approved_signs', { lat: ..., lng: ..., radius_meters: ... })
CREATE OR REPLACE FUNCTION get_nearby_approved_signs(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION
)
RETURNS TABLE (
  id UUID,
  label TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  status TEXT,
  upvotes INTEGER,
  reports_count INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.label,
    s.latitude,
    s.longitude,
    s.status,
    s.upvotes,
    s.reports_count,
    s.created_at,
    s.updated_at
  FROM public.approved_signs s
  WHERE ST_DWithin(
    s.location::geography,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_meters
  ) AND s.status = 'approved'
  ORDER BY s.upvotes DESC;
END;
$$ LANGUAGE plpgsql;

-- 9. Phân quyền truy cập cho tất cả các role để gọi được hàm get_nearby_approved_signs
GRANT EXECUTE ON FUNCTION get_nearby_approved_signs(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated, service_role;
