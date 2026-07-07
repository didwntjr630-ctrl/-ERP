/* ===================================================
   급여.js — 급여관리 시스템 로직
   =================================================== */

var _급여탭 = '직원';
var _직원목록 = [];
var _공휴일목록 = [];
var _선택직원id = null;

var WORK = {
  출근: { h: 8, m: 30 },   // 08:30
  퇴근: { h: 17, m: 30 },  // 17:30
  연장시작: { h: 18, m: 0 }, // 18:00
  점심시작: { h: 12, m: 0 },
  점심끝:   { h: 13, m: 0 },
  정규시간: 8,               // 하루 정규 8시간
  연장배율: 1.5,
  주말배율: 1.5,
  소득세율: 0.033
};

/* ── 유틸 ──────────────────────────────────────── */

function 분변환(hhmm) {
  if (!hhmm) return null;
  var parts = String(hhmm).split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1] || 0);
}

function 분to시간표시(분) {
  if (!분 && 분 !== 0) return '-';
  var h = Math.floor(분 / 60);
  var m = Math.round(분 % 60);
  return h + 'h ' + (m > 0 ? m + 'm' : '');
}

function 날짜포맷(dateStr) {
  var d = new Date(dateStr);
  return (d.getMonth()+1) + '/' + d.getDate();
}

function 요일명(dateStr) {
  return ['일','월','화','수','목','금','토'][new Date(dateStr).getDay()];
}

function 주말인가(dateStr) {
  var day = new Date(dateStr).getDay();
  return day === 0 || day === 6;
}

function 공휴일인가(dateStr) {
  return _공휴일목록.some(function(h) { return h.날짜 === dateStr; });
}

