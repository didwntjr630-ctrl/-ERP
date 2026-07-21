/* ===================================================
   입출고.js
   데이터 모델:
     공정      - 이 기록이 속하는 공정 (필터 기준)
     출발공정  - 어디서 왔는지
     입고수량  - 이 공정이 받은 수량
     도착공정  - 어디로 보내는지
     출고수량  - 이 공정이 보낸 수량
     불량수량  - 이 공정에서 발생한 불량
     완료여부  - false = 자동생성 미처리, true = 등록 완료
   =================================================== */

var 수정중인id            = null;
var 수정중인항목이확정됨  = false;
var 선택된품목   = null;
var 선택된담당자 = null;
var 현재작업공정 = null;
var 출발공정목록 = [];
var 도착공정목록 = [];
var 확정된id목록 = new Set();
var _앱브로드캐스트채널 = null;
var 현재표시목록 = [];
var 월피커_내부년 = new Date().getFullYear();
var 월피커_선택년 = new Date().getFullYear();
var 월피커_선택월 = new Date().getMonth() + 1;

/* ── 월 피커 ── */
function 월피커토글(e) {
  if (e) e.stopPropagation();
  var popup = document.getElementById('월피커팝업');
  if (!popup) return;
  if (popup.style.display === 'none') {
    월피커그리드그리기();
    popup.style.display = 'block';
  } else {
    popup.style.display = 'none';
  }
}

function 월피커년도변경(방향) {
  월피커_내부년 += 방향;
  월피커그리드그리기();
}

function 월피커그리드그리기() {
  var 헤더 = document.getElementById('월피커년도헤더');
  if (헤더) 헤더.textContent = 월피커_내부년;
  var 그리드 = document.getElementById('월피커그리드');
  if (!그리드) return;
  var 오늘 = new Date();
  var 오늘년 = 오늘.getFullYear();
  var 오늘월 = 오늘.getMonth() + 1;
  그리드.innerHTML = '';
  for (var m = 1; m <= 12; m++) {
    var 선택됨 = (월피커_내부년 === 월피커_선택년 && m === 월피커_선택월);
    var 이번달 = (월피커_내부년 === 오늘년 && m === 오늘월);
    var btn = document.createElement('button');
    btn.style.cssText = 'border:none; border-radius:6px; padding:7px 2px; cursor:pointer; font-size:13px; width:100%; position:relative;'
      + (선택됨 ? 'background:#222; color:#fff; font-weight:bold;' : 'background:#f5f5f5; color:#333;');
    var label = document.createTextNode(m + '월');
    btn.appendChild(label);
    if (이번달 && !선택됨) {
      var dot = document.createElement('span');
      dot.style.cssText = 'position:absolute; top:2px; right:3px; width:5px; height:5px; background:#e53935; border-radius:50%; display:block;';
      btn.appendChild(dot);
    }
    (function(month) {
      btn.onclick = function(e) { e.stopPropagation(); 월피커선택(월피커_내부년, month); };
    })(m);
    그리드.appendChild(btn);
  }
}

function 월피커선택(년, 월) {
  월피커_선택년 = 년;
  월피커_선택월 = 월;
  var 년el = document.getElementById('엑셀년도');
  var 월el = document.getElementById('엑셀월');
  if (년el) 년el.value = String(년);
  if (월el) 월el.value = String(월).padStart(2, '0');
  월피커텍스트갱신();
  var popup = document.getElementById('월피커팝업');
  if (popup) popup.style.display = 'none';
}

function 월피커텍스트갱신() {
  var span = document.getElementById('월피커텍스트');
  if (!span) return;
  if (!월피커_선택년 || !월피커_선택월) { span.textContent = '년월 선택'; return; }
  span.textContent = 월피커_선택년 + '년 ' + String(월피커_선택월).padStart(2, '0') + '월';
}

function 월피커지우기() {
  월피커_선택년 = null;
  월피커_선택월 = null;
  var 년el = document.getElementById('엑셀년도');
  var 월el = document.getElementById('엑셀월');
  if (년el) 년el.value = '';
  if (월el) 월el.value = '';
  월피커텍스트갱신();
  월피커그리드그리기();
}

function 월피커이번달() {
  var 오늘 = new Date();
  월피커_내부년 = 오늘.getFullYear();
  월피커선택(오늘.getFullYear(), 오늘.getMonth() + 1);
}

/* ── 폼 임시저장 / 복원 (페이지 이탈 후 복귀 대비) ── */
var 폼임시저장키 = 'erp_폼임시저장';

function 폼임시저장() {
  if (수정중인id) return; // 수정 모드일 때는 저장 안 함
  var 데이터 = {
    품명:     document.getElementById('품명').value,
    품번:     선택된품목 ? 선택된품목.품번 : '',
    일자:     document.getElementById('출고일자').value,
    lot:      document.getElementById('lot번호').value,
    출발공정: document.getElementById('출발공정').value,
    도착공정: document.getElementById('도착공정').value,
    입고수량: document.getElementById('입고수량').value,
    출고수량: document.getElementById('출고수량').value,
    담당자명: document.getElementById('담당자입력').value,
    담당자코드: document.getElementById('담당자코드표시').textContent
  };
  sessionStorage.setItem(폼임시저장키, JSON.stringify(데이터));
}

function 폼임시저장복원() {
  var raw = sessionStorage.getItem(폼임시저장키);
  if (!raw) return;
  var d = JSON.parse(raw);
  if (!d.품명 && !d.lot && !d.입고수량) return; // 빈 데이터면 복원 안 함

  if (d.품명) {
    document.getElementById('품명').value = d.품명;
    선택된품목 = 품목목록.find(function(p) { return p.품명 === d.품명; }) || null;
    if (선택된품목) document.getElementById('품명품번표시').textContent = '(' + 선택된품목.품번 + ')';
  }
  if (d.일자)     document.getElementById('출고일자').value = d.일자;
  if (d.lot)      document.getElementById('lot번호').value  = d.lot;
  if (d.출발공정) document.getElementById('출발공정').value = d.출발공정;
  if (d.도착공정) document.getElementById('도착공정').value = d.도착공정;
  if (d.입고수량) document.getElementById('입고수량').value = d.입고수량;
  if (d.출고수량) document.getElementById('출고수량').value = d.출고수량;
  if (d.담당자명) {
    document.getElementById('담당자입력').value = d.담당자명;
    document.getElementById('담당자코드표시').textContent = d.담당자코드;
    선택된담당자 = 담당자목록.find(function(t) { return t.이름 === d.담당자명; }) || null;
  }
}

function 폼임시저장초기화() {
  sessionStorage.removeItem(폼임시저장키);
}

