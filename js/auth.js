/* ===================================================
   auth.js - 로그인 / 계정 관리 (Supabase 기반)
   =================================================== */

var SESSION_KEY = 'erp_session';

function _암호해시(암호) {
  return btoa(encodeURIComponent(암호));
}

/* 로그인 시도 */
async function 로그인시도(사원명, 암호) {
  var { data, error } = await 수파베이스
    .from('사용자계정')
    .select('*')
    .eq('사원명', 사원명)
    .maybeSingle();

  if (error) return { 성공: false, 메시지: '서버 오류: ' + error.message };
  if (!data)  return { 성공: false, 메시지: '등록되지 않은 계정입니다.' };
  if (data['상태'] === 'pending')  return { 성공: false, 메시지: '관리자 승인 대기 중입니다.' };
  if (data['상태'] === 'rejected') return { 성공: false, 메시지: '승인이 거부된 계정입니다.' };
  if (data['암호해시'] !== _암호해시(암호)) return { 성공: false, 메시지: '암호가 일치하지 않습니다.' };

  return { 성공: true, 사용자: data };
}

/* 계정 신청 (사원명 중복 불가) */
async function 계정신청(사원명, 암호) {
  var { data: 기존, error: 조회오류 } = await 수파베이스
    .from('사용자계정')
    .select('id, 상태')
    .eq('사원명', 사원명)
    .maybeSingle();

  if (조회오류) return { 성공: false, 메시지: '서버 오류: ' + 조회오류.message };
  if (기존) {
    var 상태텍스트 = { pending: '승인 대기 중인', approved: '이미 승인된', rejected: '승인 거부된' };
    return { 성공: false, 메시지: (상태텍스트[기존['상태']] || '이미 존재하는') + ' 계정입니다.' };
  }

  var { error } = await 수파베이스
    .from('사용자계정')
    .insert({ '사원명': 사원명, '암호해시': _암호해시(암호), '상태': 'pending' });

  return error ? { 성공: false, 메시지: '생성 실패: ' + error.message } : { 성공: true };
}

/* 암호 변경 */
async function 암호변경처리(사원명, 현재암호, 새암호) {
  var { data, error } = await 수파베이스
    .from('사용자계정')
    .select('id, 암호해시')
    .eq('사원명', 사원명)
    .maybeSingle();

  if (error || !data) return { 성공: false, 메시지: '계정을 찾을 수 없습니다.' };
  if (data['암호해시'] !== _암호해시(현재암호)) return { 성공: false, 메시지: '현재 암호가 일치하지 않습니다.' };

  var { error: updateError } = await 수파베이스
    .from('사용자계정')
    .update({ '암호해시': _암호해시(새암호) })
    .eq('id', data.id);

  return updateError ? { 성공: false, 메시지: '변경 실패: ' + updateError.message } : { 성공: true };
}

/* 관리자 전용: 계정 승인 */
async function 계정승인(계정id) {
  var { error } = await 수파베이스
    .from('사용자계정')
    .update({ '상태': 'approved', '승인일시': new Date().toISOString() })
    .eq('id', 계정id);
  return error ? { 성공: false, 메시지: error.message } : { 성공: true };
}

/* 관리자 전용: 계정 거부 */
async function 계정거부(계정id) {
  var { error } = await 수파베이스
    .from('사용자계정')
    .update({ '상태': 'rejected' })
    .eq('id', 계정id);
  return error ? { 성공: false, 메시지: error.message } : { 성공: true };
}

/* 관리자 전용: 전체 계정 목록 */
async function 전체계정목록() {
  var { data, error } = await 수파베이스
    .from('사용자계정')
    .select('id, 사원명, 직급, 상태, 관리자여부, created_at, 승인일시')
    .order('created_at', { ascending: false });
  return error ? [] : data;
}

/* 세션 */
function 로그인처리(사용자) {
  var 세션 = {
    사원명: 사용자['사원명'],
    직급: 사용자['직급'],
    관리자: 사용자['관리자여부'],
    시각: new Date().toISOString()
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(세션));
}

function 현재세션() {
  var v = sessionStorage.getItem(SESSION_KEY);
  return v ? JSON.parse(v) : null;
}

function 로그아웃() {
  sessionStorage.removeItem(SESSION_KEY);
  location.href = 'login.html';
}

function 세션체크() {
  if (!현재세션()) { location.href = 'login.html'; return false; }
  return true;
}

function 관리자체크() {
  var 세션 = 현재세션();
  if (!세션 || !세션.관리자) { location.href = 'main.html'; return false; }
  return true;
}
