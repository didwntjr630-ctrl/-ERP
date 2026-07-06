/* ===================================================
   chat.js - 사용자간 실시간 채팅
   · 전체 채팅방 + 1:1 DM
   · 파일/사진 첨부 (Supabase Storage)
   · 3일 메시지 보관 후 자동 폐기
   =================================================== */

var _채팅채널 = null;
var _현재방 = 'global';
var _채팅열림 = false;
var _현재방읽음상태 = [];   // [{사원명, 마지막읽음}] — 현재 열린 방의 읽음 상태
var _시스템사용자수 = 1;     // 전체 승인된 계정 수 (전체방 안읽음 계산용)
var _컨텍스트메뉴대상id = null;

var _CHAT = {
  보관일수: 3,
  최대파일: 10 * 1024 * 1024,  // 10 MB
  버킷: 'chat-files'
};

/* ── 초기화 ───────────────────────────────────── */

function 채팅초기화() {
  var 세션 = 현재세션();
  if (!세션) return;
  _채팅스타일주입();
  _채팅위젯주입();
  _오래된메시지삭제();
  _채팅실시간구독();
  _시스템사용자수조회();
  setTimeout(function() {
    DM목록갱신();
    안읽음수갱신();
  }, 1600);
  document.addEventListener('click', function() { _컨텍스트메뉴닫기(); });
}

/* ── 스타일 주입 ──────────────────────────────── */

