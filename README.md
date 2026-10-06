# DMKD Lab website

영어 기반의 반응형 연구실 홈페이지입니다. GitHub Pages는 화면을 제공하고, Supabase는 이메일/비밀번호 로그인, 회원 정보, 사진을 저장합니다. 별도의 상시 실행 서버는 필요하지 않습니다.

공개 회원·교수·논문·뉴스 데이터는 빈 상태로 시작합니다. **Supabase에 연결되어 로그인/회원가입 화면이 활성화되어 있습니다.** 연결 대상은 `dmkd20242026's Project` (`geqkimegnprqipooaqvr`)입니다. 공개 API에서 이메일 가입 활성화, 이메일 인증 필수 설정, 비로그인 사용자의 회원 관리 RPC 차단을 확인했습니다. 최초 운영자 계정의 이메일 인증 및 승인된 운영자 권한도 확인했습니다.

로컬 연결값은 Git에서 제외되는 `.env.local`에 저장되어 있습니다. GitHub Pages 배포에는 별도로 아래 저장소 변수를 설정해야 합니다. `pnpm check:connection`으로 읽기 전용 연결 검사를 다시 실행할 수 있습니다.

Home(`/`), Research(`/research/`), Publications(`/publications/`), News(`/news/`), Members(`/members/`), Apply / Contact(`/apply/`)는 각자 독립된 주소와 본문을 갖습니다. 운영자 페이지는 `/admin/`입니다. 빌드 시 각 주소의 `index.html`을 생성해 GitHub Pages에서도 주소 직접 접속과 새로고침이 가능합니다.

## 로컬 실행

Node.js 22.12 이상(24 권장)과 pnpm 11.19.0을 사용합니다.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

`http://127.0.0.1:5173`에서 확인합니다. 환경변수 없이도 공개 화면을 볼 수 있습니다. 이 경우 Member login은 서비스 준비 안내를 표시하며 가짜 계정/로컬 저장소로 로그인하지 않습니다.

## Supabase 연결 — 최초 1회

