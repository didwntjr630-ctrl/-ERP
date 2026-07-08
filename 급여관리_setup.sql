-- =====================================================
-- 급여관리 테이블 설정 (테스트 서버용)
-- Supabase SQL Editor에서 실행
-- =====================================================

-- 1. 직원정보
CREATE TABLE IF NOT EXISTS 직원정보 (
  id        bigserial PRIMARY KEY,
  이름      text NOT NULL,
  직급      text DEFAULT '',
  시급      numeric(10,2) NOT NULL DEFAULT 0,
  상태      text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- 2. 출퇴근기록 (CAPS 엑셀 파싱 결과)
CREATE TABLE IF NOT EXISTS 출퇴근기록 (
  id        bigserial PRIMARY KEY,
  직원id    bigint REFERENCES 직원정보(id) ON DELETE CASCADE,
  날짜      date NOT NULL,
  출근시간  time,
  퇴근시간  time,
  년월      text NOT NULL,
  UNIQUE(직원id, 날짜)
);

-- 3. 특수근태 (연차/반차/외출/조퇴/결근)
CREATE TABLE IF NOT EXISTS 특수근태 (
  id        bigserial PRIMARY KEY,
  직원id    bigint REFERENCES 직원정보(id) ON DELETE CASCADE,
  날짜      date NOT NULL,
  종류      text NOT NULL,
  시간      numeric(5,2) DEFAULT 0
);

-- 4. 공휴일
CREATE TABLE IF NOT EXISTS 공휴일 (
  id        bigserial PRIMARY KEY,
  날짜      date UNIQUE NOT NULL,
  명칭      text NOT NULL
);

-- 5. 급여결과
CREATE TABLE IF NOT EXISTS 급여결과 (
  id          bigserial PRIMARY KEY,
  직원id      bigint REFERENCES 직원정보(id) ON DELETE CASCADE,
  년월        text NOT NULL,
  정규시간    numeric(8,2) DEFAULT 0,
  연장시간    numeric(8,2) DEFAULT 0,
  주말시간    numeric(8,2) DEFAULT 0,
  연차시간    numeric(8,2) DEFAULT 0,
  공제시간    numeric(8,2) DEFAULT 0,
  기본급      numeric(12,2) DEFAULT 0,
  연장수당    numeric(12,2) DEFAULT 0,
  주말수당    numeric(12,2) DEFAULT 0,
  공제액      numeric(12,2) DEFAULT 0,
  소득세      numeric(12,2) DEFAULT 0,
  실수령액    numeric(12,2) DEFAULT 0,
  상세내역    jsonb,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(직원id, 년월)
);

-- 6. RLS 활성화
ALTER TABLE 직원정보    ENABLE ROW LEVEL SECURITY;
ALTER TABLE 출퇴근기록  ENABLE ROW LEVEL SECURITY;
ALTER TABLE 특수근태    ENABLE ROW LEVEL SECURITY;
ALTER TABLE 공휴일      ENABLE ROW LEVEL SECURITY;
ALTER TABLE 급여결과    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='직원정보' AND policyname='직원정보_all') THEN
    CREATE POLICY "직원정보_all"   ON 직원정보   FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='출퇴근기록' AND policyname='출퇴근기록_all') THEN
    CREATE POLICY "출퇴근기록_all" ON 출퇴근기록 FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='특수근태' AND policyname='특수근태_all') THEN
    CREATE POLICY "특수근태_all"   ON 특수근태   FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='공휴일' AND policyname='공휴일_all') THEN
    CREATE POLICY "공휴일_all"     ON 공휴일     FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='급여결과' AND policyname='급여결과_all') THEN
    CREATE POLICY "급여결과_all"   ON 급여결과   FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
