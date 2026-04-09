import { useEffect, useMemo, useRef, useState } from "react";
import {
  SigmaContainer,
  useLoadGraph,
  useRegisterEvents,
  useSigma,
} from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";
import Graph from "graphology";
import { cn } from "../lib/cn";
import { getKnowledgeGraph, type KGNode } from "../api/client";

interface ExploreProps {
  className?: string;
}

type LabelMode = 1 | 2; // 1: 토픽까지, 2: 주제까지
type ToolMode = "select" | "hand";

// 토픽 엣지 색상 — constellation을 구분
const TOPIC_EDGE: Record<string, string> = {
  CLI: "#c49a5a",
  Git: "#c8624a",
  Docker: "#4a80c8",
  SQL: "#4ab87a",
};
const DEFAULT_EDGE = "#5a6a8a";

// 노드는 배경보다 약간 밝은 정도 — 항상 보이되 glow (screen blend) 가 얹혀서 깜빡임을 만든다.
const STAR_COLORS = {
  topic: "#3a4068",
  subject: "#2a2f52",
  satellite: "#1c2040",
};

// ── 별자리 stick figure 데이터 (정규화 -1 ~ 1) ─────────────────────────
interface ConstellationDef {
  name: string;
  stars: { x: number; y: number }[];
  edges: [number, number][];
}
const CONSTELLATIONS: ConstellationDef[] = [
  {
    name: "Orion",
    stars: [
      { x: -0.55, y: -0.7 },
      { x: 0.45, y: -0.65 },
      { x: -0.25, y: -0.05 },
      { x: 0.0, y: 0.0 },
      { x: 0.25, y: 0.05 },
      { x: -0.65, y: 0.7 },
      { x: 0.55, y: 0.75 },
    ],
    edges: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]],
  },
  {
    name: "Big Dipper",
    stars: [
      { x: -0.95, y: -0.4 },
      { x: -0.55, y: -0.55 },
      { x: -0.15, y: -0.5 },
      { x: 0.2, y: -0.2 },
      { x: 0.3, y: 0.35 },
      { x: 0.85, y: 0.55 },
      { x: 0.95, y: 0.0 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
  },
  {
    name: "Cassiopeia",
    stars: [
      { x: -0.95, y: -0.3 },
      { x: -0.45, y: 0.25 },
      { x: 0.0, y: -0.55 },
      { x: 0.45, y: 0.25 },
      { x: 0.95, y: -0.3 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  {
    name: "Cygnus",
    stars: [
      { x: 0.05, y: -0.95 },
      { x: 0.0, y: -0.15 },
      { x: -0.05, y: 0.85 },
      { x: -0.85, y: 0.05 },
      { x: 0.85, y: -0.35 },
    ],
    edges: [[0, 1], [1, 2], [3, 1], [1, 4]],
  },
  {
    // Leo (사자자리) — 9 stars 낫(sickle) + 삼각형
    name: "Leo",
    stars: [
      { x: -0.85, y: -0.5 },  // 0 regulus
      { x: -0.7, y: 0.0 },    // 1 eta leo
      { x: -0.55, y: 0.45 },  // 2 algieba
      { x: -0.35, y: 0.7 },   // 3 zeta
      { x: -0.1, y: 0.55 },   // 4 mu
      { x: 0.15, y: 0.25 },   // 5 epsilon
      { x: 0.5, y: -0.1 },    // 6 chort
      { x: 0.85, y: -0.6 },   // 7 denebola
      { x: 0.05, y: -0.5 },   // 8 (back)
    ],
    edges: [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 0],
    ],
  },
  {
    // Scorpius (전갈자리) — 곡선 꼬리
    name: "Scorpius",
    stars: [
      { x: -0.95, y: -0.65 },
      { x: -0.6, y: -0.5 },
      { x: -0.25, y: -0.3 },
      { x: 0.05, y: -0.05 },
      { x: 0.3, y: 0.25 },
      { x: 0.5, y: 0.55 },
      { x: 0.7, y: 0.85 },
      { x: 0.9, y: 0.55 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]],
  },
  {
    // Lyra (거문고자리) — 작은 사다리꼴 + Vega
    name: "Lyra",
    stars: [
      { x: 0.0, y: -0.9 },  // 0 vega
      { x: -0.4, y: -0.1 }, // 1
      { x: 0.4, y: -0.1 },  // 2
      { x: -0.5, y: 0.6 },  // 3
      { x: 0.5, y: 0.6 },   // 4
    ],
    edges: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 4], [1, 2]],
  },
  {
    // Aquila (독수리자리) — Y shape
    name: "Aquila",
    stars: [
      { x: 0.0, y: -0.85 },   // 0 altair
      { x: -0.4, y: -0.55 },
      { x: 0.4, y: -0.55 },
      { x: -0.7, y: 0.05 },
      { x: 0.7, y: 0.05 },
      { x: 0.0, y: 0.4 },
      { x: 0.0, y: 0.85 },
    ],
    edges: [[0, 1], [0, 2], [1, 3], [2, 4], [0, 5], [5, 6]],
  },
  {
    // Gemini (쌍둥이자리) — 두 개의 길쭉한 별 라인
    name: "Gemini",
    stars: [
      { x: -0.6, y: -0.85 }, // 0 castor
      { x: -0.45, y: -0.4 },
      { x: -0.3, y: 0.05 },
      { x: -0.15, y: 0.5 },
      { x: 0.0, y: 0.85 },
      { x: 0.6, y: -0.85 },  // 5 pollux
      { x: 0.45, y: -0.4 },
      { x: 0.3, y: 0.05 },
      { x: 0.15, y: 0.5 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [5, 6], [6, 7], [7, 8], [8, 4]],
  },
  {
    // Auriga (마차부자리) — 오각형
    name: "Auriga",
    stars: [
      { x: 0.0, y: -0.9 },    // capella
      { x: 0.85, y: -0.3 },
      { x: 0.55, y: 0.65 },
      { x: -0.55, y: 0.65 },
      { x: -0.85, y: -0.3 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]],
  },
  {
    // Perseus (페르세우스) — 곡선 + 가지
    name: "Perseus",
    stars: [
      { x: -0.9, y: -0.6 },
      { x: -0.5, y: -0.3 },
      { x: -0.15, y: 0.0 },
      { x: 0.2, y: 0.3 },
      { x: 0.55, y: 0.6 },
      { x: 0.85, y: 0.3 },
      { x: -0.3, y: 0.4 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6]],
  },
  {
    // Draco (용자리) — 길쭉한 곡선
    name: "Draco",
    stars: [
      { x: -0.95, y: -0.75 },
      { x: -0.6, y: -0.5 },
      { x: -0.25, y: -0.65 },
      { x: 0.1, y: -0.4 },
      { x: 0.4, y: -0.05 },
      { x: 0.55, y: 0.35 },
      { x: 0.3, y: 0.7 },
      { x: -0.05, y: 0.85 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]],
  },
  {
    // Ursa Minor (작은곰자리) — 작은 dipper, Polaris 중심
    name: "Ursa Minor",
    stars: [
      { x: 0.0, y: -0.95 }, // 0 Polaris
      { x: -0.15, y: -0.5 },
      { x: -0.1, y: -0.05 },
      { x: -0.35, y: 0.3 },
      { x: 0.05, y: 0.55 },
      { x: 0.5, y: 0.45 },
      { x: 0.35, y: 0.0 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 2]],
  },
  {
    // Taurus (황소자리) — V 모양 Hyades + Aldebaran + 뿔
    name: "Taurus",
    stars: [
      { x: -0.95, y: -0.75 }, // 0 뿔 끝
      { x: -0.5, y: -0.3 },
      { x: -0.15, y: 0.0 }, // 2 Aldebaran
      { x: 0.2, y: -0.15 },
      { x: 0.55, y: -0.35 },
      { x: 0.9, y: -0.7 }, // 5 뿔 끝
      { x: -0.1, y: 0.55 },
      { x: 0.3, y: 0.6 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [3, 7]],
  },
  {
    // Pegasus (페가수스자리) — Great Square + 다리
    name: "Pegasus",
    stars: [
      { x: -0.6, y: -0.55 },
      { x: 0.55, y: -0.55 },
      { x: 0.55, y: 0.35 },
      { x: -0.6, y: 0.35 },
      { x: -0.95, y: -0.9 }, // 왼쪽 위 확장
      { x: 0.9, y: 0.8 }, // 오른쪽 아래
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [2, 5]],
  },
  {
    // Andromeda (안드로메다자리) — 긴 호
    name: "Andromeda",
    stars: [
      { x: -0.95, y: 0.4 },
      { x: -0.55, y: 0.1 },
      { x: -0.15, y: -0.1 },
      { x: 0.25, y: -0.3 },
      { x: 0.6, y: -0.55 },
      { x: 0.9, y: -0.85 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
  },
  {
    // Corona Borealis (북관자리) — 반원형 7 stars
    name: "Corona Borealis",
    stars: [
      { x: -0.9, y: 0.3 },
      { x: -0.65, y: -0.15 },
      { x: -0.3, y: -0.5 },
      { x: 0.05, y: -0.6 },
      { x: 0.4, y: -0.5 },
      { x: 0.7, y: -0.15 },
      { x: 0.9, y: 0.3 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
  },
  {
    // Hercules (헤라클레스자리) — Keystone + 팔다리
    name: "Hercules",
    stars: [
      { x: -0.3, y: -0.25 }, // 0 keystone TL
      { x: 0.3, y: -0.25 }, // 1 TR
      { x: 0.35, y: 0.2 }, // 2 BR
      { x: -0.35, y: 0.2 }, // 3 BL
      { x: -0.85, y: -0.65 }, // 4 팔
      { x: 0.85, y: -0.65 },
      { x: -0.6, y: 0.85 }, // 6 다리
      { x: 0.6, y: 0.85 },
    ],
    edges: [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [0, 4], [1, 5], [3, 6], [2, 7],
    ],
  },
  {
    // Virgo (처녀자리) — Y 모양 + Spica
    name: "Virgo",
    stars: [
      { x: -0.8, y: -0.8 },
      { x: -0.4, y: -0.4 },
      { x: 0.0, y: 0.0 },
      { x: 0.4, y: -0.45 },
      { x: 0.8, y: -0.85 },
      { x: -0.15, y: 0.6 },
      { x: 0.3, y: 0.85 }, // 6 Spica
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6]],
  },
  {
    // Delphinus (돌고래자리) — 작은 다이아 + 꼬리
    name: "Delphinus",
    stars: [
      { x: 0.0, y: -0.75 },
      { x: 0.55, y: -0.15 },
      { x: 0.0, y: 0.4 },
      { x: -0.55, y: -0.15 },
      { x: -0.95, y: 0.7 }, // 꼬리
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4]],
  },
  {
    // Corvus (까마귀자리) — 사다리꼴
    name: "Corvus",
    stars: [
      { x: -0.7, y: -0.4 },
      { x: 0.5, y: -0.6 },
      { x: 0.75, y: 0.4 },
      { x: -0.5, y: 0.6 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0]],
  },
  {
    // Sagittarius (궁수자리) — teapot 모양
    name: "Sagittarius",
    stars: [
      { x: -0.8, y: 0.3 }, // 0 spout tip
      { x: -0.4, y: -0.1 },
      { x: -0.1, y: -0.55 }, // 2 lid
      { x: 0.35, y: -0.35 },
      { x: 0.7, y: 0.0 }, // 4 handle top
      { x: 0.9, y: 0.55 }, // 5 handle bottom
      { x: 0.3, y: 0.65 }, // 6 base right
      { x: -0.5, y: 0.7 }, // 7 base left
    ],
    edges: [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0],
    ],
  },
];

// ── 4개 토픽에 무작위 별자리 할당 ───────────────────────────────────
function pickConstellations(count: number, _shuffleNonce: number): ConstellationDef[] {
  // shuffleNonce는 useEffect deps에만 들어가고 실제 무작위는 Math.random()
  const pool = [...CONSTELLATIONS];
  const picked: ConstellationDef[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

// ── 그래프 로더 ─────────────────────────────────────────────────────────────
function GraphLoader({
  data,
  labelMode,
  shuffleNonce,
}: {
  data: { nodes: KGNode[]; links: { source: string; target: string; kind: string }[] };
  labelMode: LabelMode;
  shuffleNonce: number;
}) {
  const loadGraph = useLoadGraph();
  const sigma = useSigma();
  const labelModeRef = useRef(labelMode);
  labelModeRef.current = labelMode;

  // ── ① 그래프 빌드 + d3-force 시뮬레이션 (data / shuffleNonce) ──────
  useEffect(() => {
    if (!data.nodes.length) return;
    const graph = new Graph();

    // 토픽 → 이름 매핑
    const topicNames = new Map<number, string>();
    for (const n of data.nodes) {
      if (n.kind === "subject") topicNames.set(n.topic_id, n.topic_name);
    }
    const topicIds = Array.from(topicNames.keys()).sort((a, b) => a - b);

    // ── 토픽 anchor — rejection sampling으로 자연 분산 ────────────
    const SPACE = 6300;
    const MIN_TOPIC_DIST = 3150;
    const SUBJECT_RADIUS = 360;
    const SATELLITE_RADIUS = 28;
    const topicAnchors: Record<number, { x: number; y: number }> = {};
    {
      const placed: { x: number; y: number }[] = [];
      for (const id of topicIds) {
        let pos = { x: 0, y: 0 };
        for (let attempts = 0; attempts < 400; attempts++) {
          pos = {
            x: (Math.random() - 0.5) * SPACE,
            y: (Math.random() - 0.5) * SPACE,
          };
          const ok = placed.every(
            (p) => Math.hypot(p.x - pos.x, p.y - pos.y) >= MIN_TOPIC_DIST,
          );
          if (ok) break;
        }
        placed.push(pos);
        topicAnchors[id] = pos;
      }
    }

    // ── 토픽별 별자리 무작위 할당 + subject를 별 슬롯에 매핑 ──────
    const constellations = pickConstellations(topicIds.length, shuffleNonce);
    const subjectAnchors: Record<string, { x: number; y: number }> = {};
    const constellationEdges: Array<{ src: string; tgt: string; topicName: string }> = [];
    topicIds.forEach((tid, i) => {
      const constellation = constellations[i] ?? CONSTELLATIONS[0];
      const tp = topicAnchors[tid];
      const rot = Math.random() * Math.PI * 2;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const starWorld = constellation.stars.map((s) => {
        const sx = s.x * SUBJECT_RADIUS;
        const sy = s.y * SUBJECT_RADIUS;
        return {
          x: tp.x + sx * cos - sy * sin,
          y: tp.y + sx * sin + sy * cos,
        };
      });
      const subjects = data.nodes.filter(
        (n) => n.kind === "subject" && n.topic_id === tid,
      );
      const slotCount = Math.min(subjects.length, starWorld.length);
      for (let s = 0; s < slotCount; s++) {
        subjectAnchors[subjects[s].id] = starWorld[s];
      }
      for (let s = slotCount; s < subjects.length; s++) {
        const angle = Math.random() * Math.PI * 2;
        const r = SUBJECT_RADIUS * 1.4;
        subjectAnchors[subjects[s].id] = {
          x: tp.x + Math.cos(angle) * r,
          y: tp.y + Math.sin(angle) * r,
        };
      }
      for (const [a, b] of constellation.edges) {
        if (a >= slotCount || b >= slotCount) continue;
        constellationEdges.push({
          src: subjects[a].id,
          tgt: subjects[b].id,
          topicName: topicNames.get(tid) ?? "",
        });
      }
    });

    // ── 노드 추가 ───────────────────────────────────────────────────────
    const lm = labelModeRef.current;

    // 1) 토픽 super-node
    for (const [id, name] of topicNames) {
      const a = topicAnchors[id];
      graph.addNode(`topic-${id}`, {
        label: name.toUpperCase(),
        size: 14,
        color: STAR_COLORS.topic,
        x: a.x,
        y: a.y,
        kind: "topic",
        topicId: id,
        topicName: name,
        meta: {
          id: `topic-${id}`,
          kind: "subject",
          label: name,
          topic_id: id,
          topic_name: name,
          confidence: 0,
          attempts: 0,
          status: "learning",
        } as KGNode,
      });
    }

    // 2) subject 노드
    for (const n of data.nodes) {
      if (n.kind !== "subject") continue;
      const a = subjectAnchors[n.id];
      if (!a) continue;
      graph.addNode(n.id, {
        label: lm >= 2 ? n.label : "",
        size: 6 + n.confidence * 4,
        color: STAR_COLORS.subject,
        x: a.x,
        y: a.y,
        kind: n.kind,
        topicId: n.topic_id,
        topicName: n.topic_name,
        meta: n,
      });
    }

    // 3) satellite (knowledge / exercise) — 부모 subject 주변에
    for (const n of data.nodes) {
      if (n.kind === "subject") continue;
      const parentId = n.parent;
      const parentPos = parentId && parentId.startsWith("subject-")
        ? subjectAnchors[parentId]
        : topicAnchors[n.topic_id];
      if (!parentPos) continue;
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * SATELLITE_RADIUS;
      graph.addNode(n.id, {
        label: "",
        size: 1.8,
        color: STAR_COLORS.satellite,
        x: parentPos.x + Math.cos(angle) * r,
        y: parentPos.y + Math.sin(angle) * r,
        kind: n.kind,
        topicId: n.topic_id,
        topicName: n.topic_name,
        meta: n,
      });
    }

    // ── 엣지 추가 ───────────────────────────────────────────────────────
    // 토픽 → subject 보이지 않는 edge (BFS/드래그 propagation 용)
    for (const n of data.nodes) {
      if (n.kind !== "subject") continue;
      const topicNodeId = `topic-${n.topic_id}`;
      if (!graph.hasNode(topicNodeId) || !graph.hasNode(n.id)) continue;
      try {
        graph.addEdge(topicNodeId, n.id, {
          size: 0.01,
          color: "rgba(0,0,0,0)",
          hidden: true,
          kind: "topic-link",
        });
      } catch {}
    }

    // 별자리 stick figure 엣지
    for (const e of constellationEdges) {
      if (!graph.hasNode(e.src) || !graph.hasNode(e.tgt)) continue;
      const color = TOPIC_EDGE[e.topicName] ?? DEFAULT_EDGE;
      try {
        graph.addEdge(e.src, e.tgt, {
          size: 0.5,
          color,
          kind: "constellation",
        });
      } catch {}
    }
    // 위성 엣지 (subject ↔ knowledge/exercise)
    for (const l of data.links) {
      if (l.kind !== "satellite") continue;
      if (!graph.hasNode(l.source) || !graph.hasNode(l.target)) continue;
      const srcAttrs = graph.getNodeAttributes(l.source);
      const color = TOPIC_EDGE[srcAttrs.topicName] ?? DEFAULT_EDGE;
      try {
        graph.addEdge(l.source, l.target, {
          size: 0.16,
          color,
          kind: "satellite",
        });
      } catch {}
    }

    loadGraph(graph);

    // 새 그래프에 fit 한 뒤 살짝 줌 아웃해서 마진 효과 (꽉 차지 않게).
    // 이전 코드는 cur.ratio * 1.3 으로 누적해서 셔플마다 화면이 점점 작아졌음.
    // 절대값으로 설정해서 누적을 막는다.
    setTimeout(() => {
      const camera = sigma.getCamera();
      camera.animate(
        { ratio: 1.3, x: 0.5, y: 0.5, angle: 0 },
        { duration: 400 },
      );
    }, 50);
  }, [data, shuffleNonce, loadGraph, sigma]);

  // ── ② 라벨 모드 변경 시 in-place 업데이트 (위치는 그대로) ──────
  useEffect(() => {
    const graph = sigma.getGraph();
    if (!graph || graph.order === 0) return;
    graph.forEachNode((nodeId, attrs) => {
      const kind = attrs.kind as string;
      const meta = attrs.meta as KGNode | undefined;
      let nextLabel = "";
      if (kind === "topic") {
        nextLabel = (attrs.topicName as string).toUpperCase();
      } else if (kind === "subject" && labelMode >= 2) {
        nextLabel = meta?.label ?? "";
      }
      if (graph.getNodeAttribute(nodeId, "label") !== nextLabel) {
        graph.setNodeAttribute(nodeId, "label", nextLabel);
      }
    });
    sigma.refresh();
  }, [labelMode, sigma, data, shuffleNonce]);

  return null;
}

// ── 클릭 + 자석 드래그 (BFS depth + requestAnimationFrame) ────────────
function GraphEvents({
  onNodeClick,
  mode,
}: {
  onNodeClick: (n: KGNode) => void;
  mode: ToolMode;
}) {
  const sigma = useSigma();
  const registerEvents = useRegisterEvents();
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    let draggedNode: string | null = null;
    let isDragging = false;
    let dragMoved = false;
    // followers: nodeId → 드래그 시작 시점의 dragged 노드 기준 offset + 깊이 ease
    const followers = new Map<string, { dx: number; dy: number; ease: number }>();
    let animFrame: number | null = null;

    const tick = () => {
      const graph = sigma.getGraph();
      if (!draggedNode || !graph.hasNode(draggedNode)) {
        animFrame = null;
        return;
      }
      const dx0 = graph.getNodeAttribute(draggedNode, "x") as number;
      const dy0 = graph.getNodeAttribute(draggedNode, "y") as number;
      let stillMoving = false;
      const EPS = 0.5;
      for (const [nodeId, f] of followers) {
        if (!graph.hasNode(nodeId)) continue;
        const cx = graph.getNodeAttribute(nodeId, "x") as number;
        const cy = graph.getNodeAttribute(nodeId, "y") as number;
        const tx = dx0 + f.dx;
        const ty = dy0 + f.dy;
        const ddx = tx - cx;
        const ddy = ty - cy;
        if (Math.abs(ddx) > EPS || Math.abs(ddy) > EPS) stillMoving = true;
        graph.setNodeAttribute(nodeId, "x", cx + ddx * f.ease);
        graph.setNodeAttribute(nodeId, "y", cy + ddy * f.ease);
      }
      if (stillMoving || isDragging) {
        animFrame = requestAnimationFrame(tick);
      } else {
        followers.clear();
        draggedNode = null;
        animFrame = null;
      }
    };

    const startAnim = () => {
      if (animFrame !== null) return;
      animFrame = requestAnimationFrame(tick);
    };

    registerEvents({
      downNode: (e) => {
        if (modeRef.current === "hand") return;
        const graph = sigma.getGraph();
        const attrs = graph.getNodeAttributes(e.node);
        // subject/위성은 클릭만, 드래그 X. topic만 드래그 가능.
        const draggable = attrs.kind === "topic";

        draggedNode = e.node;
        isDragging = draggable;
        dragMoved = false;

        if (!draggable) return;

        // BFS로 edge 그래프를 따라 깊이 계산
        const x0 = attrs.x as number;
        const y0 = attrs.y as number;
        const depths = new Map<string, number>();
        depths.set(e.node, 0);
        const queue: string[] = [e.node];
        while (queue.length > 0) {
          const cur = queue.shift()!;
          const d = depths.get(cur)!;
          graph.forEachNeighbor(cur, (neighbor: string) => {
            if (!depths.has(neighbor)) {
              depths.set(neighbor, d + 1);
              queue.push(neighbor);
            }
          });
        }
        const easeFor = (depth: number) =>
          Math.max(0.018, 0.16 - (depth - 1) * 0.045);

        followers.clear();
        for (const [nodeId, depth] of depths) {
          if (nodeId === e.node) continue;
          const a = graph.getNodeAttributes(nodeId);
          followers.set(nodeId, {
            dx: (a.x as number) - x0,
            dy: (a.y as number) - y0,
            ease: easeFor(depth),
          });
        }

        graph.setNodeAttribute(e.node, "highlighted", true);
        startAnim();
      },
      mousemovebody: (e) => {
        if (modeRef.current === "hand") return;
        if (!isDragging || !draggedNode) return;
        dragMoved = true;
        const pos = sigma.viewportToGraph(e);
        sigma.getGraph().setNodeAttribute(draggedNode, "x", pos.x);
        sigma.getGraph().setNodeAttribute(draggedNode, "y", pos.y);
        startAnim();
        e.preventSigmaDefault();
        e.original.preventDefault();
        e.original.stopPropagation();
      },
      mouseup: () => {
        if (draggedNode) {
          const graph = sigma.getGraph();
          if (!dragMoved && modeRef.current === "select") {
            const meta = graph.getNodeAttribute(draggedNode, "meta") as KGNode;
            if (meta) onNodeClick(meta);
          }
          if (isDragging) {
            try {
              graph.removeNodeAttribute(draggedNode, "highlighted");
            } catch {}
          }
        }
        isDragging = false;
        dragMoved = false;
        // draggedNode/followers는 anim이 정착 후 자동 정리
        startAnim();
        if (modeRef.current === "select") {
          sigma.setCustomBBox(null as unknown as ReturnType<typeof sigma.getBBox>);
        }
      },
      mousedown: () => {
        if (modeRef.current === "select" && !sigma.getCustomBBox()) {
          sigma.setCustomBBox(sigma.getBBox());
        }
      },
    });

    return () => {
      if (animFrame !== null) cancelAnimationFrame(animFrame);
    };
  }, [registerEvents, sigma, onNodeClick]);

  return null;
}

// ── 우주 배경 (nebula + distant stars) ──────────────────────────────
function SpaceBackground() {
  const [starField, setStarField] = useState<string | null>(null);

  useEffect(() => {
    const w = 1920;
    const h = 1080;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    for (let i = 0; i < 700; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const size = Math.pow(Math.random(), 3) * 1.4;
      const alpha = 0.15 + Math.random() * 0.55;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 1500; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.fillStyle = `rgba(220, 230, 255, ${0.05 + Math.random() * 0.15})`;
      ctx.fillRect(x, y, 0.6, 0.6);
    }

    setStarField(canvas.toDataURL());
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, #0c0a1c 0%, #04030a 80%)",
        }}
      />
      <div
        className="absolute"
        style={{
          left: "12%",
          top: "18%",
          width: 720,
          height: 720,
          background: "radial-gradient(circle, rgba(80, 40, 160, 0.16) 0%, transparent 65%)",
          filter: "blur(80px)",
        }}
      />
      <div
        className="absolute"
        style={{
          right: "8%",
          top: "55%",
          width: 620,
          height: 620,
          background: "radial-gradient(circle, rgba(40, 80, 180, 0.14) 0%, transparent 65%)",
          filter: "blur(70px)",
        }}
      />
      <div
        className="absolute"
        style={{
          left: "38%",
          top: "62%",
          width: 800,
          height: 420,
          background: "radial-gradient(ellipse, rgba(110, 60, 150, 0.10) 0%, transparent 70%)",
          filter: "blur(90px)",
        }}
      />
      <div
        className="absolute"
        style={{
          left: "55%",
          top: "8%",
          width: 500,
          height: 500,
          background: "radial-gradient(circle, rgba(50, 100, 170, 0.10) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
      {starField && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${starField})`,
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
            opacity: 0.8,
          }}
        />
      )}
    </div>
  );
}

// ── 별 glow 오버레이 (자체 RAF + 깜빡임) ────────────────────────────
function GlowLayer() {
  const sigma = useSigma();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = true;

    // 노드별 깜빡임 phase / period 는 id 해시 기반 (재현 가능)
    const phaseFor = (id: string): number => {
      let h = 0;
      for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
      return (h % 1000) / 1000;
    };
    // 1차 주기 (느린 호흡)
    const periodFor = (id: string): number => {
      let h = 0;
      for (let i = 0; i < id.length; i++) h = (h * 17 + id.charCodeAt(i)) >>> 0;
      return 2000 + (h % 4000); // 2–6 초 — 범위 넓혀서 별마다 편차 더 큰 호흡
    };
    // 2차 주기 (빠른 미세 떨림) — 1차의 비정수 배율이라 beat 가 생김
    const period2For = (id: string): number => {
      let h = 0;
      for (let i = 0; i < id.length; i++) h = (h * 13 + id.charCodeAt(i)) >>> 0;
      return 600 + (h % 900); // 0.6–1.5 초
    };

    const renderFrame = () => {
      if (!running) return;
      const graph = sigma.getGraph();
      const dims = sigma.getDimensions();
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== dims.width * dpr || canvas.height !== dims.height * dpr) {
        canvas.width = dims.width * dpr;
        canvas.height = dims.height * dpr;
        canvas.style.width = `${dims.width}px`;
        canvas.style.height = `${dims.height}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, dims.width, dims.height);

      const camera = sigma.getCamera();
      const ratio = camera.getState().ratio;
      const scale = 1 / ratio;
      const now = performance.now();

      graph.forEachNode((nodeId, attrs) => {
        const kind = attrs.kind as string;
        if (
          kind !== "topic" &&
          kind !== "subject" &&
          kind !== "exercise" &&
          kind !== "knowledge"
        )
          return;
        const view = sigma.graphToViewport({ x: attrs.x as number, y: attrs.y as number });

        // 깜빡임 — 두 주기의 사인파 합성으로 불규칙하게 어두워졌다 밝아짐
        const period = periodFor(nodeId);
        const period2 = period2For(nodeId);
        const phase = phaseFor(nodeId) * Math.PI * 2;
        const wave1 = 0.5 + 0.5 * Math.sin((now / period) * Math.PI * 2 + phase);
        const wave2 = 0.5 + 0.5 * Math.sin((now / period2) * Math.PI * 2 + phase * 1.7);
        const combined = wave1 * 0.65 + wave2 * 0.35;
        // 범위 0.35 ~ 1.0 — 항상 어느 정도 밝기 유지하되, peak 에서 확 밝아짐
        const twinkle = 0.35 + 0.65 * combined;

        const baseSize = kind === "topic" ? 50 : kind === "subject" ? 22 : 8;
        const glowR = baseSize * Math.min(scale * 0.9, 1.6) * (0.6 + 0.7 * combined);
        if (glowR < 2) return;

        const grad = ctx.createRadialGradient(view.x, view.y, 0, view.x, view.y, glowR);
        // node 자체가 어두운 색이라 glow (screen blend) 가 별의 유일한 밝기 원천.
        // alpha 를 높여서 twinkle max 에서 확실히 밝게.
        if (kind === "topic") {
          grad.addColorStop(0, `rgba(220, 230, 255, ${0.75 * twinkle})`);
          grad.addColorStop(0.1, `rgba(200, 215, 255, ${0.45 * twinkle})`);
          grad.addColorStop(0.3, `rgba(150, 170, 230, ${0.15 * twinkle})`);
          grad.addColorStop(1, "rgba(255, 255, 255, 0)");
        } else if (kind === "subject") {
          grad.addColorStop(0, `rgba(200, 210, 240, ${0.55 * twinkle})`);
          grad.addColorStop(0.15, `rgba(170, 190, 230, ${0.25 * twinkle})`);
          grad.addColorStop(1, "rgba(255, 255, 255, 0)");
        } else {
          grad.addColorStop(0, `rgba(180, 190, 220, ${0.3 * twinkle})`);
          grad.addColorStop(0.3, `rgba(160, 170, 200, ${0.08 * twinkle})`);
          grad.addColorStop(1, "rgba(255, 255, 255, 0)");
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(view.x, view.y, glowR, 0, Math.PI * 2);
        ctx.fill();
      });

      raf = requestAnimationFrame(renderFrame);
    };

    raf = requestAnimationFrame(renderFrame);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [sigma]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0"
      style={{ mixBlendMode: "screen", zIndex: 5 }}
    />
  );
}

// ── 노드 시트 ──
function NodeSheet({ node, onClose }: { node: KGNode; onClose: () => void }) {
  const statusLabel = { mastered: "마스터", learning: "학습중", unknown: "미탐색" }[node.status];
  const kindLabel: string =
    { subject: "주제", exercise: "연습", knowledge: "노트" }[node.kind] ?? "";

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-2xl rounded-t-2xl bg-gray-900/95 px-6 pb-10 pt-6 shadow-2xl backdrop-blur-xl border-t border-gray-700">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-white">{node.label}</h3>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">{kindLabel}</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">{statusLabel}</span>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/40">{node.topic_name}</span>
          </div>
        </div>
        <button onClick={onClose} className="p-1 text-white/30 hover:text-white/70">
          ✕
        </button>
      </div>

      {(node.kind === "subject" || node.kind === "exercise") && (
        <div className="mb-4">
          <div className="mb-1 flex justify-between text-xs text-white/50">
            <span>숙련도</span>
            <span>{Math.round(node.confidence * 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10">
            <div
              className="h-full rounded-full"
              style={{
                width: `${node.confidence * 100}%`,
                backgroundColor:
                  node.confidence >= 0.7 ? "rgba(200,225,255,0.8)" : "rgba(255,240,220,0.6)",
              }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-xs text-white/50">
        {node.kind === "subject" ? (
          <>
            <div>시도: {node.attempts}회</div>
            <div>연습: {node.exercise_count ?? 0}개</div>
            <div>지식: {node.knowledge_count ?? 0}개</div>
          </>
        ) : node.kind === "exercise" ? (
          <>
            <div>시도: {node.attempts}회</div>
            <div>난이도: {node.difficulty ?? "-"}</div>
            <div></div>
          </>
        ) : (
          <div className="col-span-3 italic text-white/30">노트</div>
        )}
      </div>
    </div>
  );
}

export default function Explore({ className }: ExploreProps) {
  const [data, setData] = useState<{
    nodes: KGNode[];
    links: { source: string; target: string; kind: string }[];
  }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [labelMode, setLabelMode] = useState<LabelMode>(1);
  const [shuffleNonce, setShuffleNonce] = useState(0);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [selected, setSelected] = useState<KGNode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getKnowledgeGraph()
      .then((res) => setData(res))
      .finally(() => setLoading(false));
  }, []);

  // 키보드 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k === "1") setLabelMode(1);
      else if (k === "2") setLabelMode(2);
      else if (k === "0") setShuffleNonce((n) => n + 1);
      else if (k === "v") setToolMode("select");
      else if (k === "h") setToolMode("hand");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const sigmaSettings = useMemo(
    () => ({
      allowInvalidContainer: true,
      defaultEdgeColor: "#3a4a6a",
      labelColor: { color: "#cdd6f4" },
      labelSize: 11,
      labelWeight: "500",
      labelDensity: 1.5,
      labelGridCellSize: 60,
      renderEdgeLabels: false,
      minCameraRatio: 0.05,
      maxCameraRatio: 20,
      zoomingRatio: 1.18,
    }),
    [],
  );

  const cursorClass = toolMode === "hand" ? "cursor-grab" : "cursor-default";

  return (
    <div
      ref={containerRef}
      className={cn("relative h-full bg-[#04040c] overflow-hidden", cursorClass, className)}
    >
      {loading ? (
        <div className="flex h-full items-center justify-center text-white/40">
          <p className="text-sm">별자리 불러오는 중…</p>
        </div>
      ) : data.nodes.length === 0 ? (
        <div className="flex h-full items-center justify-center text-center text-white/30">
          <div>
            <p className="mb-3 text-3xl">✦</p>
            <p className="text-sm">별자리가 비어있어요</p>
          </div>
        </div>
      ) : (
        <>
          <SpaceBackground />
          <SigmaContainer
            style={{
              height: "100%",
              width: "100%",
              background: "transparent",
              position: "absolute",
              inset: 0,
            }}
            settings={sigmaSettings}
          >
            <GraphLoader
              data={data}
              labelMode={labelMode}
              shuffleNonce={shuffleNonce}
            />
            <GraphEvents onNodeClick={setSelected} mode={toolMode} />
            <GlowLayer />
          </SigmaContainer>
        </>
      )}

      {/* 단축키 인디케이터 */}
      {!loading && data.nodes.length > 0 && (
        <div className="pointer-events-none absolute left-4 top-4 z-30 flex flex-col gap-1.5 text-[10px] text-white/40">
          <div className="flex gap-1.5">
            {[
              { mode: 1 as const, label: "1 토픽까지" },
              { mode: 2 as const, label: "2 주제까지" },
            ].map(({ mode, label }) => (
              <span
                key={mode}
                className={cn(
                  "rounded px-2 py-0.5 border",
                  labelMode === mode
                    ? "bg-white/15 text-white/80 border-white/20"
                    : "bg-white/[0.03] border-white/5",
                )}
              >
                {label}
              </span>
            ))}
            <span className="rounded px-2 py-0.5 border bg-white/[0.03] border-white/5">0 셔플</span>
          </div>
          <div className="flex gap-1.5">
            {[
              { m: "select" as const, label: "V 선택" },
              { m: "hand" as const, label: "H 이동" },
            ].map(({ m, label }) => (
              <span
                key={m}
                className={cn(
                  "rounded px-2 py-0.5 border",
                  toolMode === m
                    ? "bg-white/15 text-white/80 border-white/20"
                    : "bg-white/[0.03] border-white/5",
                )}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setSelected(null)} />
          <NodeSheet node={selected} onClose={() => setSelected(null)} />
        </>
      )}
    </div>
  );
}
