/* ===================================================
   config.js - 전역 설정값 (배포 시 이 파일만 수정)
   =================================================== */

var APP_CONFIG = {
  회사명:     '(주)삼양이엔지',
  시스템명:   '삼양ERP',
  부제:       'Challenge',
  관리자:     '대리 양주석',
  버전:       'v1.0.0',
  사업자번호: '203-88-00683',
  대표자:     '홍운기',
  주소:       '경북 구미시 옥계2공단로 73, 가동(황상동)',
  업태:       '제조업',
  종목:       '전자부품',

  공정목록: [
    '수입검사',
    '헤어라인',
    '아노다이징',
    '공정검사',
    '출하검사'
  ],

  외부공정: {
    입고: '외부(납품)',
    출하: '외부(출하)'
  },

  출하검사옵션: {
    출발공정: ['(주)삼양이엔지'],
    도착공정: ['(주)보은금속', '(주)두산정밀']
  },

  공정코드: {
    '수입검사':       '200',
    '헤어라인':       '300',
    '아노다이징':     '400',
    '공정검사':       '500',
    '출하검사':       '600',
    '(주)삼양이엔지': '1000',
    '(주)두산정밀':   '1000',
    '(주)보은금속':   '2000'
  },

  납품처목록: [
    { 코드: '2000', 업체명: '(주)보은금속' },
    { 코드: '1000', 업체명: '(주)두산정밀' }
  ],

  수신이메일: 'didwntjr630@naver.com',
  수신처목록: [
    { 이름: '테스트',       이메일: 'didwntjr630@naver.com' },
    { 이름: '(주)삼양이엔지', 이메일: 'syeng1@syeng1.kr'       }
  ],
  메일발송URL: 'https://script.google.com/macros/s/AKfycbwbqqjznaihbxrK8m_Dd__ZfqcydygN50fOKNP-WcfPLuQ6bZ0Go-9rCnDj0SX_S0fcIg/exec',

  차종매핑: {
    '기아 45mm':               { 차종: 'CL4',        품목: 'EMBLEM' },
    '기아 61mm':               { 차종: 'KA4',        품목: 'EMBLEM' },
    '기아 71mm':               { 차종: 'GL3',        품목: 'EMBLEM' },
    'H-EMBLEM SILVER(CN7 PE)': { 차종: 'CN7 PE',    품목: 'EMBLEM' },
    'H-EMBLEM BLACK(CN7 PE)':  { 차종: 'CN7 PE',    품목: 'EMBLEM' },
    'BEZEL(GN7)':              { 차종: 'GN7',        품목: 'BEZEL'  },
    'MX5 BEZEL SILVER':        { 차종: 'MX5',        품목: 'BEZEL'  },
    'MX5 BEZEL BLACK':         { 차종: 'MX5',        품목: 'BEZEL'  },
    'GENESIS EMBLEM':          { 차종: 'JW1 PE HPV', 품목: 'EMBLEM' },
    'GN7 F/L':                 { 차종: 'GN7 FL',     품목: 'BEZEL'  },
  },

  매출고정값: {
    완료공정: 'C/T',
    규격기본:  'S/V',
    규격규칙: [
      { 품명포함: 'BLACK', 규격: 'B/K' }
    ]
  },

  매입지출카테고리: ['원자재', '외주가공비', '전기·유틸리티', '임대료', '소모품', '기타'],

  공지문구: '안녕하세요! 삼양ERP를 이용해 주셔서 감사합니다. 문의사항은 관리자에게 연락 주세요.',

  성적서자동기입: {
    '기아 45mm':               { 도막두께: [3.8,  4.2],  중량: [2.46, 2.49], 이미지폴더: 'kia_45mm'        },
    '기아 61mm':               { 도막두께: [3.3,  4.0],  중량: [4.56, 4.59], 이미지폴더: 'kia_61mm'        },
    '기아 71mm':               { 도막두께: [3.4,  4.0],  중량: [4.35, 4.39], 이미지폴더: 'kia_71mm'        },
    'H-EMBLEM SILVER(CN7 PE)': { 도막두께: [3.8,  4.3],  중량: [7.05, 7.09], 이미지폴더: 'h_emblem_silver' },
    'H-EMBLEM BLACK(CN7 PE)':  { 도막두께: [11.9, 12.4], 중량: [7.05, 7.09], 이미지폴더: 'h_emblem_black'  },
    'BEZEL(GN7)':              { 도막두께: [3.5,  4.1],  중량: [2.35, 2.40], 이미지폴더: 'bezel_gn7'       },
    'GN7 F/L':                 { 도막두께: [4.5,  4.8],  중량: [2.46, 2.49], 이미지폴더: 'gn7_fl'          },
  }
};

/* ── 공지 바 자동 주입 ── */
function _공지바삽입(문구) {
  var 문구 = (문구 || '').trim();
  if (!문구) return;
  var 기준 = document.querySelector('.메뉴바') || document.querySelector('.header');
  if (!기준) return;
  if (document.querySelector('.공지바')) return; // 중복 방지
  var bar = document.createElement('div');
  bar.className = '공지바';
  var 중복 = '<span>' + 문구 + '</span><span>' + 문구 + '</span>';
  bar.innerHTML = '<div class="공지트랙래퍼"><div class="공지트랙">' + 중복 + '</div></div>';
  기준.insertAdjacentElement('afterend', bar);
}

function _공지바갱신(문구) {
  var bar = document.querySelector('.공지바');
  if (!문구 || !문구.trim()) {
    if (bar) bar.style.display = 'none';
    return;
  }
  if (!bar) { _공지바삽입(문구); return; }
  bar.style.display = '';
  var 중복 = '<span>' + 문구 + '</span><span>' + 문구 + '</span>';
  bar.innerHTML = '<div class="공지트랙래퍼"><div class="공지트랙">' + 중복 + '</div></div>';
}

document.addEventListener('DOMContentLoaded', async function() {
  try {
    if (typeof 수파베이스 !== 'undefined') {
      var { data } = await 수파베이스.from('설정').select('값').eq('키', '공지문구').maybeSingle();
      _공지바삽입(data && data.값 ? data.값 : APP_CONFIG.공지문구);

      수파베이스.channel('공지실시간')
        .on('postgres_changes', { event: '*', schema: 'public', table: '설정' }, function(payload) {
          if ((payload.new && payload.new.키 === '공지문구') || (payload.old && payload.old.키 === '공지문구')) {
            var 새문구 = payload.new ? (payload.new.값 || '') : '';
            _공지바갱신(새문구);
          }
        })
        .subscribe();
      return;
    }
  } catch(e) {}
  _공지바삽입(APP_CONFIG.공지문구);
});
