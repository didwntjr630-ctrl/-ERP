/* =====================================================
   생산관리.js - 생산관리 시스템
   ===================================================== */

var _작업목록 = [];
var _현재상태필터 = '전체';

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

/* ── 작업 목록 로드 ── */
async function 작업목록로드() {
  var { data, error } = await 수파베이스.from('작업')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return; }
  _작업목록 = data || [];
  작업목록렌더링();
  통계업데이트();
}

/* ── 통계 카드 업데이트 ── */
function 통계업데이트() {
  var 진행중 = _작업목록.filter(function(r){ return r.상태 === '진행중'; }).length;
  var 완료 = _작업목록.filter(function(r){ return r.상태 === '완료'; }).length;
  var el전체 = document.getElementById('통계_전체');
  var el진행중 = document.getElementById('통계_진행중');
  var el완료 = document.getElementById('통계_완료');
  if (el전체) el전체.textContent = _작업목록.length;
  if (el진행중) el진행중.textContent = 진행중;
  if (el완료) el완료.textContent = 완료;
}

/* ── 목록 렌더링 ── */
function 작업목록렌더링() {
  var filtered = _현재상태필터 === '전체'
    ? _작업목록
    : _작업목록.filter(function(r){ return r.상태 === _현재상태필터; });

  var tbody = document.getElementById('작업목록바디');
  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="빈목록안내">등록된 작업이 없습니다.</td></tr>';
    return;
  }

  var 오늘 = new Date();
  오늘.setHours(0, 0, 0, 0);

  tbody.innerHTML = filtered.map(function(r) {
    var 납기d = r.납기일 ? new Date(r.납기일) : null;
    var 납기임박 = 납기d && r.상태 !== '완료' && (납기d - 오늘) / (1000 * 60 * 60 * 24) <= 3;
    var 상태색 = r.상태 === '완료' ? '#27ae60' : '#f97316';
    var 상태배경 = r.상태 === '완료' ? '#eafaf1' : '#fff7ed';
    var 납기표시 = r.납기일 ? r.납기일 : '-';

    return '<tr style="cursor:pointer;" onclick="작업상세이동(\'' + r.작업번호 + '\')">' +
      '<td style="text-align:left;padding-left:14px;">' +
        '<b style="color:#1a3a5c;font-size:13px;letter-spacing:0.3px;">' + r.작업번호 + '</b>' +
      '</td>' +
      '<td>' + (r.업체 || '-') + '</td>' +
      '<td>' + (r.품목 || '-') + '</td>' +
      '<td style="font-variant-numeric:tabular-nums;">' + (r.입고수량 || 0).toLocaleString() + ' EA</td>' +
      '<td>' +
        '<span style="background:' + 상태배경 + ';color:' + 상태색 + ';' +
          'padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">' +
          r.상태 +
        '</span>' +
      '</td>' +
      '<td' + (납기임박 ? ' style="color:#c0392b;font-weight:700;"' : '') + '>' +
        납기표시 + (납기임박 ? '  ⚠' : '') +
      '</td>' +
      '<td>' + (r.담당자 || '-') + '</td>' +
      '<td style="text-align:center;">' +
        '<div style="display:flex;gap:4px;justify-content:center;">' +
          '<button class="버튼 회색 소형" style="padding:0 10px;" ' +
            'onclick="event.stopPropagation(); QR출력(\'' + r.작업번호 + '\')">QR</button>' +
          '<button class="버튼 빨강 소형" style="padding:0 10px;" ' +
            'onclick="event.stopPropagation(); 작업삭제(\'' + r.작업번호 + '\')">삭제</button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }).join('');
}

/* ── 상태 필터 ── */
function 상태필터변경(상태) {
  _현재상태필터 = 상태;
  document.querySelectorAll('.필터버튼').forEach(function(btn) {
    var 활성 = btn.dataset.상태 === 상태;
    btn.style.background    = 활성 ? '#374151' : 'white';
    btn.style.color         = 활성 ? 'white'   : '#374151';
    btn.style.borderColor   = 활성 ? '#374151' : '#D1D5DB';
    btn.style.fontWeight    = 활성 ? '700'     : '500';
  });
  작업목록렌더링();
}

/* ── 입고 등록 팝업 ── */
function 입고등록팝업열기() {
  입고폼초기화();
  document.getElementById('입고팝업_오버레이').style.display = 'flex';
  setTimeout(function(){ document.getElementById('입력_업체').focus(); }, 120);
}

function 입고등록팝업닫기() {
  document.getElementById('입고팝업_오버레이').style.display = 'none';
}

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
  ['입력_업체','입력_품목','입력_납기일','입력_메모'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('입력_입고수량').value = '';
  document.getElementById('입력_입고일').value = new Date().toISOString().slice(0, 10);
  var 세션 = 현재세션();
  document.getElementById('입력_담당자').value = 세션 ? (세션.직급 + ' ' + 세션.사원명) : '';
  document.getElementById('입력_사진').value = '';
  document.getElementById('사진미리보기박스').style.display = 'none';
}

/* ── 입고 저장 ── */
async function 입고저장() {
  var 업체     = document.getElementById('입력_업체').value.trim();
  var 품목     = document.getElementById('입력_품목').value.trim();
  var 입고수량 = parseInt(document.getElementById('입력_입고수량').value) || 0;
  var 입고일   = document.getElementById('입력_입고일').value;
  var 납기일   = document.getElementById('입력_납기일').value;
  var 담당자   = document.getElementById('입력_담당자').value.trim();
  var 메모     = document.getElementById('입력_메모').value.trim();

  if (!업체)     { 생산알림표시('업체를 입력해주세요.', '오류'); return; }
  if (!품목)     { 생산알림표시('품목을 입력해주세요.', '오류'); return; }
  if (!입고수량) { 생산알림표시('입고수량을 입력해주세요.', '오류'); return; }
  if (!입고일)   { 생산알림표시('입고일을 입력해주세요.', '오류'); return; }

  var btn = document.getElementById('입고저장버튼');
  btn.disabled = true;
  btn.textContent = '저장 중...';

  try {
    var WO = await WO번호생성();

    // 사진 업로드
    var 사진url = null;
    var 사진파일 = document.getElementById('입력_사진').files[0];
    if (사진파일) {
      var 확장자 = 사진파일.name.split('.').pop() || 'jpg';
      var 경로 = WO + '.' + 확장자;
      var { data: upData, error: upError } = await 수파베이스.storage
        .from('work-photos')
        .upload(경로, 사진파일, { contentType: 사진파일.type, upsert: true });
      if (upError) {
        console.warn('사진 업로드 실패:', upError.message);
      } else {
        var { data: urlData } = 수파베이스.storage.from('work-photos').getPublicUrl(upData.path);
        사진url = urlData.publicUrl;
      }
    }

    var { error } = await 수파베이스.from('작업').insert({
      작업번호: WO,
      업체:     업체,
      품목:     품목,
      입고수량: 입고수량,
      입고일:   입고일 || null,
      납기일:   납기일 || null,
      담당자:   담당자,
      메모:     메모,
      사진url:  사진url,
      상태:     '진행중'
    });
    if (error) throw error;

    입고등록팝업닫기();
    await 작업목록로드();
    QR출력(WO);
    생산알림표시(WO + '  입고 등록 완료', '성공');
  } catch(e) {
    console.error(e);
    생산알림표시('저장 오류: ' + (e.message || e), '오류');
  } finally {
    btn.disabled = false;
    btn.textContent = '저장';
  }
}

/* ── 작업 상세 이동 ── */
function 작업상세이동(WO) {
  location.href = '작업상세.html?wo=' + encodeURIComponent(WO);
}

/* ── 작업 삭제 ── */
async function 작업삭제(WO번호) {
  var 행 = _작업목록.find(function(r){ return r.작업번호 === WO번호; });
  var 확인메시지 = '작업 ' + WO번호 + '\n' +
    (행 ? '업체: ' + (행.업체||'') + ' / 품목: ' + (행.품목||'') + '\n' : '') +
    '\n관련 작업실적, 불량, 출하 데이터가 모두 삭제됩니다.\n삭제하시겠습니까?';

  if (!confirm(확인메시지)) return;

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
      '.정보{width:100%;border-collapse:collapse;border:2px solid #333;border-top:none;}' +
      '.정보 td{border:1px solid #666;padding:7px 10px;font-size:12px;white-space:nowrap;overflow:hidden;}' +
      '.L{background:#f0ead8;font-weight:700;text-align:center;width:70px;min-width:70px;white-space:nowrap;font-size:11px;}' +

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
      '<tr><td class="L">업 체 명</td><td colspan="3" style="white-space:nowrap;overflow:hidden;">' + 업체 + '</td></tr>' +
      '<tr><td class="L">품&nbsp;&nbsp;&nbsp;목</td><td colspan="3">' + 품목 + '</td></tr>' +
      '<tr>' +
        '<td class="L">입고수량</td><td>' + 수량 + '</td>' +
        '<td class="L">납 기 일</td><td>' + 납기일 + '</td>' +
      '</tr>' +
      '<tr>' +
        '<td class="L">입 고 일</td><td>' + 입고일 + '</td>' +
        '<td class="L">담 당 자</td><td>' + 담당자 + '</td>' +
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
  상태필터변경('전체');
  작업목록로드();
  생산관리실시간구독();
});
