/* ===================================================
   엠블럼입출고.js — 출하검사2 전용 (Supabase 버전)
   =================================================== */

var 수정중인id      = null;
var 선택된품목      = null;
var 선택된담당자    = null;
var 현재작업공정    = null;
var 현재불량내역    = [];
var 출발공정목록    = [];
var 도착공정목록    = [];
var _lot수동모드    = false;
var 현재표시목록    = [];
var 폼임시저장키    = 'erp_엠블럼폼임시저장';
var _리얼타임타이머 = null;

var 폼입력순서 = ['품명','출고일자','단가','입고수량','도착공정','출고수량','불량수량','담당자입력'];
var 공정순서   = APP_CONFIG.공정목록;

function 출하검사계열(공정) {
  return 공정 === '출하검사' || 공정 === '출하검사2';
}
function 출하공정검사계열(공정) {
  return 공정 === '출하검사' || 공정 === '출하검사2' || 공정 === '공정검사';
}

/* 출하검사2 전용 거래처 목록 */
var 출하검사2_거래처목록 = [
  { 코드: '001', 업체명: '(주)동일오토모티브' },
  { 코드: '002', 업체명: '(주)한국레이저' },
  { 코드: '003', 업체명: '(주)케이제이정공' },
  { 코드: '004', 업체명: '유신글로텍' },
  { 코드: '005', 업체명: '주식회사 대원디씨' },
  { 코드: '006', 업체명: '주식회사 에스와이알' },
  { 코드: '007', 업체명: '주식회사 엠텍' },
  { 코드: '008', 업체명: '판야(panya)' },
];

/* ══════════════════════════════════════════
   페이지 로드
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {
  오늘날짜세팅();
  검색기간기본값세팅();
  담당자검색옵션채우기();
  엑셀날짜이번달();

  /* 업체 셀렉터 초기화 */
  (function() {
    var sel = document.getElementById('엑셀업체');
    if (!sel) return;
    var 초기목록 = APP_CONFIG.출하검사옵션.도착공정 || [];
    초기목록.forEach(function(업체명) {
      var opt = document.createElement('option');
      opt.value = 업체명; opt.textContent = 업체명;
      sel.appendChild(opt);
    });
  })();

  공정뷰선택('출하검사2');
  폼임시저장복원();

  /* Realtime 구독 — 다른 PC 변경 사항 자동 반영 */
  수파베이스.channel('엠블럼입출고실시간')
    .on('postgres_changes', { event: '*', schema: 'public', table: '엠블럼입출고' }, function() {
      clearTimeout(_리얼타임타이머);
      _리얼타임타이머= setTimeout(function() {
        var 포커스 = document.activeElement;
        if (포커스 && 포커스.closest && 포커스.closest('#폼카드')) return;
        공정필터목록갱신();
        출하현황요약();
      }, 400);
    })
    .subscribe();

  document.addEventListener('click', function(e) {
    var 감싸기 = document.getElementById('품명감싸기');
    if (감싸기 && !감싸기.contains(e.target)) 드롭다운닫기();
  });

  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    if (document.getElementById('확인모달_오버레이').style.display !== 'none') { 확인모달닫기(); return; }
    if (document.getElementById('알림모달_오버레이').style.display !== 'none') { 알림모달닫기(); return; }
    if (document.getElementById('조회팝업_오버레이').style.display !== 'none') { 조회팝업닫기(); return; }
  });
});

/* ══════════════════════════════════════════
   날짜
══════════════════════════════════════════ */
function 오늘날짜세팅() {
  var d = new Date();
  var 월el = document.getElementById('출하현황_월필터');
  if (월el) 월el.value = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
}

function 날짜입력포맷(input) {
  var raw = input.value.replace(/[^0-9]/g, '').slice(0, 8);
  var fmt = raw;
  if (raw.length > 6) fmt = raw.slice(0,4) + '-' + raw.slice(4,6) + '-' + raw.slice(6);
  else if (raw.length > 4) fmt = raw.slice(0,4) + '-' + raw.slice(4);
  input.value = fmt;
  폼임시저장();
}

function 날짜캘린더선택(값) {
  if (!값) return;
  document.getElementById('출고일자').value = 값;
  폼임시저장();
}

/* ══════════════════════════════════════════
   입고수량 변경 → 출하검사/출하검사2/공정검사 출고수량 자동 동기화
══════════════════════════════════════════ */
function 입고수량변경() {
  if (현재작업공정 === '공정검사') {
    불량합계갱신();
  } else if (출하공정검사계열(현재작업공정)) {
    var v = document.getElementById('입고수량').value;
    document.getElementById('출고수량').value = v;
  }
  잔량미리보기();
}

/* ══════════════════════════════════════════
   공정검사 불량 입력 (코드별 내역)
══════════════════════════════════════════ */
function 불량코드팝업열기() {
  조회팝업열기({
    제목: '불량코드도움', 검색힌트: '불량코드 또는 불량명 검색...',
    데이터: 엠블럼_불량코드목록,
    열목록: [{ 제목: '불량코드', 필드: '코드' }, { 제목: '불량명', 필드: '명' }],
    선택시: function(항목) { 불량내역추가(항목); }
  });
}

function 불량내역추가(코드항목) {
  var 기존 = 현재불량내역.find(function(r) { return r.명 === 코드항목.명; });
  var idx;
  if (기존) {
    idx = 현재불량내역.indexOf(기존);
  } else {
    현재불량내역.push({ 코드: 코드항목.코드 || '', 명: 코드항목.명, 수량: 0 });
    idx = 현재불량내역.length - 1;
  }
  불량내역그리기();
  setTimeout(function() {
    var 입력 = document.getElementById('불량수량입력_' + idx);
    if (입력) { 입력.focus(); 입력.select(); }
  }, 50);
}

function 불량내역수량변경(idx, value) {
  현재불량내역[idx].수량 = Number(String(value).replace(/,/g, '')) || 0;
  불량합계갱신();
}

function 불량내역삭제(idx) {
  현재불량내역.splice(idx, 1);
  불량내역그리기();
}

function 불량내역그리기() {
  var 바디 = document.getElementById('불량내역바디');
  if (!바디) return;
  바디.innerHTML = '';
  현재불량내역.forEach(function(r, idx) {
    var 행 = document.createElement('tr');
    행.innerHTML =
      '<td>' + (r.코드 || '-') + '</td>' +
      '<td>' + r.명 + '</td>' +
      '<td><input type="number" min="0" value="' + (r.수량 || 0) + '" id="불량수량입력_' + idx + '" ' +
        'style="width:90px;border:1px solid #c0cfe0;border-radius:3px;padding:3px 6px;font-size:13px;font-family:inherit;text-align:right;" ' +
        'oninput="불량내역수량변경(' + idx + ',this.value)" ' +
        'onkeydown="if(event.key===\'Enter\'){event.preventDefault();this.blur();불량코드팝업열기();}"></td>' +
      '<td style="text-align:center;"><button class="버튼 빨강 소형" onclick="불량내역삭제(' + idx + ')">삭제</button></td>';
    바디.appendChild(행);
  });

  var 빈행 = document.createElement('tr');
  빈행.innerHTML =
    '<td colspan="2" style="color:#aaa; cursor:pointer;" ondblclick="불량코드팝업열기()">더블클릭하여 불량 코드 선택</td>' +
    '<td></td><td></td>';
  바디.appendChild(빈행);

  불량합계갱신();
}

function 불량합계갱신() {
  var 총불량 = 현재불량내역.reduce(function(s, r) { return s + (Number(r.수량) || 0); }, 0);
  var el = document.getElementById('총불량표시');
  if (el) {
    el.textContent = 총불량 > 0 ? 총불량 : '-';
    el.style.color = 총불량 > 0 ? '#e67e22' : '#888';
    el.style.fontWeight = 총불량 > 0 ? 'bold' : 'normal';
  }
  if (현재작업공정 === '공정검사') {
    document.getElementById('불량수량').value = 총불량;
    var 입고 = Number(document.getElementById('입고수량').value) || 0;
    document.getElementById('출고수량').value = Math.max(0, 입고 - 총불량);
  }
  잔량미리보기();
  폼임시저장();
}

function 잔량미리보기() {
  var 입고 = Number(document.getElementById('입고수량').value) || 0;
  var 출고 = Number(document.getElementById('출고수량').value) || 0;
  var 불량 = Number(document.getElementById('불량수량').value) || 0;
  var 잔 = 입고 - 출고 - 불량;
  var el = document.getElementById('잔량표시');
  if (입고 === 0 && 출고 === 0 && 불량 === 0) {
    el.textContent = '-'; el.style.color = '#888'; el.style.fontWeight = 'normal';
  } else {
    el.textContent = 잔;
    el.style.color = 잔 < 0 ? '#e74c3c' : '#2a6496';
    el.style.fontWeight = 'bold';
  }
}

