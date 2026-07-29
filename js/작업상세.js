/* =====================================================
   작업상세.js - 작업 상세 페이지
   ===================================================== */

var _WO번호 = '';
var _작업정보 = null;
var _작업실적목록 = [];
var _출하목록 = [];
var _현재탭 = '작업실적';

/* ── 페이지 초기화 ── */
document.addEventListener('DOMContentLoaded', function() {
  var params = new URLSearchParams(window.location.search);
  _WO번호 = params.get('wo') || '';
  if (!_WO번호) {
    alert('잘못된 접근입니다.');
    location.href = '입출고등록.html';
    return;
  }
  document.getElementById('WO번호표시').textContent = _WO번호;
  document.title = _WO번호 + ' - 삼양ERP';

  // 작업자 기본값 (세션에서 자동 입력)
  var 세션 = 현재세션();
  if (세션) {
    var 이름 = 세션.직급 + ' ' + 세션.사원명;
    var el = document.getElementById('입력실적_작업자');
    if (el) el.value = 이름;
  }

  var 출하일el = document.getElementById('입력출하_출하일');
  if (출하일el) 출하일el.value = new Date().toISOString().slice(0, 10);

  탭전환('작업실적');
  데이터로드();
  실시간구독();
});

/* ── 전체 데이터 로드 ── */
async function 데이터로드() {
  var [r1, r2, r3] = await Promise.all([
    수파베이스.from('작업').select('*').eq('작업번호', _WO번호).maybeSingle(),
    수파베이스.from('작업실적').select('*').eq('작업번호', _WO번호).order('created_at'),
    수파베이스.from('출하').select('*').eq('작업번호', _WO번호).order('created_at')
  ]);

  if (!r1.data) {
    alert('존재하지 않는 작업입니다: ' + _WO번호);
    location.href = '입출고등록.html';
    return;
  }

  _작업정보     = r1.data;
  _작업실적목록 = r2.data || [];
  _출하목록     = r3.data || [];

  진행현황렌더링();
  현재탭렌더링();
}

/* ── 진행현황 계산 & 렌더링 ── */
function 진행현황렌더링() {
  if (!_작업정보) return;

  var 입고수량 = _작업정보.입고수량 || 0;
  var 생산수량 = _작업실적목록.reduce(function(s, r){ return s + (r.작업수량 || 0); }, 0);
  var 양품수량 = _작업실적목록.reduce(function(s, r){ return s + (r.양품수량 || 0); }, 0);
  var 불량수량 = _작업실적목록.reduce(function(s, r){ return s + (r.불량수량 || 0); }, 0);
  var 출하수량 = _출하목록.reduce(function(s, r){ return s + (r.출하수량 || 0); }, 0);
  var 잔량 = 입고수량 - 출하수량;
  var 진행률 = 입고수량 > 0 ? Math.min(100, Math.round((생산수량 / 입고수량) * 100)) : 0;
  var 상태 = _작업정보.상태 || '진행중';

  document.getElementById('현황_업체').textContent    = _작업정보.업체 || '';
  document.getElementById('현황_품목').textContent    = _작업정보.품목 || '';
  document.getElementById('현황_납기일').textContent  = _작업정보.납기일 || '-';
  document.getElementById('현황_담당자').textContent  = _작업정보.담당자 || '';
  document.getElementById('현황_상태').textContent    = 상태;
  document.getElementById('현황_상태').style.color    = 상태 === '완료' ? '#27ae60' : '#f97316';

  document.getElementById('현황_입고').textContent    = 입고수량.toLocaleString();
  document.getElementById('현황_생산').textContent    = 생산수량.toLocaleString();
  document.getElementById('현황_양품').textContent    = 양품수량.toLocaleString();
  document.getElementById('현황_불량').textContent    = 불량수량.toLocaleString();
  document.getElementById('현황_출하').textContent    = 출하수량.toLocaleString();
  document.getElementById('현황_잔량').textContent    = 잔량.toLocaleString();
  document.getElementById('현황_진행률숫자').textContent = 진행률 + '%';

  var 바 = document.getElementById('진행바');
  바.style.width      = 진행률 + '%';
  바.style.background = 진행률 >= 100 ? '#10b981' : '#f97316';

  // 입고사진
  var 사진영역 = document.getElementById('입고사진영역');
  var 사진img  = document.getElementById('입고사진이미지');
  if (사진영역 && 사진img) {
    if (_작업정보.사진url) {
      사진img.src = _작업정보.사진url;
      사진영역.style.display = 'block';
    } else {
      사진영역.style.display = 'none';
    }
  }
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
  var 탭el = document.getElementById('탭_' + 탭);
  if (탭el) 탭el.style.display = 'block';
  현재탭렌더링();
}