function 원화표시(n) {
  if (!n && n !== 0) return '-';
  return Math.round(n).toLocaleString() + '원';
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

/* ── 탭 전환 ───────────────────────────────────── */

function 급여탭선택(탭명) {
  _급여탭 = 탭명;
  document.querySelectorAll('.급여탭버튼').forEach(function(b) {
    b.classList.toggle('활성', b.getAttribute('data-tab') === 탭명);
  });
  document.querySelectorAll('.급여탭내용').forEach(function(c) {
    c.style.display = c.getAttribute('data-tab') === 탭명 ? 'block' : 'none';
  });
  if (탭명 === '직원') 직원목록그리기();
  if (탭명 === '근태') 근태화면초기화();
  if (탭명 === '공휴일') 공휴일목록그리기();
  if (탭명 === '급여계산') 급여계산화면초기화();
  if (탭명 === '명세서') 명세서화면초기화();
}

/* ══════════════════════════════════════════════════
   탭1 — 직원 관리
══════════════════════════════════════════════════ */

async function 직원목록불러오기() {
  var { data } = await 수파베이스.from('직원정보').select('*').eq('상태', 'active').order('id');
  _직원목록 = data || [];
}

function 직원목록그리기() {
  var tbody = document.getElementById('직원테이블바디');
  if (!tbody) return;
  if (_직원목록.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:20px;">등록된 직원이 없습니다</td></tr>';
    return;
  }
  tbody.innerHTML = _직원목록.map(function(e) {
    return '<tr>' +
      '<td>' + e.이름 + '</td>' +
      '<td>' + (e.직급 || '-') + '</td>' +
      '<td style="text-align:right;">' + Number(e.시급).toLocaleString() + '원</td>' +
      '<td><button class="소버튼 수정" onclick="직원수정폼('+e.id+')">수정</button> ' +
           '<button class="소버튼 삭제" onclick="직원삭제('+e.id+')">삭제</button></td>' +
    '</tr>';
  }).join('');
}

function 직원추가폼열기() {
  _선택직원id = null;
  document.getElementById('직원폼제목').textContent = '직원 추가';
  document.getElementById('직원이름입력').value = '';
  document.getElementById('직원직급입력').value = '';
  document.getElementById('직원시급입력').value = '';
  document.getElementById('직원폼').style.display = 'block';
}

function 직원수정폼(id) {
  var e = _직원목록.find(function(x) { return x.id === id; });
  if (!e) return;
  _선택직원id = id;
  document.getElementById('직원폼제목').textContent = '직원 수정';
  document.getElementById('직원이름입력').value = e.이름;
  document.getElementById('직원직급입력').value = e.직급 || '';
  document.getElementById('직원시급입력').value = e.시급;
  document.getElementById('직원폼').style.display = 'block';
}

function 직원폼닫기() {
  document.getElementById('직원폼').style.display = 'none';
}

async function 직원저장() {
  var 이름 = document.getElementById('직원이름입력').value.trim();
  var 직급 = document.getElementById('직원직급입력').value.trim();
  var 시급 = parseFloat(document.getElementById('직원시급입력').value);
  if (!이름) { 알림('이름을 입력하세요.', '오류'); return; }
  if (!시급 || 시급 <= 0) { 알림('시급을 올바르게 입력하세요.', '오류'); return; }

  var payload = { 이름: 이름, 직급: 직급, 시급: 시급 };
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
  if (!confirm(e.이름 + ' 직원을 삭제하시겠습니까?')) return;
  var { error } = await 수파베이스.from('직원정보').update({ 상태: 'inactive' }).eq('id', id);
  if (error) { 알림('삭제 실패', '오류'); return; }
  알림('삭제되었습니다.', '성공');
  await 직원목록불러오기();
  직원목록그리기();
}

/* ══════════════════════════════════════════════════
   탭2 — 근태 입력
══════════════════════════════════════════════════ */

var _근태년월 = '';

function 근태화면초기화() {
  if (!_근태년월) {
    var now = new Date();
    _근태년월 = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  }
  document.getElementById('근태년월').value = _근태년월;
  근태직원선택지채우기();
  특수근태목록그리기();
}

function 근태직원선택지채우기() {
  var sel = document.getElementById('특수근태직원');
  if (!sel) return;
  sel.innerHTML = '<option value="">직원 선택</option>' +
    _직원목록.map(function(e) {
      return '<option value="'+e.id+'">'+(e.직급?e.직급+' ':'')+e.이름+'</option>';
    }).join('');
}

async function CAPS업로드(input) {
  var file = input.files[0];
  if (!file) return;
  알림('파일 분석 중...', '정보');

  var reader = new FileReader();
  reader.onload = async function(ev) {
    try {
      var data = new Uint8Array(ev.target.result);
      var wb = XLSX.read(data, { type: 'array', cellText: true, cellDates: false });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      // 년월 파싱 (파일명에서)
      var 년월match = file.name.match(/(\d{4})(\d{2})/);
      var 년월 = 년월match ? 년월match[1]+'-'+년월match[2] : _근태년월;
      var [년, 월] = 년월.split('-').map(Number);

      // 직원별 출퇴근 파싱
      var 직원맵 = {};  // 이름 → { 출근: [...], 퇴근: [...] }
      var cur이름 = '';

      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        var 이름후보 = String(row[2] || '').trim();
        var 구분 = String(row[4] || '').trim();

        if (이름후보 && 이름후보 !== '삼양이엔지' && 이름후보 !== '삼양이엔지 ') {
          cur이름 = 이름후보;
        }
        if (!cur이름) continue;
        if (!직원맵[cur이름]) 직원맵[cur이름] = { 출근: [], 퇴근: [] };

        if (구분 === '출근') {
          직원맵[cur이름].출근 = row.slice(5, 5+31);
        } else if (구분 === '퇴근') {
          직원맵[cur이름].퇴근 = row.slice(5, 5+31);
        }
      }

      // DB에 저장
      var 총건수 = 0;
      for (var 이름 in 직원맵) {
        var 직원 = _직원목록.find(function(e) { return e.이름 === 이름; });
        if (!직원) continue;
        var 출근arr = 직원맵[이름].출근;
        var 퇴근arr = 직원맵[이름].퇴근;

        var upserts = [];
        for (var d = 0; d < 31; d++) {
          var 일 = d + 1;
          if (일 > new Date(년, 월, 0).getDate()) break;
          var 출근시간 = String(출근arr[d] || '').trim();
          var 퇴근시간 = String(퇴근arr[d] || '').trim();
          if (!출근시간 && !퇴근시간) continue;
          var 날짜 = 년 + '-' + String(월).padStart(2,'0') + '-' + String(일).padStart(2,'0');
          upserts.push({
            직원id: 직원.id,
            날짜: 날짜,
            출근시간: 출근시간 || null,
            퇴근시간: 퇴근시간 || null,
            년월: 년월
          });
        }
        if (upserts.length > 0) {
          await 수파베이스.from('출퇴근기록').upsert(upserts, { onConflict: '직원id,날짜' });
          총건수 += upserts.length;
        }
      }

      _근태년월 = 년월;
      document.getElementById('근태년월').value = 년월;
      알림(Object.keys(직원맵).length + '명, ' + 총건수 + '건 등록 완료', '성공');
      input.value = '';
    } catch(e) {
      알림('파싱 오류: ' + e.message, '오류');
    }
  };
  reader.readAsArrayBuffer(file);
}

