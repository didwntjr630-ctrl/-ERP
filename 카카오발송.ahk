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

; ── 공통: 채팅방 활성화 후 붙여넣기 ──
KakaoSend:
  if !WinExist("ahk_exe KakaoTalk.exe") {
    MsgBox, 카카오톡이 실행되어 있지 않습니다.
    return
  }

  ; 채팅방 창이 열려있으면 바로 활성화
  if WinExist(roomName . " ahk_exe KakaoTalk.exe") {
    WinActivate, %roomName% ahk_exe KakaoTalk.exe
    WinWaitActive, %roomName% ahk_exe KakaoTalk.exe, , 3
    if ErrorLevel {
      TrayTip, ERP 오류, 채팅방 활성화 실패: %roomName%, 3, 2
      return
    }
  } else {
    MsgBox, [%roomName%] 채팅방이 열려있지 않습니다.`n카카오톡에서 해당 채팅방을 먼저 열어주세요.
    return
  }

  Sleep, 500

  ; 입력창 포커스
  ControlFocus, EVA_ChildWnd1, %roomName% ahk_exe KakaoTalk.exe
  Sleep, 300
  if ErrorLevel {
    WinGetPos, winX, winY, winW, winH, %roomName% ahk_exe KakaoTalk.exe
    clickX := winX + (winW // 2)
    clickY := winY + winH - 60
    Click, %clickX%, %clickY%
    Sleep, 400
  }

  Send, ^v
  Sleep, 700
  Send, {Enter}

  TrayTip, ERP, %roomName% 전송완료!, 2, 1
return
