<script lang="ts">
  // The Betly gold coin as a real 3D model (three.js + the GLB from the design files).
  // Same choreography as before: tossed high, spinning slower and slower, lands on its edge, teeters with a
  // fake-out and only then falls flat. three.js is loaded only on this page.
  import { onDestroy, onMount, untrack } from 'svelte';
  import coinUrl from '../assets/betly_coin_gold.glb?url';
  import { sfx } from '../lib/sfx';
  import { coinFace, tableTop } from '../lib/coinface';

  let { face, tosses, size = 180, ondone, onphase, onfail }: {
    face: 'heads' | 'tails'; tosses: number; size?: number; ondone?: () => void; onphase?: (p: 'air' | 'edge' | 'fall' | 'rest') => void; onfail?: () => void;
  } = $props();

  let host: HTMLDivElement;
  let theta = 0; // flip angle around the coin's X axis: 0 = heads up, PI = tails up
  let lift = 0; // height above the table in coin radii
  const BASE_SPIN = Math.PI / 2; // the face text reads upright at this turn
  let spin = BASE_SPIN;
  let anim = 0, raf = 0, alive = true;
  let render: (() => void) | null = null;
  let dispose = () => {};
  const R = 2.6, T = 0.17; // coin radius and half thickness in model units
  const FACE_ROT = 0; // turns the face designs so they read upright

  onMount(async () => {
    try {
      const THREE = await import('three');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      if (!alive) return;
      // the 3D view fills its box (the whole game stage) and follows its size
      let w = Math.max(200, host.clientWidth), h = Math.max(200, host.clientHeight);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
      renderer.setSize(w, h);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.25;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0e0c12);
      scene.fog = new THREE.Fog(0x0e0c12, 24, 46);
      const camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 100);
      const ro = new ResizeObserver(() => {
        if (!host || !alive) return;
        w = Math.max(200, host.clientWidth); h = Math.max(200, host.clientHeight);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        // narrow screens: step back so the coin and its toss stay in view
        const k = 1.35 * Math.max(1, 1.1 / camera.aspect);
        camera.position.set(0, 14 * k, 17 * k);
        camera.lookAt(0, 2.2, 0);
        camera.updateProjectionMatrix();
      });
      ro.observe(host);
      camera.position.set(0, 19, 23);
      camera.lookAt(0, 2.2, 0);
      // a warm key light with soft shadows, a cool rim and a little ambient fill
      scene.add(new THREE.HemisphereLight(0xfff1d6, 0x1a1830, 1.1));
      const key = new THREE.DirectionalLight(0xffffff, 3.2);
      key.position.set(-6, 14, 8);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
      key.shadow.radius = 6;
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x9db8ff, 1.2);
      rim.position.set(8, 6, -10);
      scene.add(rim);
      // shiny metal needs something to reflect: a simple gradient environment
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0x8a8296);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 16), new THREE.MeshBasicMaterial({ color: 0xfff3d0 }));
      glow.position.set(-6, 10, 8);
      envScene.add(glow);
      scene.environment = pmrem.fromScene(envScene, 0.04).texture;

      // the coin lands on a felt mat on a wooden table
      const tableTex = new THREE.CanvasTexture(tableTop());
      tableTex.colorSpace = THREE.SRGBColorSpace;
      tableTex.anisotropy = 8;
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), new THREE.MeshStandardMaterial({ map: tableTex, roughness: 0.85, metalness: 0 }));
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);
      const lamp = new THREE.SpotLight(0xffe2b0, 60, 40, 0.55, 0.6, 1.4);
      lamp.position.set(0, 16, 2);
      lamp.target.position.set(0, 0, 0);
      scene.add(lamp, lamp.target);

      const gltf = await new GLTFLoader().loadAsync(coinUrl);
      if (!alive) return renderer.dispose();
      const model = gltf.scene.getObjectByName('Betly_3D_Coin') ?? gltf.scene;
      model.matrix.identity();
      model.matrixAutoUpdate = true;
      model.position.set(0, 0, 0);
      model.rotation.set(0, 0, 0);
      model.scale.set(1, 1, 1);
      let faceMat = 0;
      model.traverse((o: any) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        // the face textures come mirrored from the exporter: flip them so HEADS / TAILS read correctly
        // the faces get the Betly designs: a struck crown for heads and a star for tails
        const m = o.material;
        if (m?.map) {
          const old = m.map, t = new THREE.CanvasTexture(coinFace(faceMat++ === 0 ? 'heads' : 'tails'));
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = 8;
          t.center.set(0.5, 0.5);
          t.rotation = FACE_ROT;
          m.map = t;
          m.roughness = 0.28;
          m.metalness = 0.85;
          old.dispose();
          m.needsUpdate = true;
        } else if (m) { m.color?.set?.(0xf0b94a); m.roughness = 0.3; }
      });
      const coin = new THREE.Group();
      coin.add(model);
      scene.add(coin);

      render = () => {
        coin.rotation.set(0, 0, 0);
        coin.rotateY(spin);
        coin.rotateX(theta);
        // resting height: on its face T, on its edge R, plus the toss height
        coin.position.y = Math.abs(Math.sin(theta)) * R + Math.abs(Math.cos(theta)) * T + lift * R;
        renderer.render(scene, camera);
      };
      const loop = () => { if (!alive) return; render?.(); raf = requestAnimationFrame(loop); };
      loop();
      dispose = () => { ro.disconnect(); renderer.dispose(); pmrem.dispose(); };
    } catch {
      onfail?.();
    }
  });
  onDestroy(() => { alive = false; cancelAnimationFrame(raf); cancelAnimationFrame(anim); dispose(); });

  if (import.meta.env.DEV) (window as any).__coin = (th: number, sp?: number) => { theta = th; if (sp !== undefined) spin = sp; };
  const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
  $effect(() => {
    if (!tosses) return;
    const target = face;
    cancelAnimationFrame(anim);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = untrack(() => theta);
    const TAU = Math.PI * 2;
    const base = Math.ceil((start + 0.01) / TAU) * TAU + TAU * (5 + Math.floor(Math.random() * 2));
    const end = base + (target === 'tails' ? Math.PI : 0);
    if (reduce) { theta = end; lift = 0; spin = BASE_SPIN + (target === 'tails' ? Math.PI : 0); untrack(() => { onphase?.('rest'); ondone?.(); }); return; }
    const edge = end - Math.PI / 2;
    const s = Math.random() < 0.5 ? 1 : -1, d = Math.PI / 180;
    // teetering on the rim: lean one way, then the other, smaller each time
    const teeter: [number, number][] = [[0, edge], [0.55, edge - 30 * d * s], [1.15, edge + 26 * d * s], [1.55, edge - 12 * d * s], [1.8, edge + 4 * d * s]];
    const AIR = 1.7, EDGE = 1.8, FALL = 0.42, SETTLE = 0.6;
    // only now and then does the coin end up on its edge; usually it lands, bounces once and settles
    const edgy = Math.random() < 0.3;
    const over = (18 + Math.random() * 14) * d * (Math.random() < 0.5 ? 1 : -1);
    const LAND = 1.45, BOUNCE = 0.34;
    // tails is printed the other way round on the model, so the coin turns to read upright either way
    const spinFrom = untrack(() => spin), spinTo = BASE_SPIN + (target === 'tails' ? Math.PI : 0);
    const t0 = performance.now();
    let step = 0, tick = -1;
    untrack(() => onphase?.('air'));
    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      if (!edgy) {
        if (t < LAND) {
          const u = t / LAND;
          lift = 0.8 * 4 * u * (1 - u);
          theta = start + (end + over - start) * (1 - Math.pow(1 - u, 1.8));
          spin = spinFrom + (spinTo - spinFrom) * (1 - Math.pow(1 - u, 2)) + Math.sin(u * Math.PI) * 0.5;
        } else if (t < LAND + BOUNCE) {
          if (step === 0) { step = 1; sfx('bounce'); onphase?.('fall'); }
          const v = (t - LAND) / BOUNCE;
          lift = 0.12 * 4 * v * (1 - v);
          theta = end + over * Math.cos(v * Math.PI * 0.9);
          spin = spinTo;
        } else if (t < LAND + BOUNCE + SETTLE) {
          if (step === 1) { step = 2; sfx('click'); }
          const w = (t - LAND - BOUNCE) / SETTLE;
          lift = 0;
          theta = end + over * -0.3 * Math.exp(-5 * w) * Math.cos(w * 16);
        } else {
          theta = end; lift = 0; spin = spinTo;
          onphase?.('rest');
          ondone?.();
          return;
        }
        anim = requestAnimationFrame(frame);
        return;
      }
      if (t < AIR) {
        const u = t / AIR;
        lift = 0.8 * 4 * u * (1 - u);
        theta = start + (edge - start) * (1 - Math.pow(1 - u, 2.2));
        spin = spinFrom + (spinTo - spinFrom) * (1 - Math.pow(1 - u, 2)) + Math.sin(u * Math.PI) * 0.5;
      } else if (t < AIR + EDGE) {
        if (step === 0) { step = 1; sfx('bounce'); onphase?.('edge'); }
        lift = 0;
        const v = t - AIR;
        let i = 0;
        while (i < teeter.length - 2 && v > teeter[i + 1][0]) i++;
        const [ta, a] = teeter[i], [tb, b] = teeter[i + 1];
        theta = a + (b - a) * ease(Math.min(1, (v - ta) / (tb - ta)));
        spin = spinTo + Math.sin(v * 2.4) * 0.06 * (1 - v / EDGE);
        if (i !== tick) { tick = i; sfx('tick'); }
      } else if (t < AIR + EDGE + FALL) {
        if (step === 1) { step = 2; onphase?.('fall'); }
        const w = (t - AIR - EDGE) / FALL, from = teeter[teeter.length - 1][1];
        theta = from + (end - from) * w * w;
      } else if (t < AIR + EDGE + FALL + SETTLE) {
        if (step === 2) { step = 3; sfx('click'); sfx('bounce'); }
        const w = (t - AIR - EDGE - FALL) / SETTLE;
        lift = 0.05 * Math.max(0, Math.sin(w * Math.PI * 2)) * (1 - w);
        theta = end + 7 * d * Math.exp(-5 * w) * Math.sin(w * 18);
      } else {
        theta = end;
        lift = 0;
        spin = spinTo;
        onphase?.('rest');
        ondone?.();
        return;
      }
      anim = requestAnimationFrame(frame);
    };
    anim = requestAnimationFrame(frame);
  });
</script>

<div class="gl" bind:this={host} aria-hidden="true"></div>

<style>
  .gl { position: absolute; inset: 0; }
  .gl :global(canvas) { display: block; width: 100% !important; height: 100% !important; }
</style>