async function 특수근태등록() {
  var 직원id = parseInt(document.getElementById('특수근태직원').value);
  var 날짜 = document.getElementById('특수근태날짜').value;
  var 종류 = document.getElementById('특수근태종류').value;
  var 시간val = parseFloat(document.getElementById('특수근태시간').value) || 0;

  if (!직원id || !날짜 || !종류) { 알림('모든 항목을 입력하세요.', '오류'); return; }

  var { error } = await 수파베이스.from('특수근태').insert({
    직원id: 직원id, 날짜: 날짜, 종류: 종류, 시간: 시간val
  });
  if (error) { 알림('등록 실패: ' + error.message, '오류'); return; }
  알림('등록되었습니다.', '성공');
  특수근태목록그리기();
}

async function 특수근태삭제(id) {
  await 수파베이스.from('특수근태').delete().eq('id', id);
  특수근태목록그리기();
}

async function 특수근태목록그리기() {
  var 년월 = document.getElementById('근태년월') ? document.getElementById('근태년월').value : _근태년월;
  if (!년월) return;
  var [년, 월] = 년월.split('-').map(Number);
  var 시작 = 년월 + '-01';
  var 끝 = 년 + '-' + String(월).padStart(2,'0') + '-' + String(new Date(년,월,0).getDate()).padStart(2,'0');

  var { data } = await 수파베이스.from('특수근태')
    .select('*, 직원정보(이름,직급)')
    .gte('날짜', 시작).lte('날짜', 끝)
    .order('날짜');

  var tbody = document.getElementById('특수근태바디');
  if (!tbody) return;
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#9ca3af;">등록된 항목이 없습니다</td></tr>';
    return;
  }
  tbody.innerHTML = (data || []).map(function(r) {
    var 직원명 = r.직원정보 ? (r.직원정보.직급 ? r.직원정보.직급+' ' : '')+r.직원정보.이름 : '-';
    return '<tr>' +
      '<td>'+날짜포맷(r.날짜)+' ('+요일명(r.날짜)+')</td>' +
      '<td>'+직원명+'</td>' +
      '<td>'+r.종류+'</td>' +
      '<td>'+(r.시간 > 0 ? r.시간+'h' : '-')+'</td>' +
      '<td><button class="소버튼 삭제" onclick="특수근태삭제('+r.id+')">삭제</button></td>' +
    '</tr>';
  }).join('');
}

/* ══════════════════════════════════════════════════
   탭3 — 공휴일 관리
══════════════════════════════════════════════════ */

async function 공휴일목록불러오기() {
  var { data } = await 수파베이스.from('공휴일').select('*').order('날짜');
  _공휴일목록 = data || [];
}