/* ── 페이지 로드 ── */
document.addEventListener('DOMContentLoaded', async function() {
  오늘날짜세팅();
  검색기간기본값세팅();
  담당자검색옵션채우기();
  // 월 피커 초기화
  (function() {
    var 오늘 = new Date();
    월피커_내부년 = 오늘.getFullYear();
    월피커_선택년 = 오늘.getFullYear();
    월피커_선택월 = 오늘.getMonth() + 1;
    var 년el = document.getElementById('엑셀년도');
    var 월el = document.getElementById('엑셀월');
    if (년el) 년el.value = String(월피커_선택년);
    if (월el) 월el.value = String(월피커_선택월).padStart(2, '0');
    월피커텍스트갱신();
    월피커그리드그리기();
    document.addEventListener('click', function(e) {
      var popup = document.getElementById('월피커팝업');
      var wrap = document.getElementById('월피커감싸기');
      if (popup && wrap && !wrap.contains(e.target)) popup.style.display = 'none';
    });
  })();
  // 업체 선택 셀렉터 초기화
  (function() {
    var 업체sel = document.getElementById('엑셀업체');
    if (!업체sel) return;
    (APP_CONFIG.출하검사옵션.도착공정 || []).forEach(function(업체명) {
      var opt = document.createElement('option');
      opt.value = 업체명;
      opt.textContent = 업체명;
      업체sel.appendChild(opt);
    });
  })();
  await 공정뷰선택('출하검사');  // 출하검사 기본 선택
  폼임시저장복원();               // 이탈 전 작성 내용 복원

  document.addEventListener('click', function(e) {
    if (!document.getElementById('품명감싸기').contains(e.target)) 드롭다운닫기();
  });

  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    if (document.getElementById('확인모달_오버레이').style.display !== 'none') { 확인모달닫기(); return; }
    if (document.getElementById('알림모달_오버레이').style.display !== 'none') { 알림모달닫기(); return; }
    if (document.getElementById('조회팝업_오버레이').style.display !== 'none') { 조회팝업닫기(); return; }
  });

  // 다른 PC의 변경을 실시간으로 반영 (Supabase Realtime)
  var _실시간타이머 = null;
  function _실시간갱신() {
    clearTimeout(_실시간타이머);
    _실시간타이머 = setTimeout(공정필터목록갱신, 400);
  }
  // postgres_changes: 입출고기록 변경 (저장·수정·삭제)
  수파베이스
    .channel('입출고실시간')
    .on('postgres_changes', { event: '*', schema: 'public', table: '입출고기록' }, _실시간갱신)
    .subscribe();
  // broadcast: 확정처리 완료 신호 수신
  _앱브로드캐스트채널 = 수파베이스
    .channel('app_broadcast')
    .on('broadcast', { event: '확정갱신' }, _실시간갱신)
    .subscribe();

  // 폴링: 5초마다 확정 상태 체크 (Realtime 보완용)
  setInterval(async function() {
    if (현재작업공정 !== '출하검사' && 현재작업공정 !== '공정검사') return;
    var 이전크기 = 확정된id목록.size;
    var 이전목록 = new Set(확정된id목록);
    await 확정id목록갱신();
    var 변경 = 확정된id목록.size !== 이전크기;
    if (!변경) {
      for (var _id of 확정된id목록) { if (!이전목록.has(_id)) { 변경 = true; break; } }
    }
    if (변경) 공정필터목록갱신();
  }, 5000);
});

/* ── 날짜 기본값 ── */
function 오늘날짜세팅() {
  var d = new Date();
  var v = d.getFullYear() + '-' +
          String(d.getMonth()+1).padStart(2,'0') + '-' +
          String(d.getDate()).padStart(2,'0');
  var el = document.getElementById('출고일자');
  if (el) el.value = v;
  var 월el = document.getElementById('출하현황_월필터');
  if (월el) 월el.value = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
}

/* ── 입고수량 변경 시 출하검사는 출고수량 자동 동기화 ── */
function 입고수량변경() {
  if (현재작업공정 === '출하검사' || 현재작업공정 === '공정검사') {
    var v = document.getElementById('입고수량').value;
    document.getElementById('출고수량').value = v;
  }
  잔량미리보기();
}

/* ── 잔량 미리보기 (입고 - 출고 - 불량) ── */
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
   공정 선택 모드
══════════════════════════════════════════ */
var 공정순서 = APP_CONFIG.공정목록;

async function 공정뷰선택(공정) {
  현재작업공정 = 공정;

  document.querySelectorAll('.공정선택버튼').forEach(function(b) { b.classList.remove('활성'); });
  if (공정) {
    document.querySelectorAll('.공정선택버튼').forEach(function(b) {
      if (b.textContent.trim() === 공정) b.classList.add('활성');
    });
  } else {
    document.querySelectorAll('.공정선택버튼.전체버튼').forEach(function(b) { b.classList.add('활성'); });
  }

  var 폼제목 = document.querySelector('#폼카드 .페이지제목');
  var 목록제목 = document.getElementById('목록제목');
  var 안내박스 = document.getElementById('공정뷰안내');

  var 확정버튼영역 = document.getElementById('확정버튼영역');
  if (공정) {
    if (폼제목)  폼제목.textContent  = 공정 + ' 입출고 등록';
    if (목록제목) 목록제목.textContent = 공정 + ' 입출고 목록';
    if (안내박스) 안내박스.style.display = (공정 === '출하검사' || 공정 === '공정검사') ? 'none' : 'block';
    if (확정버튼영역) 확정버튼영역.style.display = (공정 === '출하검사' || 공정 === '공정검사') ? 'flex' : 'none';
    document.getElementById('출발공정').value = 공정;
    document.getElementById('검색_공정').value = 공정;
  } else {
    if (폼제목)  폼제목.textContent  = '입출고 등록';
    if (목록제목) 목록제목.textContent = '입출고 목록';
    if (안내박스) 안내박스.style.display = 'none';
    if (확정버튼영역) 확정버튼영역.style.display = 'none';
    document.getElementById('검색_공정').value = '';
  }

  // 출하현황 제목 변경
  var 현황제목 = document.querySelector('#출하현황카드제목, .카드 .페이지제목[data-현황]');
  // 제목 직접 탐색 (고정 텍스트 기준)
  document.querySelectorAll('.카드 .페이지제목').forEach(function(el) {
    if (el.textContent.trim() === '출하 현황' || el.textContent.trim() === '코팅 출하 현황') {
      el.textContent = (공정 === '공정검사') ? '코팅 출하 현황' : '출하 현황';
    }
  });

  공정별출발도착옵션갱신(공정);
  // 검사대장 출력 업체 선택지 갱신
  var 업체sel = document.getElementById('엑셀업체');
  if (업체sel) {
    업체sel.innerHTML = '';
    var 옵션소스 = (공정 === '공정검사') ? APP_CONFIG.공정검사옵션 : APP_CONFIG.출하검사옵션;
    (옵션소스.도착공정 || []).forEach(function(업체명) {
      var opt = document.createElement('option');
      opt.value = 업체명; opt.textContent = 업체명;
      업체sel.appendChild(opt);
    });
  }
  출하검사폼전환(공정);
  폼초기화();
  await 공정필터목록갱신();
  await 공정별재고요약();
}

function 출하검사폼전환(공정) {
  var 검사공정 = 공정 === '출하검사' || 공정 === '공정검사';
  document.getElementById('불량수량그룹').style.display = 검사공정 ? 'none' : '';
  document.getElementById('잔량그룹').style.display     = 검사공정 ? 'none' : '';
  var 출발el = document.getElementById('출발공정');
  if (공정 === '출하검사') {
    출발el.value    = APP_CONFIG.출하검사옵션.출발공정[0];
    출발el.readOnly = false;
  } else if (공정 === '공정검사') {
    출발el.value    = APP_CONFIG.공정검사옵션.출발공정[0];
    출발el.readOnly = true;
    document.getElementById('도착공정').value = APP_CONFIG.공정검사옵션.도착공정[0];
  } else {
    출발el.readOnly = false;
  }
}

