/* ===================================================
   엠블럼품질현황.js — "삼양이엔지 엠블럼 통합품질 현황.xlsx" 템플릿에
   공정검사 데이터를 자동 기입해서 월별로 출력
   (JSZip으로 셀 값만 직접 수정 — 차트·이미지·서식 등 나머지는 원본 그대로 보존)
   =================================================== */

/* 품명 → 템플릿 모델 슬롯(시작행) 매핑. 슬롯당 5행(LOT 5건)까지 */
var 품질현황_모델슬롯맵 = {
  '기아 61mm':               { 시작행: 5  },
  '기아 71mm':               { 시작행: 10 },
  'H-EMBLEM SILVER(CN7 PE)': { 시작행: 15 },
  'H-EMBLEM BLACK(CN7 PE)':  { 시작행: 15 },
  'BEZEL(GN7)':              { 시작행: 20 },
  '기아 45mm':                { 시작행: 25 },
  'GN7 F/L':                 { 시작행: 30 }, /* 템플릿의 미사용 'A' 슬롯을 재활용 */
  'MX5 BEZEL SILVER':        { 시작행: 40 },
  'MX5 BEZEL BLACK':         { 시작행: 40 }
};

/* 불량코드마스터 명칭 → 템플릿 불량내역 컬럼 (순서·명칭 완전 일치) */
var 품질현황_불량코드열맵 = {
  'S/C': 'J', '찍힘': 'K', 'A/D얼룩': 'L', 'H/L': 'M', '휨': 'N',
  '기포': 'P', '소재': 'Q', '툴자국': 'R', '가공': 'S',
  '이물': 'V', '코팅얼룩': 'W', '시료': 'X',
  '조건시료': 'W', /* 템플릿에 전용 칸이 없어 코팅얼룩 칸에 합산 */
  '테스트시료': 'X' /* 템플릿에 전용 칸이 없어 시료 칸에 합산 */
};

/* ─────────── 셀 값 쓰기 (기존 서식 s= 속성은 그대로 유지) ─────────── */
function _품질현황_셀쓰기(xml, ref, value, isText) {
  var re = new RegExp('<c r="' + ref + '"([^>/]*)(/>|>[\\s\\S]*?</c>)');
  return xml.replace(re, function(match, attrs) {
    var sMatch = attrs.match(/\ss="(\d+)"/);
    var sAttr = sMatch ? ' s="' + sMatch[1] + '"' : '';
    if (isText) {
      var esc = String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return '<c r="' + ref + '"' + sAttr + ' t="inlineStr"><is><t>' + esc + '</t></is></c>';
    }
    return '<c r="' + ref + '"' + sAttr + '><v>' + Number(value || 0) + '</v></c>';
  });
}

/* ─────────── 셀 값 지우기 (서식은 유지한 채 빈 셀로) ─────────── */
function _품질현황_셀지우기(xml, ref) {
  var re = new RegExp('<c r="' + ref + '"([^>/]*)(/>|>[\\s\\S]*?</c>)');
  return xml.replace(re, function(match, attrs) {
    var sMatch = attrs.match(/\ss="(\d+)"/);
    var sAttr = sMatch ? ' s="' + sMatch[1] + '"' : '';
    return '<c r="' + ref + '"' + sAttr + '/>';
  });
}