function _채팅스타일주입() {
  if (document.getElementById('_chat_css')) return;
  var s = document.createElement('style');
  s.id = '_chat_css';
  s.textContent =
    /* 플로팅 버튼 */
    '.ch-btn{position:fixed;bottom:24px;right:24px;width:52px;height:52px;border-radius:50%;background:#374151;border:none;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;z-index:9400;transition:background .2s,transform .2s;}' +
    '.ch-btn:hover{background:#f97316;transform:scale(1.08);}' +
    '.ch-btn-badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font-size:9px;font-weight:700;min-width:16px;height:16px;border-radius:8px;display:none;align-items:center;justify-content:center;padding:0 3px;pointer-events:none;line-height:1;}' +

    /* 채팅창 */
    '.ch-win{position:fixed;bottom:24px;right:24px;width:500px;max-width:calc(100vw - 16px);height:540px;max-height:calc(100vh - 40px);background:#fff;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,.22);z-index:9400;display:none;flex-direction:column;overflow:hidden;border:1px solid #e5e7eb;}' +
    '.ch-win.열림{display:flex;}' +

    /* 헤더 */
    '.ch-head{background:#374151;color:#fff;padding:0 16px;height:46px;display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #f97316;flex-shrink:0;}' +
    '.ch-head-title{font-size:14px;font-weight:700;}' +
    '.ch-head-close{background:none;border:none;color:#9ca3af;cursor:pointer;font-size:18px;line-height:1;padding:2px 6px;border-radius:4px;transition:color .15s,background .15s;}' +
    '.ch-head-close:hover{color:#fff;background:rgba(255,255,255,.1);}' +

    /* 본문 */
    '.ch-body{display:flex;flex:1;overflow:hidden;}' +

    /* 좌측 방 목록 */
    '.ch-rooms{width:138px;background:#f9fafb;border-right:1px solid #e5e7eb;display:flex;flex-direction:column;flex-shrink:0;overflow-y:auto;}' +
    '.ch-sec-label{font-size:10px;font-weight:700;letter-spacing:.08em;color:#9ca3af;padding:10px 12px 4px;text-transform:uppercase;flex-shrink:0;}' +
    '.ch-room{display:flex;align-items:center;gap:5px;padding:7px 8px 7px 12px;cursor:pointer;transition:background .12s;}' +
    '.ch-room:hover{background:rgba(0,0,0,.04);}' +
    '.ch-room.활성{background:#fff7ed;}' +
    '.ch-room.활성 .ch-rname{color:#f97316;font-weight:700;}' +
    '.ch-rdot{color:#22c55e;font-size:8px;flex-shrink:0;line-height:1;}' +
    '.ch-rname{font-size:12px;color:#374151;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
    '.ch-rbadge{background:#ef4444;color:#fff;font-size:9px;font-weight:700;min-width:14px;height:14px;border-radius:7px;display:none;align-items:center;justify-content:center;padding:0 2px;flex-shrink:0;line-height:1;}' +

    /* 우측 메시지 영역 */
    '.ch-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;}' +
    '.ch-rtitle{padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;font-weight:700;color:#374151;background:#fff;flex-shrink:0;}' +
    '.ch-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:6px;}' +

    /* 메시지 말풍선 */
    '.ch-row{display:flex;flex-direction:column;align-items:flex-start;max-width:80%;align-self:flex-start;}' +
    '.ch-row.mine{align-self:flex-end;align-items:flex-end;}' +
    '.ch-sender{font-size:11px;color:#6b7280;font-weight:600;padding:0 2px;margin-bottom:1px;}' +
    '.ch-bubble{background:#f3f4f6;border-radius:10px 10px 10px 2px;padding:7px 10px;font-size:13px;color:#111827;line-height:1.5;word-break:break-word;}' +
    '.ch-row.mine .ch-bubble{background:#374151;color:#f9fafb;border-radius:10px 10px 2px 10px;}' +
    '.ch-msg-wrap{display:flex;align-items:flex-end;gap:4px;}' +
    '.ch-msg-info{display:flex;flex-direction:column;align-items:flex-end;gap:2px;}' +
    '.ch-read-num{font-size:10px;font-weight:700;color:#f97316;line-height:1;}' +
    '.ch-ts{font-size:10px;color:#9ca3af;line-height:1;}' +
    '.ch-bubble.deleted{background:#f3f4f6 !important;color:#9ca3af !important;font-style:italic;font-size:12px;}' +

    /* 파일 미리보기 */
    '.ch-preview{display:none;padding:6px 12px;border-top:1px solid #f3f4f6;align-items:center;gap:6px;background:#f9fafb;flex-shrink:0;}' +

    /* 입력 영역 */
    '.ch-input-wrap{padding:8px 10px;border-top:1px solid #e5e7eb;display:flex;align-items:flex-end;gap:6px;background:#fff;flex-shrink:0;}' +
    '.ch-attach-lbl{cursor:pointer;color:#9ca3af;display:flex;align-items:center;padding:4px;border-radius:4px;transition:color .15s;flex-shrink:0;}' +
    '.ch-attach-lbl:hover{color:#f97316;}' +
    '.ch-textarea{flex:1;min-width:0;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px;font-size:13px;font-family:inherit;resize:none;outline:none;transition:border-color .15s;line-height:1.4;max-height:80px;overflow-y:auto;}' +
    '.ch-textarea:focus{border-color:#f97316;box-shadow:0 0 0 3px rgba(249,115,22,.12);}' +
    '.ch-send-btn{background:#374151;color:#fff;border:none;border-radius:8px;width:34px;height:34px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;flex-shrink:0;}' +
    '.ch-send-btn:hover{background:#f97316;}' +
    '.ch-send-btn:disabled{opacity:.4;cursor:default;}' +

    /* 토스트 알림 */
    '.ch-toast{position:fixed;bottom:88px;right:24px;background:#1f2937;color:#f9fafb;border-radius:10px;padding:10px 14px;z-index:9500;max-width:220px;box-shadow:0 4px 16px rgba(0,0,0,.3);display:none;gap:10px;align-items:flex-start;cursor:pointer;border:1px solid #374151;}' +
    '.ch-toast-from{font-size:11px;font-weight:700;color:#f97316;margin-bottom:2px;}' +
    '.ch-toast-msg{font-size:12px;line-height:1.4;}' +
    '.ch-toast-x{background:none;border:none;color:#6b7280;cursor:pointer;font-size:12px;flex-shrink:0;padding:0;line-height:1;align-self:flex-start;}' +

    /* 컨텍스트 메뉴 */
    '.ch-ctx{position:fixed;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.15);z-index:9999;display:none;overflow:hidden;min-width:110px;}' +
    '.ch-ctx-btn{display:block;width:100%;padding:9px 16px;border:none;background:none;cursor:pointer;font-size:13px;text-align:left;font-family:inherit;transition:background .12s;white-space:nowrap;}' +
    '.ch-ctx-btn:hover{background:#f9fafb;}' +
    '.ch-ctx-btn.danger{color:#ef4444;}' +
    '.ch-ctx-btn.danger:hover{background:#fef2f2;}' +

    /* 채팅 내부 확인 오버레이 */
    '.ch-confirm-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.45);z-index:9800;display:none;align-items:center;justify-content:center;}' +
    '.ch-confirm-box{background:#fff;border-radius:10px;padding:22px 20px;max-width:280px;width:90%;box-shadow:0 8px 30px rgba(0,0,0,.2);}' +
    '.ch-confirm-msg{font-size:13px;line-height:1.7;color:#111827;margin-bottom:18px;white-space:pre-line;}' +
    '.ch-confirm-btns{display:flex;gap:8px;justify-content:flex-end;}' +
    '.ch-confirm-cancel{padding:7px 16px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;font-size:13px;font-family:inherit;}' +
    '.ch-confirm-ok{padding:7px 16px;border:none;border-radius:6px;background:#ef4444;color:#fff;cursor:pointer;font-size:13px;font-weight:600;font-family:inherit;}' +

    /* 나가기 버튼 */
    '.ch-leave-btn{background:rgba(239,68,68,.2);border:1px solid #ef4444;color:#fca5a5;cursor:pointer;font-size:11px;font-weight:600;padding:3px 10px;border-radius:4px;font-family:inherit;transition:all .15s;display:none;}' +
    '.ch-leave-btn:hover{background:#ef4444;color:#fff;}';
  document.head.appendChild(s);
}

