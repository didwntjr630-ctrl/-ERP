-- 사용자계정 테이블 생성
create table if not exists "사용자계정" (
  id            bigserial primary key,
  "사원명"      text not null,
  "직급"        text not null default '',
  "암호해시"    text not null,
  "상태"        text not null default 'pending',  -- pending / approved / rejected
  "관리자여부"  boolean not null default false,
  created_at    timestamptz default now(),
  "승인일시"    timestamptz,
  unique("사원명")
);

alter table "사용자계정" disable row level security;

-- 관리자 계정 (초기 암호: 1234)
insert into "사용자계정" ("사원명", "직급", "암호해시", "상태", "관리자여부")
values ('양주석', '대리', 'MTIzNA==', 'approved', true)
on conflict ("사원명") do nothing;
