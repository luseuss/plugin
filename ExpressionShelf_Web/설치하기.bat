@echo off
setlocal
set "SRC=%~dp0"
set "DEST=%APPDATA%\Adobe\CEP\extensions\ExpressionShelf_Web"
echo Expression Shelf Web 설치
echo.
echo [1/2] 확장 파일 복사: %DEST%
robocopy "%SRC%." "%DEST%" /MIR /XD tools /XF "*.bat" "README*.txt" /NFL /NDL /NJH /NJS /NP >nul
if %ERRORLEVEL% GEQ 8 (
  echo 복사에 실패했습니다.
  pause
  exit /b 1
)
echo [2/2] 서명 없는 확장 허용 (PlayerDebugMode, 현재 사용자 계정만)
for %%V in (9 10 11 12) do reg add "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul
echo.
echo 완료. 에펙을 다시 실행한 뒤
echo 창(Window) ^> 확장(Extensions) ^> Expression Shelf Web 을 여세요.
pause