/* ── 위젯 HTML 주입 ────────────────────────────── */

function _채팅위젯주입() {
  if (document.getElementById('채팅버튼')) return;

  var html =
    /* 토스트 */
    '<div id="채팅토스트" class="ch-toast" onclick="채팅창열기()">' +
      '<div style="flex:1;min-width:0;">' +
        '<div class="ch-toast-from" id="채팅토스트발신자"></div>' +
        '<div class="ch-toast-msg" id="채팅토스트내용"></div>' +
      '</div>' +
      '<button class="ch-toast-x" onclick="event.stopPropagation();document.getElementById(\'채팅토스트\').style.display=\'none\';">✕</button>' +
    '</div>' +

    /* 플로팅 버튼 */
    '<button id="채팅버튼" class="ch-btn" onclick="채팅창열기()" title="채팅">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f9fafb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
      '<span id="채팅안읽음배지" class="ch-btn-badge"></span>' +
    '</button>' +

    /* 컨텍스트 메뉴 */
    '<div id="채팅컨텍스트메뉴" class="ch-ctx">' +
      '<button class="ch-ctx-btn danger" onclick="_메시지삭제실행()">삭제</button>' +
    '</div>' +

    /* 확인 오버레이 */
    '<div id="채팅확인오버레이" class="ch-confirm-overlay">' +
      '<div class="ch-confirm-box">' +
        '<div class="ch-confirm-msg" id="채팅확인메시지"></div>' +
        '<div class="ch-confirm-btns">' +
          '<button class="ch-confirm-cancel" onclick="_채팅확인취소()">취소</button>' +
          '<button class="ch-confirm-ok" id="채팅확인OK">확인</button>' +
        '</div>' +
      '</div>' +
    '</div>' +

    /* 채팅창 */
    '<div id="채팅창" class="ch-win">' +
      '<div class="ch-head">' +
        '<span class="ch-head-title">채팅</span>' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          '<button id="채팅나가기버튼" class="ch-leave-btn" onclick="채팅방나가기()">나가기</button>' +
          '<button class="ch-head-close" onclick="채팅창닫기()">✕</button>' +
        '</div>' +
      '</div>' +
      '<div class="ch-body">' +

        /* 좌측 방 목록 */
        '<div class="ch-rooms">' +
          '<div class="ch-sec-label">채널</div>' +
          '<div class="ch-room 활성" data-roomid="global" onclick="방선택(\'global\')">' +
            '<span class="ch-rname"># 전체</span>' +
            '<span class="ch-rbadge" id="ch-rbadge-global"></span>' +
          '</div>' +
          '<div class="ch-sec-label" style="margin-top:6px;">다이렉트</div>' +
          '<div id="채팅DM목록"></div>' +
        '</div>' +

        /* 우측 메시지 영역 */
        '<div class="ch-main">' +
          '<div class="ch-rtitle" id="채팅방제목">전체 채팅방</div>' +
          '<div id="채팅메시지목록" class="ch-msgs"></div>' +
          '<div id="채팅파일미리보기" class="ch-preview"></div>' +
          '<div class="ch-input-wrap">' +
            '<label for="채팅파일입력" class="ch-attach-lbl" title="파일 첨부">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>' +
            '</label>' +
            '<input type="file" id="채팅파일입력" style="display:none;" onchange="파일첨부미리보기()">' +
            '<textarea id="채팅입력" class="ch-textarea" placeholder="메시지 입력... (Enter: 전송, Shift+Enter: 줄바꿈)" rows="1"' +
              ' onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();메시지전송();}"' +
              ' oninput="this.style.height=\'auto\';this.style.height=Math.min(this.scrollHeight,80)+\'px\';"></textarea>' +
            '<button id="채팅전송버튼" class="ch-send-btn" onclick="메시지전송()" title="전송">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +

      '</div>' +
    '</div>';

  var wrap = document.createElement('div');
  wrap.innerHTML = html;
  while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
}

