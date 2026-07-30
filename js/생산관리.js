/* =====================================================
   생산관리.js - 생산관리 시스템
   ===================================================== */

var _작업목록 = [];
var _업체마스터 = [];   // [{코드, 업체명}] — 업체 테이블 캐시
var _현재상태필터 = '';  // '' = 전체 (통계카드 클릭 시 사용)
var _필터_시작일  = '';
var _필터_종료일  = '';
var _필터_업체    = '';
var _필터_작업번호 = '';
var _필터_담당자  = '';

/* ── WO 번호 자동 생성 ── */
async function WO번호생성() {
  var d = new Date();
  var 날짜str = d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  var prefix = 'WO-' + 날짜str + '-';

  var { data } = await 수파베이스.from('작업')
    .select('작업번호')
    .like('작업번호', prefix + '%')
    .order('작업번호', { ascending: false })
    .limit(1);

  var 순번 = 1;
  if (data && data.length > 0) {
    var parts = data[0].작업번호.split('-');
    순번 = (parseInt(parts[parts.length - 1]) || 0) + 1;
  }
  return prefix + String(순번).padStart(3, '0');
}

/* ── 업체 마스터 로드 ── */
async function 업체마스터로드() {
  var { data } = await 수파베이스.from('업체').select('코드,업체명').order('코드');
  _업체마스터 = data || [];
}

/* ── 작업 목록 로드 ── */
async function 작업목록로드() {
  var [작업res] = await Promise.all([
    수파베이스.from('작업').select('*').order('created_at', { ascending: false }),
    업체마스터로드()
  ]);
  if (작업res.error) { console.error(작업res.error); return; }
  _작업목록 = 작업res.data || [];
  담당자목록업데이트();
  작업목록렌더링();
  통계업데이트();
}

/* ── 담당자 필터 select 갱신 ── */
function 담당자목록업데이트() {
  var el = document.getElementById('필터_담당자');
  if (!el) return;
  var seen = {};
  _작업목록.forEach(function(r){ if (r.담당자) seen[r.담당자] = true; });
  var 목록 = Object.keys(seen).sort();
  var 현재값 = el.value;
  el.innerHTML = '<option value="">전체 담당자</option>' +
    목록.map(function(d){ return '<option value="' + d + '">' + d + '</option>'; }).join('');
  if (현재값) el.value = 현재값;
}

/* ── 통계 카드 업데이트 ── */
function 통계업데이트() {
  var 입고     = _작업목록.filter(function(r){ return r.상태 === '진행중'; }).length;
  var 진행중   = _작업목록.filter(function(r){ return r.상태 === '출하대기'; }).length;
  var 작업완료 = _작업목록.filter(function(r){ return r.상태 === '작업완료'; }).length;
  var 출하     = _작업목록.filter(function(r){ return r.상태 === '완료'; }).length;
  var el입고     = document.getElementById('통계_입고');
  var el진행중   = document.getElementById('통계_진행중');
  var el작업완료 = document.getElementById('통계_작업완료');
  var el출하     = document.getElementById('통계_출하');
  if (el입고)     el입고.textContent     = 입고;
  if (el진행중)   el진행중.textContent   = 진행중;
  if (el작업완료) el작업완료.textContent = 작업완료;
  if (el출하)     el출하.textContent     = 출하;
}

