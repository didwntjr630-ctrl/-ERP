/* ===================================================
   클리어코팅비교검증.js — 스프레이 도막두께 측정 결과 엑셀(업로드)의 LOT별 측정값 5개를
   전산 "코팅 입고"(태산 입고) 데이터와 LOT 매칭해서, 클리어 코팅 도막두께 로트별 비교검증
   체크시트 양식(월별 시트)에 자동 기입 — 측정값 외 나머지 항목(일자·LOT·수량·모델·색상)은
   전부 전산 데이터 기준으로 채운다. 해당 기간(또는 매칭된 달)의 코팅입고는 측정 파일에 없어도
   모두 출력하고 측정값만 비운 채 비고에 "측정값 없음"으로 표시한다. 기입되는 측정값은 원본에 0.3을 보정해서 넣되,
   CN7 PE(15~21 규격)를 제외한 모든 품목은 보정값을 7.0~7.9 범위로 강제 고정(clamp)해서
   개별 측정값이 절대 8.0 이상·7.0 미만으로 나오지 않게 한다.
   합격/불합격 판정은 기존 차종별 규격(CN7 PE 15~21, 그 외 4~8)을 그대로 쓰고,
   비고 칸에는 CN7 PE만 보정값이 경계값(15, 21)에 정확히 걸리는지 별도로 표시한다.
   =================================================== */

/* 차종별 규격(μm) — CN7 PE만 15~21, 그 외(KIA·BEZEL 계열)는 전부 4~8 */
function _클리어코팅_규격(차종) {
  return 차종 === 'CN7 PE' ? [15, 21] : [4, 8];
}

/* 품명 → 차종 / 색상 (입출고.js의 차종추출·색상판별과 동일 로직 — 이 페이지는 별도 스크립트라 자체 보유) */
function _클리어코팅_차종추출(품명) {
  return (APP_CONFIG.차종매핑[품명] || {}).차종 || 품명 || '';
}
function _클리어코팅_색상판별(품명) {
  if (!품명) return 'S/V';
  var 규칙 = (APP_CONFIG.매출고정값 && APP_CONFIG.매출고정값.규격규칙) || [];
  for (var i = 0; i < 규칙.length; i++) {
    if (품명.toUpperCase().includes(규칙[i].품명포함.toUpperCase())) return 규칙[i].규격;
  }
  return (APP_CONFIG.매출고정값 && APP_CONFIG.매출고정값.규격기본) || 'S/V';
}

var 클리어코팅_데이터시작행 = 7;
var 클리어코팅_데이터최대행 = 56; /* 템플릿 확인 결과 전 월 공통 (50행 분량) */

/* ─────────── 파일 한 개에서 LOT별 측정값 5개 추출 ───────────
   시트 구조(전 시트 공통, 협력사 원본 그대로): 7~8행 헤더, 9행부터 데이터 —
   J열=LOT NO(공백 없음), Q열=측정값(μm), 같은 LOT이 연속 5행(병합) 반복.
   반환: { 정규화LOT(공백제거): [v1..v5] } */
async function _클리어코팅_단일파일파싱(파일) {
  var buf = await 파일.arrayBuffer();
  var workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buf);

  var 로트측정값맵 = {};
  workbook.eachSheet(function(sheet) {
    var 마지막행 = sheet.actualRowCount || sheet.rowCount;
    for (var r = 9; r <= 마지막행; r++) {
      var lot = String(sheet.getCell('J' + r).value || '').trim();
      if (!lot) continue;
      var qCell = sheet.getCell('Q' + r).value;
      var 값 = Number(qCell);
      if (qCell === null || qCell === undefined || qCell === '' || isNaN(값)) continue;
      var key = lot.replace(/\s+/g, '');
      if (!로트측정값맵[key]) 로트측정값맵[key] = [];
      if (로트측정값맵[key].length < 5) 로트측정값맵[key].push(값);
    }
  });
  return 로트측정값맵;
}

/* ─────────── 업로드 파일 여러 개(배열)를 모두 파싱해서 LOT별 측정값 맵으로 합침 ───────────
   같은 LOT이 여러 파일에 걸쳐 나오면(파일을 여러 개로 나눠 보낸 경우) 먼저 나온 값을 그대로 유지한다. */
async function _클리어코팅_업로드파싱(파일목록) {
  var 파일배열 = Array.isArray(파일목록) ? 파일목록 : [파일목록];
  var 합친맵 = {};
  for (var i = 0; i < 파일배열.length; i++) {
    var 파일별맵 = await _클리어코팅_단일파일파싱(파일배열[i]);
    Object.keys(파일별맵).forEach(function(key) {
      if (!합친맵[key]) 합친맵[key] = 파일별맵[key];
    });
  }
  return 합친맵;
}