function 공정별출발도착옵션갱신(공정) {
  if (공정 === '출하검사') {
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

/* 코드 입력 시 공정명으로 자동 변환 (예: "2000" → "(주)보은금속") */
function 공정코드변환(구분) {
  var 필드 = document.getElementById(구분 + '공정');
  var 입력 = (필드.value || '').trim();
  if (!입력) return;
  var 목록 = 구분 === '출발' ? 출발공정목록 : 도착공정목록;
  var 매칭 = 목록.find(function(p) {
    return APP_CONFIG.공정코드[p] === 입력;
  });
  if (매칭) {
    필드.value = 매칭;
    잔량미리보기();
    폼임시저장();
  }
}

function 공정팝업열기(구분) {
  var 목록 = 구분 === '출발' ? 출발공정목록 : 도착공정목록;
  var 데이터 = 목록.map(function(p) {
    return {
      코드:   APP_CONFIG.공정코드[p] || '-',
      공정명: p
    };
  });
  조회팝업열기({
    제목:       구분 === '출발' ? '출발 공정 선택' : '도착 공정 선택',
    검색힌트:   '공정명 또는 코드 검색...',
    데이터:     데이터,
    열목록: [
      { 제목: '코드',   필드: '코드'   },
      { 제목: '공정명', 필드: '공정명' }
    ],
    선택시: function(항목) {
      document.getElementById(구분 + '공정').value = 항목.공정명;
      잔량미리보기();
      폼임시저장();
      if (구분 === '출발') {
        setTimeout(function() { document.getElementById('입고수량').focus(); }, 50);
      }
    },
    빈엔터시: 구분 === '출발' ? function() {
      setTimeout(function() { document.getElementById('입고수량').focus(); }, 50);
    } : null
  });
}

async function 확정id목록갱신() {
  if (현재작업공정 !== '출하검사' && 현재작업공정 !== '공정검사') { 확정된id목록 = new Set(); return; }
  var { data } = await 수파베이스.from('매출기록').select('입출고id');
  확정된id목록 = new Set((data || []).map(function(r) { return Number(r['입출고id']); }));
}

async function 공정필터목록갱신() {
  await 확정id목록갱신();
  var 전체 = await 데이터불러오기();
  var 결과;

  if (!현재작업공정) {
    결과 = 전체;
  } else if (현재작업공정 === '수입검사' || 현재작업공정 === '출하검사' || 현재작업공정 === '공정검사') {
    결과 = 전체.filter(function(h) { return h.공정 === 현재작업공정; });
  } else {
    결과 = 전체.filter(function(h) { return h.공정 === 현재작업공정 && h.완료여부 === false; });
  }

  // 출하검사·공정검사: 조회 기간 날짜 필터 적용 (기본값 = 이번 달)
  if (현재작업공정 === '출하검사' || 현재작업공정 === '공정검사') {
    var _시작 = document.getElementById('검색_시작일').value;
    var _종료 = document.getElementById('검색_종료일').value;
    if (_시작) 결과 = 결과.filter(function(h) { return (h.출고일자||h.일자||'') >= _시작; });
    if (_종료) 결과 = 결과.filter(function(h) { return (h.출고일자||h.일자||'') <= _종료; });
  }

  목록테이블그리기(결과);

  var 안내 = document.getElementById('검색결과안내');
  if (현재작업공정) {
    var 미처리 = 결과.filter(function(h) { return h.완료여부 === false; }).length;
    var 완료 = 결과.length - 미처리;
    안내.innerHTML =
      '<b>' + 현재작업공정 + '</b> — ' +
      '완료: <span class="결과강조">' + 완료 + '건</span>' +
      (미처리 > 0
        ? ' / <span style="color:#e67e22; font-weight:bold;">미처리: ' + 미처리 + '건</span>'
        : '');
  } else {
    안내.innerHTML = '';
  }
}

/* ══════════════════════════════════════════
   품명 자동완성
══════════════════════════════════════════ */
function 품명입력시() {
  선택된품목 = null;
  document.getElementById('품명품번표시').textContent = '';
  var 검색어 = document.getElementById('품명').value.trim();
  var 드롭다운 = document.getElementById('품명드롭다운');
  if (!검색어) { 드롭다운닫기(); return; }

  var 결과 = 품목검색(검색어);
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
  작업시작알림();
}

function 드롭다운닫기() {
  var d = document.getElementById('품명드롭다운');
  if (d) d.style.display = 'none';
}

/* ── 담당자 선택 ── */
function 담당자선택(항목) {
  선택된담당자 = 항목;
  document.getElementById('담당자입력').value = 항목.직급 + ' ' + 항목.이름;
  document.getElementById('담당자코드표시').textContent = '코드: ' + 항목.코드;
  폼임시저장();
}

/* ══════════════════════════════════════════
   저장 / 수정 / 삭제
══════════════════════════════════════════ */
async function 저장하기() {
  var 품명값  = document.getElementById('품명').value.trim();
  var 입고값  = document.getElementById('입고수량').value.trim();
  var 출고값  = document.getElementById('출고수량').value.trim();
  var 불량값  = document.getElementById('불량수량').value.trim();
  var 일자값  = document.getElementById('출고일자').value;
  var lot값   = document.getElementById('lot번호').value.trim();
  var 출발값  = document.getElementById('출발공정').value;
  var 도착값  = document.getElementById('도착공정').value;

  // 품명 유효성 확인
  if (품명값 && !선택된품목) {
    var 찾은 = 품목유효성확인(품명값);
    if (찾은) 선택된품목 = 찾은;
  }

  // 필수 항목 일괄 검사
  var 미입력 = [];
  if (!품명값 || !선택된품목) 미입력.push('품명 (목록에서 선택)');
  if (!일자값)        미입력.push('일자');
  if (!lot값)         미입력.push('LOT No.');
  if (!출발값)        미입력.push('출발 공정');
  if (!입고값)        미입력.push('입고수량');
  if (!도착값)        미입력.push('도착 공정');
  if (!출고값)        미입력.push('출고수량');
  var 검사공정 = 현재작업공정 === '출하검사' || 현재작업공정 === '공정검사';
  if (!선택된담당자 && !검사공정) 미입력.push('담당자');

  if (미입력.length > 0) {
    알림모달표시(미입력);
    return;
  }

  var 입고 = Number(입고값) || 0;
  var 출고 = Number(출고값) || 0;
  var 불량 = Number(불량값) || 0;
  var 기록공정 = 현재작업공정 || 출발값;

  var 새항목 = {
    품명:       선택된품목.품명,
    품번:       선택된품목.품번,
    공정:       기록공정,
    출발공정:   출발값,
    입고수량:   입고,
    도착공정:   도착값,
    출고수량:   출고,
    불량수량:   불량,
    잔량:       입고 - 출고 - 불량,
    출고일자:   일자값,
    'lot번호':  lot값,
    담당자:     선택된담당자 ? (선택된담당자.직급 + ' ' + 선택된담당자.이름) : '',
    담당자코드: 선택된담당자 ? 선택된담당자.코드 : '',
    완료여부:   true
  };

  if (수정중인id !== null) {
    var 확정취소대상 = 수정중인항목이확정됨;
    var 이전기록 = await 데이터하나가져오기(수정중인id);
    var 이전미완료 = 이전기록 && 이전기록.완료여부 === false;
    var 수정됨 = await 데이터수정(수정중인id, 새항목);
    if (!수정됨) {
      알림표시('수정 실패: 이미 삭제된 항목입니다. 목록을 새로고침합니다.', '오류');
      폼초기화(false);
      await 공정필터목록갱신();
      await 공정별재고요약();
      return;
    }

    if (확정취소대상) {
      await 매출기록확정취소(수정중인id);
    }

    if (이전미완료 && 도착값 && 공정순서.includes(도착값)) {
      await 다음공정자동생성(도착값, 기록공정, 출고, 선택된품목, lot값, 일자값);
      알림표시('등록 완료! ' + 도착값 + '에 자동으로 전달되었습니다.' + (확정취소대상 ? ' (매출확정 취소됨. 재확정 필요)' : ''), '성공');
    } else {
      알림표시(확정취소대상 ? '수정 완료. 매출확정이 취소되었습니다. 재확정이 필요합니다.' : '수정되었습니다.', '성공');
    }

    수정중인id = null;
    수정중인항목이확정됨 = false;
    document.getElementById('저장버튼').textContent = '저장';
    document.getElementById('저장버튼').className = '버튼 초록';
    폼카드제거수정강조();
  } else {
    var 저장결과 = await 데이터저장(새항목);
    if (!저장결과) return;
    if (도착값 && 공정순서.includes(도착값)) {
      await 다음공정자동생성(도착값, 기록공정, 출고, 선택된품목, lot값, 일자값);
      알림표시(기록공정 + ' 저장 완료 → ' + 도착값 + '에 자동 전달', '성공');
    } else {
      알림표시(기록공정 + ' 기록이 저장되었습니다.', '성공');
    }
  }

  폼임시저장초기화();
  폼초기화(true);
  await 공정필터목록갱신();
  await 공정별재고요약();
}

/* 다음 공정에 미처리(완료여부=false) 기록 자동 생성 */
async function 다음공정자동생성(도착공정, 원출발공정, 출고수량, 품목, lot, 일자) {
  // 같은 lot + 공정의 미처리 레코드가 이미 있으면 중복 생성 방지
  var { data: 기존 } = await 수파베이스
    .from('입출고기록')
    .select('id')
    .eq('lot번호', lot)
    .eq('공정', 도착공정)
    .eq('완료여부', false)
    .limit(1);
  if (기존 && 기존.length > 0) return;

  var 자동 = {
    품명:       품목.품명,
    품번:       품목.품번,
    공정:       도착공정,
    출발공정:   원출발공정,
    입고수량:   출고수량,
    도착공정:   '',
    출고수량:   0,
    불량수량:   0,
    잔량:       출고수량,
    출고일자:   일자,
    'lot번호':  lot,
    담당자:     '',
    담당자코드: '',
    완료여부:   false
  };
  await 데이터저장(자동);
}

function 오류팝업표시(잘못값) {
  var msg = '❌ 품명 오류\n\n"' + 잘못값 + '" 은(는) 등록된 품명이 아닙니다.\n\n▶ 올바른 품명:\n';
  품목목록.forEach(function(p) { msg += '  • ' + p.품명 + '  [' + p.품번 + ']\n'; });
  alert(msg);
}

async function 수정하기(id) {
  if (잠금_다른사용자작업중) { 알림표시('다른 사용자가 작업 중입니다. 잠시 후 시도해 주세요.', '오류'); return; }

  var 이미확정 = 확정된id목록.has(id);
  if (이미확정) {
    확인모달표시('확정된 항목입니다.\n수정 저장 시 매출확정이 취소됩니다.\n계속 진행하시겠습니까?', function() {
      수정폼채우기(id, true);
    });
    return;
  }
  수정폼채우기(id, false);
}

async function 수정폼채우기(id, 확정됨) {
  var 항목 = await 데이터하나가져오기(id);
  if (!항목) { 알림표시('이미 삭제된 항목입니다. 목록을 새로고침합니다.', '오류'); await 공정필터목록갱신(); return; }

  수정중인항목이확정됨 = 확정됨;

  document.getElementById('품명').value = 항목.품명;
  document.getElementById('품명품번표시').textContent = 항목.품번 ? '품번: ' + 항목.품번 : '';
  선택된품목 = 품목목록.find(function(p) { return p.품명 === 항목.품명; }) || null;

  var 미완료 = 항목.완료여부 === false;
  var 공정처리모드 = 미완료 && 현재작업공정 && 현재작업공정 !== '수입검사';

  document.getElementById('입고수량').value = 항목.입고수량 || 0;
  document.getElementById('출고수량').value = 공정처리모드 ? '' : (항목.출고수량 || 0);
  document.getElementById('불량수량').value = 공정처리모드 ? '' : (항목.불량수량 || 0);
  document.getElementById('출고일자').value = 항목.출고일자 || '';
  document.getElementById('lot번호').value  = 항목['lot번호']  || '';
  document.getElementById('출발공정').value = 공정처리모드 ? 현재작업공정 : (항목.출발공정 || '');
  document.getElementById('출발공정').disabled = 공정처리모드;
  document.getElementById('도착공정').value = 항목.도착공정 || '';

  선택된담당자 = 담당자목록.find(function(d) {
    return (d.직급 + ' ' + d.이름) === 항목.담당자;
  }) || null;
  document.getElementById('담당자입력').value = 항목.담당자 || '';
  document.getElementById('담당자코드표시').textContent = 선택된담당자 ? '코드: ' + 선택된담당자.코드 : '';

  잔량미리보기();
  수정중인id = id;
  document.getElementById('저장버튼').textContent = 미완료 ? '등록 완료' : '변경 저장';
  document.getElementById('저장버튼').className = '버튼 파랑';
  document.getElementById('폼카드').classList.add('수정모드중');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (공정처리모드) {
    알림표시(현재작업공정 + ' 처리: 도착 공정·출고수량을 입력 후 [등록 완료]를 눌러주세요.', '성공');
  } else if (미완료) {
    알림표시(항목.출발공정 + '에서 넘어온 기록입니다. 도착공정·출고수량·불량수량을 입력 후 [등록 완료]를 눌러주세요.', '성공');
  } else {
    알림표시('수정할 내용 변경 후 [변경 저장]을 눌러주세요.', '성공');
  }
  작업시작알림();
}

function 삭제하기(id) {
  if (잠금_다른사용자작업중) { 알림표시('다른 사용자가 작업 중입니다. 잠시 후 시도해 주세요.', '오류'); return; }
  확인모달표시('정말 삭제할까요? 되돌릴 수 없습니다.', async function() {
    var 삭제됨 = await 데이터삭제(id);
    if (삭제됨) {
      폼초기화(false);
      알림표시('삭제되었습니다.', '성공');
    } else {
      알림표시('삭제 실패: 이미 다른 사용자가 삭제한 항목입니다.', '오류');
    }
    await 공정필터목록갱신();
    await 공정별재고요약();
  });
}

function 폼초기화(일자유지) {
  var 현재일자 = document.getElementById('출고일자').value;
  선택된품목   = null;
  선택된담당자 = null;
  document.getElementById('품명').value               = '';
  document.getElementById('품명품번표시').textContent  = '';
  document.getElementById('입고수량').value            = '';
  document.getElementById('출고수량').value            = '';
  document.getElementById('불량수량').value            = '';
  document.getElementById('lot번호').value             = '';
  document.getElementById('출발공정').value            = 현재작업공정 === '출하검사' ? APP_CONFIG.출하검사옵션.출발공정[0] : 현재작업공정 === '공정검사' ? APP_CONFIG.공정검사옵션.출발공정[0] : (현재작업공정 || '');
  document.getElementById('출발공정').readOnly         = 현재작업공정 === '공정검사';
  document.getElementById('출발공정').disabled          = false;
  document.getElementById('도착공정').value            = 현재작업공정 === '공정검사' ? APP_CONFIG.공정검사옵션.도착공정[0] : '';
  document.getElementById('담당자입력').value          = '';
  document.getElementById('담당자코드표시').textContent = '';
  document.getElementById('잔량표시').textContent      = '-';
  document.getElementById('잔량표시').style.color      = '#888';
  document.getElementById('잔량표시').style.fontWeight = 'normal';
  드롭다운닫기();
  if (일자유지 && 현재일자) {
    document.getElementById('출고일자').value = 현재일자;
  } else {
    오늘날짜세팅();
  }
  수정중인id           = null;
  수정중인항목이확정됨 = false;
  document.getElementById('저장버튼').textContent = '저장';
  document.getElementById('저장버튼').className   = '버튼 초록';
  폼카드제거수정강조();
  작업종료알림();
}

function 폼카드제거수정강조() {
  document.getElementById('폼카드').classList.remove('수정모드중');
}

/* ══════════════════════════════════════════
   목록 테이블 그리기
══════════════════════════════════════════ */
async function 목록새로고침() {
  await 공정필터목록갱신();
}

function 목록테이블그리기(목록) {
  // 출고일자 내림차순 → 같은 날짜는 id 내림차순
  목록 = 목록.slice().sort(function(a, b) {
    var da = a.출고일자 || '';
    var db = b.출고일자 || '';
    if (da !== db) return db > da ? 1 : -1;
    return b.id - a.id;
  });
  현재표시목록 = 목록;
  var 바디 = document.getElementById('목록테이블바디');
  바디.innerHTML = '';

  var 전체체크 = document.getElementById('전체선택체크');
  if (전체체크) 전체체크.checked = false;

  if (목록.length === 0) {
    바디.innerHTML = '<tr><td colspan="14" class="빈목록안내">' +
      (현재작업공정 ? 현재작업공정 + ' 관련 데이터가 없습니다.' : '데이터가 없습니다.') +
      '</td></tr>';
    return;
  }

  목록.forEach(function(항목) {
    var 미완료 = 항목.완료여부 === false;
    var 입고 = Number(항목.입고수량) || 0;
    var 출고 = Number(항목.출고수량) || 0;
    var 불량 = Number(항목.불량수량) || 0;
    var 잔 = 입고 - 출고 - 불량;

    var 행 = document.createElement('tr');

    var 도착셀 = 미완료
      ? '<span style="background:#f39c12; color:white; font-size:10px; padding:2px 6px; border-radius:3px;">미처리</span>'
      : (항목.도착공정 || '');

    var 출고셀 = 미완료 ? '<span style="color:#bbb;">-</span>' : 출고;
    var 불량셀 = 미완료 ? '<span style="color:#bbb;">-</span>' : '<span style="color:#e67e22;">' + 불량 + '</span>';
    var 잔셀   = 미완료 ? '<span style="color:#bbb;">-</span>' :
                          '<span style="' + (잔 < 0 ? 'color:#e74c3c; font-weight:bold;' : '') + '">' + 잔 + '</span>';

    var 조치버튼 = 미완료
      ? '<button class="버튼 파랑 소형" onclick="수정하기(' + 항목.id + ')">처리</button> ' +
        '<button class="버튼 빨강 소형" onclick="삭제하기(' + 항목.id + ')">삭제</button>'
      : '<button class="버튼 회색 소형" onclick="수정하기(' + 항목.id + ')">수정</button> ' +
        '<button class="버튼 빨강 소형" onclick="삭제하기(' + 항목.id + ')">삭제</button>';

    var 이미확정 = 확정된id목록.has(항목.id);
    if (이미확정) 행.style.cssText = 'background:#f0f0f0; color:#aaa;';
    else if (미완료) 행.style.cssText = 'background:#fff8e1;';

    var 체크박스셀 = 이미확정
      ? '<td style="text-align:center;"><span style="background:#27ae60; color:white; font-size:10px; font-weight:bold; padding:2px 6px; border-radius:3px; white-space:nowrap;">확인</span></td>'
      : '<td style="text-align:center;"><input type="checkbox" class="행선택체크" value="' + 항목.id + '"></td>';

    행.innerHTML =
      체크박스셀 +
      '<td style="text-align:left;">' + (항목.품명     || '') + '</td>' +
      '<td>' + (항목.품번     || '') + '</td>' +
      '<td style="font-size:11px; color:#666;">' + (항목.출고번호 || '') + '</td>' +
      '<td style="color:#2a6496; font-weight:bold;">' + (항목.출발공정 || '') + '</td>' +
      '<td style="color:#2a6496;">' + 입고 + '</td>' +
      '<td style="color:#27ae60;">' + 출고셀 + '</td>' +
      '<td>' + 불량셀 + '</td>' +
      '<td>' + 잔셀   + '</td>' +
      '<td style="color:#27ae60; font-weight:bold;">' + 도착셀 + '</td>' +
      '<td>' + (항목.담당자   || '') + '</td>' +
      '<td>' + (항목.출고일자 || '') + '</td>' +
      '<td>' + (항목['lot번호']  || '') + '</td>' +
      '<td>' + 조치버튼 + '</td>';
    바디.appendChild(행);
  });
}

/* ══════════════════════════════════════════
   공정별 재고 현황
══════════════════════════════════════════ */
async function 출하현황요약() {
  var 기준공정 = 현재작업공정 === '공정검사' ? '공정검사' : '출하검사';
  var 전체 = await 데이터불러오기();
  var 품명필터   = document.getElementById('출하현황_품명필터').value;
  var 납품처필터 = document.getElementById('출하현황_납품처필터').value;
  var 월필터     = document.getElementById('출하현황_월필터').value;
  var 출하데이터 = 전체.filter(function(h) {
    return h.공정 === 기준공정
      && (!품명필터   || h.품명     === 품명필터)
      && (!납품처필터 || h.도착공정 === 납품처필터)
      && (!월필터     || (h.출고일자 || h.일자 || '').startsWith(월필터));
  });

  var 품목집계 = {};
  출하데이터.forEach(function(h) {
    var 키 = h.품명 || '';
    if (!품목집계[키]) {
      품목집계[키] = { 품번: h.품번 || '', 건수: 0, 출하: 0, 불량: 0 };
    }
    품목집계[키].건수 += 1;
    품목집계[키].출하 += Number(h.출고수량) || 0;
    품목집계[키].불량 += Number(h.불량수량) || 0;
  });

  var 품목목록키 = Object.keys(품목집계).filter(function(k) { return k; });
  var 총출하 = 품목목록키.reduce(function(s, k) { return s + 품목집계[k].출하; }, 0);
  var 총불량 = 품목목록키.reduce(function(s, k) { return s + 품목집계[k].불량; }, 0);

  document.getElementById('출하요약_품목수').textContent = 품목목록키.length;
  document.getElementById('출하요약_총수량').textContent = 총출하.toLocaleString();
  document.getElementById('출하요약_총불량').textContent = 총불량.toLocaleString();

  var 바디 = document.getElementById('출하현황테이블바디');
  바디.innerHTML = '';
  if (품목목록키.length === 0) {
    바디.innerHTML = '<tr><td colspan="5" class="빈목록안내">데이터를 등록하면 출하 현황이 표시됩니다.</td></tr>';
    return;
  }

  품목목록키.sort().forEach(function(키) {
    var d = 품목집계[키];
    var 행 = document.createElement('tr');
    행.innerHTML =
      '<td style="font-weight:bold; color:#1a3a5c;">' + 키 + '</td>' +
      '<td style="color:#555;">' + d.품번 + '</td>' +
      '<td style="color:#2a6496; text-align:center;">' + d.건수 + '</td>' +
      '<td style="color:#27ae60; font-weight:bold; text-align:right;">' + d.출하.toLocaleString() + '</td>' +
      '<td style="color:#e67e22; text-align:right;">' + d.불량.toLocaleString() + '</td>';
    바디.appendChild(행);
  });

  var 합계행 = document.createElement('tr');
  합계행.style.cssText = 'background:#f0f7ff; font-weight:bold; border-top:2px solid #b8d0e8;';
  합계행.innerHTML =
    '<td colspan="2" style="color:#1a3a5c;">합계</td>' +
    '<td style="color:#111; text-align:center;">' + 출하데이터.length + '건</td>' +
    '<td style="color:#111; text-align:right;">' + 총출하.toLocaleString() + ' EA</td>' +
    '<td style="color:#111; text-align:right;">' + 총불량.toLocaleString() + ' EA</td>';
  바디.appendChild(합계행);
}

async function 공정별재고요약() { await 출하현황요약(); }

function 출하현황품목조회팝업열기() {
  조회팝업열기({
    제목: '품목 조회', 검색힌트: '품명 또는 품번 검색...',
    데이터: 품목목록,
    열목록: [{ 제목: '품번', 필드: '품번' }, { 제목: '품명', 필드: '품명' }, { 제목: '규격', 필드: '규격' }],
    선택시: function(항목) {
      document.getElementById('출하현황_품명필터').value = 항목.품명;
      출하현황요약();
    }
  });
}

function 출하현황납품처조회팝업열기() {
  조회팝업열기({
    제목: '납품처 조회', 검색힌트: '납품처명 검색...',
    데이터: APP_CONFIG.납품처목록,
    열목록: [{ 제목: '코드', 필드: '코드' }, { 제목: '납품처명', 필드: '업체명' }],
    선택시: function(항목) {
      document.getElementById('출하현황_납품처필터').value = 항목.업체명;
      출하현황요약();
    }
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
   검색 조회
══════════════════════════════════════════ */
function 검색기간기본값세팅() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth()+1).padStart(2,'0');
  var day = String(d.getDate()).padStart(2,'0');
  document.getElementById('검색_시작일').value = y + '-' + m + '-01';
  document.getElementById('검색_종료일').value = y + '-' + m + '-' + day;
}

function 담당자검색옵션채우기() {
  var sel = document.getElementById('검색_담당자');
  담당자목록.forEach(function(d) {
    var opt = document.createElement('option');
    opt.value = d.직급 + ' ' + d.이름;
    opt.textContent = d.직급 + ' ' + d.이름;
    sel.appendChild(opt);
  });
}

function 엔터검색(e) { if (e.key === 'Enter') 검색조회(); }

async function 검색조회() {
  var 결과 = await 데이터불러오기();
  var 시작 = document.getElementById('검색_시작일').value;
  var 종료 = document.getElementById('검색_종료일').value;
  var 품명 = document.getElementById('검색_품명').value.trim().toLowerCase();
  var 공정 = document.getElementById('검색_공정').value;
  var 담당 = document.getElementById('검색_담당자').value;

  if (시작) 결과 = 결과.filter(function(h) { return (h.출고일자||'') >= 시작; });
  if (종료) 결과 = 결과.filter(function(h) { return (h.출고일자||'') <= 종료; });
  if (품명) 결과 = 결과.filter(function(h) {
    return (h.품명||'').toLowerCase().includes(품명) || (h.품번||'').toLowerCase().includes(품명);
  });
  if (공정) 결과 = 결과.filter(function(h) {
    return h.공정 === 공정 || h.출발공정 === 공정 || h.도착공정 === 공정;
  });
  if (담당) 결과 = 결과.filter(function(h) { return (h.담당자||'') === 담당; });

  if (현재작업공정 === '수입검사' || 현재작업공정 === '출하검사' || 현재작업공정 === '공정검사') {
    결과 = 결과.filter(function(h) { return h.공정 === 현재작업공정; });
  } else if (현재작업공정) {
    결과 = 결과.filter(function(h) { return h.공정 === 현재작업공정 && h.완료여부 === false; });
  }

  목록테이블그리기(결과);
  var 안내 = document.getElementById('검색결과안내');
  안내.innerHTML = '검색 결과: <span class="결과강조">' + 결과.length + '건</span>' +
    (결과.length === 0 ? ' — 조건에 맞는 데이터가 없습니다.' : '');
}

async function 전체보기() {
  검색기간기본값세팅();
  document.getElementById('검색_품명').value   = '';
  document.getElementById('검색_담당자').value = '';
  if (!현재작업공정) document.getElementById('검색_공정').value = '';
  await 공정필터목록갱신();
}

function 검색_품목팝업열기() {
  조회팝업열기({
    제목: '품목 조회',
    검색힌트: '품명 또는 품번 검색...',
    데이터: 품목목록,
    열목록: [{ 제목: '품번', 필드: '품번' }, { 제목: '품명', 필드: '품명' }, { 제목: '규격', 필드: '규격' }],
    선택시: function(항목) { document.getElementById('검색_품명').value = 항목.품명; }
  });
}

/* ══════════════════════════════════════════
   LOT 번호 팝업 (더블클릭)
══════════════════════════════════════════ */
async function lot팝업열기() {
  var 전체 = await 데이터불러오기();

  if (현재작업공정) {
    var 미처리 = 전체.filter(function(h) {
      return h.공정 === 현재작업공정 && h.완료여부 === false;
    });

    if (미처리.length > 0) {
      var 미처리목록 = 미처리.map(function(h) {
        return {
          'lot번호':  h['lot번호'] || '-',
          품명:     h.품명,
          품번:     h.품번,
          출발공정: h.출발공정,
          입고수량: h.입고수량,
          기록id:   h.id
        };
      });
      조회팝업열기({
        제목: 현재작업공정 + ' — 미처리 항목 (처리할 것 선택)',
        검색힌트: 'LOT 또는 품명 검색...',
        데이터: 미처리목록,
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
    var lot = (h['lot번호']||'').trim();
    if (!lot) return;
    if (!lot맵[lot]) {
      lot맵[lot] = { 'lot번호': lot, 품명: h.품명, 품번: h.품번,
                     현재위치: h.공정, 마지막id: h.id, 입고합: 0, 출고합: 0, 불량합: 0 };
    }
    if (h.id > lot맵[lot].마지막id) {
      lot맵[lot].마지막id = h.id;
      lot맵[lot].현재위치 = h.공정;
      lot맵[lot].품명 = h.품명;
    }
    lot맵[lot].입고합 += Number(h.입고수량) || 0;
    if (h.완료여부 !== false) {
      lot맵[lot].출고합 += Number(h.출고수량) || 0;
      lot맵[lot].불량합 += Number(h.불량수량) || 0;
    }
  });

  var lot목록 = Object.values(lot맵).map(function(d) {
    return {
      'lot번호':  d['lot번호'],
      품명:     d.품명,
      현재위치: d.현재위치 || '-',
      재고수량: d.입고합 - d.출고합 - d.불량합
    };
  });

  조회팝업열기({
    제목: 'LOT 번호 조회',
    검색힌트: 'LOT 또는 품명 검색...',
    데이터: lot목록,
    열목록: [
      { 제목: 'LOT 번호',  필드: 'lot번호'  },
      { 제목: '품명',      필드: '품명'     },
      { 제목: '현재 위치', 필드: '현재위치' },
      { 제목: '재고수량',  필드: '재고수량' }
    ],
    선택시: function(항목) { lot선택시(항목); }
  });
}

async function lot선택시(lot데이터) {
  document.getElementById('lot번호').value = lot데이터['lot번호'];
  var 품목 = 품목목록.find(function(p) { return p.품명 === lot데이터.품명; });
  if (품목) 품목선택(품목);
  var 위치 = lot데이터.현재위치;
  if (위치 && 위치 !== '-' && 위치 !== APP_CONFIG.외부공정.출하) {
    document.getElementById('출발공정').value = 위치;
  }
  var 재고 = lot데이터.재고수량;
  if (재고 > 0) {
    document.getElementById('입고수량').value = 재고;
    document.getElementById('출고수량').value = 재고;
  }
  잔량미리보기();

  var 전체 = await 데이터불러오기();
  var 관련 = 전체.filter(function(h) {
    return (h['lot번호']||'').trim() === lot데이터['lot번호'];
  });
  목록테이블그리기(관련);
  var 안내 = document.getElementById('검색결과안내');
  안내.innerHTML = 'LOT <b>' + lot데이터['lot번호'] + '</b> 이력: <span class="결과강조">' + 관련.length + '건</span>' +
    ' &nbsp;<button class="버튼 회색" style="font-size:11px; height:22px; padding:0 8px;" onclick="목록새로고침()">전체 목록</button>';
}

/* ══════════════════════════════════════════
   공용 조회 팝업
══════════════════════════════════════════ */
var 현재팝업설정  = null;
var 원본팝업데이터 = [];
var 현재팝업필터데이터 = [];
var 현재선택행인덱스 = -1;

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
      var 항목 = 현재팝업필터데이터[현재선택행인덱스];
      현재팝업설정.선택시(항목);
      조회팝업닫기();
    } else if (현재팝업필터데이터.length === 1) {
      // 결과가 1개면 엔터로 바로 선택
      현재팝업설정.선택시(현재팝업필터데이터[0]);
      조회팝업닫기();
    } else if (현재팝업설정 && 현재팝업설정.빈엔터시) {
      조회팝업닫기();
      현재팝업설정.빈엔터시();
    }
    return;
  } else { return; }
  행목록.forEach(function(행, i) {
    행.classList.toggle('팝업행키보드선택', i === 현재선택행인덱스);
  });
  if (행목록[현재선택행인덱스]) {
    행목록[현재선택행인덱스].scrollIntoView({ block: 'nearest' });
  }
}

function 조회팝업열기(설정) {
  현재팝업설정   = 설정;
  원본팝업데이터 = 설정.데이터;
  현재선택행인덱스 = -1;
  document.getElementById('조회팝업_제목').textContent = 설정.제목;
  var 검색입력 = document.getElementById('조회팝업_검색');
  검색입력.value = '';
  검색입력.placeholder = 설정.검색힌트 || '검색...';
  검색입력.removeEventListener('keydown', 조회팝업키보드핸들러);
  검색입력.addEventListener('keydown', 조회팝업키보드핸들러);
  var 헤더 = document.getElementById('조회팝업_헤더행');
  헤더.innerHTML = '<th style="width:36px;"></th>';
  설정.열목록.forEach(function(열) {
    var th = document.createElement('th'); th.textContent = 열.제목; 헤더.appendChild(th);
  });
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
  var 결과 = 원본팝업데이터.filter(function(항목) {
    return 현재팝업설정.열목록.some(function(열) {
      return String(항목[열.필드]||'').toLowerCase().includes(검색어);
    });
  });
  조회팝업테이블채우기(결과);
}

function 조회팝업테이블채우기(목록) {
  현재팝업필터데이터 = 목록;
  현재선택행인덱스 = -1;
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
    행.addEventListener('click', function() {
      document.querySelectorAll('#조회팝업_테이블바디 input[type=checkbox]').forEach(function(c) { c.checked = false; });
      document.querySelectorAll('#조회팝업_테이블바디 tr').forEach(function(r) { r.classList.remove('팝업선택행'); });
      체크.checked = true; 행.classList.add('팝업선택행');
      현재팝업설정.선택시(항목);
      조회팝업닫기();
    });
    바디.appendChild(행);
  });
}