/* ── 채팅창 열기/닫기 ──────────────────────────── */

function 채팅창열기() {
  _채팅열림 = true;
  document.getElementById('채팅창').classList.add('열림');
  document.getElementById('채팅버튼').style.display = 'none';
  document.getElementById('채팅토스트').style.display = 'none';
  방선택(_현재방);
}

function 채팅창닫기() {
  _채팅열림 = false;
  document.getElementById('채팅창').classList.remove('열림');
  document.getElementById('채팅버튼').style.display = 'flex';
}

/* ── 방 선택 ────────────────────────────────────── */

function 방선택(roomId) {
  _현재방 = roomId;

  document.querySelectorAll('.ch-room').forEach(function(el) {
    el.classList.toggle('활성', el.getAttribute('data-roomid') === roomId);
  });

  var 세션 = 현재세션();
  var 제목 = '전체 채팅방';
  if (roomId !== 'global' && 세션) {
    var 상대 = roomId.split(':').filter(function(n) { return n !== 세션.사원명; })[0] || '';
    제목 = 상대 + ' (DM)';
  }
  document.getElementById('채팅방제목').textContent = 제목;

  var 나가기btn = document.getElementById('채팅나가기버튼');
  if (나가기btn) 나가기btn.style.display = roomId !== 'global' ? 'block' : 'none';

  _메시지불러오기(roomId);
  읽음처리(roomId);
}

/* ── 메시지 불러오기 ────────────────────────────── */

async function _메시지불러오기(roomId) {
  var el = document.getElementById('채팅메시지목록');
  el.innerHTML = '<div style="padding:20px;text-align:center;color:#9ca3af;font-size:12px;">불러오는 중...</div>';

  var 기준 = _기준일시();

  var [메시지결과, 읽음결과] = await Promise.all([
    수파베이스.from('채팅메시지').select('*').eq('방id', roomId).gte('created_at', 기준).order('created_at', { ascending: true }),
    수파베이스.from('채팅읽음상태').select('사원명,마지막읽음').eq('방id', roomId)
  ]);
  _현재방읽음상태 = 읽음결과.data || [];

  el.innerHTML = '';
  if (메시지결과.error) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;font-size:12px;">불러오기 실패</div>';
    return;
  }
  var data = 메시지결과.data;
  if (!data || data.length === 0) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:#9ca3af;font-size:12px;">메시지가 없습니다.</div>';
    return;
  }
  data.forEach(function(msg) { _메시지DOM추가(msg); });
  _스크롤아래();
}

