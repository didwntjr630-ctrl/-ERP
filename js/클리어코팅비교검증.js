/* ===================================================
   클리어코팅비교검증.js — 스프레이 도막두께 측정 결과 엑셀(업로드)의 LOT별 측정값 5개를
   전산 "출하검사"(엠블럼 출하) 데이터와 LOT 매칭해서, 클리어 코팅 도막두께 로트별 비교검증
   체크시트 양식(월별 시트)에 자동 기입 — 측정값 외 나머지 항목(일자·LOT·수량·모델·색상)은
   전부 전산 데이터 기준으로 채운다.
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

/* ─────────── 업로드 파일에서 LOT별 측정값 5개 추출 ───────────
   시트 구조(전 시트 공통, 협력사 원본 그대로): 7~8행 헤더, 9행부터 데이터 —
   J열=LOT NO(공백 없음), Q열=측정값(μm), 같은 LOT이 연속 5행(병합) 반복.
   반환: { 정규화LOT(공백제거): [v1..v5] } */
async function _클리어코팅_업로드파싱(파일) {
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

/* ─────────── 업로드 LOT을 전산 "출하검사"(엠블럼 출하) 데이터와 매칭 ───────────
   반환: { 매칭목록: [...], 미매칭목록: [{lot, 사유}] } */
async function _클리어코팅_매칭(로트측정값맵) {
  var 전체 = await 데이터불러오기();
  var 출하검사맵 = {};
  전체.forEach(function(h) {
    if (h.공정 !== '출하검사') return;
    var key = String(h['lot번호'] || '').replace(/\s+/g, '');
    if (key) 출하검사맵[key] = h;
  });

  var 매칭목록 = [], 미매칭목록 = [];
  Object.keys(로트측정값맵).forEach(function(key) {
    var 측정값들 = 로트측정값맵[key];
    if (측정값들.length !== 5) {
      미매칭목록.push({ lot: key, 사유: '측정값이 5개가 아님(' + 측정값들.length + '개)' });
      return;
    }
    var 레코드 = 출하검사맵[key];
    if (!레코드) {
      미매칭목록.push({ lot: key, 사유: '전산 출하검사(엠블럼 출하) 데이터에 없는 LOT' });
      return;
    }
    var 일자 = 레코드.출고일자 || 레코드.입고일자 || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(일자)) {
      미매칭목록.push({ lot: key, 사유: '전산 데이터에 날짜가 없음' });
      return;
    }
    매칭목록.push({
      출고일자: 일자,
      lot번호:  레코드['lot번호'],
      입고수량: Number(레코드.입고수량) || 0,
      차종:    _클리어코팅_차종추출(레코드.품명),
      색상:    _클리어코팅_색상판별(레코드.품명),
      측정값:  측정값들
    });
  });

  return { 매칭목록: 매칭목록, 미매칭목록: 미매칭목록 };
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

/* ─────────── 한 달 분량 워크북 생성 ─────────── */
async function _클리어코팅_월워크북생성(연월, 레코드목록) {
  if (typeof 클리어코팅비교검증_BASE64 === 'undefined') {
    throw new Error('클리어코팅비교검증템플릿.js 가 로드되지 않았습니다.');
  }
  var bin = atob(클리어코팅비교검증_BASE64);
  var buf = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);

  var workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buf.buffer);

  var 월번호 = Number(연월.slice(5, 7));
  var ws = _클리어코팅_월시트확보(workbook, 월번호);
  ws.getCell('B2').value = '클리어 코팅 도막두께 로트별 비교검증 체크시트 (태산 코팅완료 입고품) ' + 월번호 + ' 월';

  var 정렬 = 레코드목록.slice().sort(function(a, b) {
    if (a.출고일자 !== b.출고일자) return a.출고일자 < b.출고일자 ? -1 : 1;
    return (a.lot번호 || '') < (b.lot번호 || '') ? -1 : 1;
  });

  var 최대건수 = 클리어코팅_데이터최대행 - 클리어코팅_데이터시작행 + 1;
  var 초과여부 = 정렬.length > 최대건수;
  if (초과여부) 정렬 = 정렬.slice(0, 최대건수);

  /* 데이터 구역 전체 초기화(값·수식 모두) — 이전에 채워졌던 잔여 이탈/불합격 표시가 남지 않도록 */
  for (var r = 클리어코팅_데이터시작행; r <= 클리어코팅_데이터최대행; r++) {
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
    ['H', 'I', 'J', 'K', 'L'].forEach(function(col, i) { ws.getCell(col + 행).value = rec.측정값[i]; });

    /* 규격 판정 기준은 행마다(모델마다) 다르므로, 템플릿 수식을 그대로 두지 않고 이 행에 맞는 수식을 직접 기입 */
    ws.getCell('M' + 행).value = { formula: 'AVERAGE(H' + 행 + ':L' + 행 + ')' };
    ws.getCell('N' + 행).value = { formula: 'MAX(H' + 행 + ':L' + 행 + ')-MIN(H' + 행 + ':L' + 행 + ')' };
    ws.getCell('O' + 행).value = { formula: 'IF(AND(MIN(H' + 행 + ':L' + 행 + ')>=' + 범위[0] + ', MAX(H' + 행 + ':L' + 행 + ')<=' + 범위[1] + '), "만족", "이탈")' };
    ws.getCell('P' + 행).value = { formula: 'IF(AND(M' + 행 + '>=' + 범위[0] + ', M' + 행 + '<=' + 범위[1] + '), "합격", "불합격")' };
    ws.getCell('Q' + 행).value = { formula: 'IF(P' + 행 + '="불합격", "규격 이탈 확인", "-")' };
  });

  workbook.calcProperties.fullCalcOnLoad = true;

  var blob = await workbook.xlsx.writeBuffer().then(function(buf) {
    return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  });
  return { blob: blob, 초과여부: 초과여부, 건수: 정렬.length };
}

