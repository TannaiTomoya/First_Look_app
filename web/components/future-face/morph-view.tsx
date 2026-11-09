"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Crop, FaceData, ImageMesh } from "@/lib/face-mesh/geometry";

/** 画像全体の三角形メッシュに source をテクスチャとして貼り、頂点だけを動かして描画する */
export function MorphCanvas({
  crop = null,
  className = "rounded-2xl",
  ...props
}: {
  source: HTMLCanvasElement;
  mesh: ImageMesh;
  positions: Float64Array;
  face: FaceData;
  deformedFace: FaceData["points"];
  showWire: boolean;
  crop?: Crop | null;
  className?: string;
}) {
  const { width: W, height: H } = props.source;
  const c = crop ?? { x: 0, y: 0, w: W, h: H };
  return (
    <div className={`w-full overflow-hidden bg-zinc-100 ${className}`} style={{ aspectRatio: `${c.w} / ${c.h}` }}>
      <Canvas orthographic camera={{ position: [0, 0, 10], near: 0.1, far: 100 }} flat>
        <FitOrtho W={W} H={H} crop={c} />
        <MorphMesh {...props} />
      </Canvas>
    </div>
  );
}

function FitOrtho({ W, H, crop }: { W: number; H: number; crop: Crop }) {
  useFrame(({ camera, size }) => {
    const zoom = Math.min(size.width / crop.w, size.height / crop.h);
    const x = crop.x + crop.w / 2 - W / 2;
    const y = H / 2 - (crop.y + crop.h / 2);
    if (Math.abs(camera.zoom - zoom) > 1e-4 || camera.position.x !== x || camera.position.y !== y) {
      camera.zoom = zoom;
      camera.position.set(x, y, 10);
      camera.updateProjectionMatrix();
    }
  });
  return null;
}

function MorphMesh({
  source,
  mesh,
  positions,
  face,
  deformedFace,
  showWire,
}: {
  source: HTMLCanvasElement;
  mesh: ImageMesh;
  positions: Float64Array;
  face: FaceData;
  deformedFace: FaceData["points"];
  showWire: boolean;
}) {
  const { width: W, height: H } = source;

  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(source);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, [source]);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = mesh.base.length / 2;
    const uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      uv[i * 2] = mesh.base[i * 2] / W;
      uv[i * 2 + 1] = 1 - mesh.base[i * 2 + 1] / H;
    }
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(mesh.triangles), 1));
    return g;
  }, [mesh, W, H]);

  const wire = useMemo(() => new THREE.BufferGeometry(), []);

  useEffect(() => {
    const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < attr.count; i++) {
      attr.setXYZ(i, positions[i * 2] - W / 2, H / 2 - positions[i * 2 + 1], 0);
    }
    attr.needsUpdate = true;
    geometry.computeBoundingSphere();

    const arr = new Float32Array(face.edges.length * 6);
    face.edges.forEach(([a, b], i) => {
      const pa = deformedFace[a];
      const pb = deformedFace[b];
      arr.set([pa[0] - W / 2, H / 2 - pa[1], 1, pb[0] - W / 2, H / 2 - pb[1], 1], i * 6);
    });
    wire.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    wire.computeBoundingSphere();
  }, [geometry, wire, positions, deformedFace, face.edges, W, H]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => () => wire.dispose(), [wire]);

  return (
    <>
      <mesh geometry={geometry}>
        <meshBasicMaterial map={texture} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {showWire && (
        <lineSegments geometry={wire}>
          <lineBasicMaterial color="#4f46e5" transparent opacity={0.35} />
        </lineSegments>
      )}
    </>
  );
}