/* ── 목록 렌더링 ── */
function 작업목록렌더링() {
  var _DB상태 = { '입고': '진행중', '진행중': '출하대기', '작업완료': '작업완료', '출하': '완료' };
  var filtered = _현재상태필터
    ? _작업목록.filter(function(r){ return r.상태 === (_DB상태[_현재상태필터] || _현재상태필터); })
    : _작업목록.slice();

  if (_필터_시작일) {
    filtered = filtered.filter(function(r){ return r.입고일 && r.입고일 >= _필터_시작일; });
  }
  if (_필터_종료일) {
    filtered = filtered.filter(function(r){ return r.입고일 && r.입고일 <= _필터_종료일; });
  }
  if (_필터_업체) {
    var 키워드 = _필터_업체.toLowerCase().trim();
    var 코드일치 = _업체마스터.find(function(u){ return u.코드.toLowerCase() === 키워드; });
    if (코드일치) {
      filtered = filtered.filter(function(r){ return (r.업체||'') === 코드일치.업체명; });
    } else {
      filtered = filtered.filter(function(r){ return (r.업체||'').toLowerCase().indexOf(키워드) >= 0; });
    }
  }
  if (_필터_작업번호) {
    var wo키워드 = _필터_작업번호.toLowerCase();
    filtered = filtered.filter(function(r){ return (r.작업번호 || '').toLowerCase().indexOf(wo키워드) >= 0; });
  }
  if (_필터_담당자) {
    filtered = filtered.filter(function(r){ return (r.담당자 || '') === _필터_담당자; });
  }

  var tbody = document.getElementById('작업목록바디');
  if (!tbody) return;

  _검색결과안내업데이트();

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="빈목록안내">등록된 작업이 없습니다.</td></tr>';
    return;
  }

  var 오늘 = new Date();
  오늘.setHours(0, 0, 0, 0);

  tbody.innerHTML = filtered.map(function(r) {
    var 납기d = r.납기일 ? new Date(r.납기일) : null;
    var 납기임박 = 납기d && r.상태 !== '완료' && (납기d - 오늘) / (1000 * 60 * 60 * 24) <= 3;
    var 상태표시 = r.상태 === '진행중' ? '입고' : r.상태 === '출하대기' ? '진행중' : r.상태 === '완료' ? '출하' : r.상태;
    var 상태색   = r.상태 === '완료' ? '#27ae60' : r.상태 === '작업완료' ? '#8b5cf6' : r.상태 === '출하대기' ? '#f97316' : '#6B7280';
    var 상태배경 = r.상태 === '완료' ? '#eafaf1' : r.상태 === '작업완료' ? '#f5f3ff' : r.상태 === '출하대기' ? '#fff7ed' : '#F3F4F6';
    var 납기표시 = r.납기일 ? r.납기일 : '-';

    var 사진아이콘 = r.사진url
      ? '<span title="입고사진 있음" style="font-size:14px;vertical-align:middle;margin-left:4px;cursor:pointer;" ' +
          'onclick="event.stopPropagation();사진크게보기(\'' + r.사진url.replace(/'/g, "\\'") + '\')">📷</span>'
      : '';

    return '<tr style="cursor:pointer;" onclick="작업상세이동(\'' + r.작업번호 + '\')">' +
      '<td style="text-align:left;padding-left:14px;">' +
        '<b style="color:#1a3a5c;font-size:13px;letter-spacing:0.3px;">' + r.작업번호 + '</b>' +
        사진아이콘 +
      '</td>' +
      '<td>' + (r.업체 || '-') + '</td>' +
      '<td>' + (r.품목 || '-') + '</td>' +
      '<td class="hide-mobile" style="font-variant-numeric:tabular-nums;">' + (r.입고수량 || 0).toLocaleString() + ' EA</td>' +
      '<td class="hide-mobile" style="font-size:12px;color:#6B7280;">' + (r.입고일 || '-') + '</td>' +
      '<td>' +
        '<span style="background:' + 상태배경 + ';color:' + 상태색 + ';' +
          'padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">' +
          상태표시 +
        '</span>' +
      '</td>' +
      '<td class="hide-mobile"' + (납기임박 ? ' style="color:#c0392b;font-weight:700;"' : '') + '>' +
        납기표시 +
      '</td>' +
      '<td class="hide-mobile">' + (r.담당자 || '-') + '</td>' +
      '<td style="text-align:center;">' +
        '<div style="display:flex;gap:4px;justify-content:center;">' +
          '<button class="버튼 파랑 소형" style="padding:0 10px;" ' +
            'onclick="event.stopPropagation(); 수정버튼클릭(\'' + r.작업번호 + '\')">수정</button>' +
          '<button class="버튼 회색 소형" style="padding:0 10px;" ' +
            'onclick="event.stopPropagation(); QR출력(\'' + r.작업번호 + '\')">QR</button>' +
          '<button class="버튼 빨강 소형" style="padding:0 10px;" ' +
            'onclick="event.stopPropagation(); 작업삭제(\'' + r.작업번호 + '\')">삭제</button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }).join('');
}

/* ── 검색결과 안내 업데이트 ── */
function _검색결과안내업데이트() {
  var el = document.getElementById('검색결과안내');
  if (!el) return;
  var _DB상태 = { '입고': '진행중', '진행중': '출하대기', '작업완료': '작업완료', '출하': '완료' };
  var 기준목록 = _현재상태필터
    ? _작업목록.filter(function(r){ return r.상태 === (_DB상태[_현재상태필터] || _현재상태필터); })
    : _작업목록;
  var 필터목록 = 기준목록;
  if (_필터_시작일)   필터목록 = 필터목록.filter(function(r){ return r.입고일 && r.입고일 >= _필터_시작일; });
  if (_필터_종료일)   필터목록 = 필터목록.filter(function(r){ return r.입고일 && r.입고일 <= _필터_종료일; });
  if (_필터_업체)     필터목록 = 필터목록.filter(function(r){ return (r.업체||'').toLowerCase().indexOf(_필터_업체.toLowerCase()) >= 0; });
  if (_필터_작업번호) 필터목록 = 필터목록.filter(function(r){ return (r.작업번호||'').toLowerCase().indexOf(_필터_작업번호.toLowerCase()) >= 0; });
  if (_필터_담당자)   필터목록 = 필터목록.filter(function(r){ return (r.담당자||'') === _필터_담당자; });
  var 라벨 = _현재상태필터 || '전체';
  el.innerHTML = 라벨 + ' <span class="결과강조">' + 필터목록.length + '건</span>' +
    (필터목록.length !== 기준목록.length ? ' / ' + 라벨 + ' 합계 ' + 기준목록.length + '건' : '');
}

/* ── 필터 조회 / 전체보기 ── */
function 필터조회() {
  _필터_시작일   = (document.getElementById('필터_시작일') || {}).value || '';
  _필터_종료일   = (document.getElementById('필터_종료일') || {}).value || '';
  _필터_업체     = ((document.getElementById('필터_업체') || {}).value || '').trim();
  _필터_작업번호 = ((document.getElementById('필터_작업번호') || {}).value || '').trim();
  var 담당자el   = document.getElementById('필터_담당자');
  _필터_담당자   = 담당자el ? 담당자el.value : '';
  작업목록렌더링();
}

function 전체보기() {
  _필터_시작일 = ''; _필터_종료일 = ''; _필터_업체 = ''; _필터_작업번호 = ''; _필터_담당자 = ''; _현재상태필터 = '';
  ['필터_시작일','필터_종료일','필터_업체','필터_작업번호'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.value = '';
  });
  var 담당자el = document.getElementById('필터_담당자'); if (담당자el) 담당자el.value = '';
  ['업체자동완성_드롭다운','입력업체_드롭다운'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  작업목록렌더링();
}

/* ── 사진 크게 보기 (목록에서 📷 클릭 시) ── */
function 사진크게보기(url) {
  var ov = document.getElementById('사진크게보기_오버레이');
  var img = document.getElementById('사진크게보기_이미지');
  if (!ov || !img) return;
  img.src = url;
  ov.style.display = 'flex';
}

function 사진크게보기닫기() {
  var ov = document.getElementById('사진크게보기_오버레이');
  if (ov) ov.style.display = 'none';
}

/* ── 상태 필터 (통계 카드 클릭 시) ── */
function 상태필터변경(상태) {
  _현재상태필터 = 상태;
  작업목록렌더링();
}

/* ── 수정 모드 상태 ── */
var _수정모드 = false;
var _수정WO   = null;

/* ── 사진 미리보기 ── */
function 사진미리보기() {
  var file = document.getElementById('입력_사진').files[0];
  var 박스 = document.getElementById('사진미리보기박스');
  var img  = document.getElementById('사진미리보기이미지');
  if (!file) { 박스.style.display = 'none'; return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    img.src = e.target.result;
    박스.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

/* ── 폼 초기화 ── */
function 입고폼초기화() {
  _수정모드 = false;
  _수정WO   = null;

  ['입력_업체','입력_품목','입력_납기일'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.value = '';
  });
  ['입력_입고수량','입력_출고수량'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.value = '';
  });
  var 입고일el = document.getElementById('입력_입고일');
  if (입고일el) 입고일el.value = new Date().toISOString().slice(0, 10);
  var 세션 = 현재세션();
  var 담당자el = document.getElementById('입력_담당자');
  if (담당자el) 담당자el.value = 세션 ? (세션.직급 + ' ' + 세션.사원명) : '';
  var WO표시el = document.getElementById('입력_WO표시');
  if (WO표시el) WO표시el.value = '';

  ['입력업체_드롭다운','품명자동완성_드롭다운'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.style.display = 'none';
  });

  // UI 복원
  var 제목el = document.getElementById('입고폼제목'); if (제목el) 제목el.textContent = '입고 등록';
  var 저장btn = document.getElementById('입고저장버튼'); if (저장btn) 저장btn.textContent = '저장';
  var 취소btn = document.getElementById('수정취소버튼'); if (취소btn) 취소btn.style.display = 'none';
}

/* ── Enter 다음 셀 이동 ── */
function 다음셀이동(e, 다음ID) {
  if (e.key === 'Enter') {
    e.preventDefault();
    var el = document.getElementById(다음ID);
    if (el) el.focus();
  }
}

/* ── 일자 Enter → 오늘 날짜 자동입력 후 이동 ── */
function 일자엔터처리(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    var el = document.getElementById('입력_입고일');
    if (el && !el.value) el.value = new Date().toISOString().slice(0, 10);
    var 다음 = document.getElementById('입력_업체');
    if (다음) 다음.focus();
  }
}