/* ─────────── 시트명 → 내부 파일 경로 매핑 (workbook.xml + rels 파싱) ─────────── */
async function _품질현황_시트맵구하기(zip) {
  var wbXml   = await zip.file('xl/workbook.xml').async('string');
  var relsXml = await zip.file('xl/_rels/workbook.xml.rels').async('string');

  var relMap = {};
  var relRe = /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
  var m;
  while ((m = relRe.exec(relsXml))) relMap[m[1]] = m[2];

  var sheetMap = {};
  var sheetRe = /<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g;
  while ((m = sheetRe.exec(wbXml))) {
    var target = relMap[m[2]];
    if (target) sheetMap[m[1]] = 'xl/' + target.replace(/^\.?\//, '');
  }
  return sheetMap;
}

/* ─────────── 열었을 때 수식(양품·불량·불량율 등)이 자동 재계산되도록 설정 ─────────── */
async function _품질현황_재계산강제(zip) {
  var wbXml = await zip.file('xl/workbook.xml').async('string');
  if (/<calcPr\b[^>]*\/>/.test(wbXml)) {
    wbXml = wbXml.replace(/<calcPr\b([^>]*)\/>/, function(m, attrs) {
      attrs = attrs.replace(/\s*fullCalcOnLoad="[^"]*"/, '');
      return '<calcPr' + attrs + ' fullCalcOnLoad="1"/>';
    });
  } else {
    wbXml = wbXml.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>');
  }
  zip.file('xl/workbook.xml', wbXml);
}

/* ─────────── 5행 초과 시 초과분을 5번째 행에 합산 ─────────── */
function _품질현황_행병합(목록) {
  if (목록.length <= 5) return 목록;
  var 유지 = 목록.slice(0, 4);
  var 나머지 = 목록.slice(4);
  var 합침 = { 출고번호: 나머지.map(function(r){return r.출고번호||'';}).filter(Boolean).join(','), 입고수량: 0, A급수량: 0, 불량내역: [] };
  나머지.forEach(function(r) {
    합침.입고수량 += Number(r.입고수량) || 0;
    합침.A급수량  += Number(r.A급수량)  || 0;
    (r.불량내역 || []).forEach(function(b) {
      var 찾음 = 합침.불량내역.find(function(x) { return x.명 === b.명; });
      if (찾음) 찾음.수량 += Number(b.수량) || 0;
      else 합침.불량내역.push({ 명: b.명, 수량: Number(b.수량) || 0 });
    });
  });
  유지.push(합침);
  return 유지;
}

/* 불량내역 코드 컬럼 전체 (셀 초기화용) */
var 품질현황_전체불량열 = Object.keys(품질현황_불량코드열맵).map(function(k) { return 품질현황_불량코드열맵[k]; });

/* ─────────── 삼양 구역(5~44행) 전체를 빈 칸으로 초기화 — 다른 달 생성 시 남아있던 값이 섞이지 않도록 ─────────── */
function _품질현황_삼양구역초기화(xml) {
  [5, 10, 15, 20, 25, 30, 35, 40].forEach(function(시작행) {
    for (var i = 0; i < 5; i++) {
      var 행 = 시작행 + i;
      xml = _품질현황_셀지우기(xml, 'E' + 행);
      xml = _품질현황_셀지우기(xml, 'F' + 행);
      xml = _품질현황_셀지우기(xml, 'Y' + 행);
      품질현황_전체불량열.forEach(function(열) { xml = _품질현황_셀지우기(xml, 열 + 행); });
    }
  });
  return xml;
}

/* ─────────── 하루치 데이터를 해당 날짜 시트 XML에 기입 ─────────── */
function _품질현황_일자시트작성(xml, 연, 월, 일, 하루기록) {
  xml = _품질현황_셀쓰기(xml, 'N2', 월, false);
  xml = _품질현황_셀쓰기(xml, 'P2', '', true);
  xml = _품질현황_셀쓰기(xml, 'Q2', '', true);
  /* GN7 F/L용으로 재활용하는 A 슬롯 라벨 (삼양 구역만 사용) */
  xml = _품질현황_셀쓰기(xml, 'C30', 'GN7 F/L', true);
  xml = _품질현황_셀쓰기(xml, 'D30', 'GN7 FL', true);

  /* 이 날짜에 해당하는 값만 다시 채울 것이므로, 먼저 전체를 비워서 다른 달 생성 시 남은 값이 섞이지 않게 함 */
  xml = _품질현황_삼양구역초기화(xml);

  if (!하루기록 || !하루기록.length) return xml;

  var 모델별 = {};
  하루기록.forEach(function(항목) {
    var 슬롯 = 품질현황_모델슬롯맵[항목.품명];
    if (!슬롯) { console.warn('품질현황: 모델 슬롯 없음 - ' + 항목.품명 + ' (건너뜀)'); return; }
    var 키 = 슬롯.시작행;
    if (!모델별[키]) 모델별[키] = [];
    모델별[키].push(항목);
  });

  Object.keys(모델별).forEach(function(시작행문자) {
    var 시작행 = Number(시작행문자);
    /* 목록 화면은 최신순(내림차순)으로 보이므로, 엑셀은 등록 순서대로(오름차순) 위에서 아래로 나오게 정렬 */
    var 정렬된 = 모델별[시작행문자].slice().sort(function(a, b) { return (a.id || 0) - (b.id || 0); });
    var 목록 = _품질현황_행병합(정렬된);
    목록.forEach(function(항목, idx) {
      var 행 = 시작행 + idx;
      xml = _품질현황_셀쓰기(xml, 'E' + 행, 항목.출고번호 || '', true);
      xml = _품질현황_셀쓰기(xml, 'F' + 행, Number(항목.입고수량) || 0, false);
      if (Number(항목.A급수량) > 0) {
        xml = _품질현황_셀쓰기(xml, 'Y' + 행, Number(항목.A급수량), false);
      }
      // 여러 불량코드가 같은 칸으로 매핑될 수 있어(예: 조건시료→가공) 먼저 칸별로 합산한 뒤 한 번에 기입
      var 열합계 = {};
      (항목.불량내역 || []).forEach(function(b) {
        var 열 = 품질현황_불량코드열맵[b.명];
        if (!열) return;
        열합계[열] = (열합계[열] || 0) + (Number(b.수량) || 0);
      });
      Object.keys(열합계).forEach(function(열) {
        xml = _품질현황_셀쓰기(xml, 열 + 행, 열합계[열], false);
      });
    });
  });

  return xml;
}

/* ─────────── 메인: 연/월 지정해서 워크북 생성 ─────────── */
async function 엠블럼품질현황_생성(연, 월) {
  if (typeof 품질현황템플릿_BASE64 === 'undefined') throw new Error('품질현황템플릿.js 가 로드되지 않았습니다.');
  var bin = atob(품질현황템플릿_BASE64), buf = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  var zip = await JSZip.loadAsync(buf.buffer);
  var 시트맵 = await _품질현황_시트맵구하기(zip);
  await _품질현황_재계산강제(zip);

  var 전체 = await 엠블럼_데이터불러오기();
  var 월문자 = String(월).padStart(2, '0');
  var 말일 = new Date(연, 월, 0).getDate();
  var 대상 = 전체.filter(function(h) {
    return h.공정 === '공정검사' && h.완료여부 !== false &&
      (h.출고일자 || '').slice(0, 7) === (연 + '-' + 월문자);
  });

  var 일자별 = {};
  대상.forEach(function(h) {
    var 일 = Number((h.출고일자 || '').slice(8, 10));
    if (!일) return;
    if (!일자별[일]) 일자별[일] = [];
    일자별[일].push(h);
  });

  for (var 일 = 1; 일 <= 말일; 일++) {
    var 시트파일 = 시트맵[String(일)];
    if (!시트파일 || !zip.file(시트파일)) continue;
    var xml = await zip.file(시트파일).async('string');
    xml = _품질현황_일자시트작성(xml, 연, 월, 일, 일자별[일]);
    zip.file(시트파일, xml);
  }

  var 월마감파일 = 시트맵['26년 월마감'];
  if (월마감파일 && zip.file(월마감파일)) {
    var mXml = await zip.file(월마감파일).async('string');
    mXml = _품질현황_셀쓰기(mXml, 'B2', '삼양이엔지 일일 품질현황 (' + 연 + '년 ' + 월문자 + '월)', true);
    zip.file(월마감파일, mXml);
  }

  return zip.generateAsync({ type: 'blob' });
}

/* ─────────── 버튼 핸들러 (상단 조회 기간 필터의 시작일 기준 월 사용) ─────────── */
async function 엠블럼품질현황_출력() {
  var 버튼  = document.getElementById('품질현황출력버튼');
  var 시작일 = (document.getElementById('검색_시작일') || {}).value || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(시작일)) { 알림표시('상단 조회 기간의 시작일을 먼저 선택하세요.', '오류'); return; }
  var 연 = Number(시작일.slice(0, 4)), 월 = Number(시작일.slice(5, 7));

  if (버튼) { 버튼.disabled = true; 버튼.textContent = '생성 중...'; }
  try {
    var blob = await 엠블럼품질현황_생성(연, 월);
    var 파일명 = '삼양이엔지 엠블럼 통합품질 현황_' + 연 + '년' + String(월).padStart(2, '0') + '월.xlsx';
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 파일명; a.click();
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    알림표시(파일명 + ' 다운로드 완료', '성공');
  } catch (err) {
    알림표시('품질현황 생성 실패: ' + (err.message || err), '오류');
    console.error(err);
  }
  if (버튼) { 버튼.disabled = false; 버튼.textContent = '품질현황 출력'; }
}
