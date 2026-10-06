@echo off
set "DEST=%APPDATA%\Adobe\CEP\extensions\ExpressionShelf_Web"
if not exist "%DEST%" (
  echo 설치된 Expression Shelf Web이 없습니다.
  pause
  exit /b 0
)
echo 다음 폴더를 삭제합니다: %DEST%
echo (PlayerDebugMode 설정은 다른 확장이 쓸 수 있어 그대로 둡니다)
choice /m "계속할까요"
if errorlevel 2 exit /b 0
rmdir /s /q "%DEST%"
echo 제거했습니다. 에펙을 다시 실행하세요.
pause
