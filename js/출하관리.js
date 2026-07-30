/* =====================================================
   출하관리.js - 출하 확정 관리 페이지
   ===================================================== */

var _작업목록 = [];
var _실적맵  = {};   // 작업번호 → 양품수량 합계
var _출하맵  = {};   // 작업번호 → 출하수량 합계
var _현재탭  = '대기';
var _확정WO  = null;

var _필터업체   = '';
var _필터시작일 = '';
var _필터종료일 = '';

/* ── 초기화 ── */
document.addEventListener('DOMContentLoaded', function() {
  var 출하일el = document.getElementById('확정_출하일');
  if (출하일el) 출하일el.value = new Date().toISOString().slice(0, 10);

  탭전환('대기');
  데이터로드();
  실시간구독();
});

/* ── 데이터 로드 ── */
async function 데이터로드() {
  var r1 = await 수파베이스.from('작업')
    .select('*')
    .in('상태', ['작업완료', '완료'])
    .order('created_at', { ascending: false });

  _작업목록 = r1.data || [];

  if (_작업목록.length === 0) {
    목록렌더링();
    return;
  }

  var WO목록 = _작업목록.map(function(w){ return w.작업번호; });

  var [r2, r3] = await Promise.all([
    수파베이스.from('작업실적').select('작업번호,양품수량').in('작업번호', WO목록),
    수파베이스.from('출하').select('작업번호,출하수량').in('작업번호', WO목록)
  ]);

  _실적맵 = {};
  (r2.data || []).forEach(function(r) {
    _실적맵[r.작업번호] = (_실적맵[r.작업번호] || 0) + (r.양품수량 || 0);
  });

  _출하맵 = {};
  (r3.data || []).forEach(function(r) {
    _출하맵[r.작업번호] = (_출하맵[r.작업번호] || 0) + (r.출하수량 || 0);
  });

  목록렌더링();
}

/* ── 탭 전환 ── */
function 탭전환(탭) {
  _현재탭 = 탭;
  document.querySelectorAll('.탭버튼').forEach(function(btn) {
    var 활성 = btn.dataset.탭 === 탭;
    btn.style.borderBottom = 활성 ? '3px solid #f97316' : '3px solid transparent';
    btn.style.color        = 활성 ? '#f97316' : '#6B7280';
    btn.style.fontWeight   = 활성 ? '700' : '500';
    btn.style.background   = 활성 ? '#fff7ed' : 'transparent';
  });
  document.querySelectorAll('.탭내용').forEach(function(el) {
    el.style.display = 'none';
  });
  var el = document.getElementById('탭_' + 탭);
  if (el) el.style.display = 'block';
  목록렌더링();
}

function 목록렌더링() {
  if (_현재탭 === '대기') 대기목록렌더링();
  else                    완료목록렌더링();
}

/* ── 출하대기 목록 ── */
function 대기목록렌더링() {
  var tbody = document.getElementById('대기목록바디');
  if (!tbody) return;

  var 목록 = _작업목록.filter(function(w){ return w.상태 === '작업완료'; });
  목록 = 필터적용(목록);

  if (!목록.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="빈목록안내">출하 대기 중인 작업이 없습니다.</td></tr>';
    return;
  }

  tbody.innerHTML = 목록.map(function(w) {
    var 양품   = _실적맵[w.작업번호] || 0;
    var 기출하 = _출하맵[w.작업번호] || 0;
    var 잔여   = Math.max(0, 양품 - 기출하);
    return '<tr style="cursor:default;">' +
      '<td style="font-size:12px;color:#9CA3AF;">' + w.작업번호 + '</td>' +
      '<td style="font-weight:700;">' + (w.업체||'-') + '</td>' +
      '<td>' + (w.품목||'-') + '</td>' +
      '<td style="color:#10b981;font-weight:700;text-align:right;">' + 양품.toLocaleString() + '</td>' +
      '<td style="color:#3b82f6;text-align:right;">' + 기출하.toLocaleString() + '</td>' +
      '<td style="color:#f97316;font-weight:700;text-align:right;">' + 잔여.toLocaleString() + '</td>' +
      '<td style="font-size:12px;color:#6B7280;text-align:center;">' + (w.납기일||'-') + '</td>' +
      '<td style="text-align:center;">' +
        (잔여 > 0
          ? '<button class="버튼 초록 소형" style="padding:0 14px;white-space:nowrap;" ' +
              'onclick="확정모달열기(\'' + w.작업번호 + '\')">출하확정</button>'
          : '<span style="font-size:11px;color:#9CA3AF;">처리중</span>') +
      '</td>' +
    '</tr>';
  }).join('');
}

/* ── 완료 목록 ── */
function 완료목록렌더링() {
  var tbody = document.getElementById('완료목록바디');
  if (!tbody) return;

  var 목록 = _작업목록.filter(function(w){ return w.상태 === '완료'; });
  목록 = 필터적용(목록);

  if (!목록.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="빈목록안내">완료된 출하가 없습니다.</td></tr>';
    return;
  }

  tbody.innerHTML = 목록.map(function(w) {
    var 총출하 = _출하맵[w.작업번호] || 0;
    return '<tr>' +
      '<td style="font-size:12px;color:#9CA3AF;">' + w.작업번호 + '</td>' +
      '<td style="font-weight:700;">' + (w.업체||'-') + '</td>' +
      '<td>' + (w.품목||'-') + '</td>' +
      '<td style="color:#10b981;font-weight:700;text-align:right;">' + 총출하.toLocaleString() + ' EA</td>' +
      '<td style="font-size:12px;color:#6B7280;text-align:center;">' + (w.납기일||'-') + '</td>' +
    '</tr>';
  }).join('');
}

