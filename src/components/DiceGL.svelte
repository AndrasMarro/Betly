<script lang="ts">
  // The dice as real 3D models (three.js) on a wooden table with a purple velvet mat, like the coin toss.
  // Each die is its polyhedron with chamfered, softly shaded edges, so it looks rounded instead of boxy.
  // The throw itself comes from diceSim (the same one the CSS fallback uses). three.js loads only here.
  import { onDestroy, onMount, untrack } from 'svelte';
  import { resting, simulate, solid, spread, type Frame, type M, type Solid, type V } from '../games/diceSim';
  import { tableTop } from '../lib/coinface';
  import type * as THREE from 'three';

  let { values, rolls, faces = 6, mines = 0, ondone, onfail }: { values: number[]; rolls: number; faces?: 6 | 8 | 10; mines?: number; ondone?: () => void; onfail?: () => void } = $props();

  const SIZE = 96, K = 1 / 48; // the simulation works in "pixels" of a 96 px die; the scene in units of 48 px
  const PIPS: Record<number, [number, number][]> = {
    1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
    6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
  };
  const COLORS: Record<number, [string, string]> = { 6: ['#f7f4ec', '#1d1d22'], 8: ['#2c55c9', '#fff4d6'], 10: ['#1d8f5c', '#fff4d6'] };

  let host: HTMLDivElement;
  let alive = true, raf = 0, anim = 0;
  let api: { show: (dice: Throw3[], boom?: boolean[]) => void; frame: (i: number, fr: Frame) => void } | null = null;
  type Throw3 = { frames: Frame[]; nums: number[] };
  let dispose = () => {};
  let S: Solid = solid(6, SIZE); // set to the chosen kind by the effects below
  let state: Throw3[] = [];

  onMount(async () => {
    try {
      const THREE = await import('three');
      if (!alive) return;
      let w = Math.max(200, host.clientWidth), h = Math.max(200, host.clientHeight);
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
      renderer.setSize(w, h);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0e0a14);
      scene.fog = new THREE.Fog(0x0e0a14, 22, 44);
      const camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 100);
      const place = () => {
        w = Math.max(200, host.clientWidth); h = Math.max(200, host.clientHeight);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        // three dice need about 9 units of width; narrow screens step back
        const k = Math.max(1, 1.25 / camera.aspect);
        camera.position.set(0, 10 * k, 10.5 * k);
        Object.assign(scene.fog!, { near: 18 * k, far: 40 * k });
        camera.lookAt(0, 0, -1.1);
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(() => alive && place());
      ro.observe(host);
      place();
      scene.add(new THREE.HemisphereLight(0xfff1d6, 0x1a1028, 1.2));
      const key = new THREE.DirectionalLight(0xffffff, 2.6);
      key.position.set(-5, 12, 7);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
      key.shadow.radius = 5;
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xc9b0ff, 0.8);
      rim.position.set(7, 5, -9);
      scene.add(rim);
      const lamp = new THREE.SpotLight(0xffe2b0, 50, 40, 0.6, 0.6, 1.4);
      lamp.position.set(0, 15, 3);
      scene.add(lamp, lamp.target);
      const tex = new THREE.CanvasTexture(tableTop(1024, ['#4b2a6e', '#1f0f35'], true));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      // ---------- the dice ----------
      const to3 = (p: V) => new THREE.Vector3(p[0] * K, -p[1] * K, p[2] * K); // CSS axes (y down) -> three (y up)
      /** The polyhedron with chamfered edges and corners: faces stay flat, the bevels get smooth normals. */
      function geometry(S: Solid) {
        const t = S.f === 6 ? 0.17 : 0.1;
        const pos: number[] = [], nrm: number[] = [], uv: number[] = [];
        const geo = new THREE.BufferGeometry();
        const out = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).dot(a.clone().add(b).add(c)) > 0;
        const tri = (pts: THREE.Vector3[], ns: THREE.Vector3[], uvs: number[][]) => {
          let o = [0, 1, 2];
          if (!out(pts[0], pts[1], pts[2])) o = [0, 2, 1];
          for (const k of o) { pos.push(pts[k].x, pts[k].y, pts[k].z); nrm.push(ns[k].x, ns[k].y, ns[k].z); uv.push(...uvs[k]); }
        };
        // inset corners of every face
        const Q = S.faces.map((fc) => fc.P.map((p) => to3([p[0] + (fc.c[0] - p[0]) * t, p[1] + (fc.c[1] - p[1]) * t, p[2] + (fc.c[2] - p[2]) * t])));
        S.faces.forEach((fc, fi) => {
          const n = to3(fc.n).normalize(), c = to3(fc.c);
          const E = Math.max(...fc.P.map((p) => Math.hypot(...[0, 1, 2].map((i) => p[i] - fc.c[i])))) * K;
          const u3 = to3(fc.u).multiplyScalar(48), v3 = to3(fc.v).multiplyScalar(48);
          const uvOf = (p: THREE.Vector3) => { const d = p.clone().sub(c); return [0.5 + d.dot(u3) / (2 * E), 0.5 - d.dot(v3) / (2 * E)]; };
          const start = pos.length / 3;
          for (let i = 1; i + 1 < Q[fi].length; i++) { const tr = [Q[fi][0], Q[fi][i], Q[fi][i + 1]]; tri(tr, [n, n, n], tr.map(uvOf)); }
          geo.addGroup(start, pos.length / 3 - start, fi);
        });
        const bevel = pos.length / 3, sm = (p: THREE.Vector3) => p.clone().normalize();
        // bevel strips along every edge shared by two faces
        S.faces.forEach((a, fa) => S.faces.forEach((b, fb) => {
          if (fb <= fa) return;
          const shared = a.idx.filter((i) => b.idx.includes(i));
          if (shared.length !== 2) return;
          const [i, j] = shared, A1 = Q[fa][a.idx.indexOf(i)], A2 = Q[fa][a.idx.indexOf(j)], B1 = Q[fb][b.idx.indexOf(i)], B2 = Q[fb][b.idx.indexOf(j)];
          for (const tr of [[A1, A2, B2], [A1, B2, B1]]) tri(tr, tr.map(sm), [[0, 0], [0, 0], [0, 0]]);
        }));
        // corner caps where three or more faces meet
        S.verts.forEach((vx, vi) => {
          const around = S.faces.map((fc, fi) => (fc.idx.includes(vi) ? Q[fi][fc.idx.indexOf(vi)] : null)).filter(Boolean) as THREE.Vector3[];
          const axis = to3(vx).normalize(), ref = new THREE.Vector3(1, 0.3, 0.2).cross(axis).normalize(), ref2 = axis.clone().cross(ref);
          const mid = around.reduce((m, p) => m.add(p), new THREE.Vector3()).multiplyScalar(1 / around.length);
          around.sort((p, q) => Math.atan2(p.clone().sub(mid).dot(ref2), p.clone().sub(mid).dot(ref)) - Math.atan2(q.clone().sub(mid).dot(ref2), q.clone().sub(mid).dot(ref)));
          for (let k = 0; k < around.length; k++) { const tr = [mid, around[k], around[(k + 1) % around.length]]; tri(tr, tr.map(sm), [[0, 0], [0, 0], [0, 0]]); }
        });
        geo.addGroup(bevel, pos.length / 3 - bevel, S.faces.length);
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        return geo;
      }
      // face pictures: pips, numbers or a bomb, cached per kind and value
      const texCache = new Map<string, THREE.CanvasTexture>();
      function faceTex(f: number, n: number, bomb: boolean) {
        const id = `${f}-${n}-${bomb}`;
        if (texCache.has(id)) return texCache.get(id)!;
        const cv = document.createElement('canvas'); cv.width = cv.height = 256;
        const g = cv.getContext('2d')!, [bg, ink] = COLORS[f];
        g.fillStyle = bg; g.fillRect(0, 0, 256, 256);
        if (bomb) { g.font = '120px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('💣', 128, 136); }
        else if (f === 6) {
          // the square face spans the whole picture
          for (const [x, y] of PIPS[n]) {
            const gr = g.createRadialGradient(x * 2.56 - 4, y * 2.56 - 4, 2, x * 2.56, y * 2.56, 22);
            gr.addColorStop(0, n === 1 ? '#e8454a' : '#3a3a42'); gr.addColorStop(1, n === 1 ? '#a3161c' : '#0e0e12');
            g.fillStyle = gr; g.beginPath(); g.arc(x * 2.56, y * 2.56, 21, 0, 7); g.fill();
          }
        } else {
          g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.font = `800 ${f === 8 ? 78 : 62}px "Geist Variable", system-ui, sans-serif`;
          const y = f === 8 ? 128 : 150;
          g.fillText(String(n), 128, y);
          if (n === 6 || n === 9) g.fillRect(100, y + 34, 56, 7);
        }
        const t = new THREE.CanvasTexture(cv);
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
        texCache.set(id, t);
        return t;
      }
      type D = { mesh: THREE.Mesh; mats: THREE.MeshPhysicalMaterial[] };
      let dice: D[] = [], geo: THREE.BufferGeometry | null = null, geoFor = 0;
      const sparks: { m: THREE.Mesh; v: THREE.Vector3; t: number }[] = [];
      const sparkGeo = new THREE.SphereGeometry(0.12, 8, 8);
      let booms: { d: D; t: number }[] = [];
      const flash = new THREE.PointLight(0xff9a3a, 0, 12);
      scene.add(flash);
      function build(n: number) {
        if (geoFor !== S.f) { geo?.dispose(); geo = geometry(S); geoFor = S.f; }
        for (const d of dice) { scene.remove(d.mesh); d.mats.forEach((m) => m.dispose()); }
        dice = Array.from({ length: n }, () => {
          const [bg] = COLORS[S.f];
          const mats = [...S.faces.map(() => new THREE.MeshPhysicalMaterial({ roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 })), new THREE.MeshPhysicalMaterial({ color: bg, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 })];
          const mesh = new THREE.Mesh(geo!, mats);
          mesh.castShadow = true;
          scene.add(mesh);
          return { mesh, mats };
        });
      }
      const m4 = new THREE.Matrix4();
      api = {
        show(list, boom) {
          if (dice.length !== list.length || geoFor !== S.f) build(list.length);
          booms = [];
          list.forEach((t, i) => {
            const d = dice[i];
            d.mesh.visible = true; d.mesh.scale.setScalar(1);
            d.mats.forEach((m) => { m.opacity = 1; m.transparent = false; });
            S.faces.forEach((_, fi) => { d.mats[fi].map = faceTex(S.f, t.nums[fi], mines > 0 && t.nums[fi] > 6 - mines); d.mats[fi].needsUpdate = true; });
            api!.frame(i, t.frames[0]);
            if (boom?.[i]) booms.push({ d, t: 0 });
          });
          for (const b of booms) {
            for (let k = 0; k < 26; k++) {
              const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: k % 3 ? 0xffa53a : 0x666670, transparent: true }));
              m.position.copy(b.d.mesh.position);
              scene.add(m);
              sparks.push({ m, v: new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.3, Math.random() - 0.5).normalize().multiplyScalar(5 + Math.random() * 5), t: 0 });
            }
            flash.position.copy(b.d.mesh.position).add(new THREE.Vector3(0, 1, 0)); flash.intensity = 60;
          }
        },
        frame(i, fr) {
          const d = dice[i]; if (!d) return;
          const R: M = fr.R; // CSS frame -> three: flip y on both sides
          m4.set(R[0], -R[1], R[2], fr.p[0] * K, -R[3], R[4], -R[5], -fr.p[1] * K, R[6], -R[7], R[8], fr.p[2] * K, 0, 0, 0, 1);
          d.mesh.matrixAutoUpdate = false;
          d.mesh.matrix.copy(m4);
        },
      };
      let last = performance.now();
      const loop = (now: number) => {
        if (!alive) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        for (const b of booms) {
          b.t += dt;
          const k = Math.min(1, b.t / 0.35);
          b.d.mats.forEach((m) => { m.transparent = true; m.opacity = 1 - k; });
          b.d.mesh.matrix.multiply(new THREE.Matrix4().makeScale(1 + dt * 2, 1 + dt * 2, 1 + dt * 2));
          if (k >= 1) b.d.mesh.visible = false;
        }
        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i]; s.t += dt; s.v.y -= 14 * dt; s.m.position.addScaledVector(s.v, dt);
          (s.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - s.t);
          if (s.t > 1) { scene.remove(s.m); (s.m.material as THREE.Material).dispose(); sparks.splice(i, 1); }
        }
        flash.intensity = Math.max(0, flash.intensity - dt * 200);
        renderer.render(scene, camera);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      api.show(state);
      dispose = () => { ro.disconnect(); geo?.dispose(); sparkGeo.dispose(); texCache.forEach((t) => t.dispose()); tex.dispose(); renderer.dispose(); };
    } catch {
      onfail?.();
    }
  });
  onDestroy(() => { alive = false; cancelAnimationFrame(raf); cancelAnimationFrame(anim); dispose(); });

  // a new kind or number of dice: show them resting straight away
  $effect(() => {
    const n = values.length, f = faces;
    void mines; // bomb faces change the pictures
    untrack(() => {
      if (anim) return; // a throw is running; it shows its own dice
      S = solid(f, SIZE);
      state = values.slice(0, n).map((v, i) => resting(S, spread(i, n, SIZE), v));
      api?.show(state);
    });
  });
  // only a new roll throws
  $effect(() => { if (rolls) untrack(throwDice); });
  function throwDice() {
    const vals = values, n = vals.length, safe = 6 - mines;
    S = solid(faces, SIZE);
    state = vals.map((v, i) => simulate(S, SIZE, v, spread(i, n, SIZE), n === 1 ? 0 : (i / (n - 1)) * 2 - 1));
    api?.show(state);
    const land = () => {
      anim = 0;
      state = state.map((t) => ({ frames: [t.frames[t.frames.length - 1]], nums: t.nums }));
      if (safe < 6) api?.show(state, vals.map((v) => v > safe));
      ondone?.();
    };
    cancelAnimationFrame(anim);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !api) { state.forEach((t, i) => api?.frame(i, t.frames[t.frames.length - 1])); land(); return; }
    const t0 = performance.now();
    const tick = (now: number) => {
      let running = false;
      state.forEach((t, i) => {
        const f = Math.floor(((now - t0 - i * 70) / 1000) * 60);
        if (f < t.frames.length - 1) running = true;
        api!.frame(i, t.frames[Math.max(0, Math.min(t.frames.length - 1, f))]);
      });
      if (running) anim = requestAnimationFrame(tick);
      else land();
    };
    anim = requestAnimationFrame(tick);
  }
</script>

<div class="gl" bind:this={host}></div>

<style>
  .gl { position: absolute; inset: 0; }
  .gl :global(canvas) { display: block; width: 100% !important; height: 100% !important; }
</style>