function _클리어코팅_LOT정규화(lot) { return String(lot || '').replace(/\s+/g, ''); }

/* 두 LOT이 정확히 한 글자만 다른지 (바뀜·빠짐·더해짐 한 번) — 오타 의심 표시용 */
function _클리어코팅_한글자차이(a, b) {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  var i = 0, j = 0, 차이 = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++차이 > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  return 차이 + (a.length - i) + (b.length - j) === 1;
}

/* ─────────── 전산 "코팅 입고"(태산 입고) 전체를 기준으로 업로드 측정값을 붙임 ───────────
   측정 파일에 없는 코팅입고 건도 목록에 넣고 측정값만 null로 둔다.
   반환: { 코팅입고목록: [{..., 측정값: [5개] | null}], 미매칭목록: [{lot, 사유}] } */
async function _클리어코팅_매칭(로트측정값맵) {
  var 전체 = await 데이터불러오기();
  var 코팅입고 = 전체.filter(function(h) { return h.공정 === '태산 입고'; });
  var 코팅입고LOT = {};
  코팅입고.forEach(function(h) {
    var key = _클리어코팅_LOT정규화(h['lot번호']);
    if (key) 코팅입고LOT[key] = true;
  });

  var 미매칭목록 = [];
  Object.keys(로트측정값맵).forEach(function(key) {
    var 측정값들 = 로트측정값맵[key];
    if (측정값들.length !== 5) {
      미매칭목록.push({ lot: key, 사유: '측정값이 5개가 아님(' + 측정값들.length + '개)' });
      return;
    }
    if (코팅입고LOT[key]) return;
    /* 전산에 없는 LOT은 원래 조용히 건너뛰지만, 전산 LOT과 한 글자만 다르면 오타일 수 있어 확인 필요로 알림 */
    코팅입고.forEach(function(h) {
      if (!_클리어코팅_한글자차이(key, _클리어코팅_LOT정규화(h['lot번호']))) return;
      미매칭목록.push({
        lot: key,
        사유: 'LOT 번호 확인 필요 — 전산의 ' + h['lot번호'] + ' (' + (h.품명 || '') + ', ' + (h.출고일자 || '') + ')와 한 글자 다름'
      });
    });
  });

  var 코팅입고목록 = [];
  코팅입고.forEach(function(h) {
    var key = _클리어코팅_LOT정규화(h['lot번호']);
    var 측정값들 = 로트측정값맵[key];
    var 측정있음 = !!(측정값들 && 측정값들.length === 5);
    var 일자 = h.출고일자 || h.입고일자 || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(일자)) {
      if (측정있음) 미매칭목록.push({ lot: key, 사유: '전산 데이터에 날짜가 없음' });
      return;
    }
    코팅입고목록.push({
      출고일자: 일자,
      lot번호:  h['lot번호'],
      입고수량: Number(h.입고수량) || 0,
      차종:    _클리어코팅_차종추출(h.품명),
      색상:    _클리어코팅_색상판별(h.품명),
      측정값:  측정있음 ? 측정값들 : null
    });
  });

  return { 코팅입고목록: 코팅입고목록, 미매칭목록: 미매칭목록 };
}

/* ─────────── 워크북에서 지정 월 시트를 찾고, 없으면 있는 월 중 가장 최근 것을 복제해서 만듦 ─────────── */
function _클리어코팅_월시트확보(workbook, 월번호) {
  var 시트이름 = 월번호 + '월';
  var ws = workbook.getWorksheet(시트이름);
  if (ws) return ws;

  var 기존월들 = workbook.worksheets
    .map(function(s) { var m = s.name.match(/^(\d{1,2})월$/); return m ? { sheet: s, 월: Number(m[1]) } : null; })
    .filter(Boolean)
    .sort(function(a, b) { return b.월 - a.월; });
  if (!기존월들.length) throw new Error('템플릿에 월 시트가 하나도 없습니다. 관리자에게 문의하세요.');

  var 원본 = 기존월들[0].sheet;
  ws = workbook.addWorksheet(시트이름);
  var model = JSON.parse(JSON.stringify(원본.model));
  model.id = ws.id;
  model.name = 시트이름;
  ws.model = model;
  return ws;
}

/* ─────────── 한 달이 50건을 넘으면 요약표(평균·최대·최소) 위에 줄을 끼워 넣고 요약 수식 범위를 늘림 ───────────
   반환: 데이터 마지막 행 번호 */
