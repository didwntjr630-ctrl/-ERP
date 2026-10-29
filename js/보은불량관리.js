/* ===================================================
   보은불량관리.js — ERP에서 받은 "보은 소재 불량 납품 마감 내역" 엑셀(.xls/.xlsx)의
   Sheet1_1에서 노란색으로 표시한 LOT만 모아, 품목별 요약 + 품목별 LOT 표 형태의
   "N월 불량반납" 엑셀로 변환한다. 합계 = A/D + H/L + 코팅 (엑셀 수식으로 기입)
   .xls 읽기·셀 배경색 확인은 SheetJS(XLSX), 결과 파일 작성은 ExcelJS 사용
   =================================================== */

var _보은불량_서식 = {
  글꼴: '맑은 고딕',
  숫자형식: '#,##0;-#,##0;-',
  제목색: 'FF1B2A41',
  머리글배경: 'FF1B2A41',
  강조색: 'FFE8742B',
  소계배경: 'FFFCE4D3',
  안내글색: 'FF6B7689',
  테두리색: 'FFBFC5CE',
  열너비: [7, 28, 12, 12, 12, 12]
};

function _보은불량_셀값(ws, r, c) {
  var cell = ws[XLSX.utils.encode_cell({ r: r, c: c })];
  return cell ? cell.v : '';
}
function _보은불량_셀색(ws, r, c) {
  var cell = ws[XLSX.utils.encode_cell({ r: r, c: c })];
  var rgb = cell && cell.s && cell.s.fgColor && cell.s.fgColor.rgb;
  return rgb ? String(rgb).toUpperCase().slice(-6) : '';
}

/* 머리글(1~2행)에서 품명·LOT·불량항목 열 위치를 찾음 — ERP 양식 열 순서가 바뀌어도 동작하도록 */
function _보은불량_열찾기(ws, 범위) {
  var 위치 = { 품명: -1, lot: -1, 불량: [] };
  var 불량항목 = APP_CONFIG.보은불량반납.불량항목;
  for (var c = 범위.s.c; c <= 범위.e.c; c++) {
    var 글 = (String(_보은불량_셀값(ws, 범위.s.r, c)) + ' ' + String(_보은불량_셀값(ws, 범위.s.r + 1, c))).replace(/\s+/g, '');
    if (위치.품명 < 0 && 글.indexOf('품명') >= 0) 위치.품명 = c;
    else if (위치.lot < 0 && /LOT/i.test(글)) 위치.lot = c;
    불량항목.forEach(function(항목, i) {
      var 핵심 = 항목.replace(/\s*부적합\s*/, '').replace(/\s+/g, '');
      if (위치.불량[i] === undefined && 글.indexOf(핵심) >= 0) 위치.불량[i] = c;
    });
  }
  var 빠진항목 = 불량항목.some(function(_h, i) { return 위치.불량[i] === undefined; });
  if (위치.품명 < 0 || 위치.lot < 0 || 빠진항목) {
    throw new Error('엑셀에서 품명·LOT번호·' + 불량항목.join('·') + ' 열을 찾지 못했습니다. ERP에서 받은 원본 파일인지 확인하세요.');
  }
  return 위치;
}

/* 파일 → { 행목록: [{품명, lot, 수량:[..], 노란색}], 시트이름 } */
async function 보은불량_파일읽기(파일) {
  var 설정 = APP_CONFIG.보은불량반납;
  var buf = await 파일.arrayBuffer();
  var wb = XLSX.read(buf, { type: 'array', cellStyles: true });
  var 시트이름 = wb.SheetNames.indexOf(설정.원본시트) >= 0 ? 설정.원본시트 : wb.SheetNames[0];
  var ws = wb.Sheets[시트이름];
  if (!ws || !ws['!ref']) throw new Error('엑셀에 내용이 없습니다.');

  var 범위 = XLSX.utils.decode_range(ws['!ref']);
  var 열 = _보은불량_열찾기(ws, 범위);
  var 행목록 = [];
  for (var r = 범위.s.r + 1; r <= 범위.e.r; r++) {
    var 품명 = String(_보은불량_셀값(ws, r, 열.품명) || '').trim();
    var lot = String(_보은불량_셀값(ws, r, 열.lot) || '').trim();
    if (!품명 || !lot || 품명 === '품명' || /LOT/i.test(lot)) continue;
    var 노란색 = false;
    for (var c = 범위.s.c; c <= 범위.e.c; c++) {
      if (_보은불량_셀색(ws, r, c) === 설정.포함색) { 노란색 = true; break; }
    }
    행목록.push({
      품명: 품명,
      lot: lot,
      수량: 열.불량.map(function(c) { return Number(_보은불량_셀값(ws, r, c)) || 0; }),
      노란색: 노란색
    });
  }
  return { 행목록: 행목록, 시트이름: 시트이름 };
}

