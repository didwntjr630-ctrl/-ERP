/* presence.js - 실시간 접속자 현황 */

var _접속자채널 = null;

function 접속자패널초기화() {
  var 세션 = 현재세션();
  if (!세션) return;

  _접속자채널 = 수파베이스.channel('erp_presence', {
    config: { presence: { key: 세션.사원명 } }
  });

  _접속자채널
    .on('presence', { event: 'sync' }, 접속자목록갱신)
    .subscribe(async function(status) {
      if (status === 'SUBSCRIBED') {
        await _접속자채널.track({ 사원명: 세션.사원명, 직급: 세션.직급 });
      }
    });
}

function 접속자목록갱신() {
  if (!_접속자채널) return;
  var state = _접속자채널.presenceState();
  var 접속자들 = [];
  Object.keys(state).forEach(function(key) {
    var 항목들 = state[key] || [];
    if (항목들.length > 0 && 항목들[0].사원명) {
      접속자들.push({ 사원명: 항목들[0].사원명, 직급: 항목들[0].직급 || '' });
    }
  });

  var 목록el = document.getElementById('접속자목록');
  if (!목록el) return;

  document.getElementById('접속자수뱃지').textContent = 접속자들.length || '';
  if (typeof DM목록갱신 === 'function') DM목록갱신();

  if (접속자들.length === 0) {
    목록el.innerHTML = '<div style="padding:16px 0; color:#9ca3af; font-size:12px; text-align:center;">접속자가 없습니다.</div>';
    return;
  }

  var 내이름 = (현재세션() || {}).사원명;
  목록el.innerHTML = 접속자들.map(function(u) {
    var 나 = u.사원명 === 내이름 ? ' <span style="font-size:10px; color:#9ca3af;">(나)</span>' : '';
    return '<div class="접속자항목">' +
      '<span class="접속자점">●</span>' +
      '<span class="접속자이름">' + u.직급 + ' ' + u.사원명 + 나 + '</span>' +
      '</div>';
  }).join('');
}

function 사이드바열기() {
  var 오버레이 = document.getElementById('사이드바오버레이');
  var 사이드바 = document.getElementById('사이드바');
  if (오버레이) 오버레이.style.display = 'block';
  if (사이드바) { 사이드바.classList.add('열림'); 사이드바.style.left = '0'; }
}

function 사이드바닫기() {
  var 오버레이 = document.getElementById('사이드바오버레이');
  var 사이드바 = document.getElementById('사이드바');
  if (오버레이) 오버레이.style.display = 'none';
  if (사이드바) { 사이드바.classList.remove('열림'); 사이드바.style.left = '-260px'; }
}