/* ══════════════════════════════════════════
   LOT 번호 포맷
══════════════════════════════════════════ */
function lot키다운(e) {
  if (e.key === ' ') _lot수동모드 = true;
  폼엔터핸들러(e, 'lot번호');
}

function lot번호포맷(input) {
  if (!input.value.trim()) { _lot수동모드 = false; 폼임시저장(); return; }
  if (_lot수동모드) { 폼임시저장(); return; }
  var raw = input.value.replace(/ /g, '');
  var 숫자부 = (raw.match(/^[0-9]*/) || [''])[0];
  var 접미사 = raw.slice(숫자부.length);
  var chunks = [];
  if (숫자부.length > 0)  chunks.push(숫자부.slice(0, 4));
  if (숫자부.length > 4)  chunks.push(숫자부.slice(4, 8));
  if (숫자부.length > 8)  chunks.push(숫자부.slice(8, 11));
  if (숫자부.length > 11) chunks.push(숫자부.slice(11));
  input.value = chunks.join(' ') + 접미사;
  폼임시저장();
}

/* ══════════════════════════════════════════
   폼 임시저장 (sessionStorage — 페이지 새로고침 대비)
══════════════════════════════════════════ */
function 폼임시저장() {
  if (수정중인id) return;
  var d = {
    품명:       document.getElementById('품명').value,
    출고일자:   document.getElementById('출고일자').value,
    단가:       document.getElementById('단가').value,
    출발공정:   document.getElementById('출발공정').value,
    도착공정:   document.getElementById('도착공정').value,
    입고수량:   document.getElementById('입고수량').value,
    출고수량:   document.getElementById('출고수량').value,
    담당자명:   document.getElementById('담당자입력').value,
    담당자코드: document.getElementById('담당자코드표시').textContent
  };
  sessionStorage.setItem(폼임시저장키, JSON.stringify(d));
}

function 폼임시저장복원() {
  var raw = sessionStorage.getItem(폼임시저장키);
  if (!raw) return;
  var d;
  try { d = JSON.parse(raw); } catch(e) { return; }
  if (!d.품명 && !d.입고수량) return;
  if (d.품명) {
    document.getElementById('품명').value = d.품명;
    선택된품목 = 엠블럼_품목목록.find(function(p) { return p.품명 === d.품명; }) || null;
    if (선택된품목) document.getElementById('품명품번표시').textContent = '품번: ' + 선택된품목.품번;
  }
  if (d.출고일자) document.getElementById('출고일자').value = d.출고일자;
  if (d.단가)     document.getElementById('단가').value     = d.단가;
  if (d.출발공정) document.getElementById('출발공정').value = d.출발공정;
  if (d.도착공정) document.getElementById('도착공정').value = d.도착공정;
  if (d.입고수량) document.getElementById('입고수량').value = d.입고수량;
  if (d.출고수량) document.getElementById('출고수량').value = d.출고수량;
  if (d.담당자명) {
    document.getElementById('담당자입력').value = d.담당자명;
    document.getElementById('담당자코드표시').textContent = d.담당자코드;
    선택된담당자 = 엠블럼_담당자목록.find(function(t) {
      return (t.직급 + ' ' + t.이름) === d.담당자명;
    }) || null;
  }
}

function 폼임시저장초기화() {
  sessionStorage.removeItem(폼임시저장키);
}

/* ══════════════════════════════════════════
   공정 선택
══════════════════════════════════════════ */
function 공정뷰선택(공정) {
  현재작업공정 = 공정;
  var 표시이름 = 공정 === '출하검사2' ? '출하검사' : 공정;

  document.querySelectorAll('.공정선택버튼').forEach(function(b) { b.classList.remove('활성'); });
  if (공정) {
    document.querySelectorAll('.공정선택버튼').forEach(function(b) {
      if (b.textContent.trim() === 표시이름) b.classList.add('활성');
    });
  } else {
    document.querySelectorAll('.공정선택버튼.전체버튼').forEach(function(b) { b.classList.add('활성'); });
  }

  var 폼제목   = document.querySelector('#폼카드 .페이지제목');
  var 목록제목 = document.getElementById('목록제목');
  var 안내박스 = document.getElementById('공정뷰안내');
  var 확정영역 = document.getElementById('확정버튼영역');

  if (공정) {
    if (폼제목)   폼제목.textContent   = 표시이름 + ' 입출고 등록';
    if (목록제목) 목록제목.textContent = 표시이름 + ' 입출고 목록';
    if (안내박스) 안내박스.style.display = 출하공정검사계열(공정) ? 'none' : 'block';
    if (확정영역) 확정영역.style.display = 출하공정검사계열(공정) ? 'flex' : 'none';
    document.getElementById('출발공정').value  = 공정;
    document.getElementById('검색_공정').value = 공정;
  } else {
    if (폼제목)   폼제목.textContent   = '입출고 등록';
    if (목록제목) 목록제목.textContent = '입출고 목록';
    if (안내박스) 안내박스.style.display = 'none';
    if (확정영역) 확정영역.style.display = 'none';
    document.getElementById('검색_공정').value = '';
  }

  document.querySelectorAll('.카드 .페이지제목').forEach(function(el) {
    if (el.textContent.trim() === '출하 현황' || el.textContent.trim() === '코팅 출하 현황') {
      el.textContent = (공정 === '공정검사') ? '코팅 출하 현황' : '출하 현황';
    }
  });

  var 업체sel = document.getElementById('엑셀업체');
  if (업체sel) {
    업체sel.innerHTML = '';
    var 옵션소스 = (공정 === '공정검사') ? APP_CONFIG.공정검사옵션 : APP_CONFIG.출하검사옵션;
    var 출력업체목록 = 옵션소스.엑셀출력업체 || 옵션소스.도착공정 || [];
    출력업체목록.forEach(function(업체명) {
      var opt = document.createElement('option');
      opt.value = 업체명; opt.textContent = 업체명;
      업체sel.appendChild(opt);
    });
  }

  공정별출발도착옵션갱신(공정);
  출하검사폼전환(공정);
  폼초기화();
  공정필터목록갱신();
  출하현황요약();
}

function 출하검사폼전환(공정) {
  var 검사공정 = 출하공정검사계열(공정);
  var 불량그룹 = document.getElementById('불량수량그룹');
  var 잔량그룹 = document.getElementById('잔량그룹');
  if (불량그룹) 불량그룹.style.display = 검사공정 ? 'none' : '';
  if (잔량그룹) 잔량그룹.style.display = 검사공정 ? 'none' : '';

  var 공정검사불량행 = document.getElementById('공정검사불량행');
  var 출고el = document.getElementById('출고수량');
  if (공정검사불량행) 공정검사불량행.style.display = (공정 === '공정검사') ? 'flex' : 'none';
  if (출고el) {
    출고el.readOnly = (공정 === '공정검사');
    출고el.style.background = (공정 === '공정검사') ? '#f3f4f6' : '';
  }

  var 담당자그룹 = document.getElementById('담당자그룹');
  var 담당자저장행 = document.getElementById('담당자저장행');
  if (담당자그룹) {
    if (공정 === '공정검사' && 공정검사불량행) 공정검사불량행.appendChild(담당자그룹);
    else if (담당자저장행) 담당자저장행.insertBefore(담당자그룹, 담당자저장행.firstChild);
  }

  var 출발el = document.getElementById('출발공정');
  if (공정 === '출하검사') {
    출발el.value    = APP_CONFIG.출하검사옵션.출발공정[0];
    출발el.readOnly = false;
    document.getElementById('도착공정').value = APP_CONFIG.출하검사옵션.도착공정[0];
  } else if (공정 === '출하검사2') {
    출발el.value    = '(주)삼양이엔지';
    출발el.readOnly = true;
    document.getElementById('도착공정').value = '';
  } else if (공정 === '공정검사') {
    출발el.value    = APP_CONFIG.공정검사옵션.출발공정[0];
    출발el.readOnly = true;
    document.getElementById('도착공정').value = APP_CONFIG.공정검사옵션.도착공정[0];
  } else {
    출발el.readOnly = false;
  }
}

