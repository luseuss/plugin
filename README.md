# Expression Shelf Web

After Effects용 CEP 패널입니다. 모션 프리셋 51개, 트랜지션 12개, 타이포 보관함, 레터박스 생성 기능을 포함합니다.

현재 배포 버전은 **0.6.0 시험판**입니다. Windows에서 After Effects를 종료한 다음 `ExpressionShelf_Web/설치하기.bat`을 실행하세요. 상세 사용법은 `ExpressionShelf_Web/README_WEB.txt`에 있습니다.

## GitHub 릴리스

`ExpressionShelf_Web/CSXS/manifest.xml`의 두 버전 값을 함께 갱신하고 `RELEASE_NOTES.md`를 수정한 뒤 `v버전` 태그를 푸시하면 GitHub Actions가 JavaScript 문법과 패키지를 확인합니다. ZIP, `latest.json`, `SHA256SUMS.txt`를 첨부한 **초안 릴리스**를 생성합니다. 내용을 확인하고 GitHub에서 직접 공개하세요.

이 릴리스 파이프라인은 배포 파일을 자동으로 만들지만 패널 안에서 새 버전을 확인하거나 설치하는 기능은 아직 포함하지 않습니다. After Effects에서 실제 동작 확인도 별도로 필요합니다.

타이포 AEP 파일과 썸네일은 사용자 데이터이므로 이 저장소나 배포 ZIP에 포함하지 않습니다.
