/* ===================================================
   거래내역서.js - 거래내역서 엑셀 출력
   =================================================== */

function 거래내역서출력() {
  var 목록 = (전체데이터 || []).slice().sort(function(a, b) {
    return (a.출고일자 || '').localeCompare(b.출고일자 || '');
  });
  if (!목록.length) { 알림표시('출력할 데이터가 없습니다.', '오류'); return; }

  // 수신처 (가장 많이 등장하는 도착공정)
  var 수신맵 = {};
  목록.forEach(function(h) {
    var d = h.도착공정 || '';
    수신맵[d] = (수신맵[d] || 0) + 1;
  });
  var 수신 = Object.keys(수신맵).sort(function(a, b) { return 수신맵[b] - 수신맵[a]; })[0] || '';

  // 출력 일자 (마지막 출고일자 기준)
  var 마지막일 = (목록[목록.length - 1].출고일자 || '').split('-');
  var 출력일자 = 마지막일.length === 3
    ? 마지막일[0] + '년 ' + Number(마지막일[1]) + '월 ' + Number(마지막일[2]) + '일'
    : '';

  // 날짜별 그룹핑
  var 날짜그룹 = {}, 날짜순서 = [];
  목록.forEach(function(h) {
    var d = h.출고일자 || '';
    if (!날짜그룹[d]) { 날짜그룹[d] = []; 날짜순서.push(d); }
    날짜그룹[d].push(h);
  });

  var 총수량 = 0, 총공급가 = 0, 번호 = 1, 행HTML = '';

  날짜순서.forEach(function(날짜) {
    var 그룹 = 날짜그룹[날짜];
    var 표시날짜 = 날짜 ? 날짜.substring(5).replace('-', '/') : '';
    그룹.forEach(function(h, i) {
      var 품목 = 품목목록.find(function(p) { return p.품명 === h.품명; });
      var 단가 = 품목 ? (품목.단가 || 0) : 0;
      var 수량 = Number(h.출고수량) || 0;
      var 공급가 = 단가 * 수량;
      총수량 += 수량;
      총공급가 += 공급가;
      var 규격 = 규격결정(h.품명);
      행HTML +=
        '<tr>' +
        '<td style="text-align:center;">' + (번호++) + '</td>' +
        '<td style="text-align:center;">' + (i === 0 ? 표시날짜 : '') + '</td>' +
        '<td>' + (h.품명 || '') + '</td>' +
        '<td style="text-align:center;">' + APP_CONFIG.매출고정값.완료공정 + '</td>' +
        '<td style="text-align:center;">' + 규격 + '</td>' +
        '<td style="text-align:right;">' + 단가.toLocaleString() + '</td>' +
        '<td style="text-align:right;">' + 수량.toLocaleString() + '</td>' +
        '<td style="text-align:right;">₩ ' + 공급가.toLocaleString() + '</td>' +
        '<td></td>' +
        '</tr>';
    });
  });

  var 부가세 = Math.round(총공급가 * 0.1);
  var 총합계 = 총공급가 + 부가세;
  var c = APP_CONFIG;

  var 스타일 =
    'body{font-family:"맑은 고딕","Malgun Gothic",sans-serif;font-size:10pt;}' +
    'table{border-collapse:collapse;}' +
    'td,th{border:1px solid black;padding:4px 6px;}' +
    '.nb{border:none!important;}.c{text-align:center;}.r{text-align:right;}.b{font-weight:bold;}.bg{background:#e8e8e8;}';

  var 공급자박스 =
    '<table style="width:100%;border-collapse:collapse;">' +
      '<tr>' +
        '<td class="bg b c" rowspan="4" style="width:22px;writing-mode:vertical-rl;letter-spacing:6px;padding:4px;">공급자</td>' +
        '<td class="bg b c" style="width:60px;">등록번호</td>' +
        '<td colspan="2">' + c.사업자번호 + '</td>' +
      '</tr>' +
      '<tr>' +
        '<td class="bg b c">상 호</td>' +
        '<td>' + c.회사명 + '</td>' +
        '<td><b>대표자</b> ' + c.대표자 + '</td>' +
      '</tr>' +
      '<tr>' +
        '<td class="bg b c">주 소</td>' +
        '<td colspan="2">' + c.주소 + '</td>' +
      '</tr>' +
      '<tr>' +
        '<td class="bg b c">업 태</td>' +
        '<td>' + c.업태 + '</td>' +
        '<td><b>종 목</b> ' + c.종목 + '</td>' +
      '</tr>' +
    '</table>';

  var html =
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' + 스타일 + '</style></head><body>' +
    '<table style="width:780px;">' +
    '<tr><td colspan="9" class="nb b" style="font-size:18pt;text-align:center;padding:14px 0;border-bottom:2px solid black;">거 래 내 역 서</td></tr>' +
    '<tr>' +
      '<td colspan="5" class="nb" style="vertical-align:top;padding:10px 0;">' +
        '<table style="border:none;"><tbody>' +
          '<tr><td class="nb"><b>일 자</b> : ' + 출력일자 + '</td></tr>' +
          '<tr><td class="nb"><b>수 신</b> : ' + 수신 + '</td></tr>' +
          '<tr><td class="nb" style="padding-top:8px;">아래와 같이 거래합니다.</td></tr>' +
        '</tbody></table>' +
      '</td>' +
      '<td colspan="4" class="nb">' + 공급자박스 + '</td>' +
    '</tr>' +
    '<tr><td colspan="9" class="b c bg" style="font-size:11pt;padding:5px;">거 래 내 역</td></tr>' +
    '<tr class="bg">' +
      '<th class="c" style="width:35px;">NO.</th>' +
      '<th class="c" style="width:45px;">일자</th>' +
      '<th class="c" style="width:140px;">품명</th>' +
      '<th class="c" style="width:55px;">완료공정</th>' +
      '<th class="c" style="width:40px;">규격</th>' +
      '<th class="c" style="width:55px;">단가</th>' +
      '<th class="c" style="width:75px;">수량 (EA)</th>' +
      '<th class="c" style="width:100px;">공급가액<br>(VAT 별도)</th>' +
      '<th class="c" style="width:100px;">비고</th>' +
    '</tr>' +
    행HTML +
    '<tr>' +
      '<td colspan="6" class="c b">합 계</td>' +
      '<td class="r b">' + 총수량.toLocaleString() + '</td>' +
      '<td class="r b">₩ ' + 총공급가.toLocaleString() + '</td>' +
      '<td></td>' +
    '</tr>' +
    '<tr><td colspan="9" style="border:none;height:10px;"></td></tr>' +
    '<tr>' +
      '<td colspan="7" class="c b">공급가액</td>' +
      '<td class="r b">₩ ' + 총공급가.toLocaleString() + '</td>' +
      '<td></td>' +
    '</tr>' +
    '<tr>' +
      '<td colspan="7" class="c b">부가세 (10%)</td>' +
      '<td class="r b">₩ ' + 부가세.toLocaleString() + '</td>' +
      '<td></td>' +
    '</tr>' +
    '<tr>' +
      '<td colspan="7" class="c b">합 계</td>' +
      '<td class="r b">₩ ' + 총합계.toLocaleString() + '</td>' +
      '<td></td>' +
    '</tr>' +
    '<tr><td colspan="9" style="border:none;padding-top:14px;">■ Remark<br>1. 반품 목록 제외</td></tr>' +
    '</table></body></html>';

  var blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = '거래내역서_' + new Date().toISOString().slice(0, 10) + '.xls';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  알림표시('거래내역서가 다운로드됩니다.', '성공');
}