/* 노란색 LOT만 품목별로 묶음 — 품목은 설정 순서 우선, 나머지는 파일에 나온 순서. LOT은 번호 오름차순 */
function 보은불량_집계(행목록) {
  var 대상 = 행목록.filter(function(h) { return h.노란색; });
  var 묶음 = {}, 나온순서 = [];
  대상.forEach(function(h) {
    if (!묶음[h.품명]) { 묶음[h.품명] = []; 나온순서.push(h.품명); }
    묶음[h.품명].push(h);
  });
  var 순서 = APP_CONFIG.보은불량반납.품목순서.filter(function(p) { return 묶음[p]; })
    .concat(나온순서.filter(function(p) { return APP_CONFIG.보은불량반납.품목순서.indexOf(p) < 0; }));
  return 순서.map(function(품명) {
    var lot들 = 묶음[품명].slice().sort(function(a, b) { return a.lot < b.lot ? -1 : a.lot > b.lot ? 1 : 0; });
    return { 품명: 품명, lot목록: lot들 };
  });
}

function _보은불량_기간문자(시작, 끝) {
  if (!시작 && !끝) return '';
  var 쪼개기 = function(d) { var p = d.split('-'); return { 년: p[0].slice(2), 월: Number(p[1]), 일: Number(p[2]) }; };
  var s = 시작 ? 쪼개기(시작) : null, e = 끝 ? 쪼개기(끝) : null;
  var 앞 = s ? s.년 + '.' + s.월 + '.' + s.일 : '';
  var 뒤 = e ? ((s && s.년 === e.년) ? '' : e.년 + '.') + e.월 + '.' + e.일 : '';
  return 앞 + '~' + 뒤;
}