1. [연구실 프로젝트 대시보드](https://supabase.com/dashboard/project/geqkimegnprqipooaqvr)를 해당 프로젝트 소유 계정으로 엽니다.
2. 새 프로젝트의 SQL Editor에서 [`supabase/install.sql`](supabase/install.sql)의 `first-admin@example.com`을 실제 최초 운영자 이메일로 바꾼 뒤 전체를 **한 번만** 실행합니다. 프로필/갤러리/스토리지, 운영자 승인과 역할 관리, 최초 운영자를 한 트랜잭션으로 구성합니다. 동명 테이블이 있으면 덮어쓰지 않고 오류와 함께 롤백됩니다. 통합 파일의 원본은 `setup.sql`, `membership.sql`이며 원본 수정 시 `pnpm prepare:database`로 다시 생성합니다. 현재 연결된 연구실 프로젝트는 이미 설치되어 있으므로 재실행하지 않습니다. 실제 운영자 이메일은 비공개 DB에만 보관하며 저장소에는 예시 주소를 사용합니다.
3. 프로젝트의 Connect/API 설정에서 **Project URL**과 **publishable key**를 확인합니다. `service_role` 또는 secret key는 사용하지 않습니다.
4. `.env.example`을 `.env.local`로 복사하고 입력합니다.

```dotenv
VITE_SUPABASE_URL=https://geqkimegnprqipooaqvr.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLIC_KEY
```

5. Auth → URL Configuration에서 Site URL을 `https://dmkd-lab.github.io`로 설정하고 다음 Redirect URLs를 허용합니다.

```text
https://dmkd-lab.github.io/
https://dmkd-lab.github.io/?account=recovery
http://127.0.0.1:5173/
http://127.0.0.1:5173/?account=recovery
```

6. Email provider 및 **이메일 확인(Confirm email)을 켭니다.** 최초 운영자 권한은 확인된 이메일에 의존하므로 이메일 확인을 끄지 마세요. 공개 운영에는 Custom SMTP를 설정하고 발신자 주소/도메인을 인증하세요. [기본 메일 서비스](https://supabase.com/docs/guides/auth/auth-smtp)는 프로젝트 조직에 허용된 주소로 발송이 제한되어 일반 회원에게 확인·복구 메일을 보내지 못할 수 있습니다. Auth의 이메일 요청 rate limit도 운영 상황에 맞춰 설정하세요.
7. 개발 서버를 재시작합니다. GitHub Pages 운영 시에는 아래 저장소 변수도 설정하고 다시 배포해야 합니다.

## 첫 번째 계정으로 테스트

1. 홈페이지 → **Member login → Create an account**에서 설치 시 지정한 최초 운영자 이메일과 본인만 아는 12자 이상의 비밀번호로 가입합니다.
2. 확인 메일을 클릭한 뒤 로그인하면 **최초 1회에 한해 자동으로 승인된 운영자**가 됩니다. 이메일 인증 전에는 운영자 권한을 부여하지 않습니다. 다른 이메일은 승인 대기 회원입니다.
3. 회원 영역의 **Manage members** 또는 하단 **Administration**에서 운영자 페이지를 엽니다. 가입 요청의 **Access → Approved → Save access**로 승인합니다. 이메일 미인증 계정은 승인할 수 없습니다.
4. **Role → Administrator / Member**로 운영자와 일반 회원을 할당합니다. 운영자 승격 및 접근 중지는 화면에서 한 번 더 확인합니다. 마지막 승인 운영자는 해제할 수 없으며 다른 운영자를 먼저 지정해야 합니다. 일반 회원은 승인 후 **Check approval**을 누르면 됩니다.
5. 이름, 직위/과정, 사진, 관심분야, 링크, 공개 이메일을 입력합니다. 교수님은 **Position / program → Faculty / Professors**를 선택합니다. **Publish my profile on the lab website**를 체크하고 Save profile을 누릅니다.
6. 로그아웃하거나 다른 기기에서 홈페이지를 열어 해당 과정에 프로필이 표시되는지 확인합니다.
7. **Share a lab moment**에서 사진과 설명을 올리면 News & Lab Life의 갤러리에 나타납니다. 업로더는 본인 사진만 삭제할 수 있습니다.

초대 방식도 사용할 수 있습니다. Supabase Auth에서 사용자 초대를 보내고 운영자 페이지에서 승인합니다. 초대 링크로 로그인하면 비밀번호 설정 화면이 표시됩니다. 비밀번호를 잊었으면 로그인 화면의 **Forgot password?**를 사용하세요. 최초 운영자 지정은 한 번만 실행되므로 나중에 해당 계정이 일반 회원으로 변경되어도 다시 로그인한다고 운영자로 복구되지 않습니다.

## 운영 및 개인정보

- 가입만으로 쓰기 권한을 얻지 않습니다. 서버가 승인 대기 요청을 기록하며 승인과 역할 변경은 운영자 전용 RPC에서만 가능합니다. 브라우저는 `lab_members` 테이블을 직접 수정할 수 없습니다.
- 운영자 RPC는 매번 현재 데이터베이스의 권한을 확인합니다. 사용자 편집 가능한 메타데이터의 역할은 사용하지 않습니다. 운영자 변경 내역은 비공개 `private.membership_audit`에 기록합니다.
- 회원은 자신의 프로필만 수정하며, 자신의 저장소 폴더에만 업로드/삭제할 수 있습니다. RLS와 데이터베이스 제약이 이를 강제합니다.
- 로그인 이메일은 `auth.users`에만 있습니다. 프로필의 `public_email`에 직접 입력한 주소만 사이트에 표시됩니다.
- 공개 체크를 해제하면 프로필은 회원 목록에서 사라집니다. 다만 **업로드 이미지는 공개 버킷에 저장되므로 URL을 아는 사람은 접근할 수 있습니다.** 사진은 비공개 문서 보관용이 아닙니다. 삭제·교체된 사진은 저장소 삭제를 시도하지만 CDN/브라우저 캐시는 즉시 사라지지 않을 수 있습니다.
- JPG/PNG/WebP 최대 5 MB를 지원합니다. 업로드 전에 브라우저에서 실제 이미지로 디코딩하고 최대 1,000px(프로필)/1,800px(갤러리) WebP로 변환해 메타데이터를 제거합니다. HEIC는 JPG로 변환한 뒤 올리세요.
- 회원 접근을 중지하려면 운영자 페이지의 **Access → Suspended**를 선택합니다. 프로필은 자동으로 비공개가 되고 수정/업로드 권한이 중지됩니다. 이전 갤러리 사진은 유지됩니다. 필요하면 Supabase 대시보드에서 갤러리 레코드와 해당 Storage 파일을 함께 제거하세요.

- 계정 삭제는 Auth 테이블을 통해 회원/프로필/갤러리 레코드를 연쇄 삭제합니다. Storage 파일은 자동 연쇄 삭제되지 않으므로 계정 삭제 전 관리자가 해당 UUID 폴더의 파일을 정리하세요. 실패한 업로드 후 남은 파일도 Storage에서 정리할 수 있습니다.
- Google Maps와 jsDelivr에서 제공하는 고운바탕(GounBatang) Regular/Bold 웹폰트를 사용합니다. 외부 서비스가 차단되면 기본 바탕 글꼴과 지도 링크를 이용할 수 있습니다. 폰트와 글자 간격은 `src/typography.css`에서 관리합니다.

## 논문, 뉴스, 교수님, 연락처 추가

[`src/content.js`](src/content.js)에서 관리합니다. 각 배열 위의 필드 예시를 따르세요. `lab.contactEmail`에 연구실 이메일을 넣으면 Apply / Contact에 메일 링크가 생깁니다. 초기 연구 소개는 일반적인 주제 설명이므로 실제 연구 방향이 정해지면 `src/main.js`의 Research 내용을 조정하세요.

- `publications`: 제목, 저자, 학회/저널, 연도, 논문/코드 URL. 검색과 연도 필터 자동 반영.
- `news`: 날짜, 분류, 제목, 설명, 선택 URL. 최신 날짜부터 표시.
- `faculty`: 코드로 추가할 선택적 교수님 데이터. 웹 프로필에서 Faculty / Professors를 선택해도 같은 분류에 표시됩니다. 교수님 정보가 없어도 Members의 교수님 분류와 필터는 유지됩니다.
- 회원 프로필/사진: 웹 회원 영역에서 관리하며 코드 수정/재배포 없이 반영됩니다.

영문 주소는 [덕성여자대학교 공식 Directions](https://www.duksung.ac.kr/eng/contents/contents.do?ciIdx=2580&menuId=3762), 건물 영문명은 [공식 Campus Map](https://www.duksung.ac.kr/eng/contents/contents.do?ciIdx=2579&menuId=3761)을 기준으로 했습니다. 호실은 요청한 350호입니다. 지도는 차미리사관 검색 임베드이며 실내 호실 위치를 나타내지는 않습니다.

## GitHub Pages 배포

1. GitHub 저장소 **Settings → Pages → Source: GitHub Actions**로 설정합니다.
2. **Settings → Secrets and variables → Actions → Variables**에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`를 추가합니다. 두 값은 공개 클라이언트 설정입니다. 서버용 비밀 키를 넣지 마세요.
3. `main`에 코드를 push하면 `.github/workflows/deploy.yml`이 테스트, 빌드 후 `dist`를 배포합니다. Actions의 수동 실행도 가능합니다.

배포 작업은 두 연결 변수가 없으면 중단하여 로그인 설정이 빠진 화면이 공개되는 것을 방지합니다. 로컬 개발에서는 연결 변수 없이 빈 홈페이지를 확인할 수 있습니다.

## 검증

```sh
pnpm test
pnpm build
```

단위 테스트는 URL/입력 검증을 확인합니다. 권한 테스트는 로컬 PGlite PostgreSQL에 두 SQL 파일을 적용해 이메일 인증 전 운영자 지정, 무단 승격, 승인 전 쓰기, 타인 프로필 수정/파일 삭제를 차단하는지 확인합니다. 운영자 승인·승격·중지, 마지막 운영자 보호, 최초 지정 1회 제한도 실행합니다. 실제 Supabase Auth/메일/Storage HTTP 서비스까지 연결하는 테스트는 프로젝트 설정 후 첫 계정으로 수행해야 합니다.

브라우저 테스트는 `pnpm test:e2e`로 실행합니다. 최초에는 `pnpm exec playwright install chromium`이 필요합니다. Windows에서 설치된 Edge를 사용하려면 `PLAYWRIGHT_CHANNEL=msedge` 환경변수를 설정하세요. 브라우저 테스트의 회원 API는 로컬 테스트 응답으로 격리되며 외부 계정을 만들거나 실제 사진을 공개하지 않습니다.

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
pnpm test:e2e
```