function 공정별출발도착옵션갱신(공정) {
  if (출하검사계열(공정)) {
    출발공정목록 = APP_CONFIG.공정목록.concat(APP_CONFIG.출하검사옵션.출발공정);
    도착공정목록 = APP_CONFIG.출하검사옵션.도착공정.slice();
  } else if (공정 === '공정검사') {
    출발공정목록 = APP_CONFIG.공정목록.concat(APP_CONFIG.공정검사옵션.출발공정);
    도착공정목록 = APP_CONFIG.공정검사옵션.도착공정.slice();
  } else {
    출발공정목록 = [APP_CONFIG.외부공정.입고].concat(APP_CONFIG.공정목록);
    도착공정목록 = APP_CONFIG.공정목록.concat([APP_CONFIG.외부공정.출하]);
  }
}

function 공정코드변환(구분) {
  var 필드 = document.getElementById(구분 + '공정');
  var 입력 = (필드.value || '').trim();
  if (!입력) return;
  var 목록 = 구분 === '출발' ? 출발공정목록 : 도착공정목록;
  var 매칭 = 목록.find(function(p) { return APP_CONFIG.공정코드[p] === 입력; });
  if (매칭) { 필드.value = 매칭; 잔량미리보기(); 폼임시저장(); }
}

function 도착공정팝업열기() {
  if (현재작업공정 === '출하검사2') {
    조회팝업열기({
      제목: '거래처 선택',
      검색힌트: '거래처명 검색...',
      데이터: 출하검사2_거래처목록,
      열목록: [{ 제목: '코드', 필드: '코드' }, { 제목: '거래처명', 필드: '업체명' }],
      선택시: function(항목) {
        document.getElementById('도착공정').value = 항목.업체명;
        폼임시저장();
        setTimeout(function() { document.getElementById('담당자입력').focus(); }, 50);
      }
    });
  } else {
    공정팝업열기('도착');
  }
}

function 공정팝업열기(구분) {
  var 목록 = 구분 === '출발' ? 출발공정목록 : 도착공정목록;
  var 데이터 = 목록.map(function(p) {
    return { 코드: APP_CONFIG.공정코드[p] || '-', 공정명: p };
  });
  조회팝업열기({
    제목:     구분 === '출발' ? '출발 공정 선택' : '도착 공정 선택',
    검색힌트: '공정명 또는 코드 검색...',
    데이터:   데이터,
    열목록:   [{ 제목: '코드', 필드: '코드' }, { 제목: '공정명', 필드: '공정명' }],
    선택시: function(항목) {
      document.getElementById(구분 + '공정').value = 항목.공정명;
      잔량미리보기(); 폼임시저장();
      if (구분 === '출발') setTimeout(function() { document.getElementById('입고수량').focus(); }, 50);
    }
  });
}

/* ══════════════════════════════════════════
   목록 갱신
══════════════════════════════════════════ */
async function 공정필터목록갱신() {
  var 전체 = await 엠블럼_데이터불러오기();
  var 결과;

  if (!현재작업공정) {
    결과 = 전체;
  } else if (현재작업공정 === '수입검사' || 출하공정검사계열(현재작업공정)) {
    결과 = 전체.filter(function(h) { return h.공정 === 현재작업공정; });
  } else {
    결과 = 전체.filter(function(h) { return h.공정 === 현재작업공정 && h.완료여부 === false; });
  }

  if (출하공정검사계열(현재작업공정)) {
    var _시작 = document.getElementById('검색_시작일').value;
    var _종료 = document.getElementById('검색_종료일').value;
    if (_시작) 결과 = 결과.filter(function(h) { return (h.출고일자||'') >= _시작; });
    if (_종료) 결과 = 결과.filter(function(h) { return (h.출고일자||'') <= _종료; });
  }

  목록테이블그리기(결과);

  var 안내 = document.getElementById('검색결과안내');
  if (현재작업공정) {
    var 표시이름 = 현재작업공정 === '출하검사2' ? '출하검사' : 현재작업공정;
    var 미처리 = 결과.filter(function(h) { return h.완료여부 === false; }).length;
    var 완료 = 결과.length - 미처리;
    안내.innerHTML =
      '<b>' + 표시이름 + '</b> — 완료: <span class="결과강조">' + 완료 + '건</span>' +
      (미처리 > 0 ? ' / <span style="color:#e67e22;font-weight:bold;">미처리: ' + 미처리 + '건</span>' : '');
  } else {
    안내.innerHTML = '';
  }
}

function 목록새로고침() { 공정필터목록갱신(); }

/* ══════════════════════════════════════════
   품명 자동완성
══════════════════════════════════════════ */
function 품명입력시() {
  선택된품목 = null;
  document.getElementById('품명품번표시').textContent = '';
  var 검색어  = document.getElementById('품명').value.trim();
  var 드롭다운 = document.getElementById('품명드롭다운');
  if (!검색어) { 드롭다운닫기(); return; }

  var 결과 = 엠블럼_품목검색(검색어);
  드롭다운.innerHTML = '';
  if (결과.length === 0) {
    var li = document.createElement('li');
    li.className = '자동완성_없음';
    li.textContent = '일치하는 품목이 없습니다.';
    드롭다운.appendChild(li);
  } else {
    결과.forEach(function(품목) {
      var li = document.createElement('li');
      li.className = '자동완성_항목';
      li.innerHTML = '<span class="자동완성_품명">' + 품목.품명 + '</span>' +
                     '<span class="자동완성_품번">[' + 품목.품번 + ']</span>';
      li.addEventListener('mousedown', function(e) { e.preventDefault(); 품목선택(품목); });
      드롭다운.appendChild(li);
    });
  }
  드롭다운.style.display = 'block';
}

function 품목선택(품목) {
  선택된품목 = 품목;
  document.getElementById('품명').value = 품목.품명;
  document.getElementById('품명품번표시').textContent = '품번: ' + 품목.품번;
  드롭다운닫기();
  폼임시저장();
}

function 드롭다운닫기() {
  var d = document.getElementById('품명드롭다운');
  if (d) d.style.display = 'none';
}

function 담당자선택(항목) {
  선택된담당자 = 항목;
  document.getElementById('담당자입력').value = 항목.직급 + ' ' + 항목.이름;
  document.getElementById('담당자코드표시').textContent = '코드: ' + 항목.코드;
  폼임시저장();
  setTimeout(function() { document.getElementById('담당자입력').focus(); }, 0);
}

/* ══════════════════════════════════════════
   저장 / 수정 / 삭제
══════════════════════════════════════════ */
async function 저장하기() {
  var 품명값 = document.getElementById('품명').value.trim();
  var 입고값 = document.getElementById('입고수량').value.trim();
  var 출고값 = document.getElementById('출고수량').value.trim();
  var 불량값 = document.getElementById('불량수량').value.trim();
  var 일자값 = document.getElementById('출고일자').value;
  var lot값  = '';
  var 출발값 = document.getElementById('출발공정').value;
  var 도착값 = document.getElementById('도착공정').value;
  var 단가값 = Number(document.getElementById('단가').value) || 0;

  var 자유입력모드 = 현재작업공정 === '출하검사2';
  if (품명값 && !선택된품목 && !자유입력모드) {
    var 찾은 = 엠블럼_품목유효성확인(품명값);
    if (찾은) 선택된품목 = 찾은;
  }

  var 검사공정 = 출하공정검사계열(현재작업공정);
  var 미입력 = [];
  if (!품명값 || (!선택된품목 && !자유입력모드)) 미입력.push('품명');
  if (!일자값 || !/^\d{4}-\d{2}-\d{2}$/.test(일자값)) 미입력.push('일자 (YYYY-MM-DD)');
  if (!출발값)                                         미입력.push('출발 공정');
  if (!입고값)                                         미입력.push('입고수량');
  if (!도착값)                                         미입력.push('도착 공정');
  if (!출고값)                                         미입력.push('출고수량');
  if (!선택된담당자 && !검사공정)                      미입력.push('담당자');
  if (검사공정 && 단가값 === 0)                        미입력.push('단가 (0원 입력 불가)');

  if (미입력.length > 0) { 알림모달표시(미입력); return; }

  var 입고 = Number(입고값) || 0;
  var 출고 = Number(출고값) || 0;
  var 불량 = Number(불량값) || 0;
  var 기록공정 = 현재작업공정 || 출발값;

  var 새항목 = {
    품명:       선택된품목 ? 선택된품목.품명 : 품명값,
    품번:       선택된품목 ? 선택된품목.품번 : '',
    공정:       기록공정,
    출발공정:   출발값,
    입고수량:   입고,
    도착공정:   도착값,
    출고수량:   출고,
    불량수량:   불량,
    잔량:       입고 - 출고 - 불량,
    출고일자:   일자값,
    lot번호:    lot값,
    담당자:     선택된담당자 ? (선택된담당자.직급 + ' ' + 선택된담당자.이름) : '',
    담당자코드: 선택된담당자 ? 선택된담당자.코드 : '',
    단가:       단가값,
    불량내역:   현재작업공정 === '공정검사' ? 현재불량내역 : [],
    A급수량:    현재작업공정 === '공정검사' ? (Number(document.getElementById('A급수량').value) || 0) : 0,
    완료여부:   true,
    매출확정:   false
  };

  try {
    if (수정중인id !== null) {
      var 이전기록  = await 엠블럼_데이터하나가져오기(수정중인id);
      var 이전미완료 = 이전기록 && 이전기록.완료여부 === false;
      await 엠블럼_데이터수정(수정중인id, 새항목);
      if (이전미완료 && 도착값 && 공정순서.includes(도착값)) {
        await 다음공정자동생성(도착값, 기록공정, 출고, 선택된품목, lot값, 일자값);
        알림표시('등록 완료! ' + 도착값 + '에 자동 전달되었습니다.', '성공');
      } else {
        알림표시('수정되었습니다.', '성공');
      }
      수정중인id = null;
      document.getElementById('저장버튼').textContent = '저장';
      document.getElementById('저장버튼').className   = '버튼 초록';
      폼카드제거수정강조();
    } else {
      await 엠블럼_데이터저장(새항목);
      if (도착값 && 공정순서.includes(도착값)) {
        await 다음공정자동생성(도착값, 기록공정, 출고, 선택된품목, lot값, 일자값);
        알림표시(기록공정 + ' 저장 완료 → ' + 도착값 + '에 자동 전달', '성공');
      } else {
        알림표시(기록공정 + ' 기록이 저장되었습니다.', '성공');
      }
    }
    폼임시저장초기화();
    폼초기화(true);
    document.getElementById('품명').focus();
    공정필터목록갱신();
    출하현황요약();
  } catch(err) {
    알림표시('저장 실패: ' + (err.message || err), '오류');
    console.error(err);
  }
}

