/* ===================================================
   급여.js — 급여관리 시스템 v2 (클릭 기반 출근 등록)
   =================================================== */

var _급여탭 = '직원';
var _직원목록 = [];
var _공휴일목록 = [];
var _공휴일셋 = new Set();
var _근태기록맵 = {};
var _선택직원id = null;
var _출근년월 = '';

var PAYROLL = {
  정규시간: 8,
  연장배율: 1.5,
  주말배율: 1.5,
  야간주말배율: 2.0,
  소득세율: 0.033,
  주휴시간: 8,
  일교통비: 3000,
  수수료율: 0.07,
  사대보험율: 0.101   // 사업주 4대보험 합산 (국민연금4.5%+건강3.545%+장기요양0.459%+고용0.9%+산재0.7%)
};

/* ── 유틸 ────────────────────────────────────────── */

function 주말인가(dateStr) {
  var d = new Date(dateStr + 'T00:00:00');
  return d.getDay() === 0 || d.getDay() === 6;
}

function 공휴일인가(dateStr) {
  return _공휴일셋.has(dateStr);
}

function 빨간날인가(dateStr) {
  return 주말인가(dateStr) || 공휴일인가(dateStr);
}

function 요일명(dateStr) {
  return ['일','월','화','수','목','금','토'][new Date(dateStr + 'T00:00:00').getDay()];
}

function 원화(n) {
  return Math.round(n || 0).toLocaleString() + '원';
}

function 알림(msg, type) {
  var el = document.getElementById('급여알림');
  if (!el) return;
  el.textContent = msg;
  el.className = '알림메시지 ' + (type || '정보');
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(function() { el.style.display = 'none'; }, 3500);
}

/* ── 탭 전환 ─────────────────────────────────────── */

function 급여탭선택(탭명) {
  _급여탭 = 탭명;
  document.querySelectorAll('.급여탭버튼').forEach(function(b) {
    b.classList.toggle('활성', b.getAttribute('data-tab') === 탭명);
  });
  document.querySelectorAll('.급여탭내용').forEach(function(c) {
    c.style.display = c.getAttribute('data-tab') === 탭명 ? 'block' : 'none';
  });
  if (탭명 === '직원') 직원목록그리기();
  if (탭명 === '출근현황') 출근현황초기화();
  if (탭명 === '공휴일') 공휴일목록그리기();
  if (탭명 === '급여계산') 급여계산화면초기화();
  if (탭명 === '명세서') 명세서화면초기화();
}

/* ── 초기화 ──────────────────────────────────────── */

async function 급여관리초기화() {
  var now = new Date();
  _출근년월 = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  await Promise.all([직원목록불러오기(), 공휴일목록불러오기()]);
  급여탭선택('직원');

  var _급여실시간타이머 = null;
  function _급여실시간갱신() {
    clearTimeout(_급여실시간타이머);
    _급여실시간타이머 = setTimeout(async function() {
      // 직원 폼이 열려있으면 스킵 (입력 중 재렌더링 방지)
      var 직원폼 = document.getElementById('직원폼');
      if (직원폼 && 직원폼.style.display !== 'none') return;
      // 출근현황 숫자 입력란 포커스 중이면 스킵 (연장·지각·외출 입력 중 방지)
      var 포커스 = document.activeElement;
      if (포커스 && 포커스.type === 'number' && 포커스.closest('#출근현황테이블래퍼')) return;

      await Promise.all([직원목록불러오기(), 공휴일목록불러오기()]);
      급여탭선택(_급여탭);
    }, 400);
  }

  수파베이스.channel('급여실시간')
    .on('postgres_changes', { event: '*', schema: 'public', table: '직원정보' }, _급여실시간갱신)
    .on('postgres_changes', { event: '*', schema: 'public', table: '근태기록' }, _급여실시간갱신)
    .on('postgres_changes', { event: '*', schema: 'public', table: '급여결과' }, _급여실시간갱신)
    .on('postgres_changes', { event: '*', schema: 'public', table: '공휴일' },   _급여실시간갱신)
    .subscribe();
}

/* ══════════════════════════════════════════════════
   탭1 — 직원 관리
══════════════════════════════════════════════════ */

async function 직원목록불러오기() {
  var { data } = await 수파베이스.from('직원정보')
    .select('*').eq('상태', 'active').order('id');
  _직원목록 = data || [];
}

