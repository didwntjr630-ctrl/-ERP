-- 매출기록 테이블 생성
create table if not exists "매출기록" (
  id            bigserial primary key,
  "입출고id"    bigint,
  "품명"        text,
  "품번"        text,
  "출발공정"    text,
  "도착공정"    text,
  "출고수량"    integer default 0,
  "출고일자"    text,
  "lot번호"     text,
  "담당자"      text,
  "확정일시"    timestamptz default now(),
  created_at    timestamptz default now()
);
alter table "매출기록" disable row level security;