function 공휴일목록그리기() {
  var now = new Date();
  var 올해 = document.getElementById('공휴일년도') ? document.getElementById('공휴일년도').value : now.getFullYear();
  var tbody = document.getElementById('공휴일바디');
  if (!tbody) return;
  var 해당연도 = _공휴일목록.filter(function(h) { return h.날짜.startsWith(String(올해)); });
  if (해당연도.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#9ca3af;">등록된 공휴일이 없습니다</td></tr>';
    return;
  }
  tbody.innerHTML = 해당연도.map(function(h) {
    return '<tr>' +
      '<td>'+h.날짜+' ('+요일명(h.날짜)+')</td>' +
      '<td>'+h.명칭+'</td>' +
      '<td><button class="소버튼 삭제" onclick="공휴일삭제('+h.id+')">삭제</button></td>' +
    '</tr>';
  }).join('');
}

async function 공휴일추가() {
  var 날짜 = document.getElementById('공휴일날짜').value;
  var 명칭 = document.getElementById('공휴일명칭').value.trim();
  if (!날짜 || !명칭) { 알림('날짜와 명칭을 입력하세요.', '오류'); return; }
  var { error } = await 수파베이스.from('공휴일').insert({ 날짜: 날짜, 명칭: 명칭 });
  if (error) { 알림('추가 실패: ' + error.message, '오류'); return; }
  document.getElementById('공휴일날짜').value = '';
  document.getElementById('공휴일명칭').value = '';
  await 공휴일목록불러오기();
  공휴일목록그리기();
  알림('추가되었습니다.', '성공');
}

async function 공휴일삭제(id) {
  await 수파베이스.from('공휴일').delete().eq('id', id);
  await 공휴일목록불러오기();
  공휴일목록그리기();
}

/* ══════════════════════════════════════════════════
   탭4 — 급여 계산
══════════════════════════════════════════════════ */

function 급여계산화면초기화() {
  var now = new Date();
  var el = document.getElementById('급여계산년월');
  if (el && !el.value) el.value = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
}

async function 급여계산실행() {
  var 년월 = document.getElementById('급여계산년월').value;
  if (!년월) { 알림('년월을 선택하세요.', '오류'); return; }
  if (_직원목록.length === 0) { 알림('등록된 직원이 없습니다.', '오류'); return; }

  알림('계산 중...', '정보');
  var [년, 월] = 년월.split('-').map(Number);
  var 일수 = new Date(년, 월, 0).getDate();

  // 해당 월 전체 데이터 조회
  var [출퇴근결과, 특수결과] = await Promise.all([
    수파베이스.from('출퇴근기록').select('*').eq('년월', 년월),
    수파베이스.from('특수근태').select('*').gte('날짜', 년월+'-01').lte('날짜', 년월+'-'+String(일수).padStart(2,'0'))
  ]);
  var 출퇴근전체 = 출퇴근결과.data || [];
  var 특수전체 = 특수결과.data || [];

  var 결과목록 = [];
  for (var i = 0; i < _직원목록.length; i++) {
    var 직원 = _직원목록[i];
    var 출퇴근 = 출퇴근전체.filter(function(r) { return r.직원id === 직원.id; });
    var 특수 = 특수전체.filter(function(r) { return r.직원id === 직원.id; });
    var 결과 = _급여계산(직원, 출퇴근, 특수, 년, 월, 일수);
    결과목록.push({ 직원: 직원, 결과: 결과 });

    // DB upsert
    await 수파베이스.from('급여결과').upsert({
      직원id: 직원.id, 년월: 년월,
      정규시간: 결과.정규시간,
      연장시간: 결과.연장시간,
      주말시간: 결과.주말시간,
      연차시간: 결과.연차시간,
      공제시간: 결과.공제시간,
      기본급: 결과.기본급,
      연장수당: 결과.연장수당,
      주말수당: 결과.주말수당,
      공제액: 결과.공제액,
      소득세: 결과.소득세,
      실수령액: 결과.실수령액,
      상세내역: 결과.상세내역
    }, { onConflict: '직원id,년월' });
  }

  급여결과표그리기(결과목록);
  알림('계산 완료', '성공');
}