/* ─────────── 엑셀 작성 ─────────── */
function 보은불량_엑셀만들기(품목목록, 반납월, 시작일, 끝일) {
  var 서 = _보은불량_서식;
  var 불량항목 = APP_CONFIG.보은불량반납.불량항목;
  var 년 = 반납월.slice(2, 4), 월 = Number(반납월.slice(5, 7));
  var 기간 = _보은불량_기간문자(시작일, 끝일);
  var 제목 = 년 + '년 ' + 월 + '월 불량 반납' + (기간 ? '(' + 기간 + ')' : '');

  var 선 = { style: 'thin', color: { argb: 서.테두리색 } };
  var 테두리 = { top: 선, left: 선, bottom: 선, right: 선 };
  var 글꼴 = function(추가) { return Object.assign({ name: 서.글꼴, size: 10 }, 추가 || {}); };
  var 채움 = function(색) { return { type: 'pattern', pattern: 'solid', fgColor: { argb: 색 } }; };

  var wb = new ExcelJS.Workbook();
  var ws = wb.addWorksheet(월 + '월 불량반납', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = 서.열너비.map(function(w) { return { width: w }; });
  ws.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  function 표머리(행, 첫칸제목) {
    var 값 = ['No', 첫칸제목].concat(불량항목).concat(['합계']);
    값.forEach(function(v, i) {
      var c = ws.getRow(행).getCell(i + 1);
      c.value = v;
      c.font = 글꼴({ bold: true, color: { argb: 'FFFFFFFF' } });
      c.fill = 채움(서.머리글배경);
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = 테두리;
    });
    ws.getRow(행).height = 15;
  }
  function 숫자칸(c, 값, 추가) {
    c.value = 값;
    c.numFmt = 서.숫자형식;
    c.font = 글꼴(추가 && 추가.font);
    c.alignment = { horizontal: 'right', vertical: 'middle' };
    c.border = 테두리;
    if (추가 && 추가.fill) c.fill = 추가.fill;
  }
  function 합계줄(행, 첫행, 끝행, 글, 배경, 글자색) {
    ws.mergeCells('A' + 행 + ':B' + 행);
    var 라벨 = ws.getCell('A' + 행);
    var 강조 = { font: { bold: true, color: 글자색 ? { argb: 글자색 } : undefined }, fill: 채움(배경) };
    라벨.value = 글;
    라벨.font = 글꼴(강조.font);
    라벨.fill = 강조.fill;
    라벨.alignment = { horizontal: 'center', vertical: 'middle' };
    라벨.border = 테두리;
    ws.getCell('B' + 행).border = 테두리;
    ['C', 'D', 'E', 'F'].forEach(function(col) {
      숫자칸(ws.getCell(col + 행), { formula: 'SUM(' + col + 첫행 + ':' + col + 끝행 + ')' }, 강조);
    });
    ws.getRow(행).height = 15;
  }

  /* 품목별 표 위치를 먼저 정해야 요약표가 각 소계를 참조할 수 있음 */
  var 요약첫행 = 5;
  var 요약끝행 = 요약첫행 + 품목목록.length - 1;
  var 총합계행 = 요약끝행 + 1;
  var 안내행 = 총합계행 + 1;
  var 행 = 안내행 + 2;
  var 표위치 = 품목목록.map(function(품목) {
    var 위치 = { 제목행: 행, 머리행: 행 + 1, 첫행: 행 + 2, 끝행: 행 + 1 + 품목.lot목록.length };
    위치.소계행 = 위치.끝행 + 1;
    행 = 위치.소계행 + 3;
    return 위치;
  });

  ws.mergeCells('A1:F1');
  var 제목칸 = ws.getCell('A1');
  제목칸.value = 제목;
  제목칸.font = 글꼴({ bold: true, size: 16, color: { argb: 서.제목색 } });
  제목칸.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(1).height = 30;

  /* 결재란 — 2~3행 오른쪽(C~F열): "결재" 세로 제목 + 작성·검토·승인 칸, 아래는 서명 칸 */
  ws.mergeCells('C2:C3');
  var 결재제목 = ws.getCell('C2');
  결재제목.value = '결\n\n재';
  결재제목.font = 글꼴({ bold: true, color: { argb: 'FFFFFFFF' } });
  결재제목.fill = 채움(서.머리글배경);
  결재제목.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  결재제목.border = 테두리;
  APP_CONFIG.보은불량반납.결재란.forEach(function(이름, i) {
    var 열 = String.fromCharCode(68 + i);
    var 머리 = ws.getCell(열 + '2'), 서명 = ws.getCell(열 + '3');
    머리.value = 이름;
    머리.font = 글꼴({ bold: true, color: { argb: 'FFFFFFFF' } });
    머리.fill = 채움(서.머리글배경);
    머리.alignment = { horizontal: 'center', vertical: 'middle' };
    머리.border = 테두리;
    서명.border = 테두리;
  });
  ws.getRow(2).height = 18;
  ws.getRow(3).height = 42;

  ws.getCell('A3').value = '품목별 요약';
  ws.getCell('A3').font = 글꼴({ bold: true, size: 12, color: { argb: 서.강조색 } });
  ws.getCell('A3').alignment = { vertical: 'bottom' };
  표머리(4, '품명');

  품목목록.forEach(function(품목, i) {
    var r = 요약첫행 + i, 소계행 = 표위치[i].소계행;
    var no = ws.getCell('A' + r), 이름 = ws.getCell('B' + r);
    no.value = i + 1; no.font = 글꼴(); no.alignment = { horizontal: 'center', vertical: 'middle' }; no.border = 테두리;
    이름.value = 품목.품명; 이름.font = 글꼴(); 이름.alignment = { horizontal: 'left', vertical: 'middle' }; 이름.border = 테두리;
    ['C', 'D', 'E', 'F'].forEach(function(col) { 숫자칸(ws.getCell(col + r), { formula: col + 소계행 }); });
    ws.getRow(r).height = 15;
  });
  합계줄(총합계행, 요약첫행, 요약끝행, '총 합계', 서.강조색, 'FFFFFFFF');

  ws.getCell('A' + 안내행).value = '※ 원본 파일(' + (APP_CONFIG.보은불량반납.원본시트) + ')에서 노란색으로 표시한 LOT만 집계, 합계 = ' +
    불량항목.map(function(h) { return h.replace(/\s*부적합/, ''); }).join(' + ');
  ws.getCell('A' + 안내행).font = 글꼴({ size: 9, color: { argb: 서.안내글색 } });

  품목목록.forEach(function(품목, i) {
    var p = 표위치[i];
    ws.mergeCells('A' + p.제목행 + ':F' + p.제목행);
    var t = ws.getCell('A' + p.제목행);
    t.value = 품목.품명 + '  (' + 품목.lot목록.length + ' LOT)';
    t.font = 글꼴({ bold: true, size: 12, color: { argb: 서.강조색 } });
    ws.getRow(p.제목행).height = 19.4;
    표머리(p.머리행, 'LOT번호');

    품목.lot목록.forEach(function(h, j) {
      var r = p.첫행 + j;
      var no = ws.getCell('A' + r), lot = ws.getCell('B' + r);
      no.value = j + 1; no.font = 글꼴(); no.alignment = { horizontal: 'center', vertical: 'middle' }; no.border = 테두리;
      lot.value = h.lot; lot.font = 글꼴(); lot.alignment = { horizontal: 'center', vertical: 'middle' }; lot.border = 테두리;
      ['C', 'D', 'E'].forEach(function(col, k) { 숫자칸(ws.getCell(col + r), h.수량[k] || null); });
      숫자칸(ws.getCell('F' + r), { formula: 'SUM(C' + r + ':E' + r + ')' });
      ws.getRow(r).height = 15;
    });
    합계줄(p.소계행, p.첫행, p.끝행, '소계', 서.소계배경);
  });

  wb.calcProperties.fullCalcOnLoad = true;
  return { 워크북: wb, 파일명: 년 + '년_' + 월 + '월_불량반납.xlsx', 제목: 제목 };
}

async function 보은불량_다운로드(품목목록, 반납월, 시작일, 끝일) {
  var 결과 = 보은불량_엑셀만들기(품목목록, 반납월, 시작일, 끝일);
  var buf = await 결과.워크북.xlsx.writeBuffer();
  var blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 결과.파일명;
  a.click();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  return 결과;
}