function _메시지DOM추가(msg) {
  var el = document.getElementById('채팅메시지목록');
  if (!el) return;

  var 빈 = el.querySelector('.ch-empty');
  if (빈) el.removeChild(빈);

  var 세션 = 현재세션();
  var 내글 = 세션 && msg.발신자명 === 세션.사원명;

  var 시각 = new Date(msg.created_at);
  var 시간 = ('0' + 시각.getHours()).slice(-2) + ':' + ('0' + 시각.getMinutes()).slice(-2);

  var 내용HTML = _내용렌더(msg, 내글);

  var 안읽음 = 내글 ? _안읽음수계산(msg.created_at, msg.발신자명) : 0;

  var row = document.createElement('div');
  row.className = 'ch-row' + (내글 ? ' mine' : '');
  row.setAttribute('data-msgtime', msg.created_at);
  row.setAttribute('data-sender', msg.발신자명);
  if (msg.id) {
    row.setAttribute('data-msgid', msg.id);
    row.addEventListener('contextmenu', function(e) { _컨텍스트메뉴열기(e, msg.id); });
  }
  if (내글) {
    row.innerHTML =
      '<div class="ch-msg-wrap">' +
        '<div class="ch-msg-info">' +
          '<span class="ch-read-num">' + (안읽음 > 0 ? String(안읽음) : '') + '</span>' +
          '<span class="ch-ts">' + 시간 + '</span>' +
        '</div>' +
        '<div class="ch-bubble">' + 내용HTML + '</div>' +
      '</div>';
  } else {
    row.innerHTML =
      '<div class="ch-sender">' + _esc(msg.발신자명) + '</div>' +
      '<div class="ch-msg-wrap">' +
        '<div class="ch-bubble">' + 내용HTML + '</div>' +
        '<div class="ch-msg-info" style="align-items:flex-start;">' +
          '<span class="ch-ts">' + 시간 + '</span>' +
        '</div>' +
      '</div>';
  }

  el.appendChild(row);
}

function _내용렌더(msg, 내글) {
  if (!msg.파일url) return _esc(msg.내용 || '');

  var 이미지 = msg.파일타입 && msg.파일타입.startsWith('image/');
  var html = 이미지
    ? '<img src="' + _esc(msg.파일url) + '" alt="이미지" style="max-width:180px;max-height:150px;border-radius:6px;display:block;cursor:pointer;" onclick="window.open(\'' + _esc(msg.파일url) + '\')">'
    : '<a href="' + _esc(msg.파일url) + '" target="_blank" style="display:flex;align-items:center;gap:6px;font-size:12px;text-decoration:none;color:' + (내글 ? '#93c5fd' : '#3b82f6') + ';">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>' +
        _esc(msg.파일명 || '파일') + '</a>';

  if (msg.내용) html += '<div style="margin-top:4px;">' + _esc(msg.내용) + '</div>';
  return html;
}

/* ── 메시지 전송 ────────────────────────────────── */

async function 메시지전송() {
  var 세션 = 현재세션();
  if (!세션) return;

  var 입력 = document.getElementById('채팅입력');
  var 파일입력 = document.getElementById('채팅파일입력');
  var 내용 = (입력.value || '').trim();
  var 파일 = 파일입력 && 파일입력.files[0];

  if (!내용 && !파일) return;

  var 버튼 = document.getElementById('채팅전송버튼');
  버튼.disabled = true;

  var 파일url = null, 파일명 = null, 파일타입 = null;

  if (파일) {
    if (파일.size > _CHAT.최대파일) {
      alert('파일 크기는 10MB 이하만 가능합니다.');
      버튼.disabled = false;
      return;
    }
    var 업로드 = await _파일업로드(파일);
    if (!업로드) { 버튼.disabled = false; return; }
    파일url = 업로드.url;
    파일명 = 파일.name;
    파일타입 = 파일.type;
  }

  var { error } = await 수파베이스.from('채팅메시지').insert({
    발신자명: 세션.사원명,
    방id: _현재방,
    내용: 내용 || null,
    파일url: 파일url,
    파일명: 파일명,
    파일타입: 파일타입
  });

  if (!error) {
    입력.value = '';
    입력.style.height = 'auto';
    파일첨부취소();
  }

  버튼.disabled = false;
  입력.focus();
}

/* ── 파일 업로드 ────────────────────────────────── */

async function _파일업로드(파일) {
  var 세션 = 현재세션();
  var 안전파일명 = 파일.name.replace(/[^a-zA-Z0-9.\-_가-힣]/g, '_');
  var 경로 = 세션.사원명 + '/' + Date.now() + '_' + 안전파일명;

  var { error } = await 수파베이스.storage.from(_CHAT.버킷).upload(경로, 파일);
  if (error) { alert('파일 업로드 실패: ' + error.message); return null; }

  var { data } = 수파베이스.storage.from(_CHAT.버킷).getPublicUrl(경로);
  return { url: data.publicUrl };
}

/* ── 파일 미리보기 ──────────────────────────────── */