/* ─────────── 메인: 업로드 파일 → 매칭 → (기간 필터) → 월별 워크북 생성 → 다운로드 ─────────── */
async function 클리어코팅_생성및다운로드(파일, 시작일, 종료일) {
  var 로트측정값맵 = await _클리어코팅_업로드파싱(파일);
  if (!Object.keys(로트측정값맵).length) {
    throw new Error('업로드 파일에서 LOT 데이터를 찾지 못했습니다. 파일 형식을 확인하세요.');
  }

  var 매칭결과 = await _클리어코팅_매칭(로트측정값맵);

  var 대상목록 = 매칭결과.매칭목록;
  var 기간제외건수 = 0;
  if (시작일 || 종료일) {
    var 원본건수 = 대상목록.length;
    대상목록 = 대상목록.filter(function(rec) {
      if (시작일 && rec.출고일자 < 시작일) return false;
      if (종료일 && rec.출고일자 > 종료일) return false;
      return true;
    });
    기간제외건수 = 원본건수 - 대상목록.length;
  }

  if (!대상목록.length) {
    throw new Error(매칭결과.매칭목록.length
      ? '선택한 기간에 해당하는 매칭 데이터가 없습니다.'
      : '전산 출하검사 데이터와 매칭된 LOT이 하나도 없습니다.');
  }

  var 월별 = {};
  대상목록.forEach(function(rec) {
    var 연월 = rec.출고일자.slice(0, 7);
    if (!월별[연월]) 월별[연월] = [];
    월별[연월].push(rec);
  });

  var 결과목록 = [];
  var 초과월목록 = [];
  for (var 연월 in 월별) {
    var 결과 = await _클리어코팅_월워크북생성(연월, 월별[연월]);
    결과목록.push({ 연월: 연월, blob: 결과.blob, 건수: 결과.건수 });
    if (결과.초과여부) 초과월목록.push(연월);
  }

  if (결과목록.length === 1) {
    var 파일명 = '클리어코팅_비교검증_' + 결과목록[0].연월.replace('-', '') + '.xlsx';
    var url = URL.createObjectURL(결과목록[0].blob);
    var a = document.createElement('a'); a.href = url; a.download = 파일명; a.click();
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  } else {
    var zip = new JSZip();
    결과목록.forEach(function(r) {
      zip.file('클리어코팅_비교검증_' + r.연월.replace('-', '') + '.xlsx', r.blob);
    });
    var zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    var zip파일명 = '클리어코팅_비교검증_' + 결과목록.length + '개월.zip';
    var zurl = URL.createObjectURL(zipBlob);
    var za = document.createElement('a'); za.href = zurl; za.download = zip파일명; za.click();
    setTimeout(function() { URL.revokeObjectURL(zurl); }, 1000);
  }

  return {
    매칭건수: 대상목록.length,
    전체매칭건수: 매칭결과.매칭목록.length,
    기간제외건수: 기간제외건수,
    미매칭목록: 매칭결과.미매칭목록,
    월목록: Object.keys(월별),
    초과월목록: 초과월목록
  };
}