function 품목조회팝업열기() {
  조회팝업열기({
    제목: '품목 조회', 검색힌트: '품명 또는 품번 검색...',
    데이터: 품목목록,
    열목록: [{ 제목: '품번', 필드: '품번' }, { 제목: '품명', 필드: '품명' }, { 제목: '규격', 필드: '규격' }],
    선택시: function(항목) { 품목선택(항목); }
  });
}

function 담당자조회팝업열기() {
  조회팝업열기({
    제목: '담당자 조회', 검색힌트: '이름·직급·코드 검색...',
    데이터: 담당자목록,
    열목록: [{ 제목: '코드', 필드: '코드' }, { 제목: '직급', 필드: '직급' }, { 제목: '이름', 필드: '이름' }],
    선택시: function(항목) { 담당자선택(항목); }
  });
}

/* ══════════════════════════════════════════
   체크박스 전체선택 / 확정
══════════════════════════════════════════ */
function 전체선택토글() {
  var 전체체크 = document.getElementById('전체선택체크');
  document.querySelectorAll('.행선택체크').forEach(function(c) {
    c.checked = 전체체크.checked;
  });
}

function 확정처리() {
  var 선택ids = Array.from(document.querySelectorAll('.행선택체크:checked'))
                     .map(function(c) { return Number(c.value); });
  if (선택ids.length === 0) {
    알림표시('확정할 항목을 선택해주세요.', '오류');
    return;
  }
  확인모달표시(선택ids.length + '건을 매출확정 하시겠습니까?', async function() {
    // 확정 직전 최신 상태 재조회 — 동시 작업 중복 방지
    await 확정id목록갱신();
    var 미확정ids = 선택ids.filter(function(id) { return !확정된id목록.has(id); });
    if (미확정ids.length === 0) {
      알림표시('선택한 항목이 이미 모두 매출확정 되었습니다.', '오류');
      await 공정필터목록갱신();
      return;
    }
    var 전체 = await 데이터불러오기();
    var 선택항목 = 전체.filter(function(h) { return 미확정ids.includes(h.id); });

    var 매출행들 = 선택항목.map(function(h) {
      return {
        '입출고id':  h.id,
        '품명':      h.품명,
        '품번':      h.품번,
        '출발공정':  h.출발공정,
        '도착공정':  h.도착공정,
        '출고수량':  h.출고수량,
        '출고일자':  h.출고일자,
        'lot번호':   h['lot번호'],
        '담당자':    h.담당자,
        '확정일시':  new Date().toISOString()
      };
    });

    var result = await 수파베이스.from('매출기록').insert(매출행들);
    if (result.error) {
      알림표시('매출 저장 실패: ' + result.error.message, '오류');
      return;
    }

    // 다른 클라이언트에 확정 완료 신호 전송
    if (_앱브로드캐스트채널) _앱브로드캐스트채널.send({ type: 'broadcast', event: '확정갱신', payload: {} });

    await 성적서자동생성(선택항목);

    document.getElementById('전체선택체크').checked = false;
    알림표시(선택ids.length + '건이 매출확정 되었습니다. 매출관리 메뉴에서 확인하세요.', '성공');
    await 공정필터목록갱신();
  });
}