function 파일첨부미리보기() {
  var 파일입력 = document.getElementById('채팅파일입력');
  var 미리보기 = document.getElementById('채팅파일미리보기');
  var 파일 = 파일입력 && 파일입력.files[0];
  if (!파일) { 파일첨부취소(); return; }

  미리보기.style.display = 'flex';
  if (파일.type.startsWith('image/')) {
    var reader = new FileReader();
    reader.onload = function(e) {
      미리보기.innerHTML = '<img src="' + e.target.result + '" style="max-height:56px;border-radius:4px;">' +
        '<span style="font-size:12px;color:#374151;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + _esc(파일.name) + '</span>' +
        '<button onclick="파일첨부취소()" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:16px;line-height:1;flex-shrink:0;">✕</button>';
    };
    reader.readAsDataURL(파일);
  } else {
    미리보기.innerHTML =
      '<span style="font-size:13px;">📎</span>' +
      '<span style="font-size:12px;color:#374151;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + _esc(파일.name) + '</span>' +
      '<button onclick="파일첨부취소()" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:16px;line-height:1;flex-shrink:0;">✕</button>';
  }
}

function 파일첨부취소() {
  var fi = document.getElementById('채팅파일입력');
  if (fi) fi.value = '';
  var prev = document.getElementById('채팅파일미리보기');
  if (prev) { prev.innerHTML = ''; prev.style.display = 'none'; }
}

/* ── 읽음 처리 ──────────────────────────────────── */

async function 읽음처리(roomId) {
  var 세션 = 현재세션();
  if (!세션) return;
  var 시각 = new Date().toISOString();
  await 수파베이스.from('채팅읽음상태').upsert(
    { 사원명: 세션.사원명, 방id: roomId, 마지막읽음: 시각 },
    { onConflict: '사원명,방id' }
  );

  // 현재 방이면 로컬 상태 즉시 반영 + 배지 갱신
  if (roomId === _현재방) {
    var 기존 = _현재방읽음상태.find(function(r) { return r.사원명 === 세션.사원명; });
    if (기존) 기존.마지막읽음 = 시각;
    else _현재방읽음상태.push({ 사원명: 세션.사원명, 마지막읽음: 시각 });
  }

  // Broadcast → 상대방이 실시간으로 배지 제거
  if (_채팅채널) {
    _채팅채널.send({
      type: 'broadcast',
      event: 'read_update',
      payload: { 방id: roomId, 사원명: 세션.사원명, 시각: 시각 }
    });
  }

  안읽음수갱신();
}

/* ── 안읽음 배지 갱신 ───────────────────────────── */

async function 안읽음수갱신() {
  var 세션 = 현재세션();
  if (!세션) return;

  var [읽음결과, 메시지결과] = await Promise.all([
    수파베이스.from('채팅읽음상태').select('방id,마지막읽음').eq('사원명', 세션.사원명),
    수파베이스.from('채팅메시지').select('방id,created_at,발신자명')
      .gte('created_at', _기준일시())
      .neq('발신자명', 세션.사원명)
  ]);

  var 읽음맵 = {};
  (읽음결과.data || []).forEach(function(r) { 읽음맵[r.방id] = r.마지막읽음; });

  var 방별수 = {};
  (메시지결과.data || []).forEach(function(msg) {
    if (!_내방인가(msg.방id, 세션.사원명)) return;
    var 마지막 = 읽음맵[msg.방id];
    if (!마지막 || msg.created_at > 마지막) {
      방별수[msg.방id] = (방별수[msg.방id] || 0) + 1;
    }
  });

  var 총수 = Object.values(방별수).reduce(function(a, b) { return a + b; }, 0);

  var 배지 = document.getElementById('채팅안읽음배지');
  if (배지) {
    if (총수 > 0) {
      배지.textContent = 총수 > 99 ? '99+' : String(총수);
      배지.style.display = 'flex';
    } else {
      배지.textContent = '';
      배지.style.display = 'none';
    }
  }

  document.querySelectorAll('.ch-rbadge').forEach(function(el) {
    var 방el = el.closest('.ch-room');
    if (!방el) return;
    var rId = 방el.getAttribute('data-roomid');
    var 수 = 방별수[rId] || 0;
    el.textContent = 수 > 0 ? String(수) : '';
    el.style.display = 수 > 0 ? 'flex' : 'none';
  });
}

/* ── DM 목록 (presence 연동) ────────────────────── */