function 직원목록그리기() {
  var tbody = document.getElementById('직원테이블바디');
  if (!tbody) return;
  if (_직원목록.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:20px;">등록된 직원이 없습니다</td></tr>';
    return;
  }
  tbody.innerHTML = _직원목록.map(function(e) {
    return '<tr>' +
      '<td>' + e.이름 + '</td>' +
      '<td>' + (e.소속 || '-') + '</td>' +
      '<td>' + (e.직급 || '-') + '</td>' +
      '<td>' + Number(e.시급).toLocaleString() + '원</td>' +
      '<td>' + Number(e.직급수당 || 0).toLocaleString() + '원</td>' +
      '<td>' + Number(e.근속수당 || 0).toLocaleString() + '원</td>' +
      '<td>' + (e.입사일 || '-') + '</td>' +
      '<td>' +
        '<button class="소버튼 수정" onclick="직원수정폼(' + e.id + ')">수정</button> ' +
        '<button class="소버튼 삭제" onclick="직원삭제(' + e.id + ')">삭제</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

function 직원추가폼열기() {
  _선택직원id = null;
  document.getElementById('직원폼제목').textContent = '직원 추가';
  ['직원이름입력','직원소속입력','직원직급입력','직원시급입력','직원직급수당입력','직원근속수당입력','직원입사일입력']
    .forEach(function(id) { document.getElementById(id).value = ''; });
  document.getElementById('직원폼').style.display = 'block';
  document.getElementById('직원이름입력').focus();
}

function 직원수정폼(id) {
  var e = _직원목록.find(function(x) { return x.id === id; });
  if (!e) return;
  _선택직원id = id;
  document.getElementById('직원폼제목').textContent = '직원 수정';
  document.getElementById('직원이름입력').value = e.이름;
  document.getElementById('직원소속입력').value = e.소속 || '';
  document.getElementById('직원직급입력').value = e.직급 || '';
  document.getElementById('직원시급입력').value = e.시급;
  document.getElementById('직원직급수당입력').value = e.직급수당 || 0;
  document.getElementById('직원근속수당입력').value = e.근속수당 || 0;
  document.getElementById('직원입사일입력').value = e.입사일 || '';
  document.getElementById('직원폼').style.display = 'block';
}

function 직원폼닫기() {
  document.getElementById('직원폼').style.display = 'none';
}

async function 직원저장() {
  var 이름 = document.getElementById('직원이름입력').value.trim();
  var 소속 = document.getElementById('직원소속입력').value.trim();
  var 직급 = document.getElementById('직원직급입력').value.trim();
  var 시급 = parseFloat(document.getElementById('직원시급입력').value) || 0;
  var 직급수당 = parseFloat(document.getElementById('직원직급수당입력').value) || 0;
  var 근속수당 = parseFloat(document.getElementById('직원근속수당입력').value) || 0;
  var 입사일 = document.getElementById('직원입사일입력').value || null;

  if (!이름) { 알림('이름을 입력하세요.', '오류'); return; }
  if (시급 <= 0) { 알림('시급을 올바르게 입력하세요.', '오류'); return; }

  var payload = { 이름: 이름, 소속: 소속, 직급: 직급, 시급: 시급, 직급수당: 직급수당, 근속수당: 근속수당, 입사일: 입사일 };
  var error;
  if (_선택직원id) {
    ({ error } = await 수파베이스.from('직원정보').update(payload).eq('id', _선택직원id));
  } else {
    ({ error } = await 수파베이스.from('직원정보').insert(payload));
  }
  if (error) { 알림('저장 실패: ' + error.message, '오류'); return; }
  알림('저장되었습니다.', '성공');
  직원폼닫기();
  await 직원목록불러오기();
  직원목록그리기();
}

async function 직원삭제(id) {
  var e = _직원목록.find(function(x) { return x.id === id; });
  if (!e) return;
  var { error } = await 수파베이스.from('직원정보').update({ 상태: 'inactive' }).eq('id', id);
  if (error) { 알림('삭제 실패', '오류'); return; }
  알림('삭제되었습니다.', '성공');
  await 직원목록불러오기();
  직원목록그리기();
}

/* ══════════════════════════════════════════════════
   탭2 — 출근 현황 (클릭 기반 근태 등록)
══════════════════════════════════════════════════ */

async function 출근현황초기화() {
  var el = document.getElementById('출근년월');
  if (el && !el.value) el.value = _출근년월;
  if (el && el.value) _출근년월 = el.value;
  await 출근현황그리기();
}

async function 출근현황그리기() {
  var 년월 = document.getElementById('출근년월').value;
  if (!년월) return;
  _출근년월 = 년월;

  var parts = 년월.split('-').map(Number);
  var 년 = parts[0], 월 = parts[1];
  var 일수 = new Date(년, 월, 0).getDate();

  var 날짜들 = [];
  for (var i = 1; i <= 일수; i++) {
    날짜들.push(년 + '-' + String(월).padStart(2, '0') + '-' + String(i).padStart(2, '0'));
  }

  var 래퍼 = document.getElementById('출근현황테이블래퍼');
  래퍼.innerHTML = '<div style="color:#9ca3af;padding:30px;text-align:center;">불러오는 중...</div>';

  if (_직원목록.length === 0) {
    래퍼.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:30px;">직원을 먼저 등록하세요.</p>';
    return;
  }

  var { data: 기록들, error } = await 수파베이스.from('근태기록')
    .select('*')
    .gte('날짜', 년 + '-' + String(월).padStart(2, '0') + '-01')
    .lte('날짜', 년 + '-' + String(월).padStart(2, '0') + '-' + String(일수).padStart(2, '0'));

  if (error) { 알림('데이터 조회 실패', '오류'); return; }

  _근태기록맵 = {};
  (기록들 || []).forEach(function(r) {
    _근태기록맵[r.직원id + '_' + r.날짜] = r;
  });

  var th날짜들 = 날짜들.map(function(날짜) {
    var d = new Date(날짜 + 'T00:00:00');
    var 요일 = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    var 빨간 = 빨간날인가(날짜);
    var 날짜텍스트 = (d.getMonth() + 1) + '/' + d.getDate();
    var 요일색 = 빨간 ? '#fca5a5' : (d.getDay() === 6 ? '#93c5fd' : '#f9fafb');
    var 헤더배경 = 빨간 ? '#4b1c1c' : '#374151';
    var 공휴 = 공휴일인가(날짜);
    var 공휴명 = '';
    if (공휴) {
      var hobj = _공휴일목록.find(function(h) { return h.날짜 === 날짜; });
      if (hobj) 공휴명 = '<div style="font-size:9px;font-weight:400;color:#fca5a5;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:52px;">' + hobj.명칭 + '</div>';
    }
    return '<th style="min-width:68px;max-width:76px;text-align:center;padding:8px 4px;position:sticky;top:0;z-index:2;background:' + 헤더배경 + ';color:' + 요일색 + ';">' +
      '<div style="font-weight:700;">' + 날짜텍스트 + '</div>' +
      '<div style="font-size:11px;font-weight:400;">' + 요일 + '</div>' +
      공휴명 + '</th>';
  }).join('');

  var 행들 = _직원목록.map(function(emp) {
    var 셀들 = 날짜들.map(function(날짜) {
      var 빨간 = 빨간날인가(날짜);
      var 주말 = 주말인가(날짜);
      var 공휴 = 공휴일인가(날짜);
      var 기록 = _근태기록맵[emp.id + '_' + 날짜];
      var 셀배경 = 빨간 ? 'background:#fff5f5;' : '';
      return '<td data-empid="' + emp.id + '" data-date="' + 날짜 + '" ' +
        'style="padding:3px;text-align:center;border:1px solid #f0f0f0;vertical-align:top;' + 셀배경 + '">' +
        _근태셀HTML(emp.id, 날짜, 기록, 빨간, 주말, 공휴) + '</td>';
    }).join('');

    return '<tr>' +
      '<td style="padding:8px 12px;white-space:nowrap;border:1px solid #f0f0f0;font-size:13px;font-weight:600;position:sticky;left:0;background:#fff;z-index:1;">' +
      (emp.직급 ? '<div style="font-size:11px;color:#9ca3af;font-weight:400;">' + emp.직급 + '</div>' : '') +
      '<div>' + emp.이름 + '</div></td>' +
      셀들 + '</tr>';
  }).join('');

  래퍼.innerHTML =
    '<table style="border-collapse:collapse;font-size:13px;width:max-content;min-width:100%;">' +
    '<thead><tr style="background:#374151;color:#f9fafb;">' +
    '<th style="padding:10px 12px;text-align:center;position:sticky;top:0;left:0;background:#374151;z-index:3;min-width:100px;">이름</th>' +
    th날짜들 +
    '</tr></thead><tbody>' + 행들 + '</tbody></table>';

  래퍼.style.overflowY = 'auto';
  래퍼.style.maxHeight = _직원목록.length > 8 ? '540px' : '';
}

function _근태셀HTML(직원id, 날짜, 기록, 빨간, 주말, 공휴) {
  var BST = 'border:none;cursor:pointer;border-radius:3px;font-family:inherit;';

  if (!기록) {
    if (빨간) {
      var 타입 = 공휴 ? '공휴일출근' : '주말출근';
      var 라벨 = 공휴 ? '공휴출근' : '주말출근';
      return '<div style="padding:2px;">' +
        '<div style="font-size:10px;color:#9ca3af;margin-bottom:2px;">휴무</div>' +
        '<button onclick="근태등록버튼(' + 직원id + ',\'' + 날짜 + '\',\'' + 타입 + '\')" ' +
        'style="' + BST + 'font-size:10px;padding:2px 6px;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;">' + 라벨 + '</button>' +
        '</div>';
    }
    return '<div style="padding:2px;display:grid;grid-template-columns:1fr 1fr;gap:2px;">' +
      '<button onclick="근태등록버튼(' + 직원id + ',\'' + 날짜 + '\',\'정상출근\')" ' +
      'style="' + BST + 'font-size:11px;padding:3px 4px;background:#dcfce7;color:#15803d;border:1px solid #86efac;font-weight:700;">출근</button>' +
      '<button onclick="근태등록버튼(' + 직원id + ',\'' + 날짜 + '\',\'결근\')" ' +
      'style="' + BST + 'font-size:10px;padding:2px 4px;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;">결근</button>' +
      '<button onclick="근태등록버튼(' + 직원id + ',\'' + 날짜 + '\',\'반차\')" ' +
      'style="' + BST + 'font-size:10px;padding:2px 4px;background:#eff6ff;color:#1d4ed8;border:1px solid #93c5fd;">반차</button>' +
      '<button onclick="근태등록버튼(' + 직원id + ',\'' + 날짜 + '\',\'연차\')" ' +
      'style="' + BST + 'font-size:10px;padding:2px 4px;background:#eff6ff;color:#1d4ed8;border:1px solid #93c5fd;">연차</button>' +
      '</div>';
  }

  var 종류 = 기록.근태종류;
  var 연장 = Number(기록.연장시간) || 0;
  var 스타일맵 = {
    '정상출근':   { bg: '#dcfce7', border: '#86efac', color: '#15803d', 라벨: '정상 8h' },
    '결근':       { bg: '#fef2f2', border: '#fca5a5', color: '#dc2626', 라벨: '결근' },
    '반차':       { bg: '#eff6ff', border: '#93c5fd', color: '#1d4ed8', 라벨: '반차 4h' },
    '연차':       { bg: '#eff6ff', border: '#93c5fd', color: '#1d4ed8', 라벨: '연차 8h' },
    '주말출근':   { bg: '#fff7ed', border: '#fed7aa', color: '#c2410c', 라벨: '주말 8h' },
    '공휴일출근': { bg: '#fdf4ff', border: '#e9d5ff', color: '#7e22ce', 라벨: '공휴 8h' },
  };
  var s = 스타일맵[종류] || 스타일맵['정상출근'];

  var html = '<div style="background:' + s.bg + ';border:1px solid ' + s.border + ';border-radius:5px;padding:3px 4px;min-width:88px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">' +
    '<span style="color:' + s.color + ';font-weight:700;font-size:11px;">' + s.라벨 + '</span>' +
    '<button onclick="근태삭제버튼(' + 기록.id + ',' + 직원id + ',\'' + 날짜 + '\')" ' +
    'style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:11px;line-height:1;padding:0 2px;">✕</button>' +
    '</div>';

  if (종류 !== '결근') {
    if (종류 === '정상출근') {
      var 지각분 = Number(기록.지각시간) || 0;
      var 외출분 = Number(기록.외출시간) || 0;
      html += '<div style="display:flex;align-items:center;gap:2px;">' +
        '<span style="font-size:10px;color:#ca8a04;">지각</span>' +
        '<input type="number" value="' + 지각분 + '" min="0" max="480" step="1" ' +
        'style="width:36px;font-size:10px;border:1px solid #fde047;border-radius:3px;padding:1px 3px;text-align:center;" ' +
        'onchange="지각시간변경(' + 기록.id + ',this.value)" title="지각 분">' +
        '<span style="font-size:10px;color:#ca8a04;">분</span></div>';
      html += '<div style="display:flex;align-items:center;gap:2px;">' +
        '<span style="font-size:10px;color:#059669;">외출</span>' +
        '<input type="number" value="' + 외출분 + '" min="0" max="480" step="1" ' +
        'style="width:36px;font-size:10px;border:1px solid #6ee7b7;border-radius:3px;padding:1px 3px;text-align:center;" ' +
        'onchange="외출시간변경(' + 기록.id + ',this.value)" title="외출 분">' +
        '<span style="font-size:10px;color:#059669;">분</span></div>';
    }
    html += '<div style="display:flex;align-items:center;gap:2px;">' +
      '<span style="font-size:10px;color:#6b7280;">연장</span>' +
      '<input type="number" value="' + 연장 + '" min="0" max="12" step="0.5" ' +
      'style="width:36px;font-size:10px;border:1px solid #d1d5db;border-radius:3px;padding:1px 3px;text-align:center;" ' +
      'onchange="연장시간변경(' + 기록.id + ',this.value)" title="연장근무 시간">' +
      '<span style="font-size:10px;color:#6b7280;">h</span></div>';
    if (종류 === '주말출근' || 종류 === '공휴일출근') {
      var 야간h = Number(기록.야간시간) || 0;
      html += '<div style="display:flex;align-items:center;gap:2px;">' +
        '<span style="font-size:10px;color:#7e22ce;">야간</span>' +
        '<input type="number" value="' + 야간h + '" min="0" max="24" step="0.5" ' +
        'style="width:36px;font-size:10px;border:1px solid #e9d5ff;border-radius:3px;padding:1px 3px;text-align:center;" ' +
        'onchange="야간시간변경(' + 기록.id + ',this.value)" title="18시 이후 근무시간 (총 근무시간 이내, ×2.0배 적용)">' +
        '<span style="font-size:10px;color:#7e22ce;">h</span></div>';
    }
  }
  html += '</div>';
  return html;
}

async function 근태등록버튼(직원id, 날짜, 종류) {
  var { data, error } = await 수파베이스.from('근태기록')
    .upsert({ 직원id: 직원id, 날짜: 날짜, 근태종류: 종류, 연장시간: 0, 지각시간: 0, 외출시간: 0, 야간시간: 0 }, { onConflict: '직원id,날짜' })
    .select().single();
  if (error) { 알림('등록 실패: ' + error.message, '오류'); return; }
  _근태기록맵[직원id + '_' + 날짜] = data;
  _셀갱신(직원id, 날짜);
}

async function 근태삭제버튼(기록id, 직원id, 날짜) {
  var { error } = await 수파베이스.from('근태기록').delete().eq('id', 기록id);
  if (error) { 알림('삭제 실패', '오류'); return; }
  delete _근태기록맵[직원id + '_' + 날짜];
  _셀갱신(직원id, 날짜);
}

async function 연장시간변경(기록id, 시간) {
  var 연장 = Math.max(0, parseFloat(시간) || 0);
  await 수파베이스.from('근태기록').update({ 연장시간: 연장 }).eq('id', 기록id);
  for (var key in _근태기록맵) {
    if (_근태기록맵[key].id === 기록id) {
      _근태기록맵[key].연장시간 = 연장;
      break;
    }
  }
}

async function 지각시간변경(기록id, 시간) {
  var 지각 = Math.min(480, Math.max(0, Math.round(parseFloat(시간) || 0)));
  await 수파베이스.from('근태기록').update({ 지각시간: 지각 }).eq('id', 기록id);
  for (var key in _근태기록맵) {
    if (_근태기록맵[key].id === 기록id) {
      _근태기록맵[key].지각시간 = 지각;
      break;
    }
  }
}

async function 외출시간변경(기록id, 시간) {
  var 외출 = Math.min(480, Math.max(0, Math.round(parseFloat(시간) || 0)));
  await 수파베이스.from('근태기록').update({ 외출시간: 외출 }).eq('id', 기록id);
  for (var key in _근태기록맵) {
    if (_근태기록맵[key].id === 기록id) {
      _근태기록맵[key].외출시간 = 외출;
      break;
    }
  }
}

async function 야간시간변경(기록id, 시간) {
  var 야간 = Math.min(24, Math.max(0, parseFloat(시간) || 0));
  await 수파베이스.from('근태기록').update({ 야간시간: 야간 }).eq('id', 기록id);
  for (var key in _근태기록맵) {
    if (_근태기록맵[key].id === 기록id) {
      _근태기록맵[key].야간시간 = 야간;
      break;
    }
  }
}

function _셀갱신(직원id, 날짜) {
  var td = document.querySelector('td[data-empid="' + 직원id + '"][data-date="' + 날짜 + '"]');
  if (!td) { 출근현황그리기(); return; }
  var 기록 = _근태기록맵[직원id + '_' + 날짜];
  var 빨간 = 빨간날인가(날짜);
  var 주말 = 주말인가(날짜);
  var 공휴 = 공휴일인가(날짜);
  td.innerHTML = _근태셀HTML(직원id, 날짜, 기록, 빨간, 주말, 공휴);
}

/* ══════════════════════════════════════════════════
   탭3 — 공휴일 관리
══════════════════════════════════════════════════ */

async function 공휴일목록불러오기() {
  var { data } = await 수파베이스.from('공휴일').select('*').order('날짜');
  _공휴일목록 = data || [];
  _공휴일셋 = new Set(_공휴일목록.map(function(h) { return h.날짜; }));
}

function 공휴일목록그리기() {
  var 년 = parseInt(document.getElementById('공휴일년도').value) || new Date().getFullYear();
  var 필터 = _공휴일목록.filter(function(h) { return h.날짜.startsWith(String(년)); });
  var tbody = document.getElementById('공휴일바디');
  if (!tbody) return;
  if (필터.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#9ca3af;padding:20px;">' + 년 + '년 공휴일이 없습니다</td></tr>';
    return;
  }
  tbody.innerHTML = 필터.map(function(h) {
    return '<tr>' +
      '<td>' + h.날짜 + ' (' + 요일명(h.날짜) + ')</td>' +
      '<td>' + h.명칭 + '</td>' +
      '<td><button class="소버튼 삭제" onclick="공휴일삭제(' + h.id + ')">삭제</button></td>' +
    '</tr>';
  }).join('');
}

function 요일명(dateStr) {
  return ['일', '월', '화', '수', '목', '금', '토'][new Date(dateStr + 'T00:00:00').getDay()];
}

async function 공휴일추가() {
  var 날짜 = document.getElementById('공휴일날짜').value;
  var 명칭 = document.getElementById('공휴일명칭').value.trim();
  if (!날짜 || !명칭) { 알림('날짜와 명칭을 입력하세요.', '오류'); return; }
  var { error } = await 수파베이스.from('공휴일').insert({ 날짜: 날짜, 명칭: 명칭 });
  if (error) { 알림('추가 실패: ' + error.message, '오류'); return; }
  document.getElementById('공휴일날짜').value = '';
  document.getElementById('공휴일명칭').value = '';
  알림('공휴일이 추가되었습니다.', '성공');
  await 공휴일목록불러오기();
  공휴일목록그리기();
}

async function 공휴일삭제(id) {
  var { error } = await 수파베이스.from('공휴일').delete().eq('id', id);
  if (error) { 알림('삭제 실패', '오류'); return; }
  await 공휴일목록불러오기();
  공휴일목록그리기();
}

/* ══════════════════════════════════════════════════
   탭4 — 급여 계산
══════════════════════════════════════════════════ */

async function 급여계산화면초기화() {
  var el = document.getElementById('급여계산년월');
  if (el && !el.value) el.value = _출근년월;
  await 급여결과불러오기();
}

async function 급여결과불러오기() {
  var 년월 = document.getElementById('급여계산년월').value;
  if (!년월) return;

  var { data } = await 수파베이스.from('급여결과').select('*').eq('년월', 년월).order('직원id');
  if (!data || data.length === 0) {
    document.getElementById('급여결과바디').innerHTML =
      '<tr><td colspan="11" style="text-align:center;color:#9ca3af;padding:20px;">년월 선택 후 계산을 실행하세요</td></tr>';
    return;
  }

  var 결과들 = data.map(function(d) {
    var 직원 = _직원목록.find(function(e) { return e.id === d.직원id; });
    return {
      직원id: d.직원id,
      직원명: 직원 ? 직원.이름 : ('직원#' + d.직원id),
      시급: 직원 ? Number(직원.시급) : 0,
      정규시간: d.정규시간 || 0,
      연장시간: d.연장시간 || 0,
      주말시간: d.주말시간 || 0,
      공휴일시간: d.공휴일시간 || 0,
      기본급: d.기본급 || 0,
      연장수당: d.연장수당 || 0,
      주말수당: d.주말수당 || 0,
      야간수당: d.야간수당 || 0,
      교통비: d.교통비 || 0,
      직급수당: d.직급수당 || 0,
      근속수당: d.근속수당 || 0,
      주휴수당: d.주휴수당 || 0,
      결근공제: d.결근공제 || 0,
      소득세: d.소득세 || 0,
      실수령액: d.실수령액 || 0
    };
  });

  _급여결과그리기(결과들);
}

async function 급여계산실행() {
  var 년월 = document.getElementById('급여계산년월').value;
  if (!년월) { 알림('년월을 선택하세요.', '오류'); return; }

  var parts = 년월.split('-').map(Number);
  var 년 = parts[0], 월 = parts[1];
  var 일수 = new Date(년, 월, 0).getDate();

  알림('계산 중...', '정보');

  var { data: 기록들 } = await 수파베이스.from('근태기록')
    .select('*')
    .gte('날짜', 년월 + '-01')
    .lte('날짜', 년월 + '-' + String(일수).padStart(2, '0'));

  var 기록들맵 = {};
  (기록들 || []).forEach(function(r) {
    if (!기록들맵[r.직원id]) 기록들맵[r.직원id] = [];
    기록들맵[r.직원id].push(r);
  });

  var 결과들 = [];
  for (var ei = 0; ei < _직원목록.length; ei++) {
    var 직원 = _직원목록[ei];
    var 직원기록 = 기록들맵[직원.id] || [];
    var 결과 = _급여계산(직원, 직원기록, 년, 월);
    결과들.push(결과);

    var payload = {
      직원id: 직원.id, 년월: 년월,
      정규시간: 결과.정규시간, 연장시간: 결과.연장시간,
      주말시간: 결과.주말시간, 공휴일시간: 결과.공휴일시간,
      반차시간: 결과.반차시간, 연차시간: 결과.연차시간,
      결근일수: 결과.결근일수,
      기본급: 결과.기본급, 연장수당: 결과.연장수당,
      주말수당: 결과.주말수당, 야간수당: 결과.야간수당,
      교통비: 결과.교통비, 직급수당: 결과.직급수당,
      근속수당: 결과.근속수당, 주휴수당: 결과.주휴수당,
      결근공제: 결과.결근공제, 소득세: 결과.소득세,
      실수령액: 결과.실수령액,
      상세내역: 결과.상세
    };
    await 수파베이스.from('급여결과').upsert(payload, { onConflict: '직원id,년월' });
  }

  _급여결과그리기(결과들);
  알림('급여 계산이 완료되었습니다.', '성공');
}

function _급여계산(직원, 기록들, 년, 월) {
  var 시급 = Number(직원.시급);
  var 직급수당 = Number(직원.직급수당 || 0);
  var 근속수당 = Number(직원.근속수당 || 0);

  var 정규시간 = 0, 연장시간 = 0;
  var 주말시간 = 0, 공휴일시간 = 0;
  var 반차시간 = 0, 연차시간 = 0;
  var 결근일수 = 0;
  var 야간주말시간 = 0;
  var 교통비일수 = 0;
  var 상세 = [];

  var 기록맵 = {};
  기록들.forEach(function(r) { 기록맵[r.날짜] = r; });

  기록들.forEach(function(r) {
    var 종류 = r.근태종류;
    var 연장 = Number(r.연장시간) || 0;
    var 공휴 = 공휴일인가(r.날짜);
    var 주말 = 주말인가(r.날짜);

    if (종류 === '정상출근') {
      정규시간 += Math.max(0, 8 - (Number(r.지각시간)||0)/60 - (Number(r.외출시간)||0)/60);
      연장시간 += 연장;
      교통비일수 += 1;
    } else if (종류 === '주말출근') {
      주말시간 += 8 + 연장;
      야간주말시간 += Number(r.야간시간) || 0;
      교통비일수 += 1;
    } else if (종류 === '공휴일출근') {
      공휴일시간 += 8 + 연장;
      야간주말시간 += Number(r.야간시간) || 0;
      교통비일수 += 1;
    } else if (종류 === '결근') {
      결근일수 += 1;
    } else if (종류 === '반차') {
      반차시간 += 4;
      연장시간 += 연장;
      교통비일수 += 1;
    } else if (종류 === '연차') {
      연차시간 += 8;
      연장시간 += 연장;
    }
    상세.push({ 날짜: r.날짜, 종류: 종류, 연장: 연장 });
  });

  var 주휴수당 = _주휴수당계산(직원, 기록맵, 년, 월);

  var 기본급      = (정규시간 + 반차시간 + 연차시간) * 시급;
  var 연장수당    = 연장시간 * 시급 * PAYROLL.연장배율;
  var 주말주간    = Math.max(0, (주말시간 + 공휴일시간) - 야간주말시간);
  var 주말수당    = 주말주간 * 시급 * PAYROLL.주말배율;
  var 야간수당    = 야간주말시간 * 시급 * PAYROLL.야간주말배율;
  var 교통비      = 교통비일수 * PAYROLL.일교통비;
  var 결근공제    = 결근일수 * 8 * 시급;
  var 총지급전    = 기본급 + 연장수당 + 주말수당 + 야간수당 + 교통비 + 직급수당 + 근속수당 + 주휴수당 - 결근공제;
  var 원천징수    = Math.round(총지급전 * PAYROLL.소득세율);
  var 실수령액    = Math.round(총지급전 - 원천징수);

  return {
    직원id: 직원.id, 직원명: 직원.이름, 시급: 시급,
    정규시간: 정규시간, 연장시간: 연장시간,
    주말시간: 주말시간, 공휴일시간: 공휴일시간,
    반차시간: 반차시간, 연차시간: 연차시간,
    결근일수: 결근일수,
    기본급: Math.round(기본급), 연장수당: Math.round(연장수당),
    주말수당: Math.round(주말수당), 야간수당: Math.round(야간수당),
    교통비: Math.round(교통비),
    직급수당: Math.round(직급수당),
    근속수당: Math.round(근속수당), 주휴수당: Math.round(주휴수당),
    결근공제: Math.round(결근공제), 소득세: 원천징수,
    실수령액: 실수령액,
    상세: 상세
  };
}

function _주휴수당계산(직원, 기록맵, 년, 월) {
  var 시급 = Number(직원.시급);
  var 일수 = new Date(년, 월, 0).getDate();
  var 주휴수당총액 = 0;

  // 해당 달의 모든 평일을 주차별로 그룹핑 (월요일 기준 주차)
  var 주차맵 = {};
  for (var i = 1; i <= 일수; i++) {
    var dateObj = new Date(년, 월 - 1, i);
    var 요일 = dateObj.getDay();
    if (요일 === 0 || 요일 === 6) continue; // 주말 제외

    var 날짜str = 년 + '-' + String(월).padStart(2, '0') + '-' + String(i).padStart(2, '0');
    if (공휴일인가(날짜str)) continue; // 공휴일 제외

    // 그 주의 월요일 날짜를 key로 사용
    var offset = 요일 - 1;
    var 월요일 = new Date(년, 월 - 1, i - offset);
    var 주key = 월요일.getFullYear() + '-' + String(월요일.getMonth() + 1).padStart(2, '0') + '-' + String(월요일.getDate()).padStart(2, '0');

    if (!주차맵[주key]) 주차맵[주key] = [];
    주차맵[주key].push(날짜str);
  }

  Object.keys(주차맵).forEach(function(주key) {
    var 평일들 = 주차맵[주key];
    var 결근있음 = false;
    var 출근있음 = false;

    평일들.forEach(function(날짜) {
      var 기록 = 기록맵[날짜];
      if (!기록 || 기록.근태종류 === '결근') {
        결근있음 = true;
      } else {
        출근있음 = true;
      }
    });

    if (출근있음 && !결근있음) {
      주휴수당총액 += PAYROLL.주휴시간 * 시급;
    }
  });

  return 주휴수당총액;
}

function _명세서버튼클릭(직원id) {
  var 년월 = document.getElementById('급여계산년월').value;
  명세서직접열기(직원id, 년월);
}

function _급여결과그리기(결과들) {
  var tbody = document.getElementById('급여결과바디');
  if (!tbody) return;
  if (결과들.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;color:#9ca3af;padding:20px;">계산된 데이터가 없습니다.</td></tr>';
    var 지출박스 = document.getElementById('급여최종지출');
    if (지출박스) 지출박스.innerHTML = '';
    return;
  }
  tbody.innerHTML = 결과들.map(function(r) {
    var 기타수당 = r.직급수당 + r.근속수당 + r.주휴수당;
    return '<tr>' +
      '<td><strong>' + r.직원명 + '</strong></td>' +
      '<td style="text-align:right;font-size:11px;">' + r.시급.toLocaleString() + '원</td>' +
      '<td style="text-align:center;font-size:11px;">' + (typeof r.정규시간 === 'number' ? r.정규시간.toFixed(1) : r.정규시간) + 'h<br><small style="color:#6b7280;">연장:' + r.연장시간 + 'h</small></td>' +
      '<td style="text-align:center;font-size:11px;">' + (r.주말시간 + r.공휴일시간) + 'h</td>' +
      '<td style="text-align:right;">' + r.기본급.toLocaleString() + '</td>' +
      '<td style="text-align:right;">' + r.연장수당.toLocaleString() + '</td>' +
      '<td style="text-align:right;">' + r.주말수당.toLocaleString() +
        (r.야간수당 ? '<br><small style="color:#7e22ce;font-size:10px;">야간:' + r.야간수당.toLocaleString() + '</small>' : '') + '</td>' +
      '<td style="text-align:right;">' + (r.교통비 || 0).toLocaleString() + '</td>' +
      '<td style="text-align:right;">' + 기타수당.toLocaleString() +
        '<br><small style="color:#6b7280;font-size:10px;">직급:' + r.직급수당.toLocaleString() +
        ' 근속:' + r.근속수당.toLocaleString() + ' 주휴:' + r.주휴수당.toLocaleString() + '</small></td>' +
      '<td style="text-align:right;color:#dc2626;font-size:11px;">-' + r.결근공제.toLocaleString() +
        '<br>-' + r.소득세.toLocaleString() + '<small style="color:#9ca3af;">(세)</small></td>' +
      '<td style="text-align:right;font-weight:700;color:#1a4a7a;">' + r.실수령액.toLocaleString() + '</td>' +
      '<td><button class="소버튼" onclick="_명세서버튼클릭(' + r.직원id + ')">명세서</button></td>' +
    '</tr>';
  }).join('');

  // 최종 지출 계산
  var 총실수령 = 결과들.reduce(function(s, r) { return s + r.실수령액; }, 0);
  var 총원천징수 = 결과들.reduce(function(s, r) { return s + r.소득세; }, 0);
  var 총지급액 = 총실수령 + 총원천징수;
  var 수수료 = Math.round(총지급액 * PAYROLL.수수료율);
  var 사대보험 = Math.round(총지급액 * PAYROLL.사대보험율);
  var 최종지출 = 총지급액 + 수수료 + 사대보험;

  var 지출박스 = document.getElementById('급여최종지출');
  if (지출박스) {
    지출박스.innerHTML =
      '<h4 style="margin:0 0 12px;font-size:13px;font-weight:700;color:#374151;border-bottom:1px solid #f3f4f6;padding-bottom:8px;">업체 최종 지출 내역</h4>' +
      '<table style="width:100%;font-size:13px;border-collapse:collapse;">' +
      '<tr><td style="padding:5px 0;color:#6b7280;">직원 총 지급액 (원천징수 전)</td>' +
        '<td style="padding:5px 0;text-align:right;">' + 총지급액.toLocaleString() + '원</td></tr>' +
      '<tr><td style="padding:5px 0;color:#6b7280;">수수료 (' + (PAYROLL.수수료율 * 100).toFixed(0) + '%)</td>' +
        '<td style="padding:5px 0;text-align:right;">' + 수수료.toLocaleString() + '원</td></tr>' +
      '<tr><td style="padding:5px 0;color:#6b7280;">사업주 4대보험 (' + (PAYROLL.사대보험율 * 100).toFixed(1) + '%)</td>' +
        '<td style="padding:5px 0;text-align:right;">' + 사대보험.toLocaleString() + '원</td></tr>' +
      '<tr style="border-top:2px solid #374151;">' +
        '<td style="padding:8px 0;font-weight:700;font-size:14px;">합 계</td>' +
        '<td style="padding:8px 0;text-align:right;font-weight:700;font-size:16px;color:#dc2626;">' + 최종지출.toLocaleString() + '원</td></tr>' +
      '</table>';
  }
}

/* ══════════════════════════════════════════════════
   탭5 — 명세서
══════════════════════════════════════════════════ */

function 명세서화면초기화() {
  var sel = document.getElementById('명세서직원선택');
  if (!sel) return;
  sel.innerHTML = '<option value="">직원 선택</option>' +
    _직원목록.map(function(e) {
      return '<option value="' + e.id + '">' + (e.직급 ? e.직급 + ' ' : '') + e.이름 + '</option>';
    }).join('');
  var el = document.getElementById('명세서년월');
  if (el && !el.value) el.value = _출근년월;
}

function 명세서직접열기(직원id, 년월) {
  급여탭선택('명세서');
  setTimeout(function() {
    document.getElementById('명세서직원선택').value = 직원id;
    document.getElementById('명세서년월').value = 년월;
    명세서조회();
  }, 100);
}

async function 명세서조회() {
  var 직원id = document.getElementById('명세서직원선택').value;
  var 년월 = document.getElementById('명세서년월').value;
  if (!직원id || !년월) { 알림('직원과 년월을 선택하세요.', '오류'); return; }

  var { data, error } = await 수파베이스.from('급여결과')
    .select('*').eq('직원id', 직원id).eq('년월', 년월).maybeSingle();

  if (error || !data) {
    document.getElementById('명세서내용').innerHTML =
      '<p style="text-align:center;color:#9ca3af;padding:30px;">해당 월 급여 계산 데이터가 없습니다.<br>급여 계산 탭에서 먼저 계산을 실행하세요.</p>';
    return;
  }

  var 직원 = _직원목록.find(function(e) { return e.id === parseInt(직원id); });
  var 직원명 = 직원 ? ((직원.직급 || '') + ' ' + 직원.이름) : '';
  var 년 = 년월.split('-')[0];
  var 월 = 년월.split('-')[1];

  var html = '<div style="max-width:500px;margin:0 auto;font-family:inherit;">' +
    '<div style="text-align:center;margin-bottom:20px;border-bottom:2px solid #374151;padding-bottom:14px;">' +
    '<h3 style="margin:0 0 4px;font-size:18px;">' + 년 + '년 ' + parseInt(월) + '월 급여명세서</h3>' +
    '<div style="font-size:14px;color:#374151;">' + 직원명 + '</div>' +
    '</div>' +

    '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">' +
    '<tr><td style="padding:6px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;width:45%;">정규 근무시간</td>' +
    '<td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">' + data.정규시간 + 'h</td></tr>' +
    '<tr><td style="padding:6px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;">연장 근무시간</td>' +
    '<td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">' + (data.연장시간 || 0) + 'h</td></tr>' +
    '<tr><td style="padding:6px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;">주말/공휴일 근무</td>' +
    '<td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">' + ((data.주말시간 || 0) + (data.공휴일시간 || 0)) + 'h</td></tr>' +
    '<tr><td style="padding:6px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;">반차/연차</td>' +
    '<td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">' + (data.반차시간 || 0) + 'h / ' + (data.연차시간 || 0) + 'h</td></tr>' +
    '<tr><td style="padding:6px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;">결근</td>' +
    '<td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">' + (data.결근일수 || 0) + '일</td></tr>' +
    '</table>' +

    '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">' +
    '<thead><tr style="background:#374151;color:white;">' +
    '<th style="padding:8px;text-align:left;">지급 항목</th><th style="padding:8px;text-align:right;">금액</th></tr></thead>' +
    '<tbody>' +
    '<tr><td style="padding:6px;border:1px solid #e5e7eb;">기본급</td>' +
    '<td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">' + (data.기본급 || 0).toLocaleString() + '원</td></tr>' +
    '<tr><td style="padding:6px;border:1px solid #e5e7eb;">연장 수당 (×1.5)</td>' +
    '<td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">' + (data.연장수당 || 0).toLocaleString() + '원</td></tr>' +
    '<tr><td style="padding:6px;border:1px solid #e5e7eb;">주말/공휴일 수당 (×1.5)</td>' +
    '<td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">' + (data.주말수당 || 0).toLocaleString() + '원</td></tr>' +
    '<tr><td style="padding:6px;border:1px solid #e5e7eb;">야간 수당 (×2.0)</td>' +
    '<td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">' + (data.야간수당 || 0).toLocaleString() + '원</td></tr>' +
    '<tr><td style="padding:6px;border:1px solid #e5e7eb;">교통비</td>' +
    '<td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">' + (data.교통비 || 0).toLocaleString() + '원</td></tr>' +
    '<tr><td style="padding:6px;border:1px solid #e5e7eb;">직급 수당</td>' +
    '<td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">' + (data.직급수당 || 0).toLocaleString() + '원</td></tr>' +
    '<tr><td style="padding:6px;border:1px solid #e5e7eb;">근속 수당</td>' +
    '<td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">' + (data.근속수당 || 0).toLocaleString() + '원</td></tr>' +
    '<tr><td style="padding:6px;border:1px solid #e5e7eb;">주휴 수당</td>' +
    '<td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">' + (data.주휴수당 || 0).toLocaleString() + '원</td></tr>' +
    '</tbody>' +
    '<tfoot>' +
    '<tr style="background:#f0fdf4;"><td style="padding:8px;border:1px solid #e5e7eb;font-weight:700;">지급액 합계</td>' +
    '<td style="padding:8px;border:1px solid #e5e7eb;text-align:right;font-weight:700;">' +
    ((data.기본급||0)+(data.연장수당||0)+(data.주말수당||0)+(data.야간수당||0)+(data.교통비||0)+(data.직급수당||0)+(data.근속수당||0)+(data.주휴수당||0)).toLocaleString() + '원</td></tr>' +
    '</tfoot></table>' +

    '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">' +
    '<thead><tr style="background:#374151;color:white;">' +
    '<th style="padding:8px;text-align:left;">공제 항목</th><th style="padding:8px;text-align:right;">금액</th></tr></thead>' +
    '<tbody>' +
    '<tr><td style="padding:6px;border:1px solid #e5e7eb;">결근 공제</td>' +
    '<td style="padding:6px;border:1px solid #e5e7eb;text-align:right;color:#dc2626;">-' + (data.결근공제 || 0).toLocaleString() + '원</td></tr>' +
    '<tr><td style="padding:6px;border:1px solid #e5e7eb;">소득세 (3.3%)</td>' +
    '<td style="padding:6px;border:1px solid #e5e7eb;text-align:right;color:#dc2626;">-' + (data.소득세 || 0).toLocaleString() + '원</td></tr>' +
    '</tbody></table>' +

    '<div style="background:#1a4a7a;color:white;border-radius:8px;padding:16px;display:flex;justify-content:space-between;align-items:center;">' +
    '<span style="font-size:16px;font-weight:700;">실 수령액</span>' +
    '<span style="font-size:22px;font-weight:700;">' + (data.실수령액 || 0).toLocaleString() + '원</span>' +
    '</div>' +
    '</div>';

  document.getElementById('명세서내용').innerHTML = html;
}
