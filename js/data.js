/* ===================================================
   data.js - 데이터 저장 및 불러오기 (Supabase)
   =================================================== */

var 테이블명 = '입출고기록';

/* ===== 등록된 품목 목록 (품명 + 품번) ===== */
var 품목목록 = [
  { 품명: '기아 45mm',               품번: '013', 규격: 'R0569-12010',          단가: 665   },
  { 품명: '기아 61mm',               품번: '001', 규격: 'R0569-12010',          단가: 670   },
  { 품명: '기아 71mm',               품번: '002', 규격: 'L8569-12020',          단가: 670   },
  { 품명: 'H-EMBLEM SILVER(CN7 PE)', 품번: '008', 규격: 'AW569-12010',          단가: 730   },
  { 품명: 'H-EMBLEM BLACK(CN7 PE)',  품번: '011', 규격: 'AW569-12010-B',        단가: 1410  },
  { 품명: 'BEZEL(GN7)',              품번: '007', 규격: 'N1569-13010',            단가: 500   },
  { 품명: 'MX5 BEZEL SILVER',        품번: '016', 규격: 'P6569-13010',          단가: 0     },
  { 품명: 'MX5 BEZEL BLACK',         품번: '017', 규격: 'P6569-13010-B',        단가: 0     },
  { 품명: 'GENESIS EMBLEM',          품번: '018', 규격: '668473400B',           단가: 15320 },
  { 품명: 'GN7 F/L',                 품번: '',    규격: '',                     단가: 0     },
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

/* 출고번호 자동 생성 (예: MV2606001) */
async function 출고번호생성() {
  var 오늘 = new Date();
  var 연도 = String(오늘.getFullYear()).slice(2);
  var 월 = String(오늘.getMonth() + 1).padStart(2, '0');
  var 접두어 = 'MV' + 연도 + 월;

  var { data } = await 수파베이스
    .from(테이블명)
    .select('출고번호')
    .like('출고번호', 접두어 + '%');

  var 다음순번 = String((data ? data.length : 0) + 1).padStart(3, '0');
  return 접두어 + 다음순번;
}

/* 전체 목록 불러오기 */
async function 데이터불러오기() {
  var { data, error } = await 수파베이스
    .from(테이블명)
    .select('*')
    .order('id', { ascending: false });
  if (error) { console.error('데이터불러오기 오류:', error); return []; }
  return data || [];
}

/* 새 항목 저장 */
async function 데이터저장(새항목) {
  새항목.출고번호 = await 출고번호생성();
  var { data, error } = await 수파베이스
    .from(테이블명)
    .insert(새항목)
    .select()
    .single();
  if (error) { console.error('데이터저장 오류:', error); 알림표시('저장 실패: ' + error.message, '오류'); return null; }
  return data;
}

/* 특정 항목 수정 — 실제 수정된 행이 있으면 true, 0건이면 false */
async function 데이터수정(id, 수정값) {
  var { data, error } = await 수파베이스
    .from(테이블명)
    .update(수정값)
    .eq('id', id)
    .select('id');
  if (error) { console.error('데이터수정 오류:', error); return false; }
  return data && data.length > 0;
}

/* 특정 항목 삭제 — 실제 삭제된 행이 있으면 true, 0건이면 false */
async function 데이터삭제(id) {
  var { data, error } = await 수파베이스
    .from(테이블명)
    .delete()
    .eq('id', id)
    .select('id');
  if (error) { console.error('데이터삭제 오류:', error); return false; }
  return data && data.length > 0;
}

/* 매출기록에서 해당 입출고id 확정 취소 */
async function 매출기록확정취소(입출고id) {
  var { error } = await 수파베이스
    .from('매출기록')
    .delete()
    .eq('입출고id', 입출고id);
  if (error) { console.error('매출기록확정취소 오류:', error); return false; }
  return true;
}

/* 특정 항목 한 개 가져오기 */
async function 데이터하나가져오기(id) {
  var { data, error } = await 수파베이스
    .from(테이블명)
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}