function DM목록갱신() {
  var 세션 = 현재세션();
  if (!세션) return;

  var 접속자들 = [];
  if (window._접속자채널) {
    var state = window._접속자채널.presenceState();
    Object.keys(state).forEach(function(key) {
      var 항목들 = state[key] || [];
      if (항목들.length > 0 && 항목들[0].사원명 && 항목들[0].사원명 !== 세션.사원명) {
        접속자들.push({ 사원명: 항목들[0].사원명, 직급: 항목들[0].직급 || '' });
      }
    });
  }

  var el = document.getElementById('채팅DM목록');
  if (!el) return;

  if (접속자들.length === 0) {
    el.innerHTML = '<div style="padding:6px 12px;font-size:11px;color:#9ca3af;line-height:1.6;">접속자<br>없음</div>';
  } else {
    el.innerHTML = 접속자들.map(function(u) {
      var rId = _DM방id(세션.사원명, u.사원명);
      return '<div class="ch-room' + (_현재방 === rId ? ' 활성' : '') + '" data-roomid="' + rId + '" onclick="방선택(\'' + rId + '\')">' +
        '<span class="ch-rdot">●</span>' +
        '<span class="ch-rname">' + _esc(u.직급 ? u.직급 + ' ' + u.사원명 : u.사원명) + '</span>' +
        '<span class="ch-rbadge"></span>' +
        '</div>';
    }).join('');
  }

  안읽음수갱신();
}

/* ── Realtime 구독 ──────────────────────────────── */

function _채팅실시간구독() {
  _채팅채널 = 수파베이스
    .channel('erp_chat')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: '채팅메시지' }, function(payload) {
      var msg = payload.new;
      var 세션 = 현재세션();
      if (!세션) return;

      if (_채팅열림 && msg.방id === _현재방) {
        _메시지DOM추가(msg);
        읽음처리(_현재방);
        _스크롤아래();
      } else {
        안읽음수갱신();
        if (_내방인가(msg.방id, 세션.사원명) && msg.발신자명 !== 세션.사원명) {
          _채팅토스트(msg.발신자명, msg.내용 || '[파일]');
        }
      }
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: '채팅메시지' }, function(payload) {
      var el = document.getElementById('채팅메시지목록');
      if (!el) return;
      var row = el.querySelector('[data-msgid="' + payload.old.id + '"]');
      if (!row) return;
      var bubble = row.querySelector('.ch-bubble');
      if (bubble) { bubble.textContent = '삭제된 메시지입니다'; bubble.className = 'ch-bubble deleted'; }
      var readNum = row.querySelector('.ch-read-num');
      if (readNum) readNum.textContent = '';
      row.setAttribute('data-deleted', '1');
    })
    .on('broadcast', { event: 'read_update' }, function(payload) {
      var p = payload.payload;
      if (p.방id !== _현재방) return;
      // 로컬 읽음 상태 갱신 후 배지 업데이트
      var 기존 = _현재방읽음상태.find(function(r) { return r.사원명 === p.사원명; });
      if (기존) 기존.마지막읽음 = p.시각;
      else _현재방읽음상태.push({ 사원명: p.사원명, 마지막읽음: p.시각 });
      _읽음배지갱신();
    })
    .subscribe();
}

/* ── 읽음 배지 갱신 ─────────────────────────────── */

function _읽음배지갱신() {
  document.querySelectorAll('.ch-row.mine[data-msgtime]').forEach(function(row) {
    var T = row.getAttribute('data-msgtime');
    var 발신자 = row.getAttribute('data-sender');
    var 수 = _안읽음수계산(T, 발신자);
    var badge = row.querySelector('.ch-read-num');
    if (badge) badge.textContent = 수 > 0 ? String(수) : '';
  });
}

function _안읽음수계산(created_at, 발신자명) {
  if (_현재방 === 'global') {
    var 읽은수 = _현재방읽음상태.filter(function(r) {
      return r.사원명 !== 발신자명 && r.마지막읽음 >= created_at;
    }).length;
    var 대상수 = Math.max(0, _시스템사용자수 - 1);
    return Math.max(0, 대상수 - 읽은수);
  } else {
    var 상대방 = _현재방.split(':').filter(function(n) { return n !== 발신자명; })[0];
    if (!상대방) return 0;
    var 상대읽음 = _현재방읽음상태.find(function(r) { return r.사원명 === 상대방; });
    return (!상대읽음 || 상대읽음.마지막읽음 < created_at) ? 1 : 0;
  }
}