async function 다음공정자동생성(도착공정, 원출발공정, 출고수량, 품목, lot, 일자) {
  var 전체 = await 엠블럼_데이터불러오기();
  var 이미있음 = 전체.some(function(h) {
    return (h.lot번호||'').trim() === lot && h.공정 === 도착공정 && h.완료여부 === false;
  });
  if (이미있음) return;
  await 엠블럼_데이터저장({
    품명: 품목.품명, 품번: 품목.품번,
    공정: 도착공정, 출발공정: 원출발공정,
    입고수량: 출고수량, 도착공정: '', 출고수량: 0, 불량수량: 0, 잔량: 출고수량,
    출고일자: 일자, lot번호: lot, 담당자: '', 담당자코드: '', 완료여부: false, 매출확정: false
  });
}

function 수정하기(id) {
  var 항목 = 현재표시목록.find(function(h) { return h.id === id; });
  if (항목 && 항목.매출확정) {
    확인모달표시('매출 확정된 항목입니다.\n수정 저장 시 매출 확정이 취소됩니다.\n계속하시겠습니까?', function() {
      수정폼채우기(id);
    });
    return;
  }
  수정폼채우기(id);
}

async function 수정폼채우기(id) {
  var 항목 = await 엠블럼_데이터하나가져오기(id);
  if (!항목) { 알림표시('이미 삭제된 항목입니다.', '오류'); 공정필터목록갱신(); return; }

  document.getElementById('품명').value = 항목.품명;
  document.getElementById('품명품번표시').textContent = 항목.품번 ? '품번: ' + 항목.품번 : '';
  선택된품목 = 엠블럼_품목목록.find(function(p) { return p.품명 === 항목.품명; }) || null;

  var 미완료 = 항목.완료여부 === false;
  var 공정처리모드 = 미완료 && 현재작업공정 && 현재작업공정 !== '수입검사';

  document.getElementById('입고수량').value = 항목.입고수량 || 0;
  document.getElementById('출고수량').value = 공정처리모드 ? '' : (항목.출고수량 || 0);
  document.getElementById('불량수량').value = 공정처리모드 ? '' : (항목.불량수량 || 0);
  현재불량내역 = 공정처리모드 ? [] : (항목.불량내역 || []);
  불량내역그리기();
  document.getElementById('A급수량').value = 공정처리모드 ? '' : (항목.A급수량 || '');
  document.getElementById('출고일자').value = 항목.출고일자 || '';
  var _lotEl2 = document.getElementById('lot번호'); if (_lotEl2) _lotEl2.value = 항목.lot번호 || '';
  document.getElementById('단가').value     = 항목.단가     || '';
  document.getElementById('출발공정').value = 공정처리모드 ? 현재작업공정 : (항목.출발공정 || '');
  document.getElementById('출발공정').disabled = 공정처리모드;
  document.getElementById('도착공정').value = 항목.도착공정 || '';

  선택된담당자 = 엠블럼_담당자목록.find(function(d) {
    return (d.직급 + ' ' + d.이름) === 항목.담당자;
  }) || null;
  document.getElementById('담당자입력').value = 항목.담당자 || '';
  document.getElementById('담당자코드표시').textContent = 선택된담당자 ? '코드: ' + 선택된담당자.코드 : '';

  잔량미리보기();
  수정중인id = id;
  document.getElementById('저장버튼').textContent = 미완료 ? '등록 완료' : '변경 저장';
  document.getElementById('저장버튼').className   = '버튼 파랑';
  document.getElementById('폼카드').classList.add('수정모드중');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (공정처리모드)  알림표시(현재작업공정 + ' 처리: 도착 공정·출고수량 입력 후 [등록 완료]를 눌러주세요.', '성공');
  else if (미완료)   알림표시(항목.출발공정 + '에서 넘어온 기록입니다. 수량 입력 후 [등록 완료]를 눌러주세요.', '성공');
  else               알림표시('수정할 내용 변경 후 [변경 저장]을 눌러주세요.', '성공');
}

function 삭제하기(id) {
  확인모달표시('정말 삭제할까요? 되돌릴 수 없습니다.', async function() {
    try {
      await 엠블럼_데이터삭제(id);
      폼초기화();
      알림표시('삭제되었습니다.', '성공');
      공정필터목록갱신();
      출하현황요약();
    } catch(err) {
      알림표시('삭제 실패: ' + (err.message || err), '오류');
    }
  });
}

function 폼초기화(일자유지) {
  var 현재일자 = document.getElementById('출고일자').value;
  선택된품목   = null;
  선택된담당자 = null;
  _lot수동모드 = false;
  document.getElementById('품명').value               = '';
  document.getElementById('품명품번표시').textContent  = '';
  현재불량내역 = [];
  불량내역그리기();
  document.getElementById('A급수량').value             = '';
  document.getElementById('입고수량').value            = '';
  document.getElementById('출고수량').value            = '';
  document.getElementById('불량수량').value            = '';
  var _lotEl = document.getElementById('lot번호'); if (_lotEl) _lotEl.value = '';

  document.getElementById('출발공정').value = 현재작업공정 === '출하검사'  ? APP_CONFIG.출하검사옵션.출발공정[0] :
                                              현재작업공정 === '출하검사2' ? '(주)삼양이엔지' :
                                              현재작업공정 === '공정검사'  ? APP_CONFIG.공정검사옵션.출발공정[0] :
                                              (현재작업공정 || '');
  document.getElementById('출발공정').readOnly = (현재작업공정 === '공정검사' || 현재작업공정 === '출하검사2');
  document.getElementById('출발공정').disabled  = false;
  document.getElementById('도착공정').value = 현재작업공정 === '출하검사'  ? APP_CONFIG.출하검사옵션.도착공정[0] :
                                              현재작업공정 === '출하검사2' ? '' :
                                              현재작업공정 === '공정검사'  ? APP_CONFIG.공정검사옵션.도착공정[0] : '';
  document.getElementById('단가').value = '';
  document.getElementById('담당자입력').value          = '';
  document.getElementById('담당자코드표시').textContent = '';
  document.getElementById('잔량표시').textContent      = '-';
  document.getElementById('잔량표시').style.color      = '#888';
  document.getElementById('잔량표시').style.fontWeight = 'normal';
  드롭다운닫기();
  document.getElementById('출고일자').value = (일자유지 && 현재일자) ? 현재일자 : '';
  수정중인id = null;
  document.getElementById('저장버튼').textContent = '저장';
  document.getElementById('저장버튼').className   = '버튼 초록';
  폼카드제거수정강조();
}

