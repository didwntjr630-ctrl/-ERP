#NoEnv
#Persistent
#SingleInstance Force
SetWorkingDir %A_ScriptDir%
SetTitleMatchMode, 2

global isSending := false

TrayTip, ERP 카카오 발송, 실행 중입니다., 2, 1

OnClipboardChange:
  if (A_EventInfo != 1)
    return
  if (isSending)
    return

  clipText := Clipboard

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

  if !WinExist("ahk_exe KakaoTalk.exe") {
    MsgBox, 카카오톡이 실행되어 있지 않습니다.
    isSending := false
    return
  }

  if WinExist(roomName . " ahk_exe KakaoTalk.exe") {
    WinActivate, %roomName% ahk_exe KakaoTalk.exe
  } else {
    WinActivate, ahk_exe KakaoTalk.exe
    Sleep, 500
    Send, ^f
    Sleep, 500
    SendInput, %roomName%
    Sleep, 800
    Send, {Enter}
  }

  WinWaitActive, %roomName% ahk_exe KakaoTalk.exe, , 2
  Sleep, 600

  ; 입력창 직접 포커스 시도 (카카오톡 컨트롤 클래스)
  ControlFocus, EVA_ChildWnd1, %roomName% ahk_exe KakaoTalk.exe
  Sleep, 200
  if (ErrorLevel) {
    ; 실패시 좌표 클릭으로 대체 (창 아래에서 80px)
    WinGetPos, winX, winY, winW, winH
    Click, % winX + winW//2, % winY + winH - 80
    Sleep, 300
    Click, % winX + winW//2, % winY + winH - 80
    Sleep, 300
  }

  Send, ^v
  Sleep, 400
  Send, {Enter}

  isSending := false
  TrayTip, ERP, %roomName% 전송완료!, 2, 1
return