async function _시스템사용자수조회() {
  var { count } = await 수파베이스
    .from('사용자계정')
    .select('id', { count: 'exact', head: true })
    .eq('상태', 'approved');
  _시스템사용자수 = count || 1;
}

/* ── 오래된 메시지 삭제 ─────────────────────────── */

async function _오래된메시지삭제() {
  await 수파베이스.from('채팅메시지').delete().lt('created_at', _기준일시());
}

/* ── 토스트 알림 ────────────────────────────────── */

function _채팅토스트(발신자, 내용) {
  var el = document.getElementById('채팅토스트');
  if (!el) return;
  document.getElementById('채팅토스트발신자').textContent = 발신자;
  var 미리보기 = String(내용);
  document.getElementById('채팅토스트내용').textContent = 미리보기.length > 28 ? 미리보기.slice(0, 28) + '...' : 미리보기;
  el.style.display = 'flex';
  clearTimeout(el._t);
  el._t = setTimeout(function() { el.style.display = 'none'; }, 4000);
}

/* ── 컨텍스트 메뉴 ──────────────────────────────── */

function _컨텍스트메뉴열기(e, msgId) {
  e.preventDefault();
  e.stopPropagation();
  var el = document.getElementById('채팅메시지목록');
  if (el) { var r = el.querySelector('[data-msgid="' + msgId + '"]'); if (r && r.getAttribute('data-deleted') === '1') return; }
  _컨텍스트메뉴대상id = msgId;
  var menu = document.getElementById('채팅컨텍스트메뉴');
  if (!menu) return;
  menu.style.display = 'block';
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
  setTimeout(function() {
    var rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (e.clientX - rect.width) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (e.clientY - rect.height) + 'px';
  }, 0);
}

function _컨텍스트메뉴닫기() {
  var menu = document.getElementById('채팅컨텍스트메뉴');
  if (menu) menu.style.display = 'none';
  _컨텍스트메뉴대상id = null;
}

function _메시지삭제실행() {
  var id = _컨텍스트메뉴대상id;
  _컨텍스트메뉴닫기();
  if (!id) return;
  _채팅확인표시('이 메시지를 삭제하시겠습니까?', function() { _메시지삭제(id); });
}

async function _메시지삭제(id) {
  await 수파베이스.from('채팅메시지').delete().eq('id', id);
}

/* ── 채팅방 나가기 ──────────────────────────────── */

function 채팅방나가기() {
  if (_현재방 === 'global') return;
  var room = _현재방;
  var 세션 = 현재세션();
  _채팅확인표시('이 채팅방에서 나가시겠습니까?\n(내가 보낸 메시지만 삭제됩니다)', async function() {
    if (!세션) return;
    await Promise.all([
      수파베이스.from('채팅메시지').delete().eq('방id', room).eq('발신자명', 세션.사원명),
      수파베이스.from('채팅읽음상태').delete().eq('방id', room).eq('사원명', 세션.사원명)
    ]);
    방선택('global');
  });
}

/* ── 확인 오버레이 ──────────────────────────────── */

function _채팅확인표시(메시지, 콜백) {
  var overlay = document.getElementById('채팅확인오버레이');
  var msgEl = document.getElementById('채팅확인메시지');
  var okBtn = document.getElementById('채팅확인OK');
  if (!overlay) return;
  msgEl.textContent = 메시지;
  overlay.style.display = 'flex';
  okBtn.onclick = function() {
    overlay.style.display = 'none';
    콜백();
  };
}

function _채팅확인취소() {
  var overlay = document.getElementById('채팅확인오버레이');
  if (overlay) overlay.style.display = 'none';
}

/* ── 유틸 ───────────────────────────────────────── */

function _DM방id(a, b) { return [a, b].sort().join(':'); }

function _내방인가(방id, 사원명) {
  if (방id === 'global') return true;
  return 방id.split(':').indexOf(사원명) > -1;
}

function _기준일시() {
  var d = new Date();
  d.setDate(d.getDate() - _CHAT.보관일수);
  return d.toISOString();
}

function _esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\n/g,'<br>');
}

function _스크롤아래() {
  var el = document.getElementById('채팅메시지목록');
  if (el) setTimeout(function() { el.scrollTop = el.scrollHeight; }, 30);
}
