# Expression Shelf Web

After Effects용 CEP 패널입니다. 모션 프리셋 51개, 트랜지션 18개, 타이포 보관함, 레터박스 생성 기능을 포함합니다.

현재 준비 버전은 **0.6.3 시험판**입니다. Windows에서 After Effects를 종료한 다음 `ExpressionShelf_Web/설치하기.bat`을 실행하세요. 상세 사용법은 `ExpressionShelf_Web/README_WEB.txt`에 있습니다.

## GitHub 릴리스

`ExpressionShelf_Web/CSXS/manifest.xml`의 두 버전 값과 `ExpressionShelf_Web/updater.js`의 버전을 함께 갱신하고 `RELEASE_NOTES.md`를 수정하세요. Actions의 **Build release → Run workflow**에서 같은 `v버전` 태그를 입력하거나 해당 태그를 푸시하면 JavaScript와 패키지를 검사합니다. ZIP, `latest.json`, `SHA256SUMS.txt`가 첨부된 초안 릴리스가 생성됩니다. 내용을 확인하고 GitHub에서 직접 공개하세요. 기존 릴리스가 있으면 파일을 갱신합니다.

패널의 `업데이트 확인` 버튼은 최신 공개 릴리스를 확인합니다. 업데이트가 있으면 파일을 내려받아 SHA-256을 확인하고, 사용자가 업데이트를 예약하면 After Effects를 종료한 뒤 설치합니다. 초안 릴리스는 확인되지 않은 릴리스이므로 업데이트 검사에서 제외됩니다. After Effects에서 실제 동작 확인도 별도로 필요합니다.

타이포 AEP 파일과 썸네일은 사용자 데이터이므로 이 저장소나 배포 ZIP에 포함하지 않습니다.