function 폼카드제거수정강조() {
  document.getElementById('폼카드').classList.remove('수정모드중');
}

/* ══════════════════════════════════════════
   목록 테이블
══════════════════════════════════════════ */
function 목록테이블그리기(목록) {
  목록 = 목록.slice().sort(function(a, b) {
    var da = a.출고일자 || '', db = b.출고일자 || '';
    if (da !== db) return db > da ? 1 : -1;
    return b.id - a.id;
  });
  현재표시목록 = 목록;
  var 바디 = document.getElementById('목록테이블바디');
  바디.innerHTML = '';

  var 전체체크 = document.getElementById('전체선택체크');
  if (전체체크) 전체체크.checked = false;

  if (목록.length === 0) {
    var 표시이름 = 현재작업공정 === '출하검사2' ? '출하검사' : 현재작업공정;
    바디.innerHTML = '<tr><td colspan="14" class="빈목록안내">' +
      (현재작업공정 ? 표시이름 + ' 관련 데이터가 없습니다.' : '데이터가 없습니다.') +
      '</td></tr>';
    return;
  }

  목록.forEach(function(항목) {
    var 미완료   = 항목.완료여부 === false;
    var 이미확정 = 항목.매출확정 === true;
    var 입고 = Number(항목.입고수량) || 0;
    var 출고 = Number(항목.출고수량) || 0;
    var 불량 = Number(항목.불량수량) || 0;
    var 잔  = 입고 - 출고 - 불량;

    var 행 = document.createElement('tr');
    if (이미확정)    행.style.cssText = 'background:#f0f0f0;color:#aaa;';
    else if (미완료) 행.style.cssText = 'background:#fff8e1;';

    var 도착셀 = 미완료
      ? '<span style="background:#f39c12;color:white;font-size:10px;padding:2px 6px;border-radius:3px;">미처리</span>'
      : (항목.도착공정 || '');
    var 출고셀 = 미완료 ? '<span style="color:#bbb;">-</span>' : 출고;
    var 불량셀 = 미완료 ? '<span style="color:#bbb;">-</span>' : '<span style="color:#e67e22;">' + 불량 + '</span>';
    var 잔셀   = 미완료 ? '<span style="color:#bbb;">-</span>' :
                          '<span style="' + (잔 < 0 ? 'color:#e74c3c;font-weight:bold;' : '') + '">' + 잔 + '</span>';
    var 조치버튼 = 미완료
      ? '<button class="버튼 파랑 소형" onclick="수정하기(' + 항목.id + ')">처리</button> ' +
        '<button class="버튼 빨강 소형" onclick="삭제하기(' + 항목.id + ')">삭제</button>'
      : '<button class="버튼 회색 소형" onclick="수정하기(' + 항목.id + ')">수정</button> ' +
        '<button class="버튼 빨강 소형" onclick="삭제하기(' + 항목.id + ')">삭제</button>';

    var 체크박스셀 = 이미확정
      ? '<td style="text-align:center;"><span style="background:#27ae60;color:white;font-size:10px;font-weight:bold;padding:2px 6px;border-radius:3px;">확인</span></td>'
      : '<td style="text-align:center;"><input type="checkbox" class="행선택체크" value="' + 항목.id + '"></td>';

    행.innerHTML =
      체크박스셀 +
      '<td style="text-align:left;">' + (항목.품명     || '') + '</td>' +
      '<td>' + (항목.품번     || '') + '</td>' +
      '<td style="font-size:11px;color:#666;">' + (항목.출고번호 || '') + '</td>' +
      '<td style="color:#2a6496;font-weight:bold;">' + (항목.출발공정 || '') + '</td>' +
      '<td style="color:#2a6496;">' + 입고 + '</td>' +
      '<td style="color:#27ae60;">' + 출고셀 + '</td>' +
      '<td>' + 불량셀 + '</td>' +
      '<td>' + 잔셀   + '</td>' +
      '<td style="color:#27ae60;font-weight:bold;">' + 도착셀 + '</td>' +
      '<td>' + (항목.담당자   || '') + '</td>' +
      '<td>' + (항목.출고일자 || '') + '</td>' +
      '<td style="text-align:right;color:#1a3a5c;">' + (항목.단가 ? Number(항목.단가).toLocaleString() + '원' : '') + '</td>' +
      '<td>' + 조치버튼 + '</td>';
    바디.appendChild(행);
  });
}

/* ══════════════════════════════════════════
   출하 현황 (출하검사 + 출하검사2 통합 집계)
══════════════════════════════════════════ */
async function 출하현황요약() {
  var 기준공정목록 = 현재작업공정 === '공정검사' ? ['공정검사'] :
                     출하검사계열(현재작업공정)     ? [현재작업공정] :
                                                     ['출하검사', '출하검사2'];
  var 전체 = await 엠블럼_데이터불러오기();
  var 품명필터   = document.getElementById('출하현황_품명필터').value;
  var 납품처필터 = document.getElementById('출하현황_납품처필터').value;
  var 월필터     = document.getElementById('출하현황_월필터').value;

  var 출하데이터 = 전체.filter(function(h) {
    return 기준공정목록.includes(h.공정)
      && (!품명필터   || h.품명     === 품명필터)
      && (!납품처필터 || h.도착공정 === 납품처필터)
      && (!월필터     || (h.출고일자||'').startsWith(월필터));
  });

  var 품목집계 = {};
  출하데이터.forEach(function(h) {
    var 키 = h.품명 || '';
    if (!품목집계[키]) 품목집계[키] = { 품번: h.품번||'', 건수: 0, 출하: 0, 불량: 0 };
    품목집계[키].건수++;
    품목집계[키].출하 += Number(h.출고수량) || 0;
    품목집계[키].불량 += Number(h.불량수량) || 0;
  });

  var 키목록 = Object.keys(품목집계).filter(function(k) { return k; });
  var 총출하 = 키목록.reduce(function(s, k) { return s + 품목집계[k].출하; }, 0);
  var 총불량 = 키목록.reduce(function(s, k) { return s + 품목집계[k].불량; }, 0);

  document.getElementById('출하요약_품목수').textContent = 키목록.length;
  document.getElementById('출하요약_총수량').textContent = 총출하.toLocaleString();
  document.getElementById('출하요약_총불량').textContent = 총불량.toLocaleString();

  var 바디 = document.getElementById('출하현황테이블바디');
  바디.innerHTML = '';
  if (키목록.length === 0) {
    바디.innerHTML = '<tr><td colspan="5" class="빈목록안내">데이터를 등록하면 출하 현황이 표시됩니다.</td></tr>';
    return;
  }
  키목록.sort().forEach(function(키) {
    var d = 품목집계[키];
    var 행 = document.createElement('tr');
    행.innerHTML =
      '<td style="font-weight:bold;color:#1a3a5c;">' + 키 + '</td>' +
      '<td style="color:#555;">' + d.품번 + '</td>' +
      '<td style="color:#2a6496;text-align:center;">' + d.건수 + '</td>' +
      '<td style="color:#27ae60;font-weight:bold;text-align:right;">' + d.출하.toLocaleString() + '</td>' +
      '<td style="color:#e67e22;text-align:right;">' + d.불량.toLocaleString() + '</td>';
    바디.appendChild(행);
  });
  var 합계행 = document.createElement('tr');
  합계행.style.cssText = 'background:#f0f7ff;font-weight:bold;border-top:2px solid #b8d0e8;';
  합계행.innerHTML =
    '<td colspan="2" style="color:#1a3a5c;">합계</td>' +
    '<td style="text-align:center;">' + 출하데이터.length + '건</td>' +
    '<td style="text-align:right;">' + 총출하.toLocaleString() + ' EA</td>' +
    '<td style="text-align:right;">' + 총불량.toLocaleString() + ' EA</td>';
  바디.appendChild(합계행);
}

function 공정별재고요약() { 출하현황요약(); }

function 출하현황품목조회팝업열기() {
  조회팝업열기({
    제목: '품목 조회', 검색힌트: '품명 또는 품번 검색...',
    데이터: 엠블럼_품목목록,
    열목록: [{ 제목: '품번', 필드: '품번' }, { 제목: '품명', 필드: '품명' }, { 제목: '규격', 필드: '규격' }],
    선택시: function(항목) { document.getElementById('출하현황_품명필터').value = 항목.품명; 출하현황요약(); }
  });
}

