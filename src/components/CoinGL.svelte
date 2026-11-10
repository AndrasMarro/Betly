<script lang="ts">
  // The Betly gold coin as a real 3D model (three.js + the GLB from the design files).
  // Same choreography as before: tossed high, spinning slower and slower, lands on its edge, teeters with a
  // fake-out and only then falls flat. three.js is loaded only on this page.
  import { onDestroy, onMount, untrack } from 'svelte';
  import coinUrl from '../assets/betly_coin_gold.glb?url';
  import { sfx } from '../lib/sfx';

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

  onMount(async () => {
    try {
      const THREE = await import('three');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      if (!alive) return;
      const w = Math.round(size * 2.6), h = Math.round(size * 2.2);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
      renderer.setSize(w, h);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.25;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 100);
      camera.position.set(0, 14, 17);
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

      const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.45 }));
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      const gltf = await new GLTFLoader().loadAsync(coinUrl);
      if (!alive) return renderer.dispose();
      const model = gltf.scene.getObjectByName('Betly_3D_Coin') ?? gltf.scene;
      model.matrix.identity();
      model.matrixAutoUpdate = true;
      model.position.set(0, 0, 0);
      model.rotation.set(0, 0, 0);
      model.scale.set(1, 1, 1);
      model.traverse((o: any) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        // the face textures come mirrored from the exporter: flip them so HEADS / TAILS read correctly
        const m = o.material;
        if (m?.map) { m.map.flipY = !m.map.flipY; m.map.needsUpdate = true; }
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
      dispose = () => { renderer.dispose(); pmrem.dispose(); };
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
    // tails is printed the other way round on the model, so the coin turns to read upright either way
    const spinFrom = untrack(() => spin), spinTo = BASE_SPIN + (target === 'tails' ? Math.PI : 0);
    const t0 = performance.now();
    let step = 0, tick = -1;
    untrack(() => onphase?.('air'));
    const frame = (now: number) => {
      const t = (now - t0) / 1000;
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

<div class="gl" bind:this={host} style="--s:{size}px" aria-hidden="true"></div>

<style>
  .gl { width: calc(var(--s) * 2.6); height: calc(var(--s) * 2.2); display: grid; place-items: center; }
  .gl :global(canvas) { display: block; max-width: 100%; height: auto !important; }
</style>
