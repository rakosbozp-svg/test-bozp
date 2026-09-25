/* SAFETY RUN – endless runner v průmyslovém areálu (Three.js, bez buildu) */
(() => {
  'use strict';

  // ---------------------------------------------------------------- konstanty
  const LANES = [-2.2, 0, 2.2];
  const SPAWN_Z = -125;
  const DESPAWN_Z = 14;
  const GRAV = 30;
  const JUMP_V = 10.5;        // výška skoku ≈ 1.8
  const JUMP_V_BOOTS = 14.5;  // výška skoku ≈ 3.5
  const SLIDE_TIME = 0.75;
  const PU_TIME = 10;
  const START_SPEED = 14;
  const MAX_SPEED = 42;
  const IS_TOUCH = matchMedia('(pointer: coarse)').matches;

  // ---------------------------------------------------------------- renderer
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const FOG_COLOR = 0xdde8ea;
  scene.fog = new THREE.Fog(FOG_COLOR, 45, 120);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);

  // ---------------------------------------------------------------- textury
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  function canvasTex(w, h, draw, rx = 1, ry = 1) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.anisotropy = maxAniso;
    return t;
  }
  function speckle(g, w, h, n, alpha) {
    for (let i = 0; i < n; i++) {
      const l = Math.random() < 0.5 ? 0 : 255;
      g.fillStyle = `rgba(${l},${l},${l},${Math.random() * alpha})`;
      const s = 1 + Math.random() * 2.5;
      g.fillRect(Math.random() * w, Math.random() * h, s, s);
    }
  }

  const skyTex = canvasTex(2, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#5fa8de');
    gr.addColorStop(0.55, '#a9d3ec');
    gr.addColorStop(1, '#e6eeec');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  skyTex.wrapS = skyTex.wrapT = THREE.ClampToEdgeWrapping;
  scene.background = skyTex;

  // jízdní dráha: 7.6 široká, jedna textura = 10 m
  const TRACK_W = 7.6, TRACK_L = 260, TRACK_REP = 10;
  const trackTex = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#5b6068'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 5000, 0.18);
    const u = x => (x + TRACK_W / 2) / TRACK_W * w;
    // stopy v pruzích
    g.fillStyle = 'rgba(0,0,0,0.08)';
    LANES.forEach(l => { g.fillRect(u(l) - 22, 0, 12, h); g.fillRect(u(l) + 10, 0, 12, h); });
    // krajní žluté čáry
    g.fillStyle = '#f2c41a';
    g.fillRect(u(-3.5) - 4, 0, 8, h); g.fillRect(u(3.5) - 4, 0, 8, h);
    // přerušované dělicí čáry
    g.fillStyle = '#f4f1e8';
    [-1.1, 1.1].forEach(x => g.fillRect(u(x) - 3, 0, 6, h * 0.5));
  }, 1, TRACK_L / TRACK_REP);

  const YARD_TILE = 5;
  const yardTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#bdb7ab'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 4000, 0.16);
    g.fillStyle = 'rgba(90,80,70,0.10)';
    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 10 + Math.random() * 30, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(60,55,50,0.55)';
    g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);
  }, 40 / YARD_TILE, TRACK_L / YARD_TILE);

  const concreteTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#c9c4b9'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 1600, 0.2);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 18; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 0, 7); g.fill(); }
  });

  const hazardTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#16181b'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffc410';
    for (let i = -2; i < 4; i++) {
      g.beginPath();
      g.moveTo(i * 64, h); g.lineTo(i * 64 + 32, h); g.lineTo(i * 64 + 32 + h, 0); g.lineTo(i * 64 + h, 0);
      g.closePath(); g.fill();
    }
  });

  const RAIL_REP = 2; // 2 m na jednu opakovanou část zábradlí
  const railTex = canvasTex(256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#f5c21b';
    g.fillRect(0, 0, 14, h);           // sloupek
    g.fillRect(0, 6, w, 12);           // horní madlo
    g.fillRect(0, 60, w, 9);           // střední tyč
    g.fillStyle = '#e0a800';
    g.fillRect(0, 16, w, 3);
  }, TRACK_L / RAIL_REP, 1);

  const hallTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) {
      g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(x, 0, 3, h);
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x + 4, 0, 1, h);
    }
  }, 6, 1);

  const pitTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#7a5a3c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 12; i++) {
      const k = i / 12;
      const c = Math.floor(110 - k * 105);
      g.fillStyle = `rgb(${c},${Math.floor(c * 0.72)},${Math.floor(c * 0.5)})`;
      const p = i * 5;
      g.fillRect(p, p, w - p * 2, h - p * 2);
    }
    speckle(g, w, h, 400, 0.25);
  });

  function textTex(lines, bg, fg, stripes) {
    return canvasTex(512, 128, (g, w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      if (stripes) {
        g.fillStyle = '#16181b';
        for (let x = -h; x < w; x += 40) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 20, h); g.lineTo(x + 20 + 16, h - 16); g.lineTo(x + 16, h - 16); g.fill(); }
        for (let x = -h; x < w; x += 40) { g.beginPath(); g.moveTo(x, 16); g.lineTo(x + 20, 16); g.lineTo(x + 36, 0); g.lineTo(x + 16, 0); g.fill(); }
      }
      g.fillStyle = fg;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const fs = lines.length > 1 ? 38 : 50;
      g.font = `900 ${fs}px "Arial Black", Impact, sans-serif`;
      lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * (fs + 4)));
    });
  }
  const signTex = {
    lowPass: textTex(['POZOR – NÍZKÝ PRŮJEZD'], '#ffc410', '#16181b', true),
    oopp: textTex(['POUŽÍVEJ', 'OOPP'], '#1f8f4e', '#ffffff'),
    vzv: textTex(['POZOR', 'PROVOZ VZV'], '#ffc410', '#16181b'),
    safety: textTex(['BEZPEČNOST', 'NA 1. MÍSTĚ'], '#1d5fb8', '#ffffff'),
    hall: textTex(['PREFABRIKACE'], '#ffffff', '#1d2a3a'),
    hall2: textTex(['VÝROBA DÍLCŮ'], '#ffffff', '#1d2a3a'),
  };

  const glowTex = canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.4, 'rgba(255,255,255,0.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  glowTex.wrapS = glowTex.wrapT = THREE.ClampToEdgeWrapping;

  // ---------------------------------------------------------------- materiály a geometrie (cache)
  const matCache = new Map();
  function M(color, o = {}) {
    const key = color + JSON.stringify(o, (k, v) => (v && v.isTexture ? v.uuid : v));
    if (matCache.has(key)) return matCache.get(key);
    const m = new THREE.MeshStandardMaterial({
      color, roughness: o.r ?? 0.75, metalness: o.m ?? 0,
      emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1,
      map: o.map || null, transparent: !!o.t, opacity: o.op ?? 1,
      side: o.side ?? THREE.FrontSide, alphaTest: o.at ?? 0, depthWrite: o.dw ?? true,
    });
    matCache.set(key, m);
    return m;
  }
  const geoCache = new Map();
  function G(key, fn) { if (!geoCache.has(key)) geoCache.set(key, fn()); return geoCache.get(key); }
  const gBox = () => G('box', () => new THREE.BoxGeometry(1, 1, 1));
  const gSph = () => G('sph', () => new THREE.SphereGeometry(1, 20, 14));
  const gCyl = (seg = 18) => G('cyl' + seg, () => new THREE.CylinderGeometry(1, 1, 1, seg));
  const gCone = () => G('cone', () => new THREE.ConeGeometry(1, 1, 16));

  function mesh(geo, mat, s, p, shadow = true) {
    const o = new THREE.Mesh(geo, mat);
    if (s) o.scale.set(s[0], s[1], s[2]);
    if (p) o.position.set(p[0], p[1], p[2]);
    o.castShadow = shadow;
    o.receiveShadow = true;
    return o;
  }
  const box = (w, h, d, m, x = 0, y = 0, z = 0, sh = true) => mesh(gBox(), m, [w, h, d], [x, y, z], sh);
  const cyl = (r, h, m, x = 0, y = 0, z = 0, sh = true) => mesh(gCyl(), m, [r, h, r], [x, y, z], sh);

  // přilba (lathe = 1 draw call)
  const helmetGeo = G('helmet', () => {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI / 2;
      pts.push(new THREE.Vector2(Math.sin(a) * 0.26 + 0.001, 0.04 + Math.cos(a) * 0.26));
    }
    pts.push(new THREE.Vector2(0.37, 0.03), new THREE.Vector2(0.37, -0.01), new THREE.Vector2(0.24, -0.01), new THREE.Vector2(0.001, -0.01));
    return new THREE.LatheGeometry(pts, 20);
  });

  // barvy
  const C = {
    fur: M(0xd8914f, { r: 0.85 }),
    cream: M(0xf7e1c4, { r: 0.85 }),
    pink: M(0xf4a3a0, { r: 0.8 }),
    dark: M(0x24160f, { r: 0.4 }),
    white: M(0xffffff, { r: 0.3 }),
    vest: M(0xcdf51a, { r: 0.6, e: 0x2f3d00, side: THREE.DoubleSide }),
    refl: M(0xe3e8ec, { r: 0.25, m: 0.4, e: 0x505050 }),
    hat: M(0xffc410, { r: 0.3, e: 0x2a1c00 }),
    hatPickup: M(0xffc410, { r: 0.28, e: 0x5a3c00 }),
    orange: M(0xff6a13, { r: 0.55 }),
    wood: M(0xc49358, { r: 0.9 }),
    woodDark: M(0x9a6f3c, { r: 0.9 }),
    concrete: M(0xffffff, { map: concreteTex, r: 0.95 }),
    concreteDark: M(0x9e9a92, { map: concreteTex, r: 0.95 }),
    steel: M(0x5c6a78, { r: 0.45, m: 0.6 }),
    steelDark: M(0x2c333b, { r: 0.5, m: 0.5 }),
    rubber: M(0x1b1d20, { r: 0.9 }),
    hazard: M(0xffffff, { map: hazardTex, r: 0.6 }),
    fork: M(0xf2a900, { r: 0.5 }),
    forkRed: M(0xd9432b, { r: 0.5 }),
    beacon: M(0xff8a00, { e: 0xff6a00, ei: 1.5 }),
    lampOn: M(0xfffbe8, { e: 0xfff1c4, ei: 1.2 }),
    glass: M(0x9fd6f0, { r: 0.1, m: 0.2, e: 0x1a3b4c }),
    blue: M(0x2f6fd0, { r: 0.5 }),
    red: M(0xd23a2a, { r: 0.5 }),
    silver: M(0xd6dadf, { r: 0.35, m: 0.7 }),
    brown: M(0x6b4424, { r: 0.8 }),
    lens: M(0x49c6ff, { r: 0.1, e: 0x0b4a70, t: true, op: 0.85 }),
    moldBlue: M(0x2c62b5, { r: 0.55, m: 0.3 }),
  };

  // ---------------------------------------------------------------- světla
  const hemi = new THREE.HemisphereLight(0xe4f3ff, 0x8a7a66, 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(IS_TOUCH ? 1024 : 2048, IS_TOUCH ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);

  // ---------------------------------------------------------------- statická scéna
  const trackMesh = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_W, TRACK_L), M(0xffffff, { map: trackTex, r: 0.9 }));
  trackMesh.rotation.x = -Math.PI / 2;
  trackMesh.position.set(0, 0, 20 - TRACK_L / 2);
  trackMesh.receiveShadow = true;
  scene.add(trackMesh);

  const yardMat = M(0xffffff, { map: yardTex, r: 0.95 });
  [-1, 1].forEach(side => {
    const y = new THREE.Mesh(new THREE.PlaneGeometry(40, TRACK_L), yardMat);
    y.rotation.x = -Math.PI / 2;
    y.position.set(side * (TRACK_W / 2 + 20), -0.01, 20 - TRACK_L / 2);
    y.receiveShadow = true;
    scene.add(y);
    const curb = box(0.3, 0.16, TRACK_L, C.concrete, side * (TRACK_W / 2 + 0.1), 0.08, 20 - TRACK_L / 2, false);
    scene.add(curb);
    const rail = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_L, 1.15), M(0xffffff, { map: railTex, at: 0.5, side: THREE.DoubleSide, r: 0.5 }));
    rail.rotation.y = Math.PI / 2;
    rail.position.set(side * (TRACK_W / 2 + 0.55), 0.58, 20 - TRACK_L / 2);
    scene.add(rail);
  });

  // ---------------------------------------------------------------- postava: čivava
  function buildDog() {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    body.add(mesh(gSph(), C.fur, [0.3, 0.28, 0.42], [0, 0.56, 0]));
    body.add(mesh(gSph(), C.cream, [0.2, 0.2, 0.18], [0, 0.5, -0.3]));

    // reflexní vesta
    const vg = G('vestCyl', () => new THREE.CylinderGeometry(1, 1, 1, 24, 1, true));
    const vest = mesh(vg, C.vest, [0.318, 0.5, 0.298], [0, 0.57, -0.02]);
    vest.rotation.x = Math.PI / 2;
    body.add(vest);
    [-0.13, 0.1].forEach(z => {
      const s = mesh(vg, C.refl, [0.324, 0.06, 0.304], [0, 0.57, z]);
      s.rotation.x = Math.PI / 2;
      body.add(s);
    });
    // X pásy na zádech
    [-0.5, 0.5].forEach(a => {
      const s = box(0.07, 0.02, 0.44, C.refl, 0, 0.865, -0.02);
      s.rotation.y = a;
      body.add(s);
    });

    // hlava
    const head = new THREE.Group();
    head.position.set(0, 0.96, -0.36);
    body.add(head);
    head.add(mesh(gSph(), C.fur, [0.27, 0.25, 0.25], [0, 0, 0]));
    head.add(mesh(gSph(), C.cream, [0.18, 0.15, 0.14], [0, -0.06, -0.14]));
    head.add(mesh(gSph(), C.cream, [0.11, 0.09, 0.13], [0, -0.07, -0.25]));
    head.add(mesh(gSph(), C.dark, [0.05, 0.04, 0.04], [0, -0.03, -0.37]));
    [-1, 1].forEach(s => {
      head.add(mesh(gSph(), C.white, [0.075, 0.075, 0.06], [s * 0.11, 0.03, -0.19]));
      head.add(mesh(gSph(), C.dark, [0.045, 0.045, 0.03], [s * 0.115, 0.03, -0.24]));
      const ear = new THREE.Group();
      ear.position.set(s * 0.22, 0.14, 0.02);
      ear.rotation.z = -s * 0.75;
      ear.add(mesh(gCone(), C.fur, [0.15, 0.46, 0.06], [0, 0.23, 0]));
      ear.add(mesh(gCone(), C.pink, [0.1, 0.35, 0.03], [0, 0.2, -0.03]));
      head.add(ear);
    });
    const hat = mesh(helmetGeo, C.hat, [1.1, 1.05, 1.1], [0, 0.07, 0.01]);
    hat.rotation.x = -0.08;
    head.add(hat);
    head.add(box(0.05, 0.05, 0.34, C.hat, 0, 0.39, 0.01));
    // podbradní pásek
    const strap = mesh(G('torus', () => new THREE.TorusGeometry(1, 0.08, 6, 20)), C.rubber, [0.25, 0.25, 0.25], [0, -0.04, -0.02], false);
    strap.rotation.y = Math.PI / 2;
    head.add(strap);

    // nohy
    const legs = [];
    [[-0.15, -0.22], [0.15, -0.22], [-0.15, 0.24], [0.15, 0.24]].forEach(([x, z]) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.45, z);
      pivot.add(mesh(gCyl(10), C.fur, [0.075, 0.4, 0.075], [0, -0.2, 0]));
      pivot.add(mesh(gSph(), C.cream, [0.085, 0.06, 0.11], [0, -0.41, -0.03]));
      body.add(pivot);
      legs.push(pivot);
    });

    // ocas
    const tail = new THREE.Group();
    tail.position.set(0, 0.68, 0.38);
    tail.rotation.x = 0.9;
    tail.add(mesh(gCone(), C.fur, [0.07, 0.36, 0.07], [0, 0.16, 0]));
    tail.add(mesh(gSph(), C.cream, [0.055, 0.07, 0.055], [0, 0.33, 0]));
    body.add(tail);

    // štít
    const bubble = new THREE.Mesh(gSph(), M(0x9cf6ff, { t: true, op: 0.22, e: 0x2fd0ff, ei: 0.8, dw: false }));
    bubble.scale.set(0.85, 0.9, 1.0);
    bubble.position.y = 0.7;
    bubble.visible = false;
    root.add(bubble);

    return { root, body, head, legs, tail, bubble };
  }
  const dog = buildDog();
  scene.add(dog.root);

  // ---------------------------------------------------------------- překážky
  const builders = {
    cone() {
      const g = new THREE.Group();
      [-0.45, 0.45].forEach(x => {
        g.add(box(0.5, 0.05, 0.5, C.rubber, x, 0.025, 0));
        g.add(mesh(gCone(), C.orange, [0.24, 0.75, 0.24], [x, 0.42, 0]));
        g.add(mesh(G('coneBand', () => new THREE.CylinderGeometry(0.1, 0.14, 0.13, 16)), C.refl, null, [x, 0.46, 0]));
      });
      g.add(box(0.95, 0.09, 0.07, C.hazard, 0, 0.66, 0));
      return { g, boxes: [{ hx: 0.75, hz: 0.3, y0: 0, y1: 0.78 }] };
    },
    pallet() {
      const g = new THREE.Group();
      const layer = (y) => {
        g.add(box(1.5, 0.05, 1.1, C.wood, 0, y + 0.145, 0));
        [-0.45, 0, 0.45].forEach(z => g.add(box(1.5, 0.12, 0.14, C.woodDark, 0, y + 0.06, z)));
      };
      if (Math.random() < 0.5) {
        for (let i = 0; i < 4; i++) layer(i * 0.19);
      } else {
        layer(0);
        g.add(box(1.36, 0.56, 1.0, C.concrete, 0, 0.45, 0));
        g.add(box(1.38, 0.57, 0.06, C.blue, 0, 0.45, 0.2));
        g.add(box(1.38, 0.57, 0.06, C.blue, 0, 0.45, -0.2));
      }
      return { g, boxes: [{ hx: 0.78, hz: 0.58, y0: 0, y1: 0.8 }] };
    },
    block() {
      const g = new THREE.Group();
      for (let i = 0; i < 2; i++) {
        g.add(box(1.75, 1.05, 1.3, i ? C.concrete : C.concreteDark, 0, 0.525 + i * 1.07, 0));
      }
      [-0.45, 0.45].forEach(x => [-0.3, 0.3].forEach(z => g.add(mesh(gCyl(), C.concrete, [0.16, 0.14, 0.16], [x, 2.2, z]))));
      g.add(box(1.77, 0.28, 0.02, C.hazard, 0, 0.3, 0.66, false));
      return { g, boxes: [{ hx: 0.9, hz: 0.68, y0: 0, y1: 2.3 }] };
    },
    forklift() {
      const g = buildForklift(C.fork);
      return { g, boxes: [{ hx: 0.78, hz: 1.5, y0: 0, y1: 2.3 }], vz: 5.5 };
    },
    pipe() { return buildPipe(false); },
    pipeWide() { return buildPipe(true); },
    pit() {
      const g = new THREE.Group();
      const hole = new THREE.Mesh(G('pitPlane', () => new THREE.PlaneGeometry(1.8, 2.5)), M(0xffffff, { map: pitTex, r: 1 }));
      hole.rotation.x = -Math.PI / 2;
      hole.position.y = 0.012;
      g.add(hole);
      // hrany z hlíny
      g.add(box(1.9, 0.06, 0.12, C.brown, 0, 0.03, -1.28, false));
      g.add(box(1.9, 0.06, 0.12, C.brown, 0, 0.03, 1.28, false));
      // výstražné sloupky
      [[-0.95, -1.3], [0.95, -1.3], [-0.95, 1.3], [0.95, 1.3]].forEach(([x, z]) => {
        g.add(box(0.1, 0.7, 0.1, C.hazard, x, 0.35, z));
      });
      // hromada hlíny vzadu
      g.add(mesh(gSph(), C.brown, [0.7, 0.3, 0.45], [0, 0, -1.7]));
      return { g, boxes: [], pit: { hx: 0.8, hz: 1.12 } };
    },
  };

  function buildForklift(colorMat) {
    const g = new THREE.Group();
    g.add(box(1.3, 0.8, 1.7, colorMat, 0, 0.7, -0.1));
    g.add(box(1.32, 0.75, 0.5, C.steelDark, 0, 0.72, -1.05));        // protizávaží
    [[-0.62, 0.55], [0.62, 0.55], [-0.62, -0.7], [0.62, -0.7]].forEach(([x, z]) => {
      const w = mesh(G('wheel', () => new THREE.CylinderGeometry(0.3, 0.3, 0.26, 16)), C.rubber, null, [x, 0.3, z]);
      w.rotation.z = Math.PI / 2;
      g.add(w);
    });
    // kabina
    [[-0.58, 0.45], [0.58, 0.45], [-0.58, -0.75], [0.58, -0.75]].forEach(([x, z]) => g.add(box(0.07, 1.2, 0.07, C.steelDark, x, 1.7, z)));
    g.add(box(1.3, 0.08, 1.35, C.steelDark, 0, 2.3, -0.15));
    g.add(box(0.5, 0.12, 0.5, C.rubber, 0, 1.2, -0.3));
    g.add(box(0.45, 0.5, 0.1, C.rubber, 0, 1.45, -0.55));
    // stožár a vidle (vpředu = +z)
    [-0.36, 0.36].forEach(x => g.add(box(0.1, 2.3, 0.12, C.steel, x, 1.15, 0.85)));
    g.add(box(0.95, 0.42, 0.07, C.steel, 0, 0.42, 0.95));
    [-0.3, 0.3].forEach(x => g.add(box(0.13, 0.05, 1.1, C.steel, x, 0.16, 1.5)));
    // světla
    [-0.45, 0.45].forEach(x => g.add(box(0.14, 0.1, 0.03, C.lampOn, x, 1.0, 0.76, false)));
    g.add(mesh(gCyl(), C.beacon, [0.09, 0.14, 0.09], [0.4, 2.42, -0.5], false));
    return g;
  }

  function buildPipe(wide) {
    const g = new THREE.Group();
    const half = wide ? 3.7 : 1.08;
    [-half, half].forEach(x => {
      g.add(box(0.16, 2.7, 0.16, C.steel, x, 1.35, 0));
      g.add(box(0.36, 0.05, 0.36, C.steelDark, x, 0.025, 0));
    });
    const len = half * 2;
    const pipe = (r, y, m) => {
      const p = mesh(G('pipeCyl', () => new THREE.CylinderGeometry(1, 1, 1, 14)), m, [r, len, r], [0, y, 0]);
      p.rotation.z = Math.PI / 2;
      g.add(p);
    };
    pipe(0.12, 1.07, C.red);
    pipe(0.12, 1.33, C.blue);
    pipe(0.18, 1.67, C.silver);
    if (wide) {
      const sign = new THREE.Mesh(gBox(), [C.steelDark, C.steelDark, C.steelDark, C.steelDark, M(0xffffff, { map: signTex.lowPass, r: 0.6 }), C.steelDark]);
      sign.scale.set(6.2, 0.75, 0.06);
      sign.position.set(0, 2.25, 0.1);
      sign.castShadow = true;
      g.add(sign);
    } else {
      g.add(box(len - 0.1, 0.7, 0.06, C.hazard, 0, 2.25, 0.1));
    }
    return { g, boxes: [{ hx: wide ? 3.8 : 1.1, hz: 0.24, y0: 0.93, y1: 2.6 }] };
  }

  // ---------------------------------------------------------------- sběratelné předměty
  const glowMats = {
    vest: new THREE.SpriteMaterial({ map: glowTex, color: 0xd4ff1a, transparent: true, depthWrite: false, opacity: 0.8 }),
    boots: new THREE.SpriteMaterial({ map: glowTex, color: 0xff8a3a, transparent: true, depthWrite: false, opacity: 0.8 }),
    goggles: new THREE.SpriteMaterial({ map: glowTex, color: 0x5fd3ff, transparent: true, depthWrite: false, opacity: 0.8 }),
  };
  function buildPowerup(type) {
    const g = new THREE.Group();
    const spin = new THREE.Group();
    g.add(spin);
    if (type === 'vest') {
      spin.add(box(0.6, 0.66, 0.22, C.vest, 0, 0, 0));
      spin.add(box(0.62, 0.07, 0.24, C.refl, 0, 0.12, 0));
      spin.add(box(0.62, 0.07, 0.24, C.refl, 0, -0.14, 0));
      spin.add(box(0.18, 0.3, 0.24, C.steelDark, 0, 0.26, 0));
    } else if (type === 'boots') {
      [-0.16, 0.16].forEach(x => {
        spin.add(box(0.22, 0.34, 0.24, C.brown, x, 0.05, 0.06));
        spin.add(box(0.24, 0.16, 0.44, C.brown, x, -0.17, -0.05));
        spin.add(box(0.26, 0.06, 0.46, C.rubber, x, -0.26, -0.05));
        spin.add(box(0.25, 0.1, 0.12, C.hat, x, -0.17, -0.23));
      });
    } else {
      [-0.17, 0.17].forEach(x => {
        const lens = mesh(G('lens', () => new THREE.CylinderGeometry(0.15, 0.15, 0.07, 20)), C.lens, null, [x, 0, 0]);
        lens.rotation.x = Math.PI / 2;
        spin.add(lens);
        const rim = mesh(G('rim', () => new THREE.TorusGeometry(0.15, 0.035, 8, 20)), C.steelDark, null, [x, 0, 0]);
        spin.add(rim);
      });
      spin.add(box(0.1, 0.05, 0.05, C.steelDark, 0, 0.02, 0));
      spin.add(box(0.8, 0.06, 0.03, C.rubber, 0, 0, 0.06));
    }
    const glow = new THREE.Sprite(glowMats[type]);
    glow.scale.set(1.7, 1.7, 1);
    g.add(glow);
    return { g, spin };
  }

  // ---------------------------------------------------------------- dekorace podél trati
  const decorBuilders = {
    rings() {
      const g = new THREE.Group();
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * 1.8;
        const h = 1 + Math.floor(Math.random() * 2);
        for (let k = 0; k < h; k++) {
          g.add(mesh(G('ring', () => new THREE.CylinderGeometry(0.8, 0.8, 1, 20, 1, true)), M(0xc9c4b9, { map: concreteTex, side: THREE.DoubleSide }), null, [0, 0.5 + k * 1.02, x], false));
          g.add(mesh(G('ringTop', () => new THREE.RingGeometry(0.62, 0.8, 20)), C.concrete, null, [0, 1.005 + k * 1.02, x], false)).rotation.x = -Math.PI / 2;
        }
      }
      return g;
    },
    panels() {
      const g = new THREE.Group();
      g.add(box(0.3, 2.6, 3.2, C.steel, 0, 1.3, 0, false));
      [-1, 1].forEach(s => {
        for (let i = 0; i < 2; i++) {
          const p = box(0.16, 2.8, 3.0, i ? C.concrete : C.concreteDark, s * (0.3 + i * 0.2), 1.4, 0, false);
          p.rotation.z = s * -0.12;
          g.add(p);
        }
      });
      return g;
    },
    palletStack() {
      const g = new THREE.Group();
      const cols = 1 + Math.floor(Math.random() * 2);
      for (let c = 0; c < cols; c++) {
        const n = 2 + Math.floor(Math.random() * 5);
        for (let i = 0; i < n; i++) {
          g.add(box(1.1, 0.18, 1.5, i % 2 ? C.wood : C.woodDark, 0, 0.09 + i * 0.19, c * 1.7, false));
        }
      }
      return g;
    },
    curbs() {
      const g = new THREE.Group();
      g.add(box(1.2, 0.15, 1.5, C.wood, 0, 0.075, 0, false));
      for (let i = 0; i < 4; i++) g.add(box(1.0, 0.25, 1.4, i % 2 ? C.concrete : C.concreteDark, 0, 0.28 + i * 0.26, 0, false));
      return g;
    },
    mould() {
      const g = new THREE.Group();
      g.add(box(2.4, 0.5, 4.2, C.moldBlue, 0, 0.25, 0, false));
      g.add(box(2.0, 0.08, 3.8, C.concrete, 0, 0.47, 0, false));
      [-1.6, 1.6].forEach(z => g.add(box(2.4, 0.2, 0.15, C.hat, 0, 0.6, z, false)));
      return g;
    },
    parked() {
      const mats = [C.fork, C.forkRed];
      const g = buildForklift(mats[Math.floor(Math.random() * mats.length)]);
      g.rotation.y = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      g.traverse(o => { if (o.isMesh) o.castShadow = false; });
      return g;
    },
    lamp() {
      const g = new THREE.Group();
      g.add(cyl(0.08, 7, C.steel, 0, 3.5, 0, false));
      g.add(box(1.4, 0.08, 0.08, C.steel, 0, 6.9, 0, false));
      g.add(box(0.5, 0.12, 0.3, C.lampOn, 0.6, 6.82, 0, false));
      return g;
    },
    sign() {
      const g = new THREE.Group();
      const keys = ['oopp', 'vzv', 'safety'];
      const t = signTex[keys[Math.floor(Math.random() * keys.length)]];
      [-0.9, 0.9].forEach(z => g.add(box(0.08, 2.2, 0.08, C.steel, 0, 1.1, z, false)));
      const b = new THREE.Mesh(gBox(), [M(0xffffff, { map: t }), M(0xffffff, { map: t }), C.steel, C.steel, C.steel, C.steel]);
      b.scale.set(0.06, 1.0, 2.2);
      b.position.y = 2.0;
      g.add(b);
      return g;
    },
  };
  // haly
  const hallMats = [0x8fa3b3, 0xd8d2c4, 0x5d7f99, 0xc7b8a0].map(c => M(c, { map: hallTex, r: 0.7, m: 0.2 }));
  const roofMat = M(0x5f6670, { r: 0.6, m: 0.3 });
  function buildHall(side, len) {
    const g = new THREE.Group();
    const w = 14, h = 7 + Math.random() * 3;
    const wall = mesh(gBox(), hallMats[Math.floor(Math.random() * hallMats.length)], [w, h, len], [0, h / 2, 0], false);
    g.add(wall);
    const roof = mesh(G('roof', () => {
      const s = new THREE.Shape();
      s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 0.18); s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
      geo.translate(0, 0, -0.5);
      return geo;
    }), roofMat, [w + 0.6, w, len + 0.4], [0, h, 0], false);
    g.add(roof);
    // strana ke trati
    const face = -side * (w / 2 + 0.02);
    const rot = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    const addFace = (obj, y, z) => { obj.position.set(face, y, z); obj.rotation.y = rot; g.add(obj); };
    const doorW = Math.min(6, len * 0.35);
    addFace(new THREE.Mesh(G('plane', () => new THREE.PlaneGeometry(1, 1)), M(0x1c2530, { r: 1 })), 2.6, 0);
    g.children[g.children.length - 1].scale.set(doorW, 5.2, 1);
    const frameL = box(0.3, 5.4, 0.1, C.hazard, 0, 0, 0, false); addFace(frameL, 2.7, -doorW / 2 - 0.15);
    frameL.position.x = face - side * 0.02;
    const frameR = box(0.3, 5.4, 0.1, C.hazard, 0, 0, 0, false); addFace(frameR, 2.7, doorW / 2 + 0.15);
    frameR.position.x = face - side * 0.02;
    const band = new THREE.Mesh(G('plane', () => new THREE.PlaneGeometry(1, 1)), C.glass);
    band.scale.set(len * 0.9, 0.9, 1);
    addFace(band, h - 1.2, 0);
    if (len > 25) {
      const t = new THREE.Mesh(G('plane', () => new THREE.PlaneGeometry(1, 1)), M(0xffffff, { map: Math.random() < 0.5 ? signTex.hall : signTex.hall2 }));
      t.scale.set(8, 2, 1);
      addFace(t, 3.4, doorW / 2 + 5);
    }
    wall.receiveShadow = true;
    return g;
  }
  function buildGantry() {
    const g = new THREE.Group();
    [-6.2, 6.2].forEach(x => {
      g.add(box(0.5, 7.6, 0.5, C.hat, x, 3.8, 0, false));
      g.add(box(0.9, 0.4, 1.6, C.steelDark, x, 0.2, 0, false));
    });
    g.add(box(13, 0.8, 0.7, C.hat, 0, 7.8, 0, false));
    g.add(box(13, 0.12, 0.72, C.hazard, 0, 7.35, 0, false));
    g.add(box(1.0, 0.7, 1.0, C.steelDark, -1.5, 7.2, 0, false));
    g.add(cyl(0.03, 2.3, C.steelDark, -1.5, 5.7, 0, false));
    g.add(box(0.3, 0.3, 0.3, C.hat, -1.5, 4.5, 0, false));
    return g;
  }

  // ---------------------------------------------------------------- stav hry
  let state = 'menu';
  let speed = START_SPEED;
  let distance = 0;
  let score = 0;
  let helmets = 0;
  let best = 0;
  try { best = parseInt(localStorage.getItem('safetyrun_best') || '0', 10) || 0; } catch (e) { /* bez úložiště */ }

  const player = { lane: 1, x: 0, y: 0, vy: 0, slide: 0, slideQueued: false, dead: false, deadT: 0, fall: false, runPhase: 0 };
  const power = { vest: 0, boots: 0, goggles: 0 };

  const obstacles = [];
  const pickups = [];
  const decor = [];

  function addEntity(list, obj, z, data) {
    obj.position.z = z;
    scene.add(obj);
    const e = Object.assign({ obj, z, len: 0, vz: 0 }, data);
    list.push(e);
    return e;
  }
  function clearList(list) { list.forEach(e => scene.remove(e.obj)); list.length = 0; }

  // spawnery (kurzor = z konce posledního objektu, jede se světem)
  const streams = {};
  function resetStreams(withRows) {
    streams.rows = { cursor: withRows ? -38 : -1e9 };
    streams.propsL = { cursor: 16 };
    streams.propsR = { cursor: 16 };
    streams.hallL = { cursor: 30 };
    streams.hallR = { cursor: 30 };
    streams.gantry = { cursor: -20 };
  }

  function rowGap() { return 12 + speed * 0.75; }

  function pickType() {
    const d = distance;
    const opts = [['cone', 3], ['pallet', 3], ['block', 2.6]];
    if (d > 60) opts.push(['pipe', 2.4]);
    if (d > 90) opts.push(['pit', 2]);
    if (d > 160) opts.push(['forklift', 1.6]);
    let sum = 0; opts.forEach(o => (sum += o[1]));
    let r = Math.random() * sum;
    for (const [t, w] of opts) { if ((r -= w) <= 0) return t; }
    return 'cone';
  }
  const TALL = new Set(['block', 'forklift']);

  function spawnObstacle(type, lane, z) {
    const b = builders[type]();
    const x = type === 'pipeWide' ? 0 : LANES[lane];
    b.g.position.x = x;
    return addEntity(obstacles, b.g, z, { type, lane, x, boxes: b.boxes, pit: b.pit || null, vz: b.vz || 0, len: 4 });
  }

  function spawnHelmetLine(lane, zCenter, type, gap) {
    const x = LANES[lane];
    const n = 6;
    const step = Math.min(1.9, gap * 0.7 / n);
    for (let i = 0; i < n; i++) {
      const k = i - (n - 1) / 2;
      const z = zCenter + k * step;
      let y = 0.55;
      if (type && !TALL.has(type) && type !== 'pipe' && type !== 'pipeWide') {
        const t = 1 - Math.pow(k / ((n - 1) / 2 + 0.6), 2);
        y = 0.55 + 1.5 * Math.max(0, t);
      }
      const h = new THREE.Mesh(helmetGeo, C.hatPickup);
      h.castShadow = true;
      h.scale.setScalar(1.25);
      h.position.set(x, y, z);
      h.rotation.x = -0.25;
      addEntity(pickups, h, z, { kind: 'helmet', x, y, spin: i * 0.4 });
    }
  }

  function spawnPowerup(lane, z) {
    const types = ['vest', 'boots', 'goggles'];
    const type = types[Math.floor(Math.random() * 3)];
    const p = buildPowerup(type);
    p.g.position.set(LANES[lane], 1.0, z);
    addEntity(pickups, p.g, z, { kind: 'power', type, x: LANES[lane], y: 1.0, spinObj: p.spin, spin: 0 });
  }

  function spawnRow(z) {
    const gap = rowGap();
    // speciální řada – široké potrubí přes všechny pruhy
    if (distance > 220 && Math.random() < 0.09) {
      spawnObstacle('pipeWide', 1, z);
      spawnHelmetLine(Math.floor(Math.random() * 3), z, 'pipeWide', gap);
      return;
    }
    const pEmpty = Math.max(0.26, 0.6 - distance / 2600);
    const types = [null, null, null];
    let tall = 0;
    for (let i = 0; i < 3; i++) {
      if (Math.random() > pEmpty) {
        let t = pickType();
        if (TALL.has(t)) {
          if (tall >= 2) t = ['cone', 'pallet', 'pipe'][Math.floor(Math.random() * 3)];
          else tall++;
        }
        types[i] = t;
      }
    }
    if (types.every(t => t === null) && distance > 40) types[Math.floor(Math.random() * 3)] = pickType();
    types.forEach((t, i) => { if (t) spawnObstacle(t, i, z); });

    const free = [0, 1, 2].filter(i => !types[i]);
    const safe = [0, 1, 2].filter(i => !TALL.has(types[i]));
    let helmetLane = -1;
    if (Math.random() < 0.8 && safe.length) {
      helmetLane = safe[Math.floor(Math.random() * safe.length)];
      spawnHelmetLine(helmetLane, z, types[helmetLane], gap);
    }
    if (distance > 80 && Math.random() < 0.11) {
      const cand = free.filter(i => i !== helmetLane);
      const lanes = cand.length ? cand : free;
      if (lanes.length) spawnPowerup(lanes[Math.floor(Math.random() * lanes.length)], z + gap * 0.5);
    }
  }

  const propKeys = ['rings', 'panels', 'palletStack', 'curbs', 'mould', 'parked', 'lamp', 'sign', 'rings', 'palletStack', 'lamp'];
  function spawnProp(side, z) {
    const k = propKeys[Math.floor(Math.random() * propKeys.length)];
    const g = decorBuilders[k]();
    const x = side * (k === 'lamp' ? 5.2 : 6.2 + Math.random() * 2.5);
    g.position.x = x;
    if (k === 'lamp' && side > 0) g.rotation.y = Math.PI;
    if (k === 'sign') g.position.x = side * 5.4;
    addEntity(decor, g, z, { len: 5 });
  }

  function runStreams() {
    const s = streams;
    while (s.rows.cursor - rowGap() > SPAWN_Z) {
      s.rows.cursor -= rowGap();
      spawnRow(s.rows.cursor);
    }
    [['propsL', -1], ['propsR', 1]].forEach(([k, side]) => {
      while (s[k].cursor > SPAWN_Z) {
        const step = 6 + Math.random() * 7;
        s[k].cursor -= step;
        spawnProp(side, s[k].cursor);
      }
    });
    [['hallL', -1], ['hallR', 1]].forEach(([k, side]) => {
      while (s[k].cursor > SPAWN_Z - 30) {
        const len = 18 + Math.random() * 18;
        const gap = 3 + Math.random() * 8;
        const zc = s[k].cursor - gap - len / 2;
        const g = buildHall(side, len);
        g.position.x = side * 19;
        addEntity(decor, g, zc, { len });
        s[k].cursor = zc - len / 2;
      }
    });
    while (s.gantry.cursor > SPAWN_Z) {
      s.gantry.cursor -= 90 + Math.random() * 70;
      addEntity(decor, buildGantry(), s.gantry.cursor, { len: 2 });
    }
  }

  // ---------------------------------------------------------------- zvuk (WebAudio)
  let actx = null;
  function audio() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
    }
    if (actx && actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, dur, type = 'sine', vol = 0.15, slide = 0, delay = 0) {
    const a = actx; if (!a) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.25, freq = 800) {
    const a = actx; if (!a) return;
    const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = a.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(a.destination);
    src.start();
  }
  const sfx = {
    helmet() { tone(880, 0.08, 'square', 0.05); tone(1320, 0.12, 'square', 0.05, 0, 0.06); },
    jump() { tone(300, 0.18, 'triangle', 0.12, 400); },
    slide() { noise(0.22, 0.12, 1200); },
    lane() { tone(520, 0.05, 'sine', 0.05); },
    power() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, 'square', 0.05, 0, i * 0.07)); },
    crash() { noise(0.5, 0.45, 600); tone(160, 0.4, 'sawtooth', 0.12, -120); },
    smash() { noise(0.25, 0.3, 1500); },
  };

  // ---------------------------------------------------------------- HUD
  const $ = id => document.getElementById(id);
  const ui = {
    hud: $('hud'), menu: $('menu'), pause: $('pause'), over: $('over'),
    score: $('score'), dist: $('dist'), helmets: $('helmets'), powerups: $('powerups'), toast: $('toast'),
    bestMenu: $('bestMenu'), bestOver: $('bestOver'), finalScore: $('finalScore'), finalHelmets: $('finalHelmets'),
    finalDist: $('finalDist'), newBest: $('newBest'), overReason: $('overReason'),
  };
  ui.bestMenu.textContent = best;
  const PU_LABEL = { vest: 'Štít', boots: 'Super skok', goggles: 'Skóre ×2' };
  const puEls = {};
  ['vest', 'boots', 'goggles'].forEach(k => {
    const el = document.createElement('div');
    el.className = 'pu-chip ' + k;
    el.hidden = true;
    el.innerHTML = `<span>${PU_LABEL[k]}</span><span class="bar"><i></i></span>`;
    ui.powerups.appendChild(el);
    puEls[k] = { el, bar: el.querySelector('i') };
  });
  let toastTimer = 0;
  function toast(text) {
    ui.toast.textContent = text;
    ui.toast.classList.add('show');
    toastTimer = 1.2;
  }
  let lastHud = '';
  function updateHud() {
    const s = Math.floor(score), d = Math.floor(distance);
    const key = s + '|' + d + '|' + helmets;
    if (key !== lastHud) {
      lastHud = key;
      ui.score.textContent = s;
      ui.dist.textContent = d + ' m';
      ui.helmets.textContent = helmets;
    }
    for (const k in puEls) {
      const on = power[k] > 0;
      if (puEls[k].el.hidden === on) puEls[k].el.hidden = !on;
      if (on) puEls[k].bar.style.width = (power[k] / PU_TIME * 100).toFixed(1) + '%';
    }
  }

  // ---------------------------------------------------------------- řízení stavu
  function show(el, on) { el.hidden = !on; }

  function resetWorld(withRows) {
    clearList(obstacles); clearList(pickups); clearList(decor);
    speed = START_SPEED; distance = 0; score = 0; helmets = 0;
    Object.assign(player, { lane: 1, x: 0, y: 0, vy: 0, slide: 0, slideQueued: false, dead: false, deadT: 0, fall: false });
    power.vest = power.boots = power.goggles = 0;
    dog.root.rotation.set(0, 0, 0);
    dog.body.rotation.set(0, 0, 0);
    dog.body.scale.set(1, 1, 1);
    trackTex.offset.set(0, 0); yardTex.offset.set(0, 0); railTex.offset.set(0, 0);
    resetStreams(withRows);
    runStreams();
    lastHud = '';
  }

  function startGame() {
    audio();
    resetWorld(true);
    state = 'play';
    show(ui.menu, false); show(ui.over, false); show(ui.pause, false); show(ui.hud, true);
    toast('BĚŽ!');
    updateHud();
  }
  function toMenu() {
    resetWorld(false);
    state = 'menu';
    ui.bestMenu.textContent = best;
    show(ui.over, false); show(ui.pause, false); show(ui.hud, false); show(ui.menu, true);
  }
  function pauseGame() {
    if (state !== 'play') return;
    state = 'paused';
    show(ui.pause, true);
  }
  function resumeGame() {
    if (state !== 'paused') return;
    state = 'play';
    show(ui.pause, false);
    last = performance.now();
  }
  function gameOver(reason) {
    if (player.dead) return;
    player.dead = true;
    player.deadT = 0;
    state = 'dying';
    ui.overReason.textContent = reason;
    sfx.crash();
    shake = 0.5;
  }
  function showOver() {
    state = 'over';
    const s = Math.floor(score);
    const isBest = s > best;
    if (isBest) {
      best = s;
      try { localStorage.setItem('safetyrun_best', String(best)); } catch (e) { /* bez úložiště */ }
    }
    ui.finalScore.textContent = s;
    ui.finalHelmets.textContent = helmets;
    ui.finalDist.textContent = Math.floor(distance) + ' m';
    ui.bestOver.textContent = best;
    ui.newBest.hidden = !isBest;
    show(ui.hud, false);
    show(ui.over, true);
  }

  // ---------------------------------------------------------------- akce hráče
  function moveLane(dir) {
    if (state !== 'play') return;
    const nl = Math.max(0, Math.min(2, player.lane + dir));
    if (nl !== player.lane) { player.lane = nl; sfx.lane(); }
  }
  function jump() {
    if (state !== 'play') return;
    if (player.y <= 0.001 && !player.fall) {
      player.vy = power.boots > 0 ? JUMP_V_BOOTS : JUMP_V;
      player.slide = 0;
      player.slideQueued = false;
      sfx.jump();
    }
  }
  function slide() {
    if (state !== 'play') return;
    if (player.y > 0.001) {
      player.vy = Math.min(player.vy, -22);
      player.slideQueued = true;
    } else {
      player.slide = SLIDE_TIME;
      sfx.slide();
    }
  }

  // klávesnice
  window.addEventListener('keydown', e => {
    const k = e.code;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(k)) e.preventDefault();
    if (state === 'play') {
      if (k === 'ArrowLeft' || k === 'KeyA') moveLane(-1);
      else if (k === 'ArrowRight' || k === 'KeyD') moveLane(1);
      else if (k === 'ArrowUp' || k === 'KeyW' || k === 'Space') jump();
      else if (k === 'ArrowDown' || k === 'KeyS') slide();
      else if (k === 'Escape' || k === 'KeyP') pauseGame();
    } else if (state === 'paused') {
      if (k === 'Escape' || k === 'KeyP' || k === 'Enter' || k === 'Space') resumeGame();
    } else if (state === 'menu' || state === 'over') {
      if (k === 'Enter' || k === 'Space') { e.preventDefault(); startGame(); }
    }
  });

  // swipe gesta
  let touch = null;
  const SWIPE = 28;
  window.addEventListener('touchstart', e => {
    if (state !== 'play') return;
    const t = e.changedTouches[0];
    touch = { x: t.clientX, y: t.clientY, done: false };
  }, { passive: true });
  window.addEventListener('touchmove', e => {
    if (state !== 'play' || !touch || touch.done) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return;
    touch.done = true;
    if (Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1);
    else if (dy < 0) jump();
    else slide();
  }, { passive: true });
  window.addEventListener('touchend', () => { touch = null; }, { passive: true });
  // swipe myší (pro testování na PC)
  let mouse = null;
  canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') mouse = { x: e.clientX, y: e.clientY }; });
  window.addEventListener('pointerup', e => {
    if (!mouse || e.pointerType !== 'mouse') return;
    const dx = e.clientX - mouse.x, dy = e.clientY - mouse.y;
    mouse = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 40) return;
    if (Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1);
    else if (dy < 0) jump();
    else slide();
  });

  $('playBtn').addEventListener('click', startGame);
  $('restartBtn').addEventListener('click', startGame);
  $('overMenuBtn').addEventListener('click', toMenu);
  $('pauseMenuBtn').addEventListener('click', toMenu);
  $('resumeBtn').addEventListener('click', resumeGame);
  $('pauseBtn').addEventListener('click', pauseGame);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

  // ---------------------------------------------------------------- kolize
  const PHX = 0.3, PHZ = 0.35;
  function checkCollisions() {
    const top = player.y + (player.slide > 0 ? 0.6 : 1.25);
    for (const o of obstacles) {
      if (o.knocked) continue;
      const dz = Math.abs(o.z);
      if (dz > 3) continue;
      if (o.pit) {
        if (power.vest > 0) continue;
        if (player.y <= 0.02 && Math.abs(player.x - o.x) < o.pit.hx && dz < o.pit.hz - 0.15) {
          player.fall = true;
          player.x = o.x;
          gameOver('Spadl jsi do výkopu!');
          return;
        }
        continue;
      }
      for (const b of o.boxes) {
        if (Math.abs(player.x - o.x) < b.hx + PHX && dz < b.hz + PHZ && player.y < b.y1 && top > b.y0) {
          if (power.vest > 0) {
            o.knocked = true;
            o.kvy = 8; o.kvx = (o.x - player.x >= 0 ? 1 : -1) * 4 + (Math.random() - 0.5) * 2;
            o.kspin = (Math.random() - 0.5) * 8;
            sfx.smash();
            break;
          }
          const why = {
            cone: 'Narazil jsi do kuželů!', pallet: 'Zakopl jsi o palety!', block: 'Betonový blok nepovolí!',
            forklift: 'Pozor na VZV!', pipe: 'Nezapomeň se skrčit!', pipeWide: 'Nezapomeň se skrčit!',
          }[o.type] || 'Náraz!';
          gameOver(why);
          return;
        }
      }
    }
    // sběr
    const pc = player.y + 0.6;
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      if (Math.abs(p.z) > 1.0 || Math.abs(p.x - player.x) > 0.9) continue;
      if (p.y < player.y - 0.4 || p.y > top + 0.5) continue;
      if (p.kind === 'helmet') {
        helmets++;
        sfx.helmet();
      } else {
        power[p.type] = PU_TIME;
        sfx.power();
        toast(PU_LABEL[p.type].toUpperCase() + '!');
      }
      scene.remove(p.obj);
      pickups.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- update
  let shake = 0;
  let t = 0;
  function moveWorld(dz, dt) {
    for (const list of [obstacles, pickups, decor]) {
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        e.z += dz + (e.vz && e.z > -70 ? e.vz * dt : 0);
        e.obj.position.z = e.z;
        if (e.z - e.len / 2 > DESPAWN_Z) { scene.remove(e.obj); list.splice(i, 1); }
      }
    }
    for (const k in streams) streams[k].cursor += dz;
    trackTex.offset.y += dz / TRACK_REP;
    yardTex.offset.y += dz / YARD_TILE;
    railTex.offset.x += dz / RAIL_REP;
  }

  function animateDog(dt) {
    const p = player;
    const airborne = p.y > 0.001;
    const sliding = p.slide > 0;
    dog.root.position.set(p.x, p.y, 0);
    // náklon při změně pruhu
    const lean = (LANES[p.lane] - p.x);
    dog.root.rotation.z = THREE.MathUtils.lerp(dog.root.rotation.z, -lean * 0.12, 0.3);
    dog.root.rotation.y = THREE.MathUtils.lerp(dog.root.rotation.y, lean * 0.18, 0.3);

    p.runPhase += dt * (8 + speed * 0.35);
    const s = Math.sin(p.runPhase);
    const [fl, fr, bl, br] = dog.legs;
    if (airborne) {
      fl.rotation.x = fr.rotation.x = 0.9;
      bl.rotation.x = br.rotation.x = -0.9;
      dog.body.position.y = 0;
      dog.body.rotation.x = THREE.MathUtils.lerp(dog.body.rotation.x, p.vy > 0 ? 0.25 : -0.15, 0.2);
    } else if (sliding) {
      fl.rotation.x = fr.rotation.x = 1.3;
      bl.rotation.x = br.rotation.x = -1.3;
      dog.body.rotation.x = THREE.MathUtils.lerp(dog.body.rotation.x, 0, 0.3);
    } else {
      fl.rotation.x = s * 0.9; br.rotation.x = s * 0.9;
      fr.rotation.x = -s * 0.9; bl.rotation.x = -s * 0.9;
      dog.body.position.y = Math.abs(Math.cos(p.runPhase)) * 0.06;
      dog.body.rotation.x = THREE.MathUtils.lerp(dog.body.rotation.x, Math.sin(p.runPhase * 2) * 0.04, 0.3);
    }
    const ty = sliding ? 0.5 : 1, tz = sliding ? 1.2 : 1;
    dog.body.scale.y = THREE.MathUtils.lerp(dog.body.scale.y, ty, 0.35);
    dog.body.scale.z = THREE.MathUtils.lerp(dog.body.scale.z, tz, 0.35);
    dog.tail.rotation.z = Math.sin(t * 14) * 0.5;
    dog.head.rotation.x = airborne ? -0.1 : Math.sin(p.runPhase * 2) * 0.05;
    dog.bubble.visible = power.vest > 0 && (power.vest > 2 || Math.floor(t * 8) % 2 === 0);
    if (dog.bubble.visible) dog.bubble.rotation.y += dt * 2;
  }

  function idleDog(dt) {
    player.runPhase += dt * 6;
    const s = Math.sin(player.runPhase);
    dog.root.position.set(player.x, 0, 0);
    dog.legs.forEach((l, i) => (l.rotation.x = (i === 0 || i === 3 ? s : -s) * 0.7));
    dog.body.position.y = Math.abs(Math.cos(player.runPhase)) * 0.05;
    dog.tail.rotation.z = Math.sin(t * 12) * 0.6;
    dog.bubble.visible = false;
  }

  function update(dt) {
    t += dt;
    if (toastTimer > 0 && (toastTimer -= dt) <= 0) ui.toast.classList.remove('show');

    if (state === 'menu') {
      const dz = 7 * dt;
      moveWorld(dz, dt);
      runStreams();
      idleDog(dt);
    } else if (state === 'play') {
      speed = Math.min(MAX_SPEED, START_SPEED + distance / 85);
      const dz = speed * dt;
      distance += dz;
      score += dz * (power.goggles > 0 ? 2 : 1);
      for (const k in power) power[k] = Math.max(0, power[k] - dt);

      // pohyb hráče
      const tx = LANES[player.lane];
      player.x += (tx - player.x) * Math.min(1, dt * 15);
      if (player.y > 0 || player.vy > 0) {
        player.vy -= GRAV * dt;
        player.y += player.vy * dt;
        if (player.y <= 0) {
          player.y = 0; player.vy = 0;
          if (player.slideQueued) { player.slide = SLIDE_TIME; player.slideQueued = false; sfx.slide(); }
        }
      }
      if (player.slide > 0) player.slide -= dt;

      moveWorld(dz, dt);
      runStreams();
      checkCollisions();
      animateDog(dt);
      updateHud();
    } else if (state === 'dying') {
      player.deadT += dt;
      const k = player.deadT;
      if (player.fall) {
        player.y = Math.max(-2, player.y - dt * 6);
        dog.root.position.y = player.y;
        dog.root.rotation.x = -k * 2;
      } else {
        dog.root.position.y = Math.max(0, Math.sin(Math.min(k * 5, Math.PI)) * 0.6);
        dog.root.rotation.x = Math.min(1.3, k * 4);
        dog.root.position.z = Math.min(1.2, k * 3);
      }
      if (k > 0.9) showOver();
    }

    // odhozené překážky (štít)
    for (const o of obstacles) {
      if (!o.knocked) continue;
      o.kvy -= GRAV * dt;
      o.obj.position.y += o.kvy * dt;
      o.obj.position.x += o.kvx * dt;
      o.obj.rotation.z += o.kspin * dt;
      o.obj.rotation.x += o.kspin * 0.5 * dt;
    }
    // animace předmětů
    for (const p of pickups) {
      p.spin += dt;
      if (p.kind === 'helmet') {
        p.obj.rotation.y = t * 3 + p.spin;
        p.obj.position.y = p.y + Math.sin(t * 4 + p.spin) * 0.06;
      } else {
        p.spinObj.rotation.y = t * 2.2;
        p.obj.position.y = p.y + Math.sin(t * 3) * 0.12;
      }
    }
    C.beacon.emissiveIntensity = Math.sin(t * 10) > 0 ? 2.5 : 0.2;

    // kamera
    const portrait = camera.aspect < 1;
    const camDist = portrait ? 7.4 + (1 - camera.aspect) * 3 : 6.2;
    const camH = portrait ? 4.2 : 3.4;
    const cx = player.x * 0.55;
    camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 6);
    camera.position.y = camH + (state === 'play' ? player.y * 0.35 : 0);
    camera.position.z = camDist;
    if (shake > 0) {
      shake -= dt;
      camera.position.x += (Math.random() - 0.5) * shake * 0.8;
      camera.position.y += (Math.random() - 0.5) * shake * 0.8;
    }
    camera.lookAt(camera.position.x * 0.8, 1.0 + player.y * 0.2, -8);

    sun.position.set(player.x - 7, 14, 8);
    sun.target.position.set(player.x, 0, -5);
  }

  // ---------------------------------------------------------------- smyčka
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 1 ? 72 : 60;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state !== 'paused') update(dt);
    renderer.render(scene, camera);
  }
  resetWorld(false);
  requestAnimationFrame(frame);

  // ladicí přístup pro testy
  window.__safetyRun = { get state() { return state; }, get score() { return score; }, get helmets() { return helmets; }, player, power, obstacles };
})();