function 출하현황납품처조회팝업열기() {
  /* 출하검사2는 자체 거래처 목록 사용 */
  var 납품처데이터 = 현재작업공정 === '출하검사2'
    ? 출하검사2_거래처목록
    : APP_CONFIG.납품처목록;
  조회팝업열기({
    제목: '납품처 조회', 검색힌트: '납품처명 검색...',
    데이터: 납품처데이터,
    열목록: [{ 제목: '코드', 필드: '코드' }, { 제목: '납품처명', 필드: '업체명' }],
    선택시: function(항목) { document.getElementById('출하현황_납품처필터').value = 항목.업체명; 출하현황요약(); }
  });
}

function 출하현황필터초기화() {
  document.getElementById('출하현황_품명필터').value   = '';
  document.getElementById('출하현황_납품처필터').value = '';
  var d = new Date();
  document.getElementById('출하현황_월필터').value = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
  출하현황요약();
}

/* ══════════════════════════════════════════
   검색
══════════════════════════════════════════ */
function 검색기간기본값세팅() {
  var d = new Date();
  var y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  document.getElementById('검색_시작일').value = y + '-' + m + '-01';
  document.getElementById('검색_종료일').value = y + '-' + m + '-' + day;
}

function 담당자검색옵션채우기() {
  var sel = document.getElementById('검색_담당자');
  엠블럼_담당자목록.forEach(function(d) {
    var opt = document.createElement('option');
    opt.value = d.직급 + ' ' + d.이름; opt.textContent = d.직급 + ' ' + d.이름;
    sel.appendChild(opt);
  });
}

function 엔터검색(e) { if (e.key === 'Enter') 검색조회(); }

async function 검색조회() {
  var 전체 = await 엠블럼_데이터불러오기();
  var 시작 = document.getElementById('검색_시작일').value;
  var 종료 = document.getElementById('검색_종료일').value;
  var 품명 = document.getElementById('검색_품명').value.trim().toLowerCase();
  var 공정 = document.getElementById('검색_공정').value;
  var 담당 = document.getElementById('검색_담당자').value;

  var 결과 = 전체;
  if (시작) 결과 = 결과.filter(function(h) { return (h.출고일자||'') >= 시작; });
  if (종료) 결과 = 결과.filter(function(h) { return (h.출고일자||'') <= 종료; });
  if (품명) 결과 = 결과.filter(function(h) {
    return (h.품명||'').toLowerCase().includes(품명) || (h.품번||'').toLowerCase().includes(품명);
  });
  if (공정) 결과 = 결과.filter(function(h) {
    return h.공정 === 공정 || h.출발공정 === 공정 || h.도착공정 === 공정;
  });
  if (담당) 결과 = 결과.filter(function(h) { return (h.담당자||'') === 담당; });

  if (출하공정검사계열(현재작업공정)) {
    결과 = 결과.filter(function(h) { return h.공정 === 현재작업공정; });
  } else if (현재작업공정) {
    결과 = 결과.filter(function(h) { return h.공정 === 현재작업공정 && h.완료여부 === false; });
  }

  목록테이블그리기(결과);
  var 안내 = document.getElementById('검색결과안내');
  안내.innerHTML = '검색 결과: <span class="결과강조">' + 결과.length + '건</span>' +
    (결과.length === 0 ? ' — 조건에 맞는 데이터가 없습니다.' : '');
}

function 전체보기() {
  검색기간기본값세팅();
  document.getElementById('검색_품명').value   = '';
  document.getElementById('검색_담당자').value = '';
  if (!현재작업공정) document.getElementById('검색_공정').value = '';
  공정필터목록갱신();
}

function 검색_품목팝업열기() {
  조회팝업열기({
    제목: '품목 조회', 검색힌트: '품명 또는 품번 검색...',
    데이터: 엠블럼_품목목록,
    열목록: [{ 제목: '품번', 필드: '품번' }, { 제목: '품명', 필드: '품명' }, { 제목: '규격', 필드: '규격' }],
    선택시: function(항목) { document.getElementById('검색_품명').value = 항목.품명; }
  });
}

/* ══════════════════════════════════════════
   LOT 팝업
══════════════════════════════════════════ */
async function lot팝업열기() {
  var 전체 = await 엠블럼_데이터불러오기();

  if (현재작업공정) {
    var 미처리 = 전체.filter(function(h) {
      return h.공정 === 현재작업공정 && h.완료여부 === false;
    });
    if (미처리.length > 0) {
      조회팝업열기({
        제목: 현재작업공정 + ' — 미처리 항목 (처리할 것 선택)',
        검색힌트: 'LOT 또는 품명 검색...',
        데이터: 미처리.map(function(h) {
          return { lot번호: h.lot번호||'-', 품명: h.품명, 품번: h.품번, 출발공정: h.출발공정, 입고수량: h.입고수량, 기록id: h.id };
        }),
        열목록: [
          { 제목: 'LOT 번호',  필드: 'lot번호'  },
          { 제목: '품명',      필드: '품명'     },
          { 제목: '출발 공정', 필드: '출발공정' },
          { 제목: '입고수량',  필드: '입고수량' }
        ],
        선택시: function(항목) { 수정하기(항목.기록id); }
      });
      return;
    }
  }

  if (전체.length === 0) { 알림표시('등록된 LOT 번호가 없습니다.', '오류'); return; }

  var lot맵 = {};
  전체.forEach(function(h) {
    var lot = (h.lot번호||'').trim();
    if (!lot) return;
    if (!lot맵[lot]) lot맵[lot] = { lot번호: lot, 품명: h.품명, 품번: h.품번, 현재위치: h.공정, 마지막id: h.id, 입고합: 0, 출고합: 0, 불량합: 0 };
    if (h.id > lot맵[lot].마지막id) { lot맵[lot].마지막id = h.id; lot맵[lot].현재위치 = h.공정; lot맵[lot].품명 = h.품명; }
    lot맵[lot].입고합 += Number(h.입고수량) || 0;
    if (h.완료여부 !== false) { lot맵[lot].출고합 += Number(h.출고수량) || 0; lot맵[lot].불량합 += Number(h.불량수량) || 0; }
  });

  var lot목록 = Object.values(lot맵).map(function(d) {
    return { lot번호: d.lot번호, 품명: d.품명, 현재위치: d.현재위치||'-', 재고수량: d.입고합-d.출고합-d.불량합 };
  });

  조회팝업열기({
    제목: 'LOT 번호 조회', 검색힌트: 'LOT 또는 품명 검색...',
    데이터: lot목록,
    열목록: [
      { 제목: 'LOT 번호',  필드: 'lot번호'  },
      { 제목: '품명',      필드: '품명'     },
      { 제목: '현재 위치', 필드: '현재위치' },
      { 제목: '재고수량',  필드: '재고수량' }
    ],
    선택시: function(항목) { lot선택시(항목, 전체); }
  });
}

function lot선택시(lot데이터, 전체데이터) {
  var _lotEl3 = document.getElementById('lot번호'); if (_lotEl3) _lotEl3.value = lot데이터.lot번호;
  var 품목 = 엠블럼_품목목록.find(function(p) { return p.품명 === lot데이터.품명; });
  if (품목) 품목선택(품목);
  var 위치 = lot데이터.현재위치;
  if (위치 && 위치 !== '-' && 위치 !== APP_CONFIG.외부공정.출하) {
    document.getElementById('출발공정').value = 위치;
  }
  if (lot데이터.재고수량 > 0) {
    document.getElementById('입고수량').value = lot데이터.재고수량;
    document.getElementById('출고수량').value = lot데이터.재고수량;
  }
  잔량미리보기();

  var 관련 = (전체데이터 || []).filter(function(h) {
    return (h.lot번호||'').trim() === lot데이터.lot번호;
  });
  목록테이블그리기(관련);
  var 안내 = document.getElementById('검색결과안내');
  안내.innerHTML = 'LOT <b>' + lot데이터.lot번호 + '</b> 이력: <span class="결과강조">' + 관련.length + '건</span>' +
    ' &nbsp;<button class="버튼 회색" style="font-size:11px;height:22px;padding:0 8px;" onclick="목록새로고침()">전체 목록</button>';
}

/* ══════════════════════════════════════════
   공용 조회 팝업
══════════════════════════════════════════ */
var 현재팝업설정       = null;
var 원본팝업데이터     = [];
var 현재팝업필터데이터 = [];
var 현재선택행인덱스   = -1;

