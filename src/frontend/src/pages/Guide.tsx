import { Home, PenLine, GraduationCap, Layers, Compass, Wrench } from "lucide-react";
import { cn } from "../lib/cn";

interface GuideProps {
  className?: string;
}

export default function Guide({ className }: GuideProps) {
  return (
    <div className={cn("h-full overflow-y-auto bg-white dark:bg-gray-900", className)}>
      <div className="max-w-3xl mx-auto px-8 py-10 text-gray-700 dark:text-gray-300 leading-relaxed">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Dojang Guide</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">
          dojang 은 로컬에 설치된 Claude Code 세션과 대화하면서 자기만의 학습 커리큘럼을 키워가는
          개인 학습 공간입니다. 외부 AI API 호출이 없고, 모든 대화는 당신 머신의 <code>claude</code> CLI
          를 통해 이루어집니다. 학습 이력은 별자리로 시각화됩니다.
        </p>

        <nav className="mb-12 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
            탭별 사용법
          </p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <li><a href="#home" className="hover:text-primary-600 dark:hover:text-primary-400">🏠 Home — 가장 빠른 진입</a></li>
            <li><a href="#sketch" className="hover:text-primary-600 dark:hover:text-primary-400">✏️ Sketch — 무얼 공부할지 대화</a></li>
            <li><a href="#learn" className="hover:text-primary-600 dark:hover:text-primary-400">🎓 Learn — 직접 공부</a></li>
            <li><a href="#topics" className="hover:text-primary-600 dark:hover:text-primary-400">📦 Topics — 학습 portfolio</a></li>
            <li><a href="#explore" className="hover:text-primary-600 dark:hover:text-primary-400">🔭 Explore — 공부할 영역 찾기</a></li>
          </ul>
        </nav>

        <Section id="home" icon={Home} title="Home">
          <p><strong>가장 빠른 진입점.</strong> 짧은 질문을 한 줄 쓰고 Enter 하면 새 sketch 가 만들어지면서 Sketch 탭으로 자동 이동합니다. "docker 기초 배우고 싶어" 처럼 목적을 던지기만 하면 거기서부터 Claude 와의 대화가 시작됩니다.</p>
          <p>아래의 빠른 액션 버튼들은 특정 탭 바로 이동 또는 미리 준비된 프롬프트를 입력란에 채워줍니다 — "뭘 모르는지 알아보기", "커리큘럼 생성", "다음 공부 추천" 등.</p>
        </Section>

        <Section id="sketch" icon={PenLine} title="Sketch">
          <p><strong>무얼 공부할지 / 어떤 커리큘럼을 만들지 Claude 와 대화하면서 정하는 자리.</strong> 이 탭의 핵심은 "계획과 탐색" 입니다. 뭔가 배우고 싶지만 아직 구체 과목이 없을 때, Claude 와 왔다갔다 하며 범위·난이도·순서를 잡아가는 곳.</p>
          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">레이아웃</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>좌</strong>: sketch 목록 (생각 이력)</li>
            <li><strong>중</strong>: 마크다운 에디터 — 자유 메모장</li>
            <li><strong>우</strong>: <em>이 sketch 전용</em> Claude Code 터미널</li>
          </ul>
          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">per-sketch session</h4>
          <p>각 sketch 는 자기만의 Claude 세션 uuid 를 가지고, <code>claude --resume &lt;uuid&gt;</code> 로 다시 열립니다. 그래서 나중에 그 sketch 를 다시 열면 Claude 가 <em>그때까지의 대화 맥락을 기억한 채로</em> 돌아옵니다. 주제별로 sketch 를 분리해두면 각각의 생각 흐름이 섞이지 않습니다.</p>
          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">대화 예시</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>"나 지금 docker 입문인데 앞으로 한 달 공부 계획 짜줘"</li>
            <li>"SQL JOIN 이 헷갈리는데 어떻게 접근해야 돼?"</li>
            <li>"이 메모 정리해서 커리큘럼으로 만들어줘"</li>
          </ul>
        </Section>

        <Section id="learn" icon={GraduationCap} title="Learn">
          <p><strong>직접 공부하는 자리.</strong> 선택한 토픽의 커리큘럼 트리에서 노트(📖)와 실습(✏️)을 펼쳐보고, 커리큘럼과 연습문제를 원하는 대로 생성·수정합니다. Sketch 가 계획 탭이라면 Learn 은 실행 탭.</p>
          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">레이아웃</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>좌 사이드바</strong>: 상단 토픽 셀렉터 → 그 토픽의 커리큘럼 목록 → 각 커리큘럼 트리 (주제 → 노트/실습)</li>
            <li><strong>중앙</strong>: 선택한 노트는 읽기, 실습은 풀이 뷰</li>
            <li><strong>우</strong>: 글로벌 Claude 터미널 (Topics 간 공유 세션)</li>
          </ul>
          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">★ 기본 커리큘럼 토글</h4>
          <p>한 토픽 아래에 여러 커리큘럼을 둘 수 있고, 각 커리큘럼 옆 별을 눌러 이 토픽의 "기본" 을 고릅니다. 노란 별 = 현재 기본, 회색 별 = 기본 아님. 노란 별을 다시 누르면 해제되어 <strong>그 토픽이 Explore 별자리에서 사라집니다</strong> (정리 중이라 아직 안 보여주고 싶을 때).</p>
          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">Claude 와의 협업</h4>
          <p>지금 보고 있는 노트 / 실습은 자동으로 <code>data/current_context.md</code> 에 기록됩니다. 오른쪽 Claude 터미널에서 그냥 "이거 설명해줘", "힌트 줘", "이 실습 더 쉬운 버전으로 바꿔줘" 같이 물으면, Claude 가 MCP 도구로 맥락을 읽고 답합니다. 필요하면 그 자리에서 새 연습문제 / 새 주제 / 새 노트를 생성·수정할 수 있어요.</p>
        </Section>

        <Section id="topics" icon={Layers} title="Topics">
          <p><strong>학습 portfolio 를 cluster 로 정리하는 메타 레이어.</strong> Learn 이 한 토픽 안의 세부 학습이라면, Topics 는 그 위에서 "내가 뭘 배우고 있고 뭘 배울 건가" 의 큰 그림을 잡는 자리입니다.</p>
          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">cluster 로 분류</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>cluster section <strong>헤더를 드래그</strong> → cluster 순서 변경</li>
            <li>토픽 카드를 <strong>드래그</strong> → 다른 cluster 로 이동</li>
            <li>cluster 헤더의 <strong>▸</strong> → 접기 (상태는 localStorage 영속)</li>
            <li>각 cluster 안의 <strong>+ Create Topic</strong> → 그 cluster 에 바로 새 토픽 생성</li>
            <li>페이지 맨 아래 <strong>+ Cluster 추가</strong> → 새 그룹</li>
          </ul>
          <div className="mt-5 rounded-lg border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-900/10 px-4 py-3">
            <p className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm mb-1">
              <Wrench size={14} /> Claude 와의 협업 — 개발 중
            </p>
            <p className="text-[13px] text-amber-800/80 dark:text-amber-300/70">
              Topics 탭에서 Claude 가 cluster 구조를 진단 / 제안 / 리팩토링해주는 기능은 아직 없습니다.
              지금은 순수한 수동 정리 도구로만 동작합니다. 가까운 시일 내에 MCP 도구를 추가해서
              "지금 내 구조 점검해줘" / "이 목표에 맞는 cluster 제안해줘" 같은 대화가 가능해질
              예정이에요.
            </p>
          </div>
        </Section>

        <Section id="explore" icon={Compass} title="Explore">
          <p><strong>지금까지 쌓아온 학습을 별자리로 시각화한 공간.</strong> 새로 공부할 영역을 찾는 탭이에요 — 어디가 비었는지, 어디를 더 깊이 파야 할지, 다음엔 어느 방향으로 갈지 눈으로 보고 판단하는 자리.</p>
          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">무엇이 보이는지</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>각 <strong>토픽</strong>이 실제 별자리 (Orion, Big Dipper 등) 의 모양을 빌려 흩어집니다</li>
            <li>각 <strong>subject (주제)</strong> 가 별자리의 별 자리에 박힙니다</li>
            <li><strong>exercise / knowledge</strong> 는 subject 주변 위성처럼 떠다닙니다</li>
            <li>학습이 진행될수록 별이 밝아집니다</li>
          </ul>
          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">조작</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>토픽을 드래그하면 BFS 깊이에 따라 주변 별이 자석처럼 따라옵니다 (정리하는 느낌)</li>
            <li>노드를 클릭하면 상세 시트가 아래에서 올라옵니다</li>
          </ul>
          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">단축키</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li><Kbd>1</Kbd> 토픽 이름까지만 라벨 / <Kbd>2</Kbd> 주제 이름까지 라벨</li>
            <li><Kbd>0</Kbd> 별자리 셔플 (다른 별자리 패턴으로 재배치)</li>
            <li><Kbd>V</Kbd> 선택 모드 (기본) / <Kbd>H</Kbd> 손바닥 모드 (카메라 이동)</li>
          </ul>
          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">숨기기</h4>
          <p>어떤 토픽을 별자리에서 빼고 싶으면 Learn 탭으로 가서 그 토픽의 기본 커리큘럼 ★ 을 해제하세요 — 노란 별이 회색으로 바뀌면 Explore 에서 사라집니다.</p>
        </Section>

        <div className="mt-16 pt-6 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500">
          <p>세부 개발 문서: <code>docs/</code> 디렉토리 및 <code>CLAUDE.md</code></p>
        </div>
      </div>
    </div>
  );
}

// ── 섹션 helper ──
function Section({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: typeof Home;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-12 scroll-mt-6">
      <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">
        <Icon size={20} className="text-primary-500" />
        {title}
      </h2>
      <div className="space-y-3 text-[14px]">{children}</div>
    </section>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[22px] px-1.5 h-[20px] rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-[11px] font-mono text-gray-700 dark:text-gray-300 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
      {children}
    </kbd>
  );
}
