-- =====================================================
-- 채팅 기능 테이블 설정
-- Supabase SQL Editor에서 실행하세요
-- =====================================================

-- 1. 채팅 메시지 테이블
CREATE TABLE IF NOT EXISTS 채팅메시지 (
  id        bigserial PRIMARY KEY,
  발신자명  text NOT NULL,
  방id      text NOT NULL,
  내용      text,
  파일url   text,
  파일명    text,
  파일타입  text,
  created_at timestamptz DEFAULT now()
);

-- 2. 채팅 읽음 상태 테이블
CREATE TABLE IF NOT EXISTS 채팅읽음상태 (
  사원명      text NOT NULL,
  방id        text NOT NULL,
  마지막읽음  timestamptz DEFAULT now(),
  PRIMARY KEY (사원명, 방id)
);

-- 3. RLS 활성화 및 정책 (anon 키 허용)
ALTER TABLE 채팅메시지    ENABLE ROW LEVEL SECURITY;
ALTER TABLE 채팅읽음상태  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='채팅메시지' AND policyname='채팅메시지_all') THEN
    CREATE POLICY "채팅메시지_all" ON 채팅메시지 FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='채팅읽음상태' AND policyname='채팅읽음상태_all') THEN
    CREATE POLICY "채팅읽음상태_all" ON 채팅읽음상태 FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE 채팅메시지;