function 현재탭렌더링() {
  if      (_현재탭 === '작업실적') 작업실적목록렌더링();
  else if (_현재탭 === '출하')    출하목록렌더링();
  else if (_현재탭 === '이력')    이력렌더링();
}

/* ══════════════════════════════════════
   작업실적 탭
══════════════════════════════════════ */

/* 작업수량 → 양품수량 자동계산 */
function 실적수량변경() {
  var 작업str = document.getElementById('입력실적_작업수량').value;
  var 불량str = document.getElementById('입력실적_불량수량').value;
  var 작업 = parseInt(작업str) || 0;
  var 불량 = parseInt(불량str) || 0;
  var 양품el = document.getElementById('입력실적_양품수량');
  if (양품el) {
    양품el.value = (작업str || 불량str) ? Math.max(0, 작업 - 불량) : '';
  }
}

function 작업실적목록렌더링() {
  var tbody = document.getElementById('실적목록바디');
  if (!tbody) return;
  if (!_작업실적목록.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="빈목록안내">등록된 작업실적이 없습니다.</td></tr>';
    return;
  }
  tbody.innerHTML = _작업실적목록.map(function(r) {
    var 시간 = r.작업시간 ||
      new Date(r.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    return '<tr>' +
      '<td>' + 시간 + '</td>' +
      '<td style="font-weight:700;color:#f97316;">' + (r.작업수량||0).toLocaleString() + '</td>' +
      '<td style="color:#27ae60;">' + (r.양품수량||0).toLocaleString() + '</td>' +
      '<td style="color:#e74c3c;">' + (r.불량수량||0).toLocaleString() + '</td>' +
      '<td>' + (r.작업자||'-') + '</td>' +
      '<td style="color:#9CA3AF;font-size:12px;">' + (r.메모||'') + '</td>' +
    '</tr>';
  }).join('');
}

async function 작업실적저장() {
  var 작업수량 = parseInt(document.getElementById('입력실적_작업수량').value) || 0;
  var 양품수량 = parseInt(document.getElementById('입력실적_양품수량').value) || 0;
  var 불량수량 = parseInt(document.getElementById('입력실적_불량수량').value) || 0;
  var 작업자   = document.getElementById('입력실적_작업자').value.trim();
  var 메모     = document.getElementById('입력실적_메모').value.trim();

  if (!작업수량) { 상세알림표시('작업수량을 입력해주세요.', '오류'); return; }

  // 불량수량 > 작업수량 검증
  if (불량수량 > 작업수량) {
    상세알림표시('불량수량이 작업수량보다 많습니다.', '오류');
    return;
  }

  // 입고수량 초과 검증
  var 입고수량 = (_작업정보 && _작업정보.입고수량) || 0;
  var 기존생산 = _작업실적목록.reduce(function(s, r){ return s + (r.작업수량 || 0); }, 0);
  if (입고수량 > 0 && 기존생산 + 작업수량 > 입고수량) {
    var 잔여생산 = Math.max(0, 입고수량 - 기존생산);
    상세알림표시(
      '입고수량(' + 입고수량.toLocaleString() + ')을 초과합니다.\n' +
      '현재 생산: ' + 기존생산.toLocaleString() + ' / 등록 가능 잔여: ' + 잔여생산.toLocaleString(),
      '오류'
    );
    return;
  }

  var btn = document.getElementById('실적저장버튼');
  btn.disabled = true; btn.textContent = '저장 중...';

  try {
    var { error } = await 수파베이스.from('작업실적').insert({
      작업번호: _WO번호, 작업수량, 양품수량, 불량수량, 작업자, 메모
    });
    if (error) throw error;

    document.getElementById('입력실적_작업수량').value = '';
    document.getElementById('입력실적_양품수량').value = '';
    document.getElementById('입력실적_불량수량').value = '';
    document.getElementById('입력실적_메모').value     = '';

    await 데이터로드();
    상세알림표시('작업실적이 등록되었습니다.', '성공');
    document.getElementById('입력실적_작업수량').focus();
  } catch(e) {
    console.error(e);
    상세알림표시('저장 오류: ' + (e.message || e), '오류');
  } finally {
    btn.disabled = false; btn.textContent = '등록';
  }
}

/* ══════════════════════════════════════
   출하 탭
══════════════════════════════════════ */
function 출하목록렌더링() {
  var tbody = document.getElementById('출하목록바디');
  if (!tbody) return;
  if (!_출하목록.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="빈목록안내">등록된 출하가 없습니다.</td></tr>';
    return;
  }
  tbody.innerHTML = _출하목록.map(function(r) {
    return '<tr>' +
      '<td>' + (r.출하일||'-') + '</td>' +
      '<td style="color:#27ae60;font-weight:700;">' + (r.출하수량||0).toLocaleString() + ' EA</td>' +
      '<td style="color:#9CA3AF;font-size:12px;">' + (r.메모||'') + '</td>' +
    '</tr>';
  }).join('');
}

async function 출하저장() {
  var 출하수량 = parseInt(document.getElementById('입력출하_수량').value) || 0;
  var 출하일   = document.getElementById('입력출하_출하일').value;
  var 메모     = document.getElementById('입력출하_메모').value.trim();

  if (!출하수량) { 상세알림표시('출하수량을 입력해주세요.', '오류'); return; }
  if (!출하일)   { 상세알림표시('출하일을 입력해주세요.', '오류'); return; }

  // 양품수량 기준 출하 초과 검증
  var 양품합계    = _작업실적목록.reduce(function(s, r){ return s + (r.양품수량 || 0); }, 0);
  var 기존출하합계 = _출하목록.reduce(function(s, r){ return s + (r.출하수량 || 0); }, 0);

  if (양품합계 === 0) {
    상세알림표시('작업실적을 먼저 등록해주세요. (양품수량 없음)', '오류');
    return;
  }
  if (기존출하합계 + 출하수량 > 양품합계) {
    var 잔여출하 = Math.max(0, 양품합계 - 기존출하합계);
    상세알림표시(
      '양품수량(' + 양품합계.toLocaleString() + ')을 초과합니다.\n' +
      '현재 출하: ' + 기존출하합계.toLocaleString() + ' / 출하 가능 잔여: ' + 잔여출하.toLocaleString(),
      '오류'
    );
    return;
  }

  var 전체출하 = 기존출하합계 + 출하수량;
  var 입고수량 = _작업정보 ? (_작업정보.입고수량 || 0) : 0;

  var btn = document.getElementById('출하저장버튼');
  btn.disabled = true; btn.textContent = '저장 중...';

  try {
    var { error } = await 수파베이스.from('출하').insert({
      작업번호: _WO번호, 출하수량, 출하일: 출하일 || null, 메모
    });
    if (error) throw error;

    if (전체출하 >= 입고수량) {
      await 수파베이스.from('작업').update({ 상태: '완료' }).eq('작업번호', _WO번호);
    }

    document.getElementById('입력출하_수량').value = '';
    document.getElementById('입력출하_메모').value = '';

    await 데이터로드();
    상세알림표시(
      전체출하 >= 입고수량
        ? '전량 출하 완료! 작업이 [완료] 처리되었습니다.'
        : '출하가 등록되었습니다.',
      '성공'
    );
  } catch(e) {
    console.error(e);
    상세알림표시('저장 오류: ' + (e.message || e), '오류');
  } finally {
    btn.disabled = false; btn.textContent = '등록';
  }
}

/* ══════════════════════════════════════
   이력 탭
══════════════════════════════════════ */
function 이력렌더링() {
  var 이력 = [];

  if (_작업정보) {
    이력.push({ 시간: new Date(_작업정보.created_at), 유형: '입고등록',
      내용: (_작업정보.입고수량||0).toLocaleString() + ' EA', 작업자: _작업정보.담당자||'' });
  }
  _작업실적목록.forEach(function(r) {
    이력.push({ 시간: new Date(r.created_at), 유형: '작업실적',
      내용: (r.작업수량||0).toLocaleString() + ' EA' +
            (r.불량수량 ? ' · 불량 ' + r.불량수량.toLocaleString() + 'EA' : '') +
            (r.양품수량 ? ' · 양품 ' + r.양품수량.toLocaleString() + 'EA' : ''),
      작업자: r.작업자||'' });
  });
  _출하목록.forEach(function(r) {
    이력.push({ 시간: new Date(r.created_at), 유형: '출하등록',
      내용: (r.출하수량||0).toLocaleString() + ' EA'
            + (r.출하일 ? ' (' + r.출하일 + ')' : ''),
      작업자: '' });
  });

  이력.sort(function(a, b){ return a.시간 - b.시간; });

  var container = document.getElementById('이력목록');
  if (!container) return;
  if (!이력.length) {
    container.innerHTML = '<div style="text-align:center;padding:36px;color:#9CA3AF;">기록이 없습니다.</div>';
    return;
  }

  var 유형색 = { '입고등록': '#2a6496', '작업실적': '#f97316', '출하등록': '#27ae60' };

  container.innerHTML = 이력.map(function(r) {
    var 시간str = r.시간.toLocaleString('ko-KR', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
    var 색 = 유형색[r.유형] || '#6B7280';
    return '<div style="display:flex;gap:10px;align-items:flex-start;padding:12px 0;border-bottom:1px solid #F3F4F6;">' +
      '<div style="font-size:11px;color:#9CA3AF;white-space:nowrap;min-width:72px;padding-top:2px;">' + 시간str + '</div>' +
      '<div>' +
        '<div style="font-size:11px;font-weight:700;color:' + 색 + ';letter-spacing:0.4px;margin-bottom:2px;">' + r.유형 + '</div>' +
        '<div style="font-size:14px;font-weight:700;color:#374151;">' + r.내용 + '</div>' +
        (r.작업자 ? '<div style="font-size:11px;color:#9CA3AF;margin-top:2px;">' + r.작업자 + '</div>' : '') +
      '</div>' +
    '</div>';
  }).join('');
}

function 상세알림표시(msg, type) {
  var box = document.getElementById('상세알림박스');
  if (!box) return;
  box.textContent = msg;
  box.className = '알림 ' + (type === '성공' ? '성공' : '오류');
  box.style.display = 'block';
  clearTimeout(box._timer);
  box._timer = setTimeout(function(){ box.style.display = 'none'; }, 4000);
}

/* ── Realtime 구독 (WO번호 필터링, 채널 정리 포함) ── */
var _채널목록 = [];

function 실시간구독() {
  _채널목록.forEach(function(ch) { try { 수파베이스.removeChannel(ch); } catch(e){} });
  _채널목록 = [];

  ['작업실적', '출하'].forEach(function(tbl) {
    var ch = 수파베이스
      .channel('detail_' + tbl + '_' + _WO번호)
      .on('postgres_changes',
          { event: '*', schema: 'public', table: tbl,
            filter: '작업번호=eq.' + _WO번호 },
          function() { 데이터로드(); })
      .subscribe();
    _채널목록.push(ch);
  });

  var ch작업 = 수파베이스
    .channel('detail_작업_' + _WO번호)
    .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: '작업',
          filter: '작업번호=eq.' + _WO번호 },
        function() { 데이터로드(); })
    .subscribe();
  _채널목록.push(ch작업);
}

window.addEventListener('beforeunload', function() {
  _채널목록.forEach(function(ch) { try { 수파베이스.removeChannel(ch); } catch(e){} });
});
