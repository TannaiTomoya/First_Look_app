"use client";

import type { FaceLandmarker, FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import type { FaceData, Vec3 } from "@/lib/face-mesh/geometry";

// package.json の @mediapipe/tasks-vision と同じバージョンにすること（型は package から取る）
const CDN_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2";
const WASM_BASE = `${CDN_BASE}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

type Loaded = { landmarker: FaceLandmarker; edges: Array<[number, number]> };

let loading: Promise<Loaded> | null = null;

export function loadFaceLandmarker(): Promise<Loaded> {
  loading ??= (async () => {
    // バンドルに含めない（Worker のサーバーバンドルに SSR 用チャンクとして入るのを防ぐ）
    const { FaceLandmarker, FilesetResolver } = (await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ `${CDN_BASE}/vision_bundle.mjs`
    )) as typeof import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    const create = (delegate: "GPU" | "CPU") =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: "IMAGE",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
    let landmarker: FaceLandmarker;
    try {
      landmarker = await create("GPU");
    } catch {
      landmarker = await create("CPU");
    }
    const edges = FaceLandmarker.FACE_LANDMARKS_TESSELATION.map(
      (c) => [c.start, c.end] as [number, number],
    );
    return { landmarker, edges };
  })();
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

export type Detection = {
  face: FaceData;
  blendshapes: Array<{ name: string; score: number }>;
  matrix: number[] | null;
};

export async function detectFace(canvas: HTMLCanvasElement): Promise<Detection | null> {
  const { landmarker, edges } = await loadFaceLandmarker();
  const result: FaceLandmarkerResult = landmarker.detect(canvas);
  const lms = result.faceLandmarks[0];
  if (!lms?.length) return null;

  const W = canvas.width;
  const H = canvas.height;
  const points: Vec3[] = lms.map((l) => [l.x * W, l.y * H, l.z * W]);
  const blendshapes = (result.faceBlendshapes[0]?.categories ?? []).map((c) => ({
    name: c.categoryName,
    score: c.score,
  }));
  return {
    face: { width: W, height: H, points, edges },
    blendshapes,
    matrix: result.facialTransformationMatrixes[0]?.data ?? null,
  };
}