function _급여계산(직원, 출퇴근목록, 특수목록, 년, 월, 일수) {
  var 시급 = Number(직원.시급);
  var 정규분 = 0, 연장분 = 0, 주말분 = 0, 연차분 = 0, 공제분 = 0;
  var 상세내역 = [];

  var 출근분 = WORK.출근.h*60 + WORK.출근.m;    // 510 (08:30)
  var 퇴근분 = WORK.퇴근.h*60 + WORK.퇴근.m;    // 1050 (17:30)
  var 연장시작분 = WORK.연장시작.h*60 + WORK.연장시작.m; // 1080 (18:00)
  var 점심시작분 = WORK.점심시작.h*60 + WORK.점심시작.m; // 720 (12:00)
  var 점심끝분 = WORK.점심끝.h*60 + WORK.점심끝.m;       // 780 (13:00)

  for (var d = 1; d <= 일수; d++) {
    var 날짜str = 년+'-'+String(월).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    var 주말 = 주말인가(날짜str);
    var 공휴일 = 공휴일인가(날짜str);
    var 비근무일 = 주말 || 공휴일;

    var 출퇴 = 출퇴근목록.find(function(r) { return r.날짜 === 날짜str; });
    var 당일특수 = 특수목록.filter(function(r) { return r.날짜 === 날짜str; });

    var 결근 = 당일특수.some(function(r) { return r.종류 === '결근'; });
    var 연차 = 당일특수.find(function(r) { return r.종류 === '연차'; });
    var 반차 = 당일특수.find(function(r) { return r.종류 === '반차'; });
    var 외출목록 = 당일특수.filter(function(r) { return r.종류 === '외출' || r.종류 === '조퇴'; });

    if (!비근무일) {
      // 결근
      if (결근) {
        공제분 += WORK.정규시간 * 60;
        상세내역.push({ 날짜: 날짜str, 비고: '결근', 공제분: WORK.정규시간*60 });
        continue;
      }
      // 연차
      if (연차) { 연차분 += WORK.정규시간 * 60; }
      // 반차
      if (반차) { 연차분 += (WORK.정규시간 / 2) * 60; }
      // 외출/조퇴 공제
      외출목록.forEach(function(s) { 공제분 += s.시간 * 60; });
    }

    if (!출퇴 || !출퇴.출근시간 || !출퇴.퇴근시간) continue;

    var 실출근 = 분변환(출퇴.출근시간);
    var 실퇴근 = 분변환(출퇴.퇴근시간);
    if (실출근 === null || 실퇴근 === null) continue;

    if (비근무일) {
      // 주말/공휴일 근무 → 전체 1.5배
      var 근무분 = 실퇴근 - 실출근;
      // 점심시간 겹치면 차감
      if (실출근 < 점심끝분 && 실퇴근 > 점심시작분) {
        근무분 -= Math.min(실퇴근, 점심끝분) - Math.max(실출근, 점심시작분);
      }
      근무분 = Math.max(0, 근무분);
      주말분 += 근무분;
      상세내역.push({ 날짜: 날짜str, 비고: 공휴일 ? '공휴일근무' : '주말근무', 주말분: 근무분 });
    } else {
      // 평일
      var 유효출근 = Math.max(실출근, 출근분); // 08:30 이전 무시
      if (유효출근 >= 실퇴근) continue;

      // 정규 구간: 08:30 ~ 17:30
      var 정규끝 = Math.min(실퇴근, 퇴근분);
      var 오늘정규 = Math.max(0, 정규끝 - 유효출근);
      // 점심 차감
      if (유효출근 < 점심끝분 && 정규끝 > 점심시작분) {
        var 점심겹침 = Math.min(정규끝, 점심끝분) - Math.max(유효출근, 점심시작분);
        오늘정규 -= Math.max(0, 점심겹침);
      }
      정규분 += Math.max(0, 오늘정규);

      // 연장 구간: 18:00 이후
      if (실퇴근 > 연장시작분) {
        연장분 += 실퇴근 - 연장시작분;
      }

      상세내역.push({ 날짜: 날짜str, 출근: 출퇴.출근시간, 퇴근: 출퇴.퇴근시간,
        정규분: Math.max(0,오늘정규), 연장분: 실퇴근>연장시작분?실퇴근-연장시작분:0 });
    }
  }

  var 정규시간 = 정규분/60, 연장시간 = 연장분/60, 주말시간 = 주말분/60;
  var 연차시간 = 연차분/60, 공제시간 = 공제분/60;

  var 기본급 = (정규시간 + 연차시간) * 시급;
  var 연장수당 = 연장시간 * 시급 * WORK.연장배율;
  var 주말수당 = 주말시간 * 시급 * WORK.주말배율;
  var 공제액 = 공제시간 * 시급;
  var 소계 = 기본급 + 연장수당 + 주말수당 - 공제액;
  var 소득세 = Math.round(소계 * WORK.소득세율);
  var 실수령액 = 소계 - 소득세;

  return { 정규시간, 연장시간, 주말시간, 연차시간, 공제시간,
    기본급, 연장수당, 주말수당, 공제액, 소득세, 실수령액, 상세내역 };
}

