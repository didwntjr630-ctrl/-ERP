/* ===================================================
   엠블럼data.js — Supabase 데이터 레이어
   입출고등록v2.html 전용
   =================================================== */

var 엠블럼_테이블 = '엠블럼입출고';

/* ─────────── 품목 목록 — Supabase 품목마스터 테이블에서 로드 (일반 시스템과 공용) ─────────── */
var 엠블럼_품목목록 = [];

async function 엠블럼_품목목록로드() {
  var { data, error } = await 수파베이스
    .from('품목마스터')
    .select('*')
    .order('id', { ascending: true });
  if (error) { console.error('엠블럼_품목목록로드 오류:', error); return; }
  엠블럼_품목목록.length = 0;
  (data || []).forEach(function(p) { 엠블럼_품목목록.push(p); });
}
엠블럼_품목목록로드();

수파베이스.channel('품목마스터_실시간_엠블럼')
  .on('postgres_changes', { event: '*', schema: 'public', table: '품목마스터' }, function() {
    엠블럼_품목목록로드();
  })
  .subscribe();

/* ─────────── 담당자 목록 ─────────── */
var 엠블럼_담당자목록 = [
  { 코드: '001', 직급: '이사', 이름: '박영민' },
  { 코드: '002', 직급: '부장', 이름: '이풍화' },
  { 코드: '003', 직급: '부장', 이름: '이재훈' },
  { 코드: '004', 직급: '과장', 이름: '이민호' },
  { 코드: '005', 직급: '과장', 이름: '조요한' },
  { 코드: '006', 직급: '대리', 이름: '양주석' },
  { 코드: '007', 직급: '대리', 이름: '홍서현' },
  { 코드: '008', 직급: '반장', 이름: '이정자' },
];

function 엠블럼_품목검색(검색어) {
  var 소문자 = 검색어.toLowerCase();
  return 엠블럼_품목목록.filter(function(p) {
    return p.품명.toLowerCase().includes(소문자) || p.품번.includes(검색어);
  });
}

function 엠블럼_품목유효성확인(입력값) {
  return 엠블럼_품목목록.find(function(p) {
    return p.품명 === 입력값 || p.품번 === 입력값;
  }) || null;
}

/* ─────────── 출고번호 생성 ─────────── */
async function 엠블럼_출고번호생성() {
  var 오늘   = new Date();
  var 연도   = String(오늘.getFullYear()).slice(2);
  var 월     = String(오늘.getMonth() + 1).padStart(2, '0');
  var 접두어  = 'MV' + 연도 + 월;
  var { count } = await 수파베이스
    .from(엠블럼_테이블)
    .select('*', { count: 'exact', head: true })
    .like('출고번호', 접두어 + '%');
  return 접두어 + String((count || 0) + 1).padStart(3, '0');
}

/* ─────────── CRUD ─────────── */
async function 엠블럼_데이터불러오기() {
  var { data, error } = await 수파베이스
    .from(엠블럼_테이블)
    .select('*')
    .order('출고일자', { ascending: false })
    .order('id',       { ascending: false });
  if (error) { console.error('데이터 불러오기 실패:', error); return []; }
  return data || [];
}

async function 엠블럼_데이터저장(새항목) {
  새항목.출고번호 = await 엠블럼_출고번호생성();
  var { data, error } = await 수파베이스
    .from(엠블럼_테이블)
    .insert(새항목)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function 엠블럼_데이터수정(id, 수정값) {
  var { error } = await 수파베이스
    .from(엠블럼_테이블)
    .update(수정값)
    .eq('id', id);
  if (error) throw error;
  return true;
}

async function 엠블럼_데이터삭제(id) {
  var { error } = await 수파베이스
    .from(엠블럼_테이블)
    .delete()
    .eq('id', id);
  if (error) throw error;
}

async function 엠블럼_데이터하나가져오기(id) {
  var { data, error } = await 수파베이스
    .from(엠블럼_테이블)
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}
