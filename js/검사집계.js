/* ===================================================
   검사집계.js — 품목별 "엠블럼 검사현황 집계" 템플릿(월 시트, 74~98행)에
   출하검사 데이터를 자동 기입해서 월별로 출력 (일반 시스템용)
   (JSZip으로 셀 값만 직접 수정 — 불량율 수식·서식 등 나머지는 원본 그대로 보존)
   =================================================== */

/* 품명 → 템플릿(검사집계템플릿.js의 BASE64 변수명) 매핑.
   H-EMBLEM SILVER/BLACK은 같은 "현대 EMBLEM" 템플릿 한 장에 함께 채워진다.
   GN7 F/L, MX5는 매칭되는 템플릿이 없어 이 집계에서 제외한다 */
var 검사집계_템플릿목록 = [
  { 품명목록: ['기아 45mm'],                                          표시명: '45mm',       변수: '검사집계_45MM_BASE64' },
  { 품명목록: ['기아 61mm'],                                          표시명: '61mm',       변수: '검사집계_61MM_BASE64' },
  { 품명목록: ['기아 71mm'],                                          표시명: '71mm',       변수: '검사집계_71MM_BASE64' },
  { 품명목록: ['BEZEL(GN7)'],                                         표시명: 'GN7 BEZEL',  변수: '검사집계_GN7BEZEL_BASE64' },
  { 품명목록: ['H-EMBLEM SILVER(CN7 PE)', 'H-EMBLEM BLACK(CN7 PE)'],  표시명: '현대 EMBLEM', 변수: '검사집계_현대EMBLEM_BASE64' }
];

/* 불량코드마스터 명칭 → 템플릿 불량내역 컬럼 (품질현황_불량코드열맵과 순서·명칭은 같고 한 칸씩 왼쪽으로 밀려있음) */
var 검사집계_불량코드열맵 = {
  'S/C': 'I', '찍힘': 'J', 'A/D얼룩': 'K', 'H/L': 'L', '휨': 'M',
  '기포': 'O', '소재': 'P', '툴자국': 'Q', '가공': 'R',
  '이물': 'U', '코팅얼룩': 'V', '시료': 'W',
  '조건시료': 'V', /* 템플릿에 전용 칸이 없어 코팅얼룩 칸에 합산 */
  '테스트시료': 'W' /* 템플릿에 전용 칸이 없어 시료 칸에 합산 */
};
var 검사집계_전체불량열 = Object.keys(검사집계_불량코드열맵)
  .map(function(k) { return 검사집계_불량코드열맵[k]; })
  .filter(function(v, i, arr) { return arr.indexOf(v) === i; }); // I,J,K,L,M,O,P,Q,R,U,V,W (중복 제거)

var 검사집계_데이터시작행 = 74;
var 검사집계_데이터최대행 = 98; /* 템플릿에 불량율 수식이 이미 준비된 마지막 행 (25행 분량, 모든 모델·모든 월 시트 공통 확인됨) */

