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
var _마지막로컬변경 = 0;

var PAYROLL = {
  정규시간: 8,
  연장배율: 1.5,
  주말배율: 1.5,
  주말연장배율: 2.0,
  주휴시간: 8,
  일교통비: 3000,
  수수료율: 0.07,
  국민연금율: 0.0475,
  건강보험율: 0.03595,
  장기요양율: 0.1314,   // 건강보험료의 13.14%
  고용보험율: 0.009,
  부가세율: 0.1
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
      // 직원 폼이 열려있으면 스킵
      var 직원폼 = document.getElementById('직원폼');
      if (직원폼 && 직원폼.style.display !== 'none') return;
      // 출근현황 숫자 입력란 포커스 중이면 스킵
      var 포커스 = document.activeElement;
      if (포커스 && 포커스.type === 'number' && 포커스.closest('#출근현황테이블래퍼')) return;
      // 내가 방금 변경한 경우 1.5초간 스킵 (자기 변경 재렌더링 방지)
      if (Date.now() - _마지막로컬변경 < 1500) return;

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
  _근태표소속드롭다운갱신();
  await 출근현황그리기();
}

function _근태표소속드롭다운갱신() {
  var sel = document.getElementById('근태표소속선택');
  if (!sel) return;
  var 소속목록 = [...new Set(_직원목록.map(function(e) { return e.소속 || '미분류'; }))].sort();
  var 현재값 = sel.value;
  sel.innerHTML = 소속목록.map(function(s) {
    return '<option value="' + s + '"' + (s === 현재값 ? ' selected' : '') + '>' + s + '</option>';
  }).join('');
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
      var 조퇴분 = Number(기록.조퇴시간) || 0;
      var 실근무h = 조퇴분 > 0 ? _조퇴실근무h(조퇴분, 지각분, 외출분) : null;
      // 라벨 동적 반영 (조퇴 있으면 실근무시간 표시)
      if (실근무h !== null) {
        html = html.replace('정상 8h', '조퇴 ' + 실근무h.toFixed(1) + 'h');
      }
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
      html += '<div style="display:flex;align-items:center;gap:2px;">' +
        '<span style="font-size:10px;color:#7c3aed;">조퇴</span>' +
        '<input type="time" value="' + _분to시각문자열(조퇴분) + '" min="08:30" max="17:29" ' +
        'style="width:60px;font-size:10px;border:1px solid #c4b5fd;border-radius:3px;padding:1px 2px;" ' +
        'onchange="조퇴시간변경(' + 기록.id + ',this.value)" title="조퇴 시각 (빈칸=정상)">' +
        '</div>';
    }
    html += '<div style="display:flex;align-items:center;gap:2px;">' +
      '<span style="font-size:10px;color:#6b7280;">연장</span>' +
      '<input type="number" value="' + 연장 + '" min="0" max="12" step="0.5" ' +
      'style="width:36px;font-size:10px;border:1px solid #d1d5db;border-radius:3px;padding:1px 3px;text-align:center;" ' +
      'onchange="연장시간변경(' + 기록.id + ',this.value)" title="연장근무 시간">' +
      '<span style="font-size:10px;color:#6b7280;">h</span></div>';
  }
  html += '</div>';
  return html;
}

async function 근태등록버튼(직원id, 날짜, 종류) {
  _마지막로컬변경 = Date.now();
  var { data, error } = await 수파베이스.from('근태기록')
    .upsert({ 직원id: 직원id, 날짜: 날짜, 근태종류: 종류, 연장시간: 0, 지각시간: 0, 외출시간: 0, 야간시간: 0 }, { onConflict: '직원id,날짜' })
    .select().single();
  if (error) { 알림('등록 실패: ' + error.message, '오류'); return; }
  _근태기록맵[직원id + '_' + 날짜] = data;
  _셀갱신(직원id, 날짜);
}

