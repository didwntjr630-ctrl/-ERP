-- 입출고기록 테이블 생성
create table if not exists "입출고기록" (
  id          bigserial primary key,
  "품명"      text,
  "품번"      text,
  "공정"      text,
  "출발공정"  text,
  "도착공정"  text,
  "입고수량"  integer default 0,
  "출고수량"  integer default 0,
  "불량수량"  integer default 0,
  "잔량"      integer default 0,
  "출고일자"  text,
  "lot번호"   text,
  "담당자"    text,
  "담당자코드" text,
  "완료여부"  boolean default true,
  "출고번호"  text,
  created_at  timestamptz default now()
);

-- 내부 시스템이므로 RLS 비활성화
alter table "입출고기록" disable row level security;