/* ══════════════════════════════════════════
   출하성적서 자동 생성
══════════════════════════════════════════ */
async function 성적서자동생성(선택항목) {
  var 성적서들 = 선택항목.map(function(h) {
    var 매핑 = (APP_CONFIG.차종매핑 || {})[h.품명] || { 차종: '', 품목: '' };
    return {
      '입출고id':     h.id,
      '작성일':       (h['출고일자'] || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      '차종':         매핑.차종 || '',
      '공급자명':     APP_CONFIG.회사명 || '(주)삼양이엔지',
      'EO_NO':        h['출고번호'] || '',
      '품번':         h.품번 || '',
      '품명':         매핑.품목 || '',
      '원품명':       h.품명 || '',
      '수량':         h['출고수량'] || 0,
      'lot번호':      h['lot번호'] || '',
      '검사목적':     '정기',
      '승인항목':     { '외관': true, '치수': false, '재질': false, '성능': false },
      '종합판정':     '승인',
      '종합판정기타': '',
      '측정치':       _성적서기본측정치(),
      '비고':         '',
      '담당자':       h.담당자 || ''
    };
  });
  var 결과 = await 수파베이스.from('출하성적서').insert(성적서들);
  if (결과.error) console.error('성적서 자동생성 실패:', 결과.error);
}

function _성적서기본측정치() {
  return [
    { X1:'OK', X2:'OK', X3:'OK', X4:'OK', X5:'OK', 수요자확인:'', X_bar:'', R:'', Cp:'', 확인:'', 판정:'' },
    { X1:'OK', X2:'OK', X3:'OK', X4:'OK', X5:'OK', 수요자확인:'', X_bar:'', R:'', Cp:'', 확인:'', 판정:'' },
    { X1:'', X2:'', X3:'', X4:'', X5:'', 수요자확인:'', X_bar:'', R:'', Cp:'', 확인:'', 판정:'' },
    { X1:'', X2:'', X3:'', X4:'', X5:'', 수요자확인:'', X_bar:'', R:'', Cp:'', 확인:'', 판정:'' },
    { X1:'', X2:'', X3:'', X4:'', X5:'', 수요자확인:'', X_bar:'', R:'', Cp:'', 확인:'', 판정:'' },
    { X1:'', X2:'', X3:'', X4:'', X5:'', 수요자확인:'', X_bar:'', R:'', Cp:'', 확인:'', 판정:'' },
    { X1:'OK', X2:'OK', X3:'OK', X4:'OK', X5:'OK', 수요자확인:'', X_bar:'', R:'', Cp:'', 확인:'', 판정:'' },
    { X1:'', X2:'', X3:'', X4:'', X5:'', 수요자확인:'', X_bar:'', R:'', Cp:'', 확인:'', 판정:'' }
  ];
}

/* ══════════════════════════════════════════
   엔터키 다음 칸 이동
══════════════════════════════════════════ */
var 폼입력순서 = ['품명','출고일자','lot번호','출발공정','입고수량','도착공정','출고수량','불량수량','담당자입력'];

function 폼엔터핸들러(event, 현재id) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  var 검사공정 = 현재작업공정 === '출하검사' || 현재작업공정 === '공정검사';

  // 출하검사·공정검사: 출고수량 → 담당자 바로 이동 (불량수량 스킵)
  if (검사공정 && 현재id === '출고수량') {
    var 담당자el = document.getElementById('담당자입력');
    if (담당자el) 담당자el.focus();
    return;
  }
  // 출하검사·공정검사: 담당자에서 Enter → 저장 (팝업 열지 않음)
  if (검사공정 && 현재id === '담당자입력') {
    저장하기();
    return;
  }

  var idx = 폼입력순서.indexOf(현재id);
  if (idx === -1) return;
  var 다음id = 폼입력순서[idx + 1];
  if (!다음id) {
    저장하기();
    return;
  }
  if (현재id === '출발공정') 공정코드변환('출발');
  else if (현재id === '도착공정') 공정코드변환('도착');

  var 다음el = document.getElementById(다음id);
  if (!다음el) return;
  다음el.focus();
  var 출발값 = document.getElementById('출발공정').value;
  var 도착값 = document.getElementById('도착공정').value;
  if (다음id === '출발공정' && !출발값) 공정팝업열기('출발');
  else if (다음id === '도착공정' && !도착값) 공정팝업열기('도착');
  else if (다음id === '담당자입력' && !검사공정) 담당자조회팝업열기();
}