function 조회팝업키보드핸들러(e) {
  var 행목록 = document.querySelectorAll('#조회팝업_테이블바디 tr');
  if (!행목록.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    현재선택행인덱스 = Math.min(현재선택행인덱스 + 1, 행목록.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    현재선택행인덱스 = Math.max(현재선택행인덱스 - 1, 0);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (현재선택행인덱스 >= 0 && 현재선택행인덱스 < 현재팝업필터데이터.length) {
      현재팝업설정.선택시(현재팝업필터데이터[현재선택행인덱스]); 조회팝업닫기();
    } else if (현재팝업필터데이터.length === 1) {
      현재팝업설정.선택시(현재팝업필터데이터[0]); 조회팝업닫기();
    }
    return;
  } else { return; }
  행목록.forEach(function(행, i) { 행.classList.toggle('팝업행키보드선택', i === 현재선택행인덱스); });
  if (행목록[현재선택행인덱스]) 행목록[현재선택행인덱스].scrollIntoView({ block: 'nearest' });
}

function 조회팝업열기(설정) {
  현재팝업설정      = 설정;
  원본팝업데이터    = 설정.데이터;
  현재선택행인덱스  = -1;
  document.getElementById('조회팝업_제목').textContent = 설정.제목;
  var 검색입력 = document.getElementById('조회팝업_검색');
  검색입력.value = '';
  검색입력.placeholder = 설정.검색힌트 || '검색...';
  검색입력.removeEventListener('keydown', 조회팝업키보드핸들러);
  검색입력.addEventListener('keydown', 조회팝업키보드핸들러);
  var 헤더 = document.getElementById('조회팝업_헤더행');
  헤더.innerHTML = '<th style="width:36px;"></th>';
  설정.열목록.forEach(function(열) { var th = document.createElement('th'); th.textContent = 열.제목; 헤더.appendChild(th); });
  조회팝업테이블채우기(원본팝업데이터);
  document.getElementById('조회팝업_오버레이').style.display = 'flex';
  setTimeout(function() { 검색입력.focus(); }, 50);
}

function 조회팝업닫기() { document.getElementById('조회팝업_오버레이').style.display = 'none'; }

function 팝업배경클릭(e) {
  if (e.target === document.getElementById('조회팝업_오버레이')) 조회팝업닫기();
}

function 조회팝업검색필터() {
  var 검색어 = document.getElementById('조회팝업_검색').value.trim().toLowerCase();
  if (!검색어) { 조회팝업테이블채우기(원본팝업데이터); return; }
  조회팝업테이블채우기(원본팝업데이터.filter(function(항목) {
    return 현재팝업설정.열목록.some(function(열) {
      return String(항목[열.필드]||'').toLowerCase().includes(검색어);
    });
  }));
}

function 조회팝업테이블채우기(목록) {
  현재팝업필터데이터 = 목록;
  현재선택행인덱스   = -1;
  var 바디 = document.getElementById('조회팝업_테이블바디');
  바디.innerHTML = '';
  if (목록.length === 0) {
    var 열수 = (현재팝업설정 ? 현재팝업설정.열목록.length : 3) + 1;
    바디.innerHTML = '<tr><td colspan="' + 열수 + '" class="빈목록안내">검색 결과가 없습니다.</td></tr>';
    return;
  }
  목록.forEach(function(항목) {
    var 행 = document.createElement('tr');
    var 체크td = document.createElement('td');
    var 체크 = document.createElement('input'); 체크.type = 'checkbox';
    체크td.appendChild(체크); 행.appendChild(체크td);
    현재팝업설정.열목록.forEach(function(열) {
      var td = document.createElement('td');
      td.textContent = 항목[열.필드] !== undefined ? 항목[열.필드] : '';
      행.appendChild(td);
    });
    행.addEventListener('click', function(e) {
      e.stopPropagation();
      document.querySelectorAll('#조회팝업_테이블바디 input[type=checkbox]').forEach(function(c) { c.checked = false; });
      document.querySelectorAll('#조회팝업_테이블바디 tr').forEach(function(r) { r.classList.remove('팝업선택행'); });
      체크.checked = true; 행.classList.add('팝업선택행');
      var 선택항목 = 항목;
      var 현재설정 = 현재팝업설정;
      조회팝업닫기();
      if (현재설정 && 현재설정.선택시) 현재설정.선택시(선택항목);
    });
    바디.appendChild(행);
  });
}

function 품목조회팝업열기() {
  조회팝업열기({
    제목: '품목 조회', 검색힌트: '품명 또는 품번 검색...',
    데이터: 엠블럼_품목목록,
    열목록: [{ 제목: '품번', 필드: '품번' }, { 제목: '품명', 필드: '품명' }, { 제목: '규격', 필드: '규격' }],
    선택시: function(항목) { 품목선택(항목); }
  });
}

function 담당자조회팝업열기() {
  조회팝업열기({
    제목: '담당자 조회', 검색힌트: '이름·직급·코드 검색...',
    데이터: 엠블럼_담당자목록,
    열목록: [{ 제목: '코드', 필드: '코드' }, { 제목: '직급', 필드: '직급' }, { 제목: '이름', 필드: '이름' }],
    선택시: function(항목) { 담당자선택(항목); }
  });
}

/* ══════════════════════════════════════════
   전체선택 / 확정
══════════════════════════════════════════ */
function 전체선택토글() {
  var 전체체크 = document.getElementById('전체선택체크');
  document.querySelectorAll('.행선택체크').forEach(function(c) { c.checked = 전체체크.checked; });
}

async function 확정처리() {
  var 선택ids = Array.from(document.querySelectorAll('.행선택체크:checked'))
                     .map(function(c) { return Number(c.value); });
  if (선택ids.length === 0) { 알림표시('확정할 항목을 선택해주세요.', '오류'); return; }
  확인모달표시(선택ids.length + '건을 확정하고 매출관리로 전송하시겠습니까?', async function() {
    /* 현재 표시 목록에서 미전송 항목만 추출 */
    var 미전송항목 = 현재표시목록.filter(function(h) {
      return 선택ids.includes(h.id) && !h.매출확정;
    });

    if (미전송항목.length === 0) {
      알림표시('선택한 항목이 이미 모두 매출관리로 전송되었습니다.', '오류');
      공정필터목록갱신();
      return;
    }

    var 매출행들 = 미전송항목.map(function(h) {
      return {
        입출고id: h.id,
        품명:     h.품명,
        품번:     h.품번 || '',
        출발공정: h.출발공정 || '',
        도착공정: h.도착공정 || '',
        출고수량: h.출고수량,
        출고일자: h.출고일자,
        lot번호:  '',
        담당자:   h.담당자 || '',
        단가:     Number(h.단가) || 0,
        확정일시: new Date().toISOString()
      };
    });

    try {
      /* 재확정 시 기존 매출기록 제거 (중복 방지) */
      var 입출고ids = 미전송항목.map(function(h) { return h.id; });
      await 수파베이스.from('매출기록').delete().in('입출고id', 입출고ids);

      var result = await 수파베이스.from('매출기록').insert(매출행들);
      if (result.error) { 알림표시('매출 전송 실패: ' + result.error.message, '오류'); return; }

      /* Supabase 레코드에 매출확정 마킹 */
      await Promise.all(미전송항목.map(function(h) {
        return 엠블럼_데이터수정(h.id, { 매출확정: true });
      }));
      알림표시(미전송항목.length + '건이 확정되어 매출관리로 전송되었습니다.', '성공');
      공정필터목록갱신();
    } catch(err) {
      알림표시('확정 처리 중 오류: ' + (err.message || err), '오류');
      console.error(err);
    }
  });
}

/* ══════════════════════════════════════════
   엑셀
══════════════════════════════════════════ */
function 엑셀날짜이번달() {
  var d = new Date();
  var 년 = d.getFullYear(), 월 = String(d.getMonth()+1).padStart(2,'0');
  var 말일 = String(new Date(년, d.getMonth()+1, 0).getDate()).padStart(2,'0');
  var s = document.getElementById('엑셀시작일'), e = document.getElementById('엑셀종료일');
  if (s) s.value = 년 + '-' + 월 + '-01';
  if (e) e.value = 년 + '-' + 월 + '-' + 말일;
}

function AQL검사수량계산(lotSize) {
  var n = Number(lotSize) || 0;
  if (n <= 8)    return 2;  if (n <= 15)   return 3;  if (n <= 25)   return 5;
  if (n <= 50)   return 8;  if (n <= 90)   return 13; if (n <= 150)  return 20;
  if (n <= 280)  return 32; if (n <= 500)  return 50; if (n <= 1200) return 80;
  if (n <= 3200) return 125; return 200;
}

function 엑셀날짜변환(dateStr) {
  if (!dateStr) return null;
  var d = new Date(dateStr + 'T00:00:00Z');
  return Math.floor((d - new Date(Date.UTC(1899, 11, 30))) / 86400000);
}

function 색상판별(품명) {
  if (!품명) return 'S/V';
  var 규칙 = (APP_CONFIG.매출고정값 && APP_CONFIG.매출고정값.규격규칙) || [];
  for (var i = 0; i < 규칙.length; i++) {
    if (품명.toUpperCase().includes(규칙[i].품명포함.toUpperCase())) return 규칙[i].규격;
  }
  return (APP_CONFIG.매출고정값 && APP_CONFIG.매출고정값.규격기본) || 'S/V';
}

async function 출하검사_엑셀다운로드() {
  var 공정검사여부 = 현재작업공정 === '공정검사';
  var _오늘 = new Date();
  var _년 = _오늘.getFullYear(), _월 = String(_오늘.getMonth()+1).padStart(2,'0');
  var _말일 = String(new Date(_년, _오늘.getMonth()+1, 0).getDate()).padStart(2,'0');
  var 시작일 = (document.getElementById('엑셀시작일')||{}).value || (_년+'-'+_월+'-01');
  var 종료일 = (document.getElementById('엑셀종료일')||{}).value || (_년+'-'+_월+'-'+_말일);
  var 선택업체 = (document.getElementById('엑셀업체')||{}).value || (APP_CONFIG.출하검사옵션.도착공정||[])[0]||'';
  var 버튼 = document.getElementById('엑셀다운로드버튼');

  if (!선택업체) { 알림표시('업체를 선택하세요.', '오류'); return; }
  if (버튼) { 버튼.disabled = true; 버튼.textContent = '생성 중...'; }

  try {
    var 전체 = await 엠블럼_데이터불러오기();
    var 공정 = 현재작업공정 || '출하검사';
    var 전체필터 = 전체.filter(function(h) { return h.공정 === 공정 && h.도착공정 === 선택업체; });

    function 날짜정렬(arr) {
      return arr.sort(function(a,b) { var da=a.출고일자||'',db=b.출고일자||''; return da>db?1:da<db?-1:a.id-b.id; });
    }
    function 차종추출(품명) { return (APP_CONFIG.차종매핑[품명]||{}).차종||품명||''; }

    var 업체단축명 = 선택업체.replace(/\(주\)/g,'').trim();
    var 데이터 = 날짜정렬(전체필터.filter(function(h) {
      return (h.출고일자||'')>=시작일 && (h.출고일자||'')<=종료일;
    }));

    if (데이터.length === 0) {
      알림표시(시작일+'~'+종료일+' '+업체단축명+' 데이터가 없습니다.', '오류');
      if (버튼) { 버튼.disabled=false; 버튼.textContent='검사대장 출력'; } return;
    }

    var BASE64 = 공정검사여부
      ? (typeof 아노다이징출하대장_BASE64 !== 'undefined' ? 아노다이징출하대장_BASE64 : null)
      : (typeof 보은금속출하대장_BASE64  !== 'undefined' ? 보은금속출하대장_BASE64  : null);
    if (!BASE64) { 알림표시('템플릿 파일이 로드되지 않았습니다.', '오류'); if (버튼) { 버튼.disabled=false; 버튼.textContent='검사대장 출력'; } return; }

    var bin = atob(BASE64), buf = new Uint8Array(bin.length);
    for (var i=0; i<bin.length; i++) buf[i] = bin.charCodeAt(i);

    var workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buf.buffer);

    var REF_ROW = 6;
    var ws1 = workbook.worksheets[0];
    var colMax = ws1 && ws1.columnCount ? ws1.columnCount : 25;
    var styles = [];
    for (var c=1; c<=colMax; c++) {
      var rc = ws1.getRow(REF_ROW).getCell(c);
      styles[c] = JSON.parse(JSON.stringify(rc.style||{}));
    }
    데이터.forEach(function(항목, idx) {
      var rowNum = REF_ROW + idx, row = ws1.getRow(rowNum);
      var 수량 = Number(항목.입고수량)||Number(항목.출고수량)||0;
      var 불량 = Number(항목.불량수량)||0;
      var 검사수량 = AQL검사수량계산(수량);
      var 불량율 = 검사수량 > 0 ? 불량/검사수량 : 0;
      var vals = [엑셀날짜변환(항목.출고일자), 차종추출(항목.품명), 색상판별(항목.품명), 수량, 검사수량, 불량율, 불량, 불량===0?'OK':'NG','','','',''];
      for (var c2=1; c2<=Math.min(vals.length,colMax); c2++) {
        var cell = row.getCell(c2);
        cell.value = vals[c2-1]; cell.style = JSON.parse(JSON.stringify(styles[c2]||{}));
      }
      row.commit();
    });

    var 파일명 = 업체단축명+'출하검사대장_'+_년+_월+'.xlsx';
    var ab = await workbook.xlsx.writeBuffer();
    var blob = new Blob([ab],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href=url; a.download=파일명; a.click();
    setTimeout(function(){URL.revokeObjectURL(url);}, 1000);
    알림표시(파일명+' 다운로드 완료', '성공');
  } catch(err) {
    알림표시('엑셀 생성 실패: '+(err.message||err), '오류');
    console.error(err);
  }
  if (버튼) { 버튼.disabled=false; 버튼.textContent='검사대장 출력'; }
}

/* ══════════════════════════════════════════
   폼 엔터 핸들러
══════════════════════════════════════════ */
function 폼엔터핸들러(event, 현재id) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  var 검사공정 = 출하공정검사계열(현재작업공정);

  if (현재id === '출고일자') {
    var 일자el = document.getElementById('출고일자');
    if (!일자el.value || !/^\d{4}-\d{2}-\d{2}$/.test(일자el.value)) {
      var t = new Date();
      일자el.value = t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0');
      폼임시저장();
    }
    setTimeout(function() { document.getElementById('단가').focus(); }, 0);
    return;
  }
  if (검사공정 && 현재id === '출고수량') { document.getElementById('담당자입력').focus(); return; }
  if (검사공정 && 현재id === '담당자입력') { 저장하기(); return; }

  var idx = 폼입력순서.indexOf(현재id);
  if (idx === -1) return;
  var 다음id = 폼입력순서[idx + 1];
  if (!다음id) { 저장하기(); return; }

  if (현재id === '출발공정') 공정코드변환('출발');
  else if (현재id === '도착공정') 공정코드변환('도착');

  var 다음el = document.getElementById(다음id);
  if (!다음el) return;
  다음el.focus();
  var 출발값 = document.getElementById('출발공정').value;
  var 도착값 = document.getElementById('도착공정').value;
  if (다음id === '출발공정' && !출발값) 공정팝업열기('출발');
  else if (다음id === '담당자입력' && !검사공정) 담당자조회팝업열기();
}

