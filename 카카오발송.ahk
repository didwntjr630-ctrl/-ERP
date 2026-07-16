#NoEnv
#Persistent
#SingleInstance Force
SetWorkingDir %A_ScriptDir%
SetTitleMatchMode, 2

global isSending := false
global pendingRoom := ""

TrayTip, ERP 카카오 발송, 실행 중입니다., 2, 1

OnClipboardChange:
  if (isSending)
    return
  if (A_EventInfo != 1)
    return

  clipText := Clipboard

  ; ── 이미지 발송 마커: 3초 후 타이머로 붙여넣기 ──
  if (SubStr(clipText, 1, 15) == "[ERP_KAKAO_IMG:") {
    RegExMatch(clipText, "\[ERP_KAKAO_IMG:(.*)\]", m)
    if (m1 == "")
      return
    pendingRoom := m1
    SetTimer, ImageSendTimer, -3000
    return
  }

  ; ── 텍스트 발송 ──
  if (SubStr(clipText, 1, 11) != "[ERP_KAKAO:")
    return

  lineEnd := InStr(clipText, "`n")
  if (!lineEnd)
    return

  firstLine := SubStr(clipText, 1, lineEnd - 1)
  RegExMatch(firstLine, "\[ERP_KAKAO:(.*)\]", m)
  roomName := m1
  msgBody  := SubStr(clipText, lineEnd + 1)

  if (!roomName || !msgBody)
    return

  isSending := true
  Clipboard := msgBody
  ClipWait, 2
  gosub, KakaoSend
  isSending := false
return

; ── 3초 후 실행 (이미지가 클립보드에 들어올 시간 확보) ──
ImageSendTimer:
  if (pendingRoom == "")
    return
  roomName  := pendingRoom
  pendingRoom := ""
  isSending := true
  gosub, KakaoSend
  isSending := false
return

; ── 카카오톡 채팅방 창 찾기 (정확한 창만) ──
FindKakaoRoom:
  foundHwnd := ""
  WinGet, wins, List, ahk_exe KakaoTalk.exe
  ; 1순위: 제목이 정확히 일치
  Loop, %wins%
  {
    h := wins%A_Index%
    WinGetTitle, t, ahk_id %h%
    if (t == roomName) {
      foundHwnd := h
      return
    }
  }
  ; 2순위: 제목이 roomName으로 시작 (예: "정문 (3)")
  Loop, %wins%
  {
    h := wins%A_Index%
    WinGetTitle, t, ahk_id %h%
    if (SubStr(t, 1, StrLen(roomName)) == roomName && t != "KakaoTalk" && t != "카카오톡") {
      foundHwnd := h
      return
    }
  }
  ; 3순위: 제목에 roomName 포함 (메인창·짧은 제목 제외)
  Loop, %wins%
  {
    h := wins%A_Index%
    WinGetTitle, t, ahk_id %h%
    if (InStr(t, roomName) && t != "KakaoTalk" && t != "카카오톡" && StrLen(t) < 40) {
      foundHwnd := h
      return
    }
  }
return

; ── 공통: 채팅방 활성화 후 붙여넣기 ──
KakaoSend:
  if !WinExist("ahk_exe KakaoTalk.exe") {
    MsgBox, 카카오톡이 실행되어 있지 않습니다.
    return
  }

  gosub, FindKakaoRoom
  if (foundHwnd == "") {
    MsgBox, [%roomName%] 채팅방이 열려있지 않습니다.`n카카오톡에서 해당 채팅방을 먼저 열어두세요.
    return
  }

  ; 찾은 창 제목 알림 (확인용)
  WinGetTitle, foundTitle, ahk_id %foundHwnd%
  TrayTip, ERP 발송대상, %foundTitle%, 2, 1

  WinActivate, ahk_id %foundHwnd%
  WinWaitActive, ahk_id %foundHwnd%, , 3
  if ErrorLevel {
    TrayTip, ERP 오류, 창 활성화 실패: %foundTitle%, 3, 2
    return
  }

  Sleep, 600

  ; 창 하단 중앙 클릭 (입력창 포커스)
  WinGetPos, winX, winY, winW, winH, ahk_id %foundHwnd%
  clickX := winX + (winW // 2)
  clickY := winY + winH - 45
  Click, %clickX%, %clickY%
  Sleep, 500

  ; 붙여넣기 + 전송
  SendInput, ^v
  Sleep, 800
  SendInput, {Enter}

  TrayTip, ERP, %roomName% 전송완료!, 2, 1
return