/* ── 알림 모달 ── */
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
    li.style.cssText = 'display:flex; align-items:center; gap:10px; background:#fff5f5; border:1px solid #f5c6cb; border-radius:6px; padding:8px 12px; font-size:13px; color:#c0392b; font-weight:bold;';
    li.innerHTML = '<span style="font-size:15px;">⚠</span>' + 항목;
    ul.appendChild(li);
  });
  document.getElementById('알림모달_오버레이').style.display = 'flex';
}

function 알림모달닫기() {
  document.getElementById('알림모달_오버레이').style.display = 'none';
}

/* ── 알림 ── */
function 알림표시(메시지, 종류) {
  var el = document.getElementById('알림박스');
  el.textContent = 메시지;
  el.className = '알림 ' + 종류;
  el.style.display = 'block';
  setTimeout(function() { el.style.display = 'none'; }, 3500);
}

/* ══════════════════════════════════════════
   보은금속 출하검사대장 엑셀 다운로드
══════════════════════════════════════════ */

function AQL검사수량계산(lotSize) {
  var n = Number(lotSize) || 0;
  if (n <= 8)    return 2;
  if (n <= 15)   return 3;
  if (n <= 25)   return 5;
  if (n <= 50)   return 8;
  if (n <= 90)   return 13;
  if (n <= 150)  return 20;
  if (n <= 280)  return 32;
  if (n <= 500)  return 50;
  if (n <= 1200) return 80;
  if (n <= 3200) return 125;
  return 200;
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
  // 선택한 년/월/업체로 DB에서 직접 조회 (화면 필터와 무관)
  var 선택년 = (document.getElementById('엑셀년도') || {}).value || String(new Date().getFullYear());
  var 선택월 = (document.getElementById('엑셀월') || {}).value || String(new Date().getMonth() + 1).padStart(2, '0');
  var 선택업체 = (document.getElementById('엑셀업체') || {}).value || (APP_CONFIG.출하검사옵션.도착공정 || [])[0] || '';
  var 업체단축명 = 선택업체.replace(/\(주\)/g, '').trim();
  var 업체타이틀 = 업체단축명.split('').join(' ');
  var 시작일 = 선택년 + '-' + 선택월 + '-01';
  var 말일   = new Date(Number(선택년), Number(선택월), 0).getDate();
  var 종료일 = 선택년 + '-' + 선택월 + '-' + String(말일).padStart(2, '0');

  var 버튼 = document.getElementById('엑셀다운로드버튼');
  if (버튼) { 버튼.disabled = true; 버튼.textContent = '조회 중...'; }
  if (!선택업체) { 알림표시('업체를 선택하세요.', '오류'); if (버튼) { 버튼.disabled = false; 버튼.textContent = '검사대장 출력'; } return; }

  var { data: 조회결과, error: 조회오류 } = await 수파베이스
    .from('입출고기록')
    .select('*')
    .eq('공정', 현재작업공정 || '출하검사')
    .gte('출고일자', 시작일)
    .lte('출고일자', 종료일);

  if (버튼) 버튼.textContent = '생성 중...';

  if (조회오류) {
    알림표시('데이터 조회 실패: ' + 조회오류.message, '오류');
    if (버튼) { 버튼.disabled = false; 버튼.textContent = '검사대장 출력'; }
    return;
  }

  var 데이터 = (조회결과 || []).filter(function(h) {
    return (h.도착공정 || '') === 선택업체;
  }).sort(function(a, b) {
    var da = a.출고일자 || '';
    var db = b.출고일자 || '';
    if (da !== db) return da > db ? 1 : -1;
    return a.id - b.id;
  });

  if (데이터.length === 0) {
    알림표시(선택년 + '년 ' + Number(선택월) + '월 ' + 업체단축명 + ' 출하 데이터가 없습니다.', '오류');
    if (버튼) { 버튼.disabled = false; 버튼.textContent = '검사대장 출력'; }
    return;
  }

  try {
    if (typeof 보은금속출하대장_BASE64 === 'undefined') {
      throw new Error('보은금속템플릿.js 가 로드되지 않았습니다.');
    }

    // base64 → ArrayBuffer
    var bin = atob(보은금속출하대장_BASE64);
    var buf = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);

    // ExcelJS로 템플릿 로드 (스타일 완전 보존)
    var workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buf.buffer);
    var ws = workbook.worksheets[0];

    // 제목 월 업데이트 (선택한 년/월 기준)
    ws.getCell('A1').value = 업체타이틀 + ' 출 하 검 사 대 장 ( ' + Number(선택월) + ' 월 )';

    // 6행 스타일을 열별로 저장 (템플릿 없는 행에 복사)
    var REF_ROW = 6;
    var COL_MAX = 25; // A~Y
    var refStyles = [];
    for (var c = 1; c <= COL_MAX; c++) {
      var rc = ws.getRow(REF_ROW).getCell(c);
      refStyles[c] = JSON.parse(JSON.stringify(rc.style || {}));
    }

    // 마지막 유효 행 파악
    var tmplLast = ws.lastRow ? ws.lastRow.number : REF_ROW;

    function 행채우기(rowNum, 항목, idx, 날짜표시) {
      var row = ws.getRow(rowNum);
      var 수량 = Number(항목.입고수량) || Number(항목.출고수량) || 0;
      var 불량 = Number(항목.불량수량) || 0;
      var 검사수량 = AQL검사수량계산(수량);
      var 차종 = (APP_CONFIG.차종매핑[항목.품명] || {}).차종 || '';
      var 색상 = 색상판별(항목.품명);
      var 판정 = 불량 === 0 ? 'OK' : 'NG';
      var 불량율 = 검사수량 > 0 ? 불량 / 검사수량 : 0;

      // 템플릿 행이 없으면 스타일 수동 복사
      if (rowNum > tmplLast) {
        for (var c = 1; c <= COL_MAX; c++) {
          row.getCell(c).style = JSON.parse(JSON.stringify(refStyles[c] || {}));
        }
      }

      row.getCell(1).value = idx + 1;
      var dateCell = row.getCell(2);
      dateCell.value = (날짜표시 && 항목.출고일자) ? new Date(항목.출고일자 + 'T00:00:00Z') : null;
      if (날짜표시 && 항목.출고일자) dateCell.numFmt = 'yyyy-mm-dd';
      row.getCell(3).value = 항목['lot번호'] || '';
      row.getCell(4).value = 수량;
      row.getCell(5).value = 차종;
      row.getCell(6).value = 색상;
      row.getCell(7).value = 검사수량;
      row.getCell(8).value = 불량;
      var rateCell = row.getCell(9);
      rateCell.value = 불량율;
      rateCell.numFmt = '0%';
      for (var j = 10; j <= 20; j++) row.getCell(j).value = null; // J~T
      row.getCell(21).value = 판정;                                // U
      for (var k = 22; k <= 25; k++) row.getCell(k).value = null; // V~Y
      row.commit();
    }

    // 데이터 채우기
    데이터.forEach(function(항목, idx) {
      var 날짜표시 = idx === 0 || 항목.출고일자 !== 데이터[idx - 1].출고일자;
      행채우기(REF_ROW + idx, 항목, idx, 날짜표시);
    });

    // 남은 템플릿 행 값 초기화 (스타일·테두리 유지)
    for (var r = REF_ROW + 데이터.length; r <= tmplLast; r++) {
      var row = ws.getRow(r);
      for (var c = 1; c <= COL_MAX; c++) row.getCell(c).value = null;
      row.commit();
    }

    // 인쇄 설정
    var 마지막행 = 데이터.length > 0 ? REF_ROW + 데이터.length - 1 : tmplLast;
    ws.pageSetup.printArea = 'A1:Y' + 마지막행;
    ws.pageSetup.orientation = 'landscape';
    ws.pageSetup.fitToPage = true;
    ws.pageSetup.fitToWidth = 1;
    ws.pageSetup.fitToHeight = 0;
    ws.pageSetup.horizontalCentered = true;
    ws.pageSetup.margins = { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 };

    // 다운로드
    var 파일명 = 업체단축명 + '출하검사대장_' + 선택년 + 선택월 + '.xlsx';
    var outBuf = await workbook.xlsx.writeBuffer();

    // JSZip으로 Print_Titles 직접 주입 (ExcelJS rowsToRepeatAtTop 버그 우회)
    try {
      var 시트명 = ws.name;
      var zip = await JSZip.loadAsync(outBuf);
      var wbXml = await zip.file('xl/workbook.xml').async('string');
      var ptXml = '<definedName name="Print_Titles" localSheetId="0">\'' + 시트명 + '\'!$1:$5</definedName>';
      if (wbXml.includes('Print_Titles')) {
        wbXml = wbXml.replace(/<definedName name="Print_Titles"[^>]*>[\s\S]*?<\/definedName>/, ptXml);
      } else if (wbXml.includes('<definedNames>')) {
        wbXml = wbXml.replace('<definedNames>', '<definedNames>' + ptXml);
      } else {
        wbXml = wbXml.replace('</workbook>', '<definedNames>' + ptXml + '</definedNames></workbook>');
      }
      zip.file('xl/workbook.xml', wbXml);
      outBuf = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
    } catch(e) { console.warn('Print_Titles 설정 실패:', e); }
    var blob = new Blob([outBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 파일명;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    알림표시('다운로드 완료: ' + 파일명, '성공');

  } catch (e) {
    console.error('엑셀 다운로드 오류:', e);
    알림표시('엑셀 생성 실패: ' + e.message, '오류');
  } finally {
    if (버튼) { 버튼.disabled = false; 버튼.textContent = '검사대장 출력'; }
  }
}