/* ══════════════════════════════════════════
   모달
══════════════════════════════════════════ */
function 확인모달표시(메시지, 콜백) {
  document.getElementById('확인모달_메시지').textContent = 메시지;
  var 버튼 = document.getElementById('확인모달_확인버튼');
  버튼.onclick = function() { 확인모달닫기(); 콜백(); };
  document.getElementById('확인모달_오버레이').style.display = 'flex';
}

function 확인모달닫기() {
  document.getElementById('확인모달_오버레이').style.display = 'none';
}

function 알림모달표시(항목목록) {
  var ul = document.getElementById('알림모달_목록');
  ul.innerHTML = '';
  항목목록.forEach(function(항목) {
    var li = document.createElement('li');
    li.style.cssText = 'display:flex;align-items:center;gap:10px;background:#fff5f5;border:1px solid #f5c6cb;border-radius:6px;padding:8px 12px;font-size:13px;color:#c0392b;font-weight:bold;';
    li.innerHTML = '<span style="font-size:15px;">⚠</span>' + 항목;
    ul.appendChild(li);
  });
  document.getElementById('알림모달_오버레이').style.display = 'flex';
}

function 알림모달닫기() {
  document.getElementById('알림모달_오버레이').style.display = 'none';
}

function 알림표시(메시지, 종류) {
  var el = document.getElementById('알림박스');
  if (!el) return;
  el.textContent = 메시지;
  el.className = '알림 ' + 종류;
  el.style.display = 'block';
  setTimeout(function() { el.style.display = 'none'; }, 3500);
}
