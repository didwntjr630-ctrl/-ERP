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

  ; ── 텍스트 마커 처리 ──
  if (A_EventInfo == 1) {
    clipText := Clipboard

    ; 이미지 발송용 방 이름 예약
    if (SubStr(clipText, 1, 17) == "[ERP_KAKAO_IMG:") {
      RegExMatch(clipText, "\[ERP_KAKAO_IMG:(.*)\]", m)
      pendingRoom := m1
      return
    }

    ; 텍스트 발송
    if (SubStr(clipText, 1, 11) != "[ERP_KAKAO:")
      return

    lineEnd := InStr(clipText, "`n")
    if (!lineEnd)
      return

    firstLine := SubStr(clipText, 1, lineEnd - 1)
    RegExMatch(firstLine, "\[ERP_KAKAO:(.*)\]", m)
    roomName := m1
    msgBody := SubStr(clipText, lineEnd + 1)

    if (!roomName || !msgBody)
      return

    isSending := true
    Clipboard := msgBody
    ClipWait, 2

    gosub, KakaoSend
    isSending := false
    return
  }

  ; ── 이미지 처리 (pendingRoom 이 있을 때만) ──
  if (A_EventInfo == 2) {
    if (pendingRoom == "")
      return

    roomName := pendingRoom
    pendingRoom := ""
    isSending := true

    gosub, KakaoSend
    isSending := false
    return
  }
return

; ── 공통: 카카오톡 창 활성화 후 붙여넣기 ──
KakaoSend:
  if !WinExist("ahk_exe KakaoTalk.exe") {
    MsgBox, 카카오톡이 실행되어 있지 않습니다.
    return
  }

  if WinExist(roomName . " ahk_exe KakaoTalk.exe") {
    WinActivate, %roomName% ahk_exe KakaoTalk.exe
  } else {
    WinActivate, ahk_exe KakaoTalk.exe
    WinWaitActive, ahk_exe KakaoTalk.exe, , 3
    if ErrorLevel {
      TrayTip, ERP 오류, 카카오톡을 활성화할 수 없습니다., 3, 2
      return
    }
    Sleep, 400
    Send, ^f
    Sleep, 600
    SendInput, %roomName%
    Sleep, 900
    Send, {Enter}
  }

  WinWaitActive, %roomName% ahk_exe KakaoTalk.exe, , 3
  Sleep, 700

  ; 입력창 포커스
  ControlFocus, EVA_ChildWnd1, %roomName% ahk_exe KakaoTalk.exe
  Sleep, 200
  if (ErrorLevel) {
    WinGetPos, winX, winY, winW, winH
    clickX := winX + (winW // 2)
    clickY := winY + winH - 80
    Click, %clickX%, %clickY%
    Sleep, 300
  }

  Send, ^v
  Sleep, 500
  Send, {Enter}

  TrayTip, ERP, %roomName% 전송완료!, 2, 1
return