/* ─────────── 셀 값 쓰기 (기존 서식 s= 속성은 그대로 유지) ─────────── */
function _검사집계_셀쓰기(xml, ref, value, isText) {
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
function _검사집계_셀지우기(xml, ref) {
  var re = new RegExp('<c r="' + ref + '"([^>/]*)(/>|>[\\s\\S]*?</c>)');
  return xml.replace(re, function(match, attrs) {
    var sMatch = attrs.match(/\ss="(\d+)"/);
    var sAttr = sMatch ? ' s="' + sMatch[1] + '"' : '';
    return '<c r="' + ref + '"' + sAttr + '/>';
  });
}

/* ─────────── 시트명 → 내부 파일 경로 매핑 (workbook.xml + rels 파싱) ─────────── */
async function _검사집계_시트맵구하기(zip) {
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

/* ─────────── 열었을 때 수식(불량율 등)이 자동 재계산되도록 설정 ─────────── */
async function _검사집계_재계산강제(zip) {
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

/* ─────────── LOT.NO(삼양) → LOT.NO(보은) 변환 ───────────
   앞 4자리(날짜 부분) + 공백 한 칸을 떼고, 말미의 "-N" 분할 접미사도 제거
   예) "1204 2511 122 1112"    → "2511 122 1112"
       "1209 2511 122 1113-1" → "2511 122 1113"       */
function _검사집계_보은lot(lot삼양) {
  var s = String(lot삼양 || '').trim();
  s = s.replace(/^\d{4}\s+/, '');
  s = s.replace(/-\d+$/, '');
  return s;
}

/* ─────────── YYYY-MM-DD 문자열 → 엑셀 날짜 일련번호 (1899-12-30 기준) ─────────── */
function _검사집계_엑셀일련번호(dateStr) {
  var y = Number(dateStr.slice(0, 4)), m = Number(dateStr.slice(5, 7)), d = Number(dateStr.slice(8, 10));
  var utc대상 = Date.UTC(y, m - 1, d);
  var utc기준 = Date.UTC(1899, 11, 30);
  return Math.round((utc대상 - utc기준) / 86400000);
}

/* ─────────── 74~98행 데이터 영역 초기화 (H열 불량율 수식은 손대지 않음) ─────────── */
function _검사집계_구역초기화(xml) {
  for (var 행 = 검사집계_데이터시작행; 행 <= 검사집계_데이터최대행; 행++) {
    ['B', 'C', 'D', 'E', 'F', 'G', 'X'].forEach(function(열) { xml = _검사집계_셀지우기(xml, 열 + 행); });
    검사집계_전체불량열.forEach(function(열) { xml = _검사집계_셀지우기(xml, 열 + 행); });
  }
  return xml;
}

/* ─────────── 가용 행수(25행) 초과 시 초과분을 마지막 행에 합산 ─────────── */
function _검사집계_행병합(목록) {
  var 최대건수 = 검사집계_데이터최대행 - 검사집계_데이터시작행 + 1;
  if (목록.length <= 최대건수) return 목록;
  var 유지 = 목록.slice(0, 최대건수 - 1);
  var 나머지 = 목록.slice(최대건수 - 1);
  var 합침 = {
    출고일자: 나머지[0].출고일자,
    lot번호: 나머지.map(function(r) { return r.lot번호 || ''; }).filter(Boolean).join(','),
    입고수량: 0, 출고수량: 0, 불량수량: 0, 불량내역: []
  };
  나머지.forEach(function(r) {
    합침.입고수량 += Number(r.입고수량) || 0;
    합침.출고수량 += Number(r.출고수량) || 0;
    합침.불량수량 += Number(r.불량수량) || 0;
    (r.불량내역 || []).forEach(function(b) {
      var 찾음 = 합침.불량내역.find(function(x) { return x.명 === b.명; });
      if (찾음) 찾음.수량 += Number(b.수량) || 0;
      else 합침.불량내역.push({ 명: b.명, 수량: Number(b.수량) || 0 });
    });
  });
  유지.push(합침);
  return 유지;
}

/* ─────────── 정렬된 목록을 74행부터 순서대로 기입 (같은 출고일자는 첫 행에만 일자 표시) ─────────── */
function _검사집계_구역채우기(xml, 목록) {
  var 마지막출고일자 = null;
  목록.forEach(function(항목, idx) {
    var 행 = 검사집계_데이터시작행 + idx;
    var lot = 항목['lot번호'] || '';

    if (항목.출고일자 && 항목.출고일자 !== 마지막출고일자) {
      xml = _검사집계_셀쓰기(xml, 'B' + 행, _검사집계_엑셀일련번호(항목.출고일자), false);
      마지막출고일자 = 항목.출고일자;
    }
    xml = _검사집계_셀쓰기(xml, 'C' + 행, _검사집계_보은lot(lot), true);
    xml = _검사집계_셀쓰기(xml, 'D' + 행, lot, true);
    xml = _검사집계_셀쓰기(xml, 'E' + 행, Number(항목.입고수량) || 0, false);
    xml = _검사집계_셀쓰기(xml, 'F' + 행, Number(항목.출고수량) || 0, false);
    xml = _검사집계_셀쓰기(xml, 'G' + 행, Number(항목.불량수량) || 0, false);

    var 열합계 = {};
    (항목.불량내역 || []).forEach(function(b) {
      var 열 = 검사집계_불량코드열맵[b.명];
      if (!열) return;
      열합계[열] = (열합계[열] || 0) + (Number(b.수량) || 0);
    });
    Object.keys(열합계).forEach(function(열) {
      xml = _검사집계_셀쓰기(xml, 열 + 행, 열합계[열], false);
    });
  });
  return xml;
}

/* ─────────── 메인: 템플릿 하나(=모델 하나)에 대해 연/월 지정해서 워크북 생성 ───────────
   해당 월에 이 템플릿에 속하는 출하검사 데이터가 없으면 null 반환 (파일 자체를 만들지 않음) */
async function _검사집계_템플릿생성(연, 월, 템플릿정보) {
  var base64 = window[템플릿정보.변수];
  if (typeof base64 === 'undefined') throw new Error('검사집계템플릿.js가 로드되지 않았습니다. (' + 템플릿정보.변수 + ')');

  var 전체 = await 데이터불러오기();
  var 월문자 = String(월).padStart(2, '0');

  var 태산입고_lot맵 = {};
  전체.forEach(function(h) {
    if (h.공정 === '태산 입고' && h['lot번호']) 태산입고_lot맵[h['lot번호']] = h;
  });

  var 대상 = 전체.filter(function(h) {
    return h.공정 === '출하검사' && h.완료여부 !== false &&
      템플릿정보.품명목록.indexOf(h.품명) !== -1 &&
      (h.출고일자 || '').slice(0, 7) === (연 + '-' + 월문자);
  }).map(function(h) {
    var 태산기록 = 태산입고_lot맵[h['lot번호']];
    var 불량내역 = (h.불량내역 && h.불량내역.length) ? h.불량내역 : ((태산기록 && 태산기록.불량내역) || []);
    return Object.assign({}, h, { 불량내역: 불량내역 });
  });

  if (!대상.length) return null;

  대상.sort(function(a, b) {
    if (a.출고일자 !== b.출고일자) return (a.출고일자 || '') < (b.출고일자 || '') ? -1 : 1;
    return (a.id || 0) - (b.id || 0);
  });

  var bin = atob(base64), buf = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  var zip = await JSZip.loadAsync(buf.buffer);
  var 시트맵 = await _검사집계_시트맵구하기(zip);
  await _검사집계_재계산강제(zip);

  var 시트파일 = 시트맵[월 + '월'];
  if (!시트파일 || !zip.file(시트파일)) throw new Error(템플릿정보.표시명 + ' 템플릿에 ' + 월 + '월 시트가 없습니다.');

  var xml = await zip.file(시트파일).async('string');
  var 목록 = _검사집계_행병합(대상);
  xml = _검사집계_구역초기화(xml);
  xml = _검사집계_구역채우기(xml, 목록);
  zip.file(시트파일, xml);

  return zip.generateAsync({ type: 'blob' });
}

/* ─────────── 버튼 핸들러 (상단 조회 기간 필터의 시작일 기준 월, 없으면 이번 달) ─────────── */
async function 검사집계_출력() {
  var 버튼  = document.getElementById('검사집계출력버튼');
  var 시작일 = (document.getElementById('검색_시작일') || {}).value || '';
  var 연, 월;
  if (/^\d{4}-\d{2}-\d{2}$/.test(시작일)) {
    연 = Number(시작일.slice(0, 4));
    월 = Number(시작일.slice(5, 7));
  } else {
    var 오늘 = new Date();
    연 = 오늘.getFullYear();
    월 = 오늘.getMonth() + 1;
  }
  var 월문자 = String(월).padStart(2, '0');

  if (버튼) { 버튼.disabled = true; 버튼.textContent = '생성 중...'; }
  try {
    var 결과목록 = [];
    for (var i = 0; i < 검사집계_템플릿목록.length; i++) {
      var 템플릿정보 = 검사집계_템플릿목록[i];
      var blob = await _검사집계_템플릿생성(연, 월, 템플릿정보);
      if (blob) {
        결과목록.push({ 표시명: 템플릿정보.표시명, blob: blob });
      }
    }

    if (!결과목록.length) {
      알림표시(연 + '년 ' + 월문자 + '월에 해당하는 출하검사 데이터가 없습니다.', '오류');
      return;
    }

    if (결과목록.length === 1) {
      var 파일명 = '삼양_' + 결과목록[0].표시명 + ' 검사현황 집계_' + 연 + '년' + 월문자 + '월.xlsx';
      var url = URL.createObjectURL(결과목록[0].blob);
      var a = document.createElement('a'); a.href = url; a.download = 파일명; a.click();
      setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
      알림표시(파일명 + ' 다운로드 완료', '성공');
    } else {
      var zip = new JSZip();
      결과목록.forEach(function(결과) {
        zip.file('삼양_' + 결과.표시명 + ' 검사현황 집계_' + 연 + '년' + 월문자 + '월.xlsx', 결과.blob);
      });
      var zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      var zip파일명 = '검사집계_' + 연 + '년' + 월문자 + '월.zip';
      var zurl = URL.createObjectURL(zipBlob);
      var za = document.createElement('a'); za.href = zurl; za.download = zip파일명; za.click();
      setTimeout(function() { URL.revokeObjectURL(zurl); }, 1000);
      알림표시(zip파일명 + ' 다운로드 완료 (' + 결과목록.length + '개 파일)', '성공');
    }
  } catch (err) {
    알림표시('검사집계 생성 실패: ' + (err.message || err), '오류');
    console.error(err);
  } finally {
    if (버튼) { 버튼.disabled = false; 버튼.textContent = '검사집계 출력'; }
  }
}