/* ── 입고수량 변경 시 출고수량 자동기입 ── */
function 출고수량자동기입(값) {
  var 출고el = document.getElementById('입력_출고수량');
  if (출고el) 출고el.value = 값;
}

/* ── 입고 저장 / 수정 저장 ── */
async function 입고저장() {
  if (_수정모드) { await _수정저장(); return; }

  var 업체     = document.getElementById('입력_업체').value.trim();
  var 품목     = document.getElementById('입력_품목').value.trim();
  var 입고수량 = parseInt(document.getElementById('입력_입고수량').value) || 0;
  var 입고일   = document.getElementById('입력_입고일').value;
  var 납기일   = document.getElementById('입력_납기일').value;
  var 담당자   = document.getElementById('입력_담당자').value.trim();
  var 메모     = '';

  if (!업체)     { 생산알림표시('업체를 입력해주세요.', '오류'); return; }
  if (!품목)     { 생산알림표시('품목을 입력해주세요.', '오류'); return; }
  if (!입고수량) { 생산알림표시('입고수량을 입력해주세요.', '오류'); return; }
  if (!입고일)   { 생산알림표시('입고일을 입력해주세요.', '오류'); return; }

  var btn = document.getElementById('입고저장버튼');
  btn.disabled = true; btn.textContent = '저장 중...';

  try {
    var WO = await WO번호생성();

    var 사진url = null;

    var 출고수량 = parseInt(document.getElementById('입력_출고수량').value) || 0;
    var { error } = await 수파베이스.from('작업').insert({
      작업번호: WO, 업체: 업체, 품목: 품목, 입고수량: 입고수량, 출고수량: 출고수량,
      입고일: 입고일 || null, 납기일: 납기일 || null,
      담당자: 담당자, 메모: 메모, 사진url: 사진url, 상태: '진행중'
    });
    if (error) throw error;

    입고폼초기화();
    await 작업목록로드();
    QR출력(WO);
    생산알림표시(WO + '  입고 등록 완료', '성공');
  } catch(e) {
    console.error(e);
    생산알림표시('저장 오류: ' + (e.message || e), '오류');
  } finally {
    btn.disabled = false; btn.textContent = '저장';
  }
}

async function _수정저장() {
  var 업체     = document.getElementById('입력_업체').value.trim();
  var 품목     = document.getElementById('입력_품목').value.trim();
  var 입고수량 = parseInt(document.getElementById('입력_입고수량').value) || 0;
  var 입고일   = document.getElementById('입력_입고일').value;
  var 납기일   = document.getElementById('입력_납기일').value;
  var 담당자   = document.getElementById('입력_담당자').value.trim();
  var 메모     = '';

  if (!업체)     { 생산알림표시('업체를 입력해주세요.', '오류'); return; }
  if (!품목)     { 생산알림표시('품목을 입력해주세요.', '오류'); return; }
  if (!입고수량) { 생산알림표시('입고수량을 입력해주세요.', '오류'); return; }
  if (!입고일)   { 생산알림표시('입고일을 입력해주세요.', '오류'); return; }

  var btn = document.getElementById('입고저장버튼');
  btn.disabled = true; btn.textContent = '저장 중...';

  try {
    var 출고수량 = parseInt(document.getElementById('입력_출고수량').value) || 0;
    var { error } = await 수파베이스.from('작업').update({
      업체: 업체, 품목: 품목, 입고수량: 입고수량, 출고수량: 출고수량,
      입고일: 입고일 || null, 납기일: 납기일 || null,
      담당자: 담당자, 메모: 메모
    }).eq('작업번호', _수정WO);
    if (error) throw error;

    var WO = _수정WO;
    입고폼초기화();
    await 작업목록로드();
    생산알림표시(WO + '  수정 완료', '성공');
  } catch(e) {
    console.error(e);
    생산알림표시('수정 오류: ' + (e.message || e), '오류');
  } finally {
    btn.disabled = false; btn.textContent = '수정 저장';
  }
}

