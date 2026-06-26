/* ===================================================
   auth.js - 로그인 / 암호 관리
   =================================================== */

var AUTH_KEY     = 'erp_passwords';
var SESSION_KEY  = 'erp_session';

/* 암호 저장소 (localStorage) */
function 암호목록가져오기() {
  var v = localStorage.getItem(AUTH_KEY);
  return v ? JSON.parse(v) : {};
}

function 암호저장(사원명, 암호) {
  var 목록 = 암호목록가져오기();
  목록[사원명] = btoa(encodeURIComponent(암호)); // 간단 인코딩
  localStorage.setItem(AUTH_KEY, JSON.stringify(목록));
}

function 암호확인(사원명, 암호) {
  var 목록 = 암호목록가져오기();
  if (!목록[사원명]) return false;
  return 목록[사원명] === btoa(encodeURIComponent(암호));
}

function 암호등록여부(사원명) {
  var 목록 = 암호목록가져오기();
  return !!목록[사원명];
}

/* 세션 */
function 로그인처리(사원명, 직급) {
  var 세션 = { 사원명: 사원명, 직급: 직급, 시각: new Date().toISOString() };
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

/* 페이지 진입 시 세션 체크 - 보호 페이지에서 호출 */
function 세션체크() {
  if (!현재세션()) {
    location.href = 'login.html';
  }
}
