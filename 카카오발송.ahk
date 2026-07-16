#NoEnv
#SingleInstance Force
SetWorkingDir %A_ScriptDir%
SetTitleMatchMode, 2

; =====================================================
;  삼양ERP → 카카오톡 단톡방 자동 발송 스크립트
;  - ERP에서 "카카오 발송" 버튼 클릭 시 클립보드에
;    [ERP_KAKAO] 마커가 포함된 메시지가 복사됨
;  - 이 스크립트가 감지하여 카카오톡으로 자동 전송
; =====================================================

; ★ 여기에 단톡방 이름을 정확히 입력하세요 ★
단톡방이름 := "단톡방이름을여기에입력"   ; 예: "삼양이엔지 영업팀"

; 클립보드 감지 루프
OnClipboardChange("클립보드감지")
Return

클립보드감지(타입) {
    Global 단톡방이름
    If (타입 != 1)   ; 텍스트가 아니면 무시
        Return

    내용 := Clipboard

    ; ERP 발송 마커 확인
    If (SubStr(내용, 1, 11) != "[ERP_KAKAO]")
        Return

    ; 마커 제거한 실제 메시지
    메시지 := SubStr(내용, 13)   ; "[ERP_KAKAO]\n" 이후부터

    ; 클립보드를 실제 메시지로 교체 (마커 없이)
    Clipboard := 메시지
    ClipWait, 1

    ; 카카오톡 실행 또는 활성화
    If !WinExist(단톡방이름 . " ahk_exe KakaoTalk.exe")
    {
        ; 카카오톡 메인 창이라도 활성화
        If WinExist("ahk_exe KakaoTalk.exe")
        {
            WinActivate, ahk_exe KakaoTalk.exe
            Sleep, 600
            ; 검색으로 단톡방 찾기
            Send, ^f
            Sleep, 400
            Send, %단톡방이름%
            Sleep, 600
            Send, {Enter}
            Sleep, 500
        }
        Else
        {
            MsgBox, 카카오톡이 실행되어 있지 않습니다.`n카카오톡을 먼저 실행하고 단톡방을 열어두세요.
            Return
        }
    }
    Else
    {
        WinActivate, %단톡방이름% ahk_exe KakaoTalk.exe
    }

    Sleep, 400

    ; 채팅 입력창 클릭 후 붙여넣기
    Send, ^v
    Sleep, 300
    Send, {Enter}

    ; 완료 알림 (트레이)
    TrayTip, 삼양ERP, 카카오톡 전송 완료!, 2, 1
}