/* ── 수정 버튼 클릭 ── */
function 수정버튼클릭(WO번호) {
  var 행 = _작업목록.find(function(r){ return r.작업번호 === WO번호; });
  if (!행) return;

  _수정모드 = true;
  _수정WO   = WO번호;

  document.getElementById('입력_업체').value     = 행.업체     || '';
  document.getElementById('입력_품목').value     = 행.품목     || '';
  document.getElementById('입력_입고수량').value  = 행.입고수량 || '';
  document.getElementById('입력_출고수량').value  = 행.출고수량 || '';
  document.getElementById('입력_입고일').value   = 행.입고일   || '';
  document.getElementById('입력_납기일').value   = 행.납기일   || '';
  document.getElementById('입력_담당자').value   = 행.담당자   || '';
  document.getElementById('입력_메모').value     = 행.메모     || '';
  var WO표시el = document.getElementById('입력_WO표시');
  if (WO표시el) WO표시el.value = WO번호;

  var 제목el = document.getElementById('입고폼제목');
  if (제목el) 제목el.textContent = '입고 수정 — ' + WO번호;
  var 저장btn = document.getElementById('입고저장버튼');
  if (저장btn) 저장btn.textContent = '수정 저장';
  var 취소btn = document.getElementById('수정취소버튼');
  if (취소btn) 취소btn.style.display = '';

  var 카드 = document.getElementById('입고등록카드');
  if (카드) 카드.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── 이번달 필터 ── */
function 이번달필터() {
  var now = new Date();
  var y = now.getFullYear();
  var m = String(now.getMonth() + 1).padStart(2, '0');
  var 시작 = y + '-' + m + '-01';
  var 마지막날 = new Date(y, now.getMonth() + 1, 0).getDate();
  var 종료 = y + '-' + m + '-' + String(마지막날).padStart(2, '0');
  var 시작el = document.getElementById('필터_시작일'); if (시작el) 시작el.value = 시작;
  var 종료el = document.getElementById('필터_종료일'); if (종료el) 종료el.value = 종료;
  _필터_시작일 = 시작; _필터_종료일 = 종료;
  작업목록렌더링();
}

/* ── 작업 상세 이동 ── */
function 작업상세이동(WO) {
  location.href = '작업상세.html?wo=' + encodeURIComponent(WO);
}

/* ── 확인 모달 ── */
function 확인모달표시(메시지, 제목, 콜백) {
  var el제목 = document.getElementById('확인모달_제목');
  var el메시지 = document.getElementById('확인모달_메시지');
  var el버튼 = document.getElementById('확인모달_확인버튼');
  if (!el메시지 || !el버튼) { if (confirm(메시지)) 콜백(); return; }
  if (el제목) el제목.textContent = 제목 || '삭제 확인';
  el메시지.textContent = 메시지;
  el버튼.onclick = function() { 확인모달닫기(); 콜백(); };
  document.getElementById('확인모달_오버레이').style.display = 'flex';
}

function 확인모달닫기() {
  var ov = document.getElementById('확인모달_오버레이');
  if (ov) ov.style.display = 'none';
}

/* ── 작업 삭제 ── */
async function 작업삭제(WO번호) {
  var 행 = _작업목록.find(function(r){ return r.작업번호 === WO번호; });
  var 메시지 = '작업 ' + WO번호 + '\n' +
    (행 ? '업체: ' + (행.업체||'') + ' / 품목: ' + (행.품목||'') + '\n' : '') +
    '\n관련 작업실적, 불량, 출하 데이터가 모두 삭제됩니다.';

  확인모달표시(메시지, '작업 삭제', async function() {
    try {
      await Promise.all([
        수파베이스.from('작업실적').delete().eq('작업번호', WO번호),
        수파베이스.from('불량').delete().eq('작업번호', WO번호),
        수파베이스.from('출하').delete().eq('작업번호', WO번호)
      ]);
      var { error } = await 수파베이스.from('작업').delete().eq('작업번호', WO번호);
      if (error) throw error;

      await 작업목록로드();
      생산알림표시(WO번호 + ' 삭제 완료', '성공');
    } catch(e) {
      console.error(e);
      생산알림표시('삭제 오류: ' + (e.message || e), '오류');
    }
  });
}

/* ── QR 출력 팝업 ── */
function QR출력(WO번호) {
  var overlay = document.getElementById('QR팝업_오버레이');
  if (!overlay) return;

  document.getElementById('QR팝업_WO번호').textContent = WO번호;

  var 행 = _작업목록.find(function(r){ return r.작업번호 === WO번호; });
  document.getElementById('QR팝업_업체').textContent = 행 ? (행.업체 || '') : '';
  document.getElementById('QR팝업_품목').textContent = 행 ? (행.품목 || '') : '';
  document.getElementById('QR팝업_수량').textContent = 행 ? ((행.입고수량 || 0).toLocaleString() + ' EA') : '';

  var qrText = window.location.hostname === 'erp-red-five.vercel.app'
    ? 'https://erp-red-five.vercel.app/' + encodeURIComponent('작업상세') + '.html?wo=' + encodeURIComponent(WO번호)
    : WO번호;

  var container = document.getElementById('QR캔버스');
  container.innerHTML = '';
  new QRCode(container, {
    text: qrText,
    width: 200,
    height: 200,
    typeNumber: 10,
    colorDark: '#1a3a5c',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.L
  });

  overlay.style.display = 'flex';
}

function QR팝업닫기() {
  document.getElementById('QR팝업_오버레이').style.display = 'none';
}

function QR인쇄() {
  var WO   = document.getElementById('QR팝업_WO번호').textContent;
  var 행 = _작업목록.find(function(r){ return r.작업번호 === WO; });
  var 업체  = 행 ? (행.업체   || '') : '';
  var 품목  = 행 ? (행.품목   || '') : '';
  var 수량  = 행 ? ((행.입고수량 || 0).toLocaleString() + ' EA') : '';
  var 입고일 = 행 ? (행.입고일  || '') : '';
  var 납기일 = 행 ? (행.납기일  || '') : '';
  var 담당자 = 행 ? (행.담당자  || '') : '';
  var 메모  = 행 ? (행.메모   || '') : '';

  var 캔버스 = document.querySelector('#QR캔버스 canvas');
  var imgData = 캔버스
    ? 캔버스.toDataURL('image/png')
    : (document.querySelector('#QR캔버스 img') || {}).src || '';

  var html =
    '<!DOCTYPE html><html lang="ko"><head>' +
    '<meta charset="UTF-8">' +
    '<title>작업지시서 - ' + WO + '</title>' +
    '<style>' +
      '@page{size:A4 portrait;margin:12mm 14mm;}' +
      '*{margin:0;padding:0;box-sizing:border-box;}' +
      'body{font-family:"맑은 고딕","Malgun Gothic",Arial,sans-serif;font-size:12px;color:#111;}' +

      /* 최상단 헤더 */
      '.헤더{display:grid;grid-template-columns:1fr 150px 110px;border:2px solid #333;}' +
      '.헤더_제목{background:#c8b596;display:flex;align-items:center;justify-content:center;' +
        'font-size:22px;font-weight:700;letter-spacing:8px;padding:16px 20px;}' +
      '.헤더_WO{border-left:1px solid #555;display:flex;flex-direction:column;align-items:center;' +
        'justify-content:center;padding:10px;text-align:center;}' +
      '.헤더_WO_레이블{font-size:10px;color:#666;letter-spacing:1px;margin-bottom:6px;}' +
      '.헤더_WO_번호{font-size:12px;font-weight:700;white-space:nowrap;}' +
      '.헤더_QR{border-left:1px solid #555;display:flex;align-items:center;justify-content:center;padding:8px;}' +
      '.헤더_QR img{width:88px;height:88px;}' +

      /* 정보 테이블 */
      '.정보{width:100%;border-collapse:collapse;border:2px solid #333;border-top:none;table-layout:fixed;}' +
      '.정보 td{border:1px solid #666;padding:7px 10px;font-size:12px;overflow:hidden;}' +
      '.L{background:#f0ead8;font-weight:700;text-align:center;font-size:11px;white-space:nowrap;}' +

      /* 공정 테이블 */
      '.공정{width:100%;border-collapse:collapse;border:2px solid #333;border-top:none;margin-top:-1px;}' +
      '.공정 th{background:#c8b596;border:1px solid #666;padding:9px 4px;text-align:center;' +
        'font-size:12px;font-weight:700;letter-spacing:3px;}' +
      '.공정 td{border:1px solid #666;height:34px;vertical-align:middle;font-size:11px;}' +
      '.SL{background:#f0ead8;font-size:10px;font-weight:700;text-align:center;' +
        'letter-spacing:1px;padding:4px 2px;vertical-align:middle;}' +
      '.확인행 td{height:28px;}' +
      '.반접선{position:fixed;top:50%;left:-20mm;right:-20mm;border-top:3px dashed #aaa;pointer-events:none;}' +
    '</style></head>' +
    '<body onload="window.print();window.close();">' +
    '<div class="반접선"></div>' +

    /* 헤더 */
    '<div class="헤더">' +
      '<div class="헤더_제목">작 업 지 시 서</div>' +
      '<div class="헤더_WO">' +
        '<div class="헤더_WO_레이블">WO NO.</div>' +
        '<div class="헤더_WO_번호">' + WO + '</div>' +
      '</div>' +
      '<div class="헤더_QR"><img src="' + imgData + '"></div>' +
    '</div>' +

    /* 기본 정보 */
    '<table class="정보">' +
      '<colgroup>' +
        '<col style="width:17%"><col style="width:33%"><col style="width:17%"><col style="width:33%">' +
      '</colgroup>' +
      '<tr><td class="L">업 체 명</td><td colspan="3">' + 업체 + '</td></tr>' +
      '<tr><td class="L">품&nbsp;&nbsp;&nbsp;목</td><td colspan="3">' + 품목 + '</td></tr>' +
      '<tr>' +
        '<td class="L">입고수량</td><td>' + 수량 + '</td>' +
        '<td class="L">담 당 자</td><td>' + 담당자 + '</td>' +
      '</tr>' +
      '<tr>' +
        '<td class="L">입 고 일</td><td>' + 입고일 + '</td>' +
        '<td class="L">납 기 일</td><td>' + 납기일 + '</td>' +
      '</tr>' +
      '<tr><td class="L">비&nbsp;&nbsp;&nbsp;고</td><td colspan="3">' + 메모 + '</td></tr>' +
    '</table>' +

    /* 공정 테이블 */
    '<table class="공정">' +
      '<thead><tr>' +
        '<th colspan="2">작 업 실 적</th>' +
        '<th colspan="2">불&nbsp;&nbsp;&nbsp;&nbsp;량</th>' +
        '<th colspan="2">출&nbsp;&nbsp;&nbsp;&nbsp;하</th>' +
        '<th>비&nbsp;&nbsp;&nbsp;&nbsp;고</th>' +
      '</tr></thead>' +
      '<tbody>' +
        '<tr>' +
          '<td class="SL">수 량</td><td class="SL">작업자</td>' +
          '<td class="SL">수 량</td><td class="SL">불량유형</td>' +
          '<td class="SL">수 량</td><td class="SL">출하일</td>' +
          '<td rowspan="4" style="vertical-align:top;padding:6px;font-size:11px;color:#999;"></td>' +
        '</tr>' +
        '<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>' +
        '<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>' +
        '<tr class="확인행">' +
          '<td class="SL">확 인</td><td></td>' +
          '<td class="SL">확 인</td><td></td>' +
          '<td class="SL">확 인</td><td></td>' +
        '</tr>' +
      '</tbody>' +
    '</table>' +

    '</body></html>';

  var win = window.open('', '_blank', 'width=800,height=700');
  win.document.write(html);
  win.document.close();
}

/* ── 알림 표시 ── */
function 생산알림표시(msg, type) {
  var box = document.getElementById('생산알림박스');
  if (!box) return;
  box.textContent = msg;
  box.className = '알림 ' + (type === '성공' ? '성공' : '오류');
  box.style.display = 'block';
  clearTimeout(box._timer);
  box._timer = setTimeout(function(){ box.style.display = 'none'; }, 4000);
}

/* ── Realtime 구독 ── */
function 생산관리실시간구독() {
  수파베이스.channel('생산_작업실시간')
    .on('postgres_changes', { event: '*', schema: 'public', table: '작업' }, function(){
      작업목록로드();
    })
    .subscribe();
}

/* ── 페이지 초기화 ── */
document.addEventListener('DOMContentLoaded', function() {
  작업목록로드();
  생산관리실시간구독();

  // 자동완성 드롭다운 바깥 클릭 시 닫기
  document.addEventListener('click', function(e) {
    [
      { drop: '업체자동완성_드롭다운', input: '필터_업체' },
      { drop: '입력업체_드롭다운',     input: '입력_업체' },
      { drop: '품명자동완성_드롭다운', input: '입력_품목' }
    ].forEach(function(pair) {
      var 드롭다운 = document.getElementById(pair.drop);
      var 입력 = document.getElementById(pair.input);
      if (드롭다운 && 입력 && !드롭다운.contains(e.target) && e.target !== 입력) {
        드롭다운.style.display = 'none';
      }
    });
  });
});

/* ================================================================
   업체 자동완성 (검색카드)
   ================================================================ */
function 업체자동완성표시(값) {
  var 드롭다운 = document.getElementById('업체자동완성_드롭다운');
  if (!드롭다운) return;
  var 키워드 = (값 || '').toLowerCase().trim();
  if (!키워드) { 드롭다운.style.display = 'none'; return; }

  var 결과 = _업체마스터.filter(function(u) {
    return u.코드.toLowerCase().indexOf(키워드) >= 0 ||
           u.업체명.toLowerCase().indexOf(키워드) >= 0;
  });

  if (!결과.length) { 드롭다운.style.display = 'none'; return; }

  드롭다운.innerHTML = 결과.map(function(u) {
    var 안전명 = u.업체명.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return '<div onclick="업체자동완성선택(\'' + 안전명 + '\')" ' +
      'style="display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;" ' +
      'onmouseover="this.style.background=\'#fff7ed\'" onmouseout="this.style.background=\'\'">' +
      '<span style="color:#9CA3AF;font-size:11px;min-width:32px;text-align:right;">[' + u.코드 + ']</span>' +
      '<span style="font-weight:600;color:#1a3a5c;">' + u.업체명 + '</span>' +
    '</div>';
  }).join('');
  드롭다운.style.display = 'block';
}

function 업체자동완성선택(업체명) {
  var el = document.getElementById('필터_업체');
  if (el) el.value = 업체명;
  _필터_업체 = 업체명;
  var 드롭다운 = document.getElementById('업체자동완성_드롭다운');
  if (드롭다운) 드롭다운.style.display = 'none';
  작업목록렌더링();
}

function 업체입력키처리(e) {
  if (e.key === 'Escape') {
    var 드롭다운 = document.getElementById('업체자동완성_드롭다운');
    if (드롭다운) 드롭다운.style.display = 'none';
  } else if (e.key === 'Enter') {
    var 드롭다운 = document.getElementById('업체자동완성_드롭다운');
    // 드롭다운 첫 항목 자동 선택
    if (드롭다운 && 드롭다운.style.display !== 'none') {
      var 첫항목 = 드롭다운.querySelector('div');
      if (첫항목) { 첫항목.click(); return; }
    }
    필터조회();
  }
}

/* ================================================================
   품명 자동완성 + 조회 팝업
   ================================================================ */
var _품명팝업목록원본 = [];

function 품명자동완성표시(값) {
  var 드롭다운 = document.getElementById('품명자동완성_드롭다운');
  if (!드롭다운) return;
  var 키워드 = (값 || '').toLowerCase().trim();
  if (!키워드) { 드롭다운.style.display = 'none'; return; }

  var seen = {};
  _작업목록.forEach(function(r){ if (r.품목) seen[r.품목] = true; });
  var 전체 = Object.keys(seen).sort();
  var 결과 = 전체.filter(function(p){ return p.toLowerCase().indexOf(키워드) >= 0; });

  if (!결과.length) { 드롭다운.style.display = 'none'; return; }

  드롭다운.innerHTML = 결과.map(function(품목) {
    var 안전 = 품목.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return '<div onclick="품명선택(\'' + 안전 + '\')" ' +
      'style="padding:9px 14px;cursor:pointer;font-weight:600;color:#1a3a5c;" ' +
      'onmouseover="this.style.background=\'#fff7ed\'" onmouseout="this.style.background=\'\'">' +
      품목 +
    '</div>';
  }).join('');
  드롭다운.style.display = 'block';
}

function 품명선택(품목) {
  var el = document.getElementById('입력_품목');
  if (el) el.value = 품목;
  var 드롭다운 = document.getElementById('품명자동완성_드롭다운');
  if (드롭다운) 드롭다운.style.display = 'none';
  var 다음 = document.getElementById('입력_입고일');
  if (다음) 다음.focus();
}

function 품명키처리(e) {
  if (e.key === 'Escape') {
    var 드롭다운 = document.getElementById('품명자동완성_드롭다운');
    if (드롭다운) 드롭다운.style.display = 'none';
  } else if (e.key === 'Enter') {
    e.preventDefault();
    var 드롭다운 = document.getElementById('품명자동완성_드롭다운');
    if (드롭다운 && 드롭다운.style.display !== 'none') {
      var 첫항목 = 드롭다운.querySelector('div');
      if (첫항목) { 첫항목.click(); return; }
    }
    var 다음 = document.getElementById('입력_입고일');
    if (다음) 다음.focus();
  }
}

function 품명조회팝업열기() {
  var seen = {};
  _작업목록.forEach(function(r){ if (r.품목) seen[r.품목] = true; });
  _품명팝업목록원본 = Object.keys(seen).sort();
  var 검색el = document.getElementById('품명조회_검색');
  if (검색el) { 검색el.value = ''; 검색el.focus(); }
  품명조회팝업렌더링(_품명팝업목록원본);
  document.getElementById('품명조회팝업_오버레이').style.display = 'flex';
}

function 품명조회팝업렌더링(목록) {
  var tbody = document.getElementById('품명조회팝업_바디');
  if (!tbody) return;
  if (!목록.length) {
    tbody.innerHTML = '<tr><td class="빈목록안내">등록된 품목이 없습니다.</td></tr>';
    return;
  }
  tbody.innerHTML = 목록.map(function(품목) {
    var 안전 = 품목.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return '<tr onclick="품명팝업선택(\'' + 안전 + '\')" style="cursor:pointer;">' +
      '<td style="font-weight:600;">' + 품목 + '</td>' +
    '</tr>';
  }).join('');
}

function 품명조회팝업검색필터() {
  var 검색 = (document.getElementById('품명조회_검색').value || '').toLowerCase();
  var 결과 = !검색 ? _품명팝업목록원본 : _품명팝업목록원본.filter(function(p){
    return p.toLowerCase().indexOf(검색) >= 0;
  });
  품명조회팝업렌더링(결과);
}

function 품명팝업선택(품목) {
  var el = document.getElementById('입력_품목');
  if (el) el.value = 품목;
  품명조회팝업닫기();
  var 다음 = document.getElementById('입력_입고일');
  if (다음) 다음.focus();
}

function 품명조회팝업닫기() {
  var ov = document.getElementById('품명조회팝업_오버레이');
  if (ov) ov.style.display = 'none';
}

/* ================================================================
   입고 폼 업체 자동완성
   ================================================================ */
function 입력업체자동완성표시(값) {
  var 드롭다운 = document.getElementById('입력업체_드롭다운');
  if (!드롭다운) return;
  var 키워드 = (값 || '').toLowerCase().trim();
  if (!키워드) { 드롭다운.style.display = 'none'; return; }

  var 결과 = _업체마스터.filter(function(u) {
    return u.코드.toLowerCase().indexOf(키워드) >= 0 ||
           u.업체명.toLowerCase().indexOf(키워드) >= 0;
  });

  if (!결과.length) { 드롭다운.style.display = 'none'; return; }

  드롭다운.innerHTML = 결과.map(function(u) {
    var 안전명 = u.업체명.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return '<div onclick="입력업체선택(\'' + 안전명 + '\')" ' +
      'style="display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;" ' +
      'onmouseover="this.style.background=\'#fff7ed\'" onmouseout="this.style.background=\'\'">' +
      '<span style="color:#9CA3AF;font-size:11px;min-width:32px;text-align:right;">[' + u.코드 + ']</span>' +
      '<span style="font-weight:600;color:#1a3a5c;">' + u.업체명 + '</span>' +
    '</div>';
  }).join('');
  드롭다운.style.display = 'block';
}

function 입력업체선택(업체명) {
  var el = document.getElementById('입력_업체');
  if (el) el.value = 업체명;
  var 드롭다운 = document.getElementById('입력업체_드롭다운');
  if (드롭다운) 드롭다운.style.display = 'none';
  var 다음 = document.getElementById('입력_입고수량');
  if (다음) 다음.focus();
}

function 입력업체키처리(e) {
  if (e.key === 'Escape') {
    var 드롭다운 = document.getElementById('입력업체_드롭다운');
    if (드롭다운) 드롭다운.style.display = 'none';
  } else if (e.key === 'Enter') {
    e.preventDefault();
    var 드롭다운 = document.getElementById('입력업체_드롭다운');
    if (드롭다운 && 드롭다운.style.display !== 'none') {
      var 첫항목 = 드롭다운.querySelector('div');
      if (첫항목) { 첫항목.click(); return; }
    }
    var 다음 = document.getElementById('입력_입고수량');
    if (다음) 다음.focus();
  }
}

/* ================================================================
   담당자 조회 팝업
   ================================================================ */
var _담당자팝업목록원본 = [];
var _담당자팝업타겟 = '입력_담당자';

async function 담당자조회팝업열기(targetId) {
  _담당자팝업타겟 = targetId || '입력_담당자';
  var tbody = document.getElementById('담당자조회팝업_바디');
  if (tbody) tbody.innerHTML = '<tr><td colspan="3" class="빈목록안내">불러오는 중...</td></tr>';
  document.getElementById('담당자조회팝업_오버레이').style.display = 'flex';

  // 사원 테이블 시도
  var { data, error } = await 수파베이스.from('사원').select('코드,직급,사원명').order('코드');
  if (!error && data && data.length > 0) {
    _담당자팝업목록원본 = data.map(function(r) {
      return { 코드: r.코드 || '', 직급: r.직급 || '', 이름: r.사원명 || '', 값: ((r.직급 ? r.직급 + ' ' : '') + (r.사원명 || '')).trim() };
    });
  } else {
    // 사원 테이블 없으면 현재 작업 데이터의 담당자 목록으로 폴백
    var seen = {};
    _작업목록.forEach(function(r, i) { if (r.담당자) seen[r.담당자] = true; });
    _담당자팝업목록원본 = Object.keys(seen).sort().map(function(d, i) {
      return { 코드: String(i + 1).padStart(3, '0'), 직급: '', 이름: d, 값: d };
    });
  }

  var 검색el = document.getElementById('담당자조회_검색');
  if (검색el) { 검색el.value = ''; 검색el.focus(); }
  담당자조회팝업렌더링(_담당자팝업목록원본);
}

function 담당자조회팝업렌더링(목록) {
  var tbody = document.getElementById('담당자조회팝업_바디');
  if (!tbody) return;
  if (!목록.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="빈목록안내">검색 결과가 없습니다.</td></tr>';
    return;
  }
  tbody.innerHTML = 목록.map(function(r) {
    var 안전값 = r.값.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return '<tr onclick="담당자선택(\'' + 안전값 + '\')" style="cursor:pointer;">' +
      '<td style="text-align:center;color:#9CA3AF;font-size:12px;">' + r.코드 + '</td>' +
      '<td style="text-align:center;">' + (r.직급 || '-') + '</td>' +
      '<td style="font-weight:700;">' + r.이름 + '</td>' +
    '</tr>';
  }).join('');
}

function 담당자조회팝업검색필터() {
  var 검색 = (document.getElementById('담당자조회_검색').value || '').toLowerCase();
  var 결과 = !검색 ? _담당자팝업목록원본 : _담당자팝업목록원본.filter(function(r) {
    return (r.코드 + r.직급 + r.이름).toLowerCase().indexOf(검색) >= 0;
  });
  담당자조회팝업렌더링(결과);
}

function 담당자선택(값) {
  var el = document.getElementById(_담당자팝업타겟);
  if (el) el.value = 값;
  담당자조회팝업닫기();
  // 필터 입력일 때만 목록 갱신
  if (_담당자팝업타겟 === '필터_담당자') {
    _필터_담당자 = 값;
    작업목록렌더링();
  }
}

function 담당자조회팝업닫기() {
  var ov = document.getElementById('담당자조회팝업_오버레이');
  if (ov) ov.style.display = 'none';
}

/* ================================================================
   업체 조회 팝업
   ================================================================ */
var _업체팝업목록원본 = [];
var _업체팝업타겟 = '필터_업체';

async function 업체조회팝업열기(targetId) {
  _업체팝업타겟 = targetId || '필터_업체';
  var tbody = document.getElementById('업체조회팝업_바디');
  if (tbody) tbody.innerHTML = '<tr><td colspan="2" class="빈목록안내">불러오는 중...</td></tr>';
  document.getElementById('업체조회팝업_오버레이').style.display = 'flex';

  var { data, error } = await 수파베이스.from('업체').select('코드,업체명').order('코드');
  if (!error && data && data.length > 0) {
    _업체팝업목록원본 = data;
  } else {
    // 업체 테이블 비어있으면 작업 데이터 고유 업체명으로 폴백
    var seen = {};
    _작업목록.forEach(function(r) { if (r.업체) seen[r.업체] = true; });
    _업체팝업목록원본 = Object.keys(seen).sort().map(function(u) {
      return { 코드: '-', 업체명: u };
    });
  }

  var 검색el = document.getElementById('업체조회_검색');
  if (검색el) { 검색el.value = ''; 검색el.focus(); }
  업체조회팝업렌더링(_업체팝업목록원본);
}

function 업체조회팝업렌더링(목록) {
  var tbody = document.getElementById('업체조회팝업_바디');
  if (!tbody) return;
  if (!목록.length) {
    tbody.innerHTML = '<tr><td colspan="2" class="빈목록안내">등록된 업체가 없습니다.</td></tr>';
    return;
  }
  tbody.innerHTML = 목록.map(function(u) {
    var 안전 = u.업체명.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return '<tr onclick="업체선택(\'' + 안전 + '\')" style="cursor:pointer;">' +
      '<td style="text-align:center;color:#9CA3AF;font-size:12px;">' + u.코드 + '</td>' +
      '<td style="font-weight:600;">' + u.업체명 + '</td>' +
    '</tr>';
  }).join('');
}

function 업체조회팝업검색필터() {
  var 검색 = (document.getElementById('업체조회_검색').value || '').toLowerCase();
  var 결과 = !검색 ? _업체팝업목록원본 : _업체팝업목록원본.filter(function(u) {
    return u.코드.toLowerCase().indexOf(검색) >= 0 || u.업체명.toLowerCase().indexOf(검색) >= 0;
  });
  업체조회팝업렌더링(결과);
}

function 업체선택(업체명) {
  var el = document.getElementById(_업체팝업타겟);
  if (el) el.value = 업체명;
  업체조회팝업닫기();
  if (_업체팝업타겟 === '필터_업체') {
    _필터_업체 = 업체명;
    작업목록렌더링();
  }
}

function 업체조회팝업닫기() {
  var ov = document.getElementById('업체조회팝업_오버레이');
  if (ov) ov.style.display = 'none';
}