function 급여결과표그리기(목록) {
  var tbody = document.getElementById('급여결과바디');
  if (!tbody) return;
  if (목록.length === 0) { tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">데이터 없음</td></tr>'; return; }
  tbody.innerHTML = 목록.map(function(item) {
    var r = item.결과;
    return '<tr>' +
      '<td>'+(item.직원.직급?item.직급+' ':'')+item.직원.이름+'</td>' +
      '<td style="text-align:right;">'+Number(item.직원.시급).toLocaleString()+'</td>' +
      '<td style="text-align:right;">'+r.정규시간.toFixed(1)+'h</td>' +
      '<td style="text-align:right;">'+r.연장시간.toFixed(1)+'h</td>' +
      '<td style="text-align:right;">'+원화표시(r.기본급)+'</td>' +
      '<td style="text-align:right;">'+원화표시(r.연장수당+r.주말수당)+'</td>' +
      '<td style="text-align:right;color:#ef4444;">-'+원화표시(r.공제액+r.소득세)+'</td>' +
      '<td style="text-align:right;font-weight:700;">'+원화표시(r.실수령액)+'</td>' +
      '<td><button class="소버튼" onclick="명세서보기('+item.직원.id+')">명세서</button></td>' +
    '</tr>';
  }).join('');
}

/* ══════════════════════════════════════════════════
   탭5 — 명세서
══════════════════════════════════════════════════ */

function 명세서화면초기화() {
  var sel = document.getElementById('명세서직원선택');
  if (!sel) return;
  sel.innerHTML = '<option value="">직원 선택</option>' +
    _직원목록.map(function(e) {
      return '<option value="'+e.id+'">'+(e.직급?e.직급+' ':'')+e.이름+'</option>';
    }).join('');
  var now = new Date();
  var el = document.getElementById('명세서년월');
  if (el && !el.value) el.value = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
}

function 명세서보기(직원id) {
  급여탭선택('명세서');
  document.getElementById('명세서직원선택').value = 직원id;
  명세서조회();
}

async function 명세서조회() {
  var 직원id = parseInt(document.getElementById('명세서직원선택').value);
  var 년월 = document.getElementById('명세서년월').value;
  if (!직원id || !년월) { 알림('직원과 년월을 선택하세요.', '오류'); return; }

  var [급여결과, 출퇴결과, 특수결과] = await Promise.all([
    수파베이스.from('급여결과').select('*').eq('직원id', 직원id).eq('년월', 년월).maybeSingle(),
    수파베이스.from('출퇴근기록').select('*').eq('직원id', 직원id).eq('년월', 년월).order('날짜'),
    수파베이스.from('특수근태').select('*').eq('직원id', 직원id)
      .gte('날짜', 년월+'-01').lte('날짜', 년월+'-31').order('날짜')
  ]);

  var 직원 = _직원목록.find(function(e) { return e.id === 직원id; });
  var 급여 = 급여결과.data;
  var 출퇴 = 출퇴결과.data || [];
  var 특수 = 특수결과.data || [];

  명세서렌더링(직원, 급여, 출퇴, 특수, 년월);
}

function 명세서렌더링(직원, 급여, 출퇴, 특수, 년월) {
  var el = document.getElementById('명세서내용');
  if (!el) return;
  if (!직원) { el.innerHTML = '<p style="color:#9ca3af;text-align:center;">직원 정보 없음</p>'; return; }
  if (!급여) { el.innerHTML = '<p style="color:#9ca3af;text-align:center;">급여 계산을 먼저 실행하세요.</p>'; return; }

  var 출퇴맵 = {};
  출퇴.forEach(function(r) { 출퇴맵[r.날짜] = r; });
  var 특수맵 = {};
  특수.forEach(function(r) {
    if (!특수맵[r.날짜]) 특수맵[r.날짜] = [];
    특수맵[r.날짜].push(r);
  });

  var [년, 월] = 년월.split('-').map(Number);
  var 일수 = new Date(년, 월, 0).getDate();
  var 근무행 = '';
  for (var d = 1; d <= 일수; d++) {
    var 날짜str = 년+'-'+String(월).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    var 주말 = 주말인가(날짜str);
    var 공휴 = 공휴일인가(날짜str);
    var r = 출퇴맵[날짜str];
    var sp = 특수맵[날짜str] || [];
    var 비고 = sp.map(function(s){ return s.종류+(s.시간>0?'('+s.시간+'h)':''); }).join(' ');
    if (!r && !비고 && !주말 && !공휴) continue;
    근무행 += '<tr style="'+(주말||공휴?'color:#6b7280;':'')+'">' +
      '<td>'+날짜포맷(날짜str)+'</td>' +
      '<td>'+요일명(날짜str)+'</td>' +
      '<td>'+(r&&r.출근시간?r.출근시간:'-')+'</td>' +
      '<td>'+(r&&r.퇴근시간?r.퇴근시간:'-')+'</td>' +
      '<td>'+(공휴 ? '공휴일' : 비고 || (주말?'주말':''))+'</td>' +
    '</tr>';
  }

  el.innerHTML =
    '<div class="명세서헤더">' +
      '<h3>급여 명세서</h3>' +
      '<p>'+직원.이름+' '+(직원.직급||'')+'&nbsp;&nbsp;|&nbsp;&nbsp;'+년월+'</p>' +
    '</div>' +
    '<table class="명세서테이블">' +
      '<tr><th>날짜</th><th>요일</th><th>출근</th><th>퇴근</th><th>비고</th></tr>' +
      근무행 +
    '</table>' +
    '<div class="명세서합계">' +
      '<div class="명세서행"><span>시급</span><span>'+Number(직원.시급).toLocaleString()+'원</span></div>' +
      '<div class="명세서행"><span>정규 근무시간</span><span>'+급여.정규시간.toFixed(1)+'h</span></div>' +
      '<div class="명세서행"><span>연장 근무시간</span><span>'+급여.연장시간.toFixed(1)+'h</span></div>' +
      (급여.주말시간>0?'<div class="명세서행"><span>주말/공휴일 근무</span><span>'+급여.주말시간.toFixed(1)+'h</span></div>':'')+
      (급여.연차시간>0?'<div class="명세서행"><span>연차/반차</span><span>'+급여.연차시간.toFixed(1)+'h</span></div>':'')+
      '<hr>' +
      '<div class="명세서행"><span>기본급</span><span>'+원화표시(급여.기본급)+'</span></div>' +
      '<div class="명세서행"><span>연장수당</span><span>'+원화표시(급여.연장수당)+'</span></div>' +
      (급여.주말수당>0?'<div class="명세서행"><span>주말수당</span><span>'+원화표시(급여.주말수당)+'</span></div>':'')+
      '<div class="명세서행" style="color:#ef4444;"><span>외출/조퇴 공제</span><span>-'+원화표시(급여.공제액)+'</span></div>' +
      '<div class="명세서행" style="color:#ef4444;"><span>소득세(3.3%)</span><span>-'+원화표시(급여.소득세)+'</span></div>' +
      '<div class="명세서행 합계"><span>실수령액</span><span>'+원화표시(급여.실수령액)+'</span></div>' +
    '</div>';
}

/* ══════════════════════════════════════════════════
   초기화
══════════════════════════════════════════════════ */

async function 급여관리초기화() {
  await Promise.all([직원목록불러오기(), 공휴일목록불러오기()]);
  급여탭선택('직원');
}
