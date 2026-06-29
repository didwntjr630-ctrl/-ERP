/* ===================================================
   작업잠금.js - 동시 입력 방지 (Supabase Realtime Presence)
   탭 닫기 / 네트워크 끊김 시 잠금 자동 해제
   =================================================== */

var 잠금채널 = null;
var 잠금_내키 = '';
var 잠금_내사용자 = '';
var 잠금_구독완료 = false;

function 작업잠금초기화(사용자명) {
  잠금_내사용자 = 사용자명;
  잠금_내키 = Date.now().toString(36) + Math.random().toString(36).slice(2);

  잠금채널 = 수파베이스.channel('erp_입출고잠금', {
    config: { presence: { key: 잠금_내키 } }
  });

  잠금채널
    .on('presence', { event: 'sync' }, function() {
      잠금_상태확인();
    })
    .subscribe(async function(status) {
      if (status === 'SUBSCRIBED') {
        잠금_구독완료 = true;
        await 잠금채널.track({ 사용자: 잠금_내사용자, 상태: '대기중' });
      }
    });

  window.addEventListener('beforeunload', function() {
    if (잠금채널) 잠금채널.untrack();
  });
}

function 잠금_상태확인() {
  if (!잠금채널) return;
  var 상태목록 = 잠금채널.presenceState();
  var 다른작업자 = null;

  Object.entries(상태목록).forEach(function(entry) {
    var 키 = entry[0];
    var 항목들 = entry[1];
    if (키 === 잠금_내키) return;
    항목들.forEach(function(d) {
      if (d.상태 === '작업중' && !다른작업자) {
        다른작업자 = d.사용자;
      }
    });
  });

  if (다른작업자) {
    잠금_UI표시(다른작업자);
  } else {
    잠금_UI해제();
  }
}

function 잠금_UI표시(작업자명) {
  var 배너 = document.getElementById('작업잠금_배너');
  if (배너) {
    배너.innerHTML =
      '⚠&nbsp;&nbsp;<b>' + 작업자명 + '</b>님이 현재 입력 작업 중입니다.' +
      '&nbsp;&nbsp;작업 완료 후 이용해 주세요.';
    배너.style.display = 'block';
  }
  var 폼 = document.getElementById('폼카드');
  if (폼) 폼.classList.add('작업잠금중');
}

function 잠금_UI해제() {
  var 배너 = document.getElementById('작업잠금_배너');
  if (배너)배너.style.display = 'none';
  var 폼 = document.getElementById('폼카드');
  if (폼) 폼.classList.remove('작업잠금중');
}

async function 작업시작알림() {
  if (!잠금채널 || !잠금_구독완료) return;
  await 잠금채널.track({ 사용자: 잠금_내사용자, 상태: '작업중' });
}

async function 작업종료알림() {
  if (!잠금채널 || !잠금_구독완료) return;
  await 잠금채널.track({ 사용자: 잠금_내사용자, 상태: '대기중' });
}