async function 근태삭제버튼(기록id, 직원id, 날짜) {
  _마지막로컬변경 = Date.now();
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

/* 조퇴 실근무 계산: 08:30 출근 기준, 12:00~13:00 점심 제외 */
function _조퇴실근무h(조퇴분, 지각분, 외출분) {
  var 기준시작 = 510;   // 08:30
  var 점심시작 = 720;   // 12:00
  var 점심끝   = 780;   // 13:00
  var 실제시작 = 기준시작 + (지각분 || 0);
  var 점심공제 = Math.max(0, Math.min(조퇴분, 점심끝) - Math.max(실제시작, 점심시작));
  var 실근무분 = Math.max(0, 조퇴분 - 실제시작 - 점심공제);
  return Math.max(0, 실근무분 / 60 - (외출분 || 0) / 60);
}

function _분to시각문자열(분) {
  if (!분) return '';
  return String(Math.floor(분 / 60)).padStart(2,'0') + ':' + String(분 % 60).padStart(2,'0');
}

async function 조퇴시간변경(기록id, 시각str) {
  _마지막로컬변경 = Date.now();
  var 분 = 0;
  if (시각str) {
    var p = 시각str.split(':');
    분 = parseInt(p[0]) * 60 + parseInt(p[1]);
  }
  await 수파베이스.from('근태기록').update({ 조퇴시간: 분 || null }).eq('id', 기록id);
  for (var key in _근태기록맵) {
    if (_근태기록맵[key].id === 기록id) {
      _근태기록맵[key].조퇴시간 = 분 || null;
      _셀갱신(key.split('_')[0], key.split('_').slice(1).join('_'));
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
  var 주말연장시간 = 0;
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
      var _조퇴분 = Number(r.조퇴시간) || 0;
      if (_조퇴분 > 0) {
        정규시간 += _조퇴실근무h(_조퇴분, Number(r.지각시간)||0, Number(r.외출시간)||0);
      } else {
        정규시간 += Math.max(0, 8 - (Number(r.지각시간)||0)/60 - (Number(r.외출시간)||0)/60);
      }
      연장시간 += 연장;
      교통비일수 += 1;
    } else if (종류 === '주말출근') {
      주말시간 += 8;
      주말연장시간 += 연장;
      교통비일수 += 1;
    } else if (종류 === '공휴일출근') {
      공휴일시간 += 8;
      주말연장시간 += 연장;
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
  var 주말수당    = (주말시간 + 공휴일시간) * 시급 * PAYROLL.주말배율;
  var 주말연장수당 = 주말연장시간 * 시급 * PAYROLL.주말연장배율;
  var 교통비      = 교통비일수 * PAYROLL.일교통비;
  var 결근공제    = 결근일수 * 8 * 시급;
  var 실수령액    = Math.round(기본급 + 연장수당 + 주말수당 + 주말연장수당 + 교통비 + 직급수당 + 근속수당 + 주휴수당 - 결근공제);

  return {
    직원id: 직원.id, 직원명: 직원.이름, 시급: 시급,
    정규시간: 정규시간, 연장시간: 연장시간,
    주말시간: 주말시간, 공휴일시간: 공휴일시간,
    반차시간: 반차시간, 연차시간: 연차시간,
    결근일수: 결근일수,
    기본급: Math.round(기본급), 연장수당: Math.round(연장수당),
    주말수당: Math.round(주말수당), 야간수당: Math.round(주말연장수당),
    교통비: Math.round(교통비),
    직급수당: Math.round(직급수당),
    근속수당: Math.round(근속수당), 주휴수당: Math.round(주휴수당),
    결근공제: Math.round(결근공제), 소득세: 0,
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
        (r.야간수당 ? '<br><small style="color:#7e22ce;font-size:10px;">연장2x:' + r.야간수당.toLocaleString() + '</small>' : '') + '</td>' +
      '<td style="text-align:right;">' + (r.교통비 || 0).toLocaleString() + '</td>' +
      '<td style="text-align:right;">' + 기타수당.toLocaleString() +
        '<br><small style="color:#6b7280;font-size:10px;">직급:' + r.직급수당.toLocaleString() +
        ' 근속:' + r.근속수당.toLocaleString() + ' 주휴:' + r.주휴수당.toLocaleString() + '</small></td>' +
      '<td style="text-align:right;color:#dc2626;font-size:11px;">' + (r.결근공제 ? '-' + r.결근공제.toLocaleString() : '-') + '</td>' +
      '<td style="text-align:right;font-weight:700;color:#1a4a7a;">' + r.실수령액.toLocaleString() + '</td>' +
      '<td><button class="소버튼" onclick="_명세서버튼클릭(' + r.직원id + ')">명세서</button></td>' +
    '</tr>';
  }).join('');

  // 소속별 그룹핑
  var 소속별 = {};
  결과들.forEach(function(r) {
    var 직원 = _직원목록.find(function(e) { return e.id === r.직원id; });
    var 소속key = (직원 && 직원.소속) ? 직원.소속 : '미분류';
    if (!소속별[소속key]) 소속별[소속key] = [];
    소속별[소속key].push(r);
  });

  var 지출박스 = document.getElementById('급여최종지출');
  if (!지출박스) return;

  var 전체합계 = 0;
  var 지출html =
    '<h4 style="margin:0 0 12px;font-size:13px;font-weight:700;color:#374151;border-bottom:1px solid #f3f4f6;padding-bottom:8px;">업체 최종 지출 내역</h4>' +
    '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
    '<thead><tr style="background:#374151;color:#fff;">' +
    '<th style="padding:6px 8px;text-align:left;">직원</th>' +
    '<th style="padding:6px 8px;text-align:right;">실수령액</th>' +
    '<th style="padding:6px 8px;text-align:right;">수수료(7%)</th>' +
    '<th style="padding:6px 8px;text-align:right;">4대보험</th>' +
    '<th style="padding:6px 8px;text-align:right;">소계</th>' +
    '</tr></thead><tbody>';

  Object.keys(소속별).forEach(function(소속) {
    var 소속합계 = 0;
    지출html += '<tr style="background:#f3f4f6;">' +
      '<td colspan="5" style="padding:6px 8px;font-weight:700;color:#374151;font-size:12px;">[' + 소속 + ']</td></tr>';

    소속별[소속].forEach(function(r) {
      var 수수료 = Math.round(r.실수령액 * PAYROLL.수수료율);
      var 국민연금 = Math.round(r.실수령액 * PAYROLL.국민연금율);
      var 건강보험 = Math.round(r.실수령액 * PAYROLL.건강보험율);
      var 장기요양 = Math.round(건강보험 * PAYROLL.장기요양율);
      var 고용보험 = Math.round(r.실수령액 * PAYROLL.고용보험율);
      var 사대보험계 = 국민연금 + 건강보험 + 장기요양 + 고용보험;
      var 소계 = r.실수령액 + 수수료 + 사대보험계;
      소속합계 += 소계;
      전체합계 += 소계;
      지출html +=
        '<tr>' +
        '<td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;">' + r.직원명 + '</td>' +
        '<td style="padding:5px 8px;text-align:right;border-bottom:1px solid #f0f0f0;">' + r.실수령액.toLocaleString() + '</td>' +
        '<td style="padding:5px 8px;text-align:right;border-bottom:1px solid #f0f0f0;color:#6b7280;">' + 수수료.toLocaleString() + '</td>' +
        '<td style="padding:5px 8px;text-align:right;border-bottom:1px solid #f0f0f0;color:#6b7280;">' +
          '<span title="국민연금 ' + 국민연금.toLocaleString() + ' / 건강보험 ' + 건강보험.toLocaleString() + ' / 장기요양 ' + 장기요양.toLocaleString() + ' / 고용보험 ' + 고용보험.toLocaleString() + '" style="cursor:help;border-bottom:1px dashed #9ca3af;">' + 사대보험계.toLocaleString() + '</span>' +
        '</td>' +
        '<td style="padding:5px 8px;text-align:right;border-bottom:1px solid #f0f0f0;font-weight:600;">' + 소계.toLocaleString() + '</td>' +
        '</tr>';
    });

    지출html +=
      '<tr style="background:#fff7ed;">' +
      '<td colspan="4" style="padding:5px 8px;text-align:right;color:#6b7280;font-size:11px;">' + 소속 + ' 소계</td>' +
      '<td style="padding:5px 8px;text-align:right;font-weight:700;color:#f97316;">' + 소속합계.toLocaleString() + '원</td>' +
      '</tr>';
  });

  var 부가세 = Math.round(전체합계 * PAYROLL.부가세율);
  var 부가세포함합계 = 전체합계 + 부가세;

  지출html +=
    '</tbody><tfoot>' +
    '<tr style="background:#374151;color:#e5e7eb;">' +
    '<td colspan="4" style="padding:8px 8px;font-weight:600;font-size:13px;">공급가액</td>' +
    '<td style="padding:8px 8px;text-align:right;font-weight:600;font-size:14px;">' + 전체합계.toLocaleString() + '원</td>' +
    '</tr>' +
    '<tr style="background:#4b5563;color:#d1d5db;">' +
    '<td colspan="4" style="padding:8px 8px;font-size:13px;">부가세 (10%)</td>' +
    '<td style="padding:8px 8px;text-align:right;font-size:13px;">' + 부가세.toLocaleString() + '원</td>' +
    '</tr>' +
    '<tr style="background:#1a3a5c;color:#fff;">' +
    '<td colspan="4" style="padding:10px 8px;font-weight:700;font-size:13px;">합계 (VAT 포함)</td>' +
    '<td style="padding:10px 8px;text-align:right;font-weight:700;font-size:16px;">' + 부가세포함합계.toLocaleString() + '원</td>' +
    '</tr>' +
    '</tfoot></table>' +
    '<p style="font-size:11px;color:#6b7280;margin-top:6px;">4대보험 = 국민연금 4.75% + 건강보험 3.595% + 장기요양 13.14%of건강보험 + 고용보험 0.9% | 항목에 마우스 올리면 상세 확인</p>';

  지출박스.innerHTML = 지출html;
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
    '<tr><td style="padding:6px;border:1px solid #e5e7eb;">주말/공휴일 연장 (×2.0)</td>' +
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

    (data.결근공제 ?
    '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">' +
    '<thead><tr style="background:#374151;color:white;">' +
    '<th style="padding:8px;text-align:left;">공제 항목</th><th style="padding:8px;text-align:right;">금액</th></tr></thead>' +
    '<tbody>' +
    '<tr><td style="padding:6px;border:1px solid #e5e7eb;">결근 공제</td>' +
    '<td style="padding:6px;border:1px solid #e5e7eb;text-align:right;color:#dc2626;">-' + (data.결근공제).toLocaleString() + '원</td></tr>' +
    '</tbody></table>'
    : '') +

    '<div style="background:#1a4a7a;color:white;border-radius:8px;padding:16px;display:flex;justify-content:space-between;align-items:center;">' +
    '<span style="font-size:16px;font-weight:700;">실 수령액</span>' +
    '<span style="font-size:22px;font-weight:700;">' + (data.실수령액 || 0).toLocaleString() + '원</span>' +
    '</div>' +
    '<div style="text-align:center;margin-top:32px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;letter-spacing:0.03em;">직원 여러분의 노고에 깊이 감사드립니다.</div>' +
    '</div>';

  document.getElementById('명세서내용').innerHTML = html;
}

/* ══════════════════════════════════════════════════
   근태표 공통 데이터 준비
══════════════════════════════════════════════════ */

async function _근태표데이터준비() {
  var 년월 = document.getElementById('출근년월').value || _출근년월;
  if (!년월) { 알림('년월을 선택하세요.', '오류'); return null; }

  var 년 = parseInt(년월.split('-')[0]);
  var 월 = parseInt(년월.split('-')[1]);
  var 말일 = new Date(년, 월, 0).getDate();
  var 요일명 = ['일','월','화','수','목','금','토'];

  var 날짜들 = [];
  for (var d = 1; d <= 말일; d++) {
    var str = 년월 + '-' + String(d).padStart(2, '0');
    var dt = new Date(년, 월 - 1, d);
    날짜들.push({ 날짜: str, 일: d, 요일: dt.getDay() });
  }

  var { data: 기록들 } = await 수파베이스.from('근태기록')
    .select('*')
    .gte('날짜', 년월 + '-01')
    .lte('날짜', 년월 + '-' + String(말일).padStart(2, '0'));

  var 기록맵 = {};
  (기록들 || []).forEach(function(r) { 기록맵[r.직원id + '_' + r.날짜] = r; });

  var 공휴일set = new Set(_공휴일목록.map(function(h) { return h.날짜; }));

  var 선택소속 = (document.getElementById('근태표소속선택') || {}).value || '';
  var 직원들 = _직원목록.filter(function(e) {
    return (e.소속 || '미분류') === 선택소속;
  });

  var 종류표시 = {
    '정상출근':  { 텍스트: '○', 색: '#15803d', 배경: '#dcfce7' },
    '결근':      { 텍스트: '×', 색: '#dc2626', 배경: '#fef2f2' },
    '반차':      { 텍스트: '반차', 색: '#1d4ed8', 배경: '#eff6ff' },
    '연차':      { 텍스트: '연차', 색: '#1d4ed8', 배경: '#dbeafe' },
    '주말출근':  { 텍스트: '○', 색: '#c2410c', 배경: '#fff7ed' },
    '공휴일출근':{ 텍스트: '○', 색: '#7e22ce', 배경: '#fdf4ff' }
  };

  return { 년: 년, 월: 월, 날짜들: 날짜들, 요일명: 요일명, 기록맵: 기록맵,
           공휴일set: 공휴일set, 직원들: 직원들, 선택소속: 선택소속, 종류표시: 종류표시 };
}

function _근태표테이블HTML(데이터, 직원들) {
  var 년 = 데이터.년, 월 = 데이터.월, 날짜들 = 데이터.날짜들;
  var 요일명 = 데이터.요일명, 기록맵 = 데이터.기록맵;
  var 공휴일set = 데이터.공휴일set, 종류표시 = 데이터.종류표시;
  var 선택소속 = 데이터.선택소속;
  var cols = 날짜들.length;

  var TH = 'style="border:1px solid #888;padding:1px 0;text-align:center;background:#e8edf4;font-weight:700;font-size:7.5px;"';
  var TH_RED = 'style="border:1px solid #888;padding:1px 0;text-align:center;background:#e8edf4;font-weight:700;font-size:7.5px;color:#c00;"';

  var h = '<h2 style="text-align:center;font-size:12px;margin:0 0 4px;letter-spacing:1px;">' +
    년 + '년 ' + 월 + '월 근태표 &nbsp;|&nbsp; ' + 선택소속 + ' (' + 직원들.length + '명)</h2>' +
    '<table style="border-collapse:collapse;width:100%;table-layout:fixed;">' +
    '<thead><tr>' +
    '<th rowspan="2" ' + TH + ' style="border:1px solid #888;padding:1px 0;text-align:center;background:#e8edf4;font-weight:700;width:18px;">순번</th>' +
    '<th rowspan="2" ' + TH + ' style="border:1px solid #888;padding:1px 0;text-align:center;background:#e8edf4;font-weight:700;width:36px;">성명</th>';

  날짜들.forEach(function(날) {
    var isRed = 날.요일 === 0 || 날.요일 === 6 || 공휴일set.has(날.날짜);
    h += '<th ' + (isRed ? TH_RED : TH) + '>' + String(월).padStart(2,'0') + '.' + String(날.일).padStart(2,'0') + '</th>';
  });
  h += '<th rowspan="2" ' + TH + ' style="border:1px solid #888;padding:1px 0;text-align:center;background:#e8edf4;font-weight:700;width:22px;">출근<br>일수</th></tr><tr>';

  날짜들.forEach(function(날) {
    var isRed = 날.요일 === 0 || 날.요일 === 6 || 공휴일set.has(날.날짜);
    h += '<th ' + (isRed ? TH_RED : TH) + '>' + 요일명[날.요일] + '</th>';
  });
  h += '</tr></thead><tbody>';

  직원들.forEach(function(직원, idx) {
    var 출근수 = 0;
    var 날시간목록 = [];
    h += '<tr style="height:16px;">' +
      '<td style="border:1px solid #888;text-align:center;font-size:7.5px;">' + (idx + 1) + '</td>' +
      '<td style="border:1px solid #888;text-align:left;padding-left:2px;font-size:7.5px;">' + 직원.이름 + '</td>';

    날짜들.forEach(function(날) {
      var 기록 = 기록맵[직원.id + '_' + 날.날짜];
      var isRed = 날.요일 === 0 || 날.요일 === 6 || 공휴일set.has(날.날짜);
      if (!기록) {
        h += '<td style="border:1px solid #888;' + (isRed ? 'background:#fff0f0;' : '') + '"></td>';
        날시간목록.push({ text: '', isRed: isRed });
        return;
      }
      var 종류 = 기록.근태종류;
      var 표시 = 종류표시[종류];
      if (!표시) { h += '<td style="border:1px solid #888;"></td>'; 날시간목록.push({ text: '', isRed: isRed }); return; }
      if (종류 === '정상출근' || 종류 === '주말출근' || 종류 === '공휴일출근') 출근수++;

      var 메인텍스트 = 표시.텍스트;
      var 차감h = 0;
      var 연장h = Number(기록.연장시간) || 0;
      var 실근무 = 0;

      if (종류 === '정상출근') {
        var _조퇴분 = Number(기록.조퇴시간) || 0;
        if (_조퇴분 > 0) {
          메인텍스트 = '조퇴';
          실근무 = _조퇴실근무h(_조퇴분, Number(기록.지각시간)||0, Number(기록.외출시간)||0);
          차감h = 8 - 실근무;
        } else {
          차감h = (Number(기록.지각시간)||0)/60 + (Number(기록.외출시간)||0)/60;
          실근무 = Math.max(0, 8 - 차감h);
        }
      } else if (종류 === '반차') {
        차감h = 4;
        실근무 = 4;
      } else if (종류 === '주말출근' || 종류 === '공휴일출근') {
        실근무 = 8 + 연장h;
      }
      // 연차, 결근은 실근무 = 0 (표시 없음)

      var 부가 = '';
      if (차감h > 0.01) {
        부가 += '<span style="color:#dc2626;font-size:6px;font-weight:400;"> -' + (Math.round(차감h * 10) / 10) + 'h</span>';
      }
      if (연장h > 0) {
        부가 += '<span style="color:#1d4ed8;font-size:6px;font-weight:400;"> +' + 연장h + 'h</span>';
      }

      h += '<td style="border:1px solid #888;background:' + 표시.배경 + ';color:' + 표시.색 + ';font-weight:700;font-size:7px;white-space:nowrap;">' + 메인텍스트 + 부가 + '</td>';
      날시간목록.push({ text: 실근무 > 0 ? (Math.round(실근무 * 10) / 10) + 'h' : '', isRed: isRed });
    });

    h += '<td style="border:1px solid #888;text-align:center;font-weight:700;font-size:7.5px;">' + 출근수 + '</td></tr>';

    // 실근무시간 행
    h += '<tr style="height:11px;background:#f0f4ff;">' +
      '<td colspan="2" style="border:1px solid #dde;text-align:right;font-size:6px;color:#6b7280;padding-right:2px;font-style:italic;">실근무</td>';
    날시간목록.forEach(function(d) {
      h += '<td style="border:1px solid #dde;text-align:center;font-size:6.5px;color:#374151;' + (d.isRed ? 'background:#fff5f5;' : '') + '">' + d.text + '</td>';
    });
    h += '<td style="border:1px solid #dde;"></td></tr>';

    h += '<tr style="height:3px;background:#e8edf4;"><td colspan="' + (2 + cols + 1) + '" style="border:none;"></td></tr>';
  });

  h += '</tbody></table>' +
    '<div style="margin-top:5px;font-size:8px;display:flex;gap:12px;align-items:center;">범례: ' +
    '<span style="color:#15803d;">○ 정상출근</span>' +
    '<span style="color:#dc2626;">× 결근</span>' +
    '<span style="color:#1d4ed8;">반차</span>' +
    '<span style="color:#1d4ed8;">연차</span>' +
    '<span style="color:#dc2626;">-Xh 차감(빨강)</span>' +
    '<span style="color:#1d4ed8;">+Xh 연장(파랑)</span>' +
    '<span style="color:#c2410c;">○ 주말/공휴일출근</span>' +
    '</div>';
  return h;
}

async function 근태표출력() {
  var 데이터 = await _근태표데이터준비();
  if (!데이터 || 데이터.직원들.length === 0) { 알림('해당 업체 직원이 없습니다.', '오류'); return; }

  var 내용 = _근태표테이블HTML(데이터, 데이터.직원들);
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
    '<title>' + 데이터.년 + '년 ' + 데이터.월 + '월 근태표</title>' +
    '<style>' +
    '@page{size:A4 landscape;margin:6mm;}' +
    '*{box-sizing:border-box;}' +
    'body{font-family:"맑은 고딕","Apple SD Gothic Neo",sans-serif;font-size:7.5px;margin:0;padding:0;}' +
    '</style></head><body>' + 내용 + '</body></html>';

  var win = window.open('', '_blank', 'width=1200,height=800');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(function() { win.print(); }, 600);
}

async function 근태표엑셀() {
  var 데이터 = await _근태표데이터준비();
  if (!데이터 || 데이터.직원들.length === 0) { 알림('해당 업체 직원이 없습니다.', '오류'); return; }

  var 내용 = _근태표테이블HTML(데이터, 데이터.직원들);
  var xls = '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">' +
    '<head><meta charset="UTF-8"><!--[if gte mso 9]><xml>' +
    '<x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>' +
    '<x:Name>' + 데이터.월 + '월 근태표</x:Name>' +
    '<x:WorksheetOptions><x:FitToPage/><x:FitWidth>1</x:FitWidth></x:WorksheetOptions>' +
    '</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>' +
    '</xml><![endif]-->' +
    '<style>th,td{mso-number-format:"\\@";}</style>' +
    '</head><body>' + 내용 + '</body></html>';

  var blob = new Blob(['﻿' + xls], { type: 'application/vnd.ms-excel;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 데이터.년 + '년_' + String(데이터.월).padStart(2,'0') + '월_근태표_' + 데이터.선택소속 + '.xls';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
}
