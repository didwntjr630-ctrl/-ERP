-- 출하성적서 테이블 생성
-- 테스트 DB + 운영 DB 둘 다 실행 필요

create table if not exists "출하성적서" (
  id              bigserial primary key,
  "입출고id"      bigint,
  "작성일"        text default '',
  "차종"          text default '',
  "공급자명"      text default '(주)삼양이엔지',
  "EO_NO"         text default '',
  "품번"          text default '',
  "품명"          text default '',
  "수량"          integer default 0,
  "lot번호"       text default '',
  "검사목적"      text default '정기',
  "승인항목"      jsonb default '{"외관":true,"치수":false,"재질":false,"성능":false}',
  "종합판정"      text default '승인',
  "종합판정기타"  text default '',
  "측정치"        jsonb default '[]',
  "비고"          text default '',
  "담당자"        text default '',
  created_at      timestamptz default now()
);

alter table "출하성적서" disable row level security;
