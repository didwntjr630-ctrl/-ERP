-- =====================================================
-- 급여관리 v2 DB 업데이트 (Supabase SQL Editor에서 실행)
-- 기존 데이터 보존 · 컬럼 추가 · 신규 테이블 생성
-- =====================================================

-- 1. 직원정보 컬럼 추가
ALTER TABLE 직원정보 ADD COLUMN IF NOT EXISTS 직급수당   numeric(12,2) DEFAULT 0;
ALTER TABLE 직원정보 ADD COLUMN IF NOT EXISTS 근속수당   numeric(12,2) DEFAULT 0;
ALTER TABLE 직원정보 ADD COLUMN IF NOT EXISTS 입사일     date;

-- 2. 근태기록 테이블 신규 생성 (CAPS 파일 없이 클릭으로 등록)
CREATE TABLE IF NOT EXISTS 근태기록 (
  id          bigserial PRIMARY KEY,
  직원id      bigint REFERENCES 직원정보(id) ON DELETE CASCADE,
  날짜        date NOT NULL,
  근태종류    text NOT NULL DEFAULT '정상출근',
  연장시간    numeric(5,2) DEFAULT 0,
  UNIQUE(직원id, 날짜)
);
ALTER TABLE 근태기록 ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='근태기록' AND policyname='근태기록_all') THEN
    CREATE POLICY "근태기록_all" ON 근태기록 FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 3. 급여결과 컬럼 추가 (없는 컬럼만 추가)
ALTER TABLE 급여결과 ADD COLUMN IF NOT EXISTS 직급수당   numeric(12,2) DEFAULT 0;
ALTER TABLE 급여결과 ADD COLUMN IF NOT EXISTS 근속수당   numeric(12,2) DEFAULT 0;
ALTER TABLE 급여결과 ADD COLUMN IF NOT EXISTS 주휴수당   numeric(12,2) DEFAULT 0;
ALTER TABLE 급여결과 ADD COLUMN IF NOT EXISTS 반차시간   numeric(8,2) DEFAULT 0;
ALTER TABLE 급여결과 ADD COLUMN IF NOT EXISTS 연차시간   numeric(8,2) DEFAULT 0;
ALTER TABLE 급여결과 ADD COLUMN IF NOT EXISTS 결근일수   integer DEFAULT 0;
ALTER TABLE 급여결과 ADD COLUMN IF NOT EXISTS 공휴일시간 numeric(8,2) DEFAULT 0;
ALTER TABLE 급여결과 ADD COLUMN IF NOT EXISTS 결근공제   numeric(12,2) DEFAULT 0;

-- 4. 대한민국 공휴일 기본값 삽입 (2025 ~ 2026)
INSERT INTO 공휴일 (날짜, 명칭) VALUES
  ('2025-01-01','신정'),
  ('2025-01-28','설날 전날'),
  ('2025-01-29','설날'),
  ('2025-01-30','설날 다음날'),
  ('2025-03-01','삼일절'),
  ('2025-03-03','삼일절 대체공휴일'),
  ('2025-05-05','어린이날'),
  ('2025-05-06','부처님오신날 대체공휴일'),
  ('2025-06-06','현충일'),
  ('2025-08-15','광복절'),
  ('2025-10-03','개천절'),
  ('2025-10-05','추석 전날'),
  ('2025-10-06','추석'),
  ('2025-10-07','추석 다음날'),
  ('2025-10-08','추석 대체공휴일'),
  ('2025-10-09','한글날'),
  ('2025-12-25','성탄절'),
  ('2026-01-01','신정'),
  ('2026-02-16','설날 전날'),
  ('2026-02-17','설날'),
  ('2026-02-18','설날 다음날'),
  ('2026-03-01','삼일절'),
  ('2026-05-05','어린이날'),
  ('2026-05-24','부처님오신날'),
  ('2026-06-06','현충일'),
  ('2026-08-15','광복절'),
  ('2026-10-03','개천절'),
  ('2026-10-09','한글날'),
  ('2026-10-24','추석 전날'),
  ('2026-10-25','추석'),
  ('2026-10-26','추석 다음날'),
  ('2026-12-25','성탄절')
ON CONFLICT (날짜) DO NOTHING;