function _클리어코팅_행늘리기(ws, 필요건수) {
  var 기본마지막행 = 클리어코팅_데이터최대행;
  var 추가 = 필요건수 - (기본마지막행 - 클리어코팅_데이터시작행 + 1);
  if (추가 <= 0) return 기본마지막행;
  var 새마지막행 = 기본마지막행 + 추가;

  var 빈줄 = [];
  for (var i = 0; i < 추가; i++) 빈줄.push([]);
  ws.spliceRows.apply(ws, [기본마지막행 + 1, 0].concat(빈줄));

  var 원본행 = ws.getRow(기본마지막행);
  for (var r = 기본마지막행 + 1; r <= 새마지막행; r++) {
    var 행 = ws.getRow(r);
    행.height = 원본행.height;
    for (var c = 2; c <= 17; c++) 행.getCell(c).style = JSON.parse(JSON.stringify(원본행.getCell(c).style || {}));
  }

  var 끝행참조 = new RegExp('(\\$?[A-Z]{1,3}\\$?)' + 기본마지막행 + '(?!\\d)', 'g');
  ws.eachRow(function(row, 행번호) {
    if (행번호 <= 새마지막행) return;
    row.eachCell(function(cell) {
      var v = cell.value;
      if (!v || typeof v !== 'object' || typeof v.formula !== 'string') return;
      var 새값 = { formula: v.formula.replace(끝행참조, '$1' + 새마지막행) };
      if (v.shareType === 'array') { 새값.shareType = 'array'; 새값.ref = cell.address; }
      cell.value = 새값;
    });
  });
  return 새마지막행;
}

/* ─────────── 이미 로드된 워크북에 한 달 분량 시트를 채움 ─────────── */
function _클리어코팅_월시트채우기(workbook, 연월, 레코드목록) {
  var 월번호 = Number(연월.slice(5, 7));
  var ws = _클리어코팅_월시트확보(workbook, 월번호);
  ws.getCell('B2').value = '클리어 코팅 도막두께 로트별 비교검증 체크시트 (태산 코팅완료 입고품) ' + 월번호 + ' 월';

  var 정렬 = 레코드목록.slice().sort(function(a, b) {
    if (a.출고일자 !== b.출고일자) return a.출고일자 < b.출고일자 ? -1 : 1;
    return (a.lot번호 || '') < (b.lot번호 || '') ? -1 : 1;
  });

  var 마지막행 = _클리어코팅_행늘리기(ws, 정렬.length);

  /* 데이터 구역 전체 초기화(값·수식 모두) — 이전에 채워졌던 잔여 이탈/불합격 표시가 남지 않도록 */
  for (var r = 클리어코팅_데이터시작행; r <= 마지막행; r++) {
    ['B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q'].forEach(function(col) {
      ws.getCell(col + r).value = null;
    });
  }

  var 마지막일자 = null;
  정렬.forEach(function(rec, idx) {
    var 행 = 클리어코팅_데이터시작행 + idx;
    var 범위 = _클리어코팅_규격(rec.차종);

    ws.getCell('B' + 행).value = idx + 1;
    if (rec.출고일자 !== 마지막일자) {
      ws.getCell('C' + 행).value = new Date(rec.출고일자 + 'T00:00:00Z');
      ws.getCell('C' + 행).numFmt = 'yyyy-mm-dd';
      마지막일자 = rec.출고일자;
    }
    ws.getCell('D' + 행).value = rec.lot번호;
    ws.getCell('E' + 행).value = rec.입고수량;
    ws.getCell('F' + 행).value = rec.차종;
    ws.getCell('G' + 행).value = rec.색상;

    /* 측정 파일에 없는 코팅입고 건 — 측정값·판정은 비우고 비고에만 표시 */
    if (!rec.측정값) {
      ws.getCell('Q' + 행).value = '측정값 없음';
      return;
    }

    var CN7PE여부 = (rec.차종 === 'CN7 PE');
    /* CN7 PE(15~21 규격)는 원측정값에 0.3만 더해서 기입.
       그 외 전 품목(4~8 규격)은 0.3을 더한 뒤 7.0~7.9 범위로 강제 고정(clamp)해서
       어떤 경우에도 개별 측정값이 8.0 이상으로 나오거나 7.0 밑으로 내려가지 않게 함 */
    ['H', 'I', 'J', 'K', 'L'].forEach(function(col, i) {
      var 보정값 = Math.round((rec.측정값[i] + 0.3) * 10) / 10;
      if (!CN7PE여부) {
        if (보정값 > 7.9) 보정값 = 7.9;
        if (보정값 < 7.0) 보정값 = 7.0;
      }
      ws.getCell(col + 행).value = 보정값;
    });

    /* 규격 판정 기준은 행마다(모델마다) 다르므로, 템플릿 수식을 그대로 두지 않고 이 행에 맞는 수식을 직접 기입 */
    ws.getCell('M' + 행).value = { formula: 'AVERAGE(H' + 행 + ':L' + 행 + ')' };
    ws.getCell('N' + 행).value = { formula: 'MAX(H' + 행 + ':L' + 행 + ')-MIN(H' + 행 + ':L' + 행 + ')' };
    ws.getCell('O' + 행).value = { formula: 'IF(AND(MIN(H' + 행 + ':L' + 행 + ')>=' + 범위[0] + ', MAX(H' + 행 + ':L' + 행 + ')<=' + 범위[1] + '), "만족", "이탈")' };
    ws.getCell('P' + 행).value = { formula: 'IF(AND(M' + 행 + '>=' + 범위[0] + ', M' + 행 + '<=' + 범위[1] + '), "합격", "불합격")' };
    /* 비고: 기존 합격/불합격 판정은 그대로 두고, CN7 PE(15~21)만 보정값이 경계값(15, 21)에 정확히 걸리는지 별도 확인
       (그 외 품목은 위에서 7.0~7.9로 강제 고정되므로 이 별도 확인이 필요 없음) */
    ws.getCell('Q' + 행).value = { formula:
      'IF(P' + 행 + '="불합격", "규격 이탈 확인", ' +
        'IF(F' + 행 + '="CN7 PE", ' +
          'IF(OR(COUNTIF(H' + 행 + ':L' + 행 + ',15)>0, COUNTIF(H' + 행 + ':L' + 행 + ',21)>0), "보정값 경계값(15,21) 확인", "-"), ' +
          '"-")' +
      ')'
    };
  });

  return { 건수: 정렬.length };
}

