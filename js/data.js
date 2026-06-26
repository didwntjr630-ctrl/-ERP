/* ===================================================
   data.js - 데이터 저장 및 불러오기 담당 파일
   브라우저의 localStorage에 데이터를 보관합니다.
   =================================================== */

/* ===== 등록된 품목 목록 (품명 + 품번) ===== */
var 품목목록 = [
  { 품명: '기아 45mm',              품번: '013' },
  { 품명: '기아 61mm',              품번: '001' },
  { 품명: '기아 71mm',              품번: '002' },
  { 품명: 'H-EMBLEM SILVER(CN7 PE)', 품번: '008' },
  { 품명: 'H-EMBLEM BLACK(CN7 PE)',  품번: '011' },
  { 품명: 'BEZEL(GN7)',             품번: '007' },
  { 품명: '두산 BEZEL',             품번: '012' },
  { 품명: 'MX5 BEZEL SILVER',       품번: '016' },
  { 품명: 'MX5 BEZEL BLACK',        품번: '017' },
  { 품명: 'GENESIS EMBLEM',         품번: '018' },
];

/* ===== 담당자 목록 (코드 + 직급 + 이름) ===== */
var 담당자목록 = [
  { 코드: '001', 직급: '이사',  이름: '박영민' },
  { 코드: '002', 직급: '부장',  이름: '이풍화' },
  { 코드: '003', 직급: '부장',  이름: '이재훈' },
  { 코드: '004', 직급: '과장',  이름: '이민호' },
  { 코드: '005', 직급: '과장',  이름: '조요한' },
  { 코드: '006', 직급: '대리',  이름: '양주석' },
  { 코드: '007', 직급: '대리',  이름: '홍서현' },
  { 코드: '008', 직급: '반장',  이름: '이정자' },
];

/* 품명 또는 품번으로 품목 검색 */
function 품목검색(검색어) {
  var 소문자 = 검색어.toLowerCase();
  return 품목목록.filter(function(품목) {
    return 품목.품명.toLowerCase().includes(소문자) ||
           품목.품번.includes(검색어);
  });
}

/* 입력값이 정확히 등록된 품목인지 확인 */
function 품목유효성확인(입력값) {
  return 품목목록.find(function(품목) {
    return 품목.품명 === 입력값 || 품목.품번 === 입력값;
  }) || null;
}

var 저장소키 = 'erp_입출고목록';

/* 출고번호 자동 생성 (예: MV2606001) */
function 출고번호생성() {
  var 오늘 = new Date();
  var 연도 = String(오늘.getFullYear()).slice(2); // 26
  var 월 = String(오늘.getMonth() + 1).padStart(2, '0'); // 06
  var 접두어 = 'MV' + 연도 + 월;

  var 목록 = 데이터불러오기();
  var 같은달번호 = 목록.filter(function(항목) {
    return 항목.출고번호 && 항목.출고번호.startsWith(접두어);
  });

  var 다음순번 = String(같은달번호.length + 1).padStart(3, '0');
  return 접두어 + 다음순번;
}

/* 전체 목록 불러오기 */
function 데이터불러오기() {
  var 저장된값 = localStorage.getItem(저장소키);
  if (!저장된값) return [];
  try {
    return JSON.parse(저장된값);
  } catch (e) {
    return [];
  }
}

/* 새 항목 저장 */
function 데이터저장(새항목) {
  var 목록 = 데이터불러오기();
  새항목.id = Date.now(); // 고유 번호 (수정/삭제에 사용)
  새항목.출고번호 = 출고번호생성();
  목록.push(새항목);
  localStorage.setItem(저장소키, JSON.stringify(목록));
  return 새항목;
}

/* 특정 항목 수정 */
function 데이터수정(id, 수정값) {
  var 목록 = 데이터불러오기();
  var 인덱스 = 목록.findIndex(function(항목) { return 항목.id === id; });
  if (인덱스 === -1) return false;
  // 출고번호와 id는 유지, 나머지 덮어쓰기
  목록[인덱스] = Object.assign(목록[인덱스], 수정값);
  localStorage.setItem(저장소키, JSON.stringify(목록));
  return true;
}

/* 특정 항목 삭제 */
function 데이터삭제(id) {
  var 목록 = 데이터불러오기();
  var 새목록 = 목록.filter(function(항목) { return 항목.id !== id; });
  localStorage.setItem(저장소키, JSON.stringify(새목록));
}

/* 특정 항목 한 개 가져오기 */
function 데이터하나가져오기(id) {
  var 목록 = 데이터불러오기();
  return 목록.find(function(항목) { return 항목.id === id; }) || null;
}
