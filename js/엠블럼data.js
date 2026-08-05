/* ===================================================
   엠블럼data.js - 입출고등록v2 전용 localStorage 데이터
   =================================================== */

/* ===== 등록된 품목 목록 ===== */
var 엠블럼_품목목록 = [
  { 품명: '기아 45mm',               품번: '013', 규격: 'R0569-12010' },
  { 품명: '기아 61mm',               품번: '001', 규격: 'R0569-12010' },
  { 품명: '기아 71mm',               품번: '002', 규격: 'L8569-12020' },
  { 품명: 'H-EMBLEM SILVER(CN7 PE)', 품번: '008', 규격: 'AW569-12010' },
  { 품명: 'H-EMBLEM BLACK(CN7 PE)',  품번: '011', 규격: 'AW569-12010-B' },
  { 품명: 'BEZEL(GN7)',              품번: '007', 규격: 'N1569-13010' },
  { 품명: 'MX5 BEZEL SILVER',        품번: '016', 규격: 'P6569-13010' },
  { 품명: 'MX5 BEZEL BLACK',         품번: '017', 규격: 'P6569-13010-B' },
  { 품명: 'GENESIS EMBLEM',          품번: '018', 규격: '668473400B' },
  { 품명: 'GN7 F/L',                 품번: '019', 규격: '' },
];

/* ===== 담당자 목록 ===== */
var 엠블럼_담당자목록 = [
  { 코드: '001', 직급: '이사',  이름: '박영민' },
  { 코드: '002', 직급: '부장',  이름: '이풍화' },
  { 코드: '003', 직급: '부장',  이름: '이재훈' },
  { 코드: '004', 직급: '과장',  이름: '이민호' },
  { 코드: '005', 직급: '과장',  이름: '조요한' },
  { 코드: '006', 직급: '대리',  이름: '양주석' },
  { 코드: '007', 직급: '대리',  이름: '홍서현' },
  { 코드: '008', 직급: '반장',  이름: '이정자' },
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

var 엠블럼_저장소키 = 'samyang_입출고목록';

function 엠블럼_출고번호생성() {
  var 오늘 = new Date();
  var 연도 = String(오늘.getFullYear()).slice(2);
  var 월   = String(오늘.getMonth() + 1).padStart(2, '0');
  var 접두어 = 'MV' + 연도 + 월;
  var 목록 = 엠블럼_데이터불러오기();
  var 같은달 = 목록.filter(function(h) { return h.출고번호 && h.출고번호.startsWith(접두어); });
  return 접두어 + String(같은달.length + 1).padStart(3, '0');
}

function 엠블럼_데이터불러오기() {
  var v = localStorage.getItem(엠블럼_저장소키);
  if (!v) return [];
  try { return JSON.parse(v); } catch(e) { return []; }
}

function 엠블럼_데이터저장(새항목) {
  var 목록 = 엠블럼_데이터불러오기();
  새항목.id = Date.now();
  새항목.출고번호 = 엠블럼_출고번호생성();
  목록.push(새항목);
  localStorage.setItem(엠블럼_저장소키, JSON.stringify(목록));
  return 새항목;
}

function 엠블럼_데이터수정(id, 수정값) {
  var 목록 = 엠블럼_데이터불러오기();
  var 인덱스 = 목록.findIndex(function(h) { return h.id === id; });
  if (인덱스 === -1) return false;
  목록[인덱스] = Object.assign(목록[인덱스], 수정값);
  localStorage.setItem(엠블럼_저장소키, JSON.stringify(목록));
  return true;
}

function 엠블럼_데이터삭제(id) {
  var 목록 = 엠블럼_데이터불러오기();
  localStorage.setItem(엠블럼_저장소키, JSON.stringify(목록.filter(function(h) { return h.id !== id; })));
}

function 엠블럼_데이터하나가져오기(id) {
  return 엠블럼_데이터불러오기().find(function(h) { return h.id === id; }) || null;
}