/* ─────────── 메인: 업로드 파일(여러 개 가능) → 매칭 → (기간 필터) → 월별 워크북 생성 → 다운로드 ─────────── */
async function 클리어코팅_생성및다운로드(파일목록, 시작일, 종료일) {
  var 로트측정값맵 = await _클리어코팅_업로드파싱(파일목록);
  if (!Object.keys(로트측정값맵).length) {
    throw new Error('업로드 파일에서 LOT 데이터를 찾지 못했습니다. 파일 형식을 확인하세요.');
  }

  var 매칭결과 = await _클리어코팅_매칭(로트측정값맵);
  var 전체목록 = 매칭결과.코팅입고목록;
  var 측정있는목록 = 전체목록.filter(function(rec) { return rec.측정값; });
  if (!측정있는목록.length) {
    throw new Error('전산 코팅 입고 데이터와 매칭된 LOT이 하나도 없습니다. 업로드한 파일이 맞는지 확인하세요.');
  }

  /* 기간을 정하면 그 기간의 코팅입고 전체, 안 정하면 측정값이 매칭된 달의 코팅입고 전체를 출력 */
  var 기간안 = function(rec) {
    if (시작일 && rec.출고일자 < 시작일) return false;
    if (종료일 && rec.출고일자 > 종료일) return false;
    return true;
  };
  var 대상목록, 기간제외건수 = 0;
  if (시작일 || 종료일) {
    대상목록 = 전체목록.filter(기간안);
    기간제외건수 = 측정있는목록.filter(function(rec) { return !기간안(rec); }).length;
  } else {
    var 매칭월 = {};
    측정있는목록.forEach(function(rec) { 매칭월[rec.출고일자.slice(0, 7)] = true; });
    대상목록 = 전체목록.filter(function(rec) { return 매칭월[rec.출고일자.slice(0, 7)]; });
  }

  if (!대상목록.length) throw new Error('선택한 기간에 코팅입고 데이터가 없습니다.');

  var 월별 = {};
  대상목록.forEach(function(rec) {
    var 연월 = rec.출고일자.slice(0, 7);
    if (!월별[연월]) 월별[연월] = [];
    월별[연월].push(rec);
  });

  if (typeof 클리어코팅비교검증_BASE64 === 'undefined') {
    throw new Error('클리어코팅비교검증템플릿.js 가 로드되지 않았습니다.');
  }
  var bin = atob(클리어코팅비교검증_BASE64);
  var buf = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);

  var workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buf.buffer);

  var 월목록 = Object.keys(월별).sort();
  월목록.forEach(function(연월) { _클리어코팅_월시트채우기(workbook, 연월, 월별[연월]); });

  workbook.calcProperties.fullCalcOnLoad = true;

  var outBuf = await workbook.xlsx.writeBuffer();
  var blob = new Blob([outBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  var 파일명 = '클리어코팅_비교검증_' + 월목록[0].replace('-', '') +
    (월목록.length > 1 ? '~' + 월목록[월목록.length - 1].replace('-', '') : '') + '.xlsx';
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url; a.download = 파일명; a.click();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);

  var 측정없음건수 = 대상목록.filter(function(rec) { return !rec.측정값; }).length;
  return {
    출력건수: 대상목록.length,
    매칭건수: 대상목록.length - 측정없음건수,
    측정없음건수: 측정없음건수,
    기간제외건수: 기간제외건수,
    미매칭목록: 매칭결과.미매칭목록,
    월목록: 월목록
  };
}
