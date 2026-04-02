# TransLit — AI Business Translation v1.0

## 프로젝트 개요
"아무렇게나 입력 → 한국어 정제 → 3톤 동시 번역" 2단계 파이프라인 웹앱

## 핵심 기능
- 양방향 자동 감지 (한↔영)
- 원문 정제 (맞춤법, 어순, 띄어쓰기 교정) → 정제 결과 먼저 표시
- 3톤 동시 번역 (Professional / Friendly / Concise)
- 음성 입력 (Web Speech API)
- 스트리밍 UI (실시간 토큰 표시)
- 번역 히스토리 (localStorage, 최대 50건)

## 기술 스택
- 프론트엔드: HTML/CSS/JS (바닐라, 빌드 없음)
- 백엔드: Python FastAPI + uvicorn
- LLM: Claude API (anthropic SDK), 구분자 기반 스트리밍 파싱
- 음성: Web Speech API
- 저장: localStorage

## 프로젝트 구조
```
translator_bot_en_v1.0/
├── backend/
│   ├── main.py              # FastAPI 앱 (정적파일 서빙 + API)
│   ├── config.py            # 환경변수, 상수
│   ├── routers/translate.py # POST /api/translate (SSE 스트리밍)
│   └── prompts/translation.py # 시스템 프롬프트
├── frontend/
│   ├── index.html           # 싱글 페이지 앱
│   ├── css/style.css        # 다크 테마
│   └── js/                  # app, api, ui, voice, history, clipboard
├── docs/                    # 크로스 검증 문서 (GPT/Grok/Gemini)
├── .env                     # API 키 (gitignore)
├── requirements.txt
├── start.bat
└── service_definition.md    # 서비스 정의서 v2.0
```

## 실행 방법
```bash
pip install -r requirements.txt
# .env 파일에 ANTHROPIC_API_KEY 설정
python -m uvicorn backend.main:app --reload --port 5050
# http://localhost:5050 접속
```

## 컨벤션
- 커밋 메시지: 한국어 허용, 변경 내용 명확히 기술
- 파일명: 케밥케이스(kebab-case) 권장
- CSS: CSS 변수 기반 디자인 토큰 사용
- JS: 모듈별 전역 객체 패턴 (API, UI, Voice, History, Clipboard)