/* ── 필터 ── */
function 필터적용(목록) {
  if (_필터업체)   목록 = 목록.filter(function(w){ return (w.업체||'').includes(_필터업체); });
  if (_필터시작일) 목록 = 목록.filter(function(w){ return (w.입고일||'') >= _필터시작일; });
  if (_필터종료일) 목록 = 목록.filter(function(w){ return (w.입고일||'') <= _필터종료일; });
  return 목록;
}

function 필터조회() {
  _필터업체   = document.getElementById('필터_업체').value.trim();
  _필터시작일 = document.getElementById('필터_시작일').value;
  _필터종료일 = document.getElementById('필터_종료일').value;
  목록렌더링();
}

function 필터초기화() {
  _필터업체 = ''; _필터시작일 = ''; _필터종료일 = '';
  document.getElementById('필터_업체').value    = '';
  document.getElementById('필터_시작일').value  = '';
  document.getElementById('필터_종료일').value  = '';
  목록렌더링();
}

/* ── 확정 모달 ── */
function 확정모달열기(WO번호) {
  var w = _작업목록.find(function(x){ return x.작업번호 === WO번호; });
  if (!w) return;

  _확정WO = WO번호;
  var 양품   = _실적맵[WO번호] || 0;
  var 기출하 = _출하맵[WO번호] || 0;
  var 잔여   = Math.max(0, 양품 - 기출하);

  document.getElementById('확정_WO번호').textContent    = WO번호;
  document.getElementById('확정_업체품목').textContent  = (w.업체||'') + ' · ' + (w.품목||'');
  document.getElementById('확정_양품표시').textContent  = 양품.toLocaleString() + ' EA';
  document.getElementById('확정_기출하표시').textContent = 기출하.toLocaleString() + ' EA';
  document.getElementById('확정_잔여표시').textContent  = 잔여.toLocaleString() + ' EA';

  var 수량el = document.getElementById('확정_수량');
  수량el.value = 잔여;
  수량el.max   = 잔여;

  document.getElementById('확정_메모').value = '';
  document.getElementById('확정모달_오버레이').style.display = 'flex';
  setTimeout(function() { 수량el.focus(); 수량el.select(); }, 80);
}

function 확정모달닫기() {
  document.getElementById('확정모달_오버레이').style.display = 'none';
  _확정WO = null;
}

async function 출하확정저장() {
  if (!_확정WO) return;

  var 출하수량 = parseInt(document.getElementById('확정_수량').value) || 0;
  var 출하일   = document.getElementById('확정_출하일').value;
  var 메모     = document.getElementById('확정_메모').value.trim();

  if (출하수량 <= 0) { 알림표시('출하수량을 입력해주세요.', '오류'); return; }
  if (!출하일)       { 알림표시('출하일을 선택해주세요.', '오류'); return; }

  var 양품   = _실적맵[_확정WO] || 0;
  var 기출하 = _출하맵[_확정WO] || 0;
  var 잔여   = Math.max(0, 양품 - 기출하);

  if (출하수량 > 잔여) {
    알림표시('출하수량(' + 출하수량.toLocaleString() + ')이 잔여(' + 잔여.toLocaleString() + ')를 초과합니다.', '오류');
    return;
  }

  var btn = document.getElementById('확정저장버튼');
  btn.disabled = true; btn.textContent = '저장 중...';

  try {
    var { error: e1 } = await 수파베이스.from('출하').insert({
      작업번호: _확정WO,
      출하수량: 출하수량,
      출하일: 출하일,
      메모: 메모
    });
    if (e1) throw e1;

    // 전량 출하 시 완료 처리
    var 신규합계 = 기출하 + 출하수량;
    if (신규합계 >= 양품) {
      var { error: e2 } = await 수파베이스.from('작업').update({ 상태: '완료' }).eq('작업번호', _확정WO);
      if (e2) throw e2;
    }

    확정모달닫기();
    await 데이터로드();
    알림표시(
      신규합계 >= 양품
        ? '전량 출하 완료! 작업이 완료 처리되었습니다.'
        : '출하 확정 완료. 잔여 ' + (양품 - 신규합계).toLocaleString() + ' EA 남아있습니다.',
      '성공'
    );
  } catch(e) {
    console.error(e);
    알림표시('저장 오류: ' + (e.message || e), '오류');
  } finally {
    btn.disabled = false; btn.textContent = '출하 확정';
  }
}

/* ── 알림 ── */
function 알림표시(msg, type) {
  var box = document.getElementById('알림박스');
  if (!box) return;
  box.textContent = msg;
  box.className = '알림 ' + (type === '성공' ? '성공' : '오류');
  box.style.display = 'block';
  clearTimeout(box._timer);
  box._timer = setTimeout(function(){ box.style.display = 'none'; }, 6000);
}

/* ── 실시간 구독 ── */
var _채널목록 = [];

function 실시간구독() {
  _채널목록.forEach(function(ch){ try { 수파베이스.removeChannel(ch); } catch(e){} });
  _채널목록 = [];

  ['작업', '작업실적', '출하'].forEach(function(tbl) {
    var ch = 수파베이스
      .channel('출하관리_' + tbl)
      .on('postgres_changes', { event: '*', schema: 'public', table: tbl },
          function() { 데이터로드(); })
      .subscribe();
    _채널목록.push(ch);
  });
}

window.addEventListener('beforeunload', function() {
  _채널목록.forEach(function(ch){ try { 수파베이스.removeChannel(ch); } catch(e){} });
});
