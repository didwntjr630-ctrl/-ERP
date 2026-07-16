#NoEnv
#SingleInstance Force
SetWorkingDir %A_ScriptDir%
SetTitleMatchMode, 2

; =====================================================
;  삼양ERP → 카카오톡 자동 발송 스크립트
;  ERP "카카오 발송" 클릭 → 클립보드 감지 → 선택한 톡방으로 전송
;  마커 형식: [ERP_KAKAO:톡방이름]
; =====================================================

OnClipboardChange("클립보드감지")
Return

클립보드감지(타입) {
    If (타입 != 1)
        Return

    내용 := Clipboard

    ; ERP 발송 마커 확인
    If (SubStr(내용, 1, 11) != "[ERP_KAKAO:")
        Return

    ; 톡방 이름 파싱: [ERP_KAKAO:톡방이름] 형태
    줄끝 := InStr(내용, "`n")
    If (!줄끝)
        Return

    첫줄 := SubStr(내용, 1, 줄끝 - 1)           ; [ERP_KAKAO:톡방이름]
    톡방이름 := RegExReplace(첫줄, "^\[ERP_KAKAO:(.*)\]$", "$1")
    메시지 := SubStr(내용, 줄끝 + 1)             ; 실제 메시지 본문

    If (!톡방이름 || !메시지)
        Return

    ; 클립보드를 실제 메시지로 교체
    Clipboard := 메시지
    ClipWait, 1

    ; 카카오톡 실행 여부 확인
    If !WinExist("ahk_exe KakaoTalk.exe") {
        MsgBox, 카카오톡이 실행되어 있지 않습니다.`n카카오톡을 먼저 실행해 주세요.
        Return
    }

    ; 해당 톡방 창이 열려 있는지 확인
    If WinExist(톡방이름 . " ahk_exe KakaoTalk.exe") {
        WinActivate, %톡방이름% ahk_exe KakaoTalk.exe
        Sleep, 300
    } Else {
        ; 카카오톡 메인 창 활성화 후 검색으로 톡방 찾기
        WinActivate, ahk_exe KakaoTalk.exe
        Sleep, 500
        Send, ^f                    ; 검색 단축키
        Sleep, 400
        Send, %톡방이름%
        Sleep, 700
        Send, {Enter}
        Sleep, 500
    }

    ; 채팅 입력창 붙여넣기 & 전송
    Send, ^v
    Sleep, 300
    Send, {Enter}

    TrayTip, 삼양ERP, [%톡방이름%] 카카오톡 전송 완료!, 2, 1
}
