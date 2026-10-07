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

  // ---------------------------------------------------------------- prostředí (témata)
  const THEMES = {
    vyroba: {
      name: 'Výroba', icon: '🏭', sky: ['#5fa8de', '#a9d3ec', '#e6eeec'], fog: 0xdde8ea, hemiG: 0x8a7a66,
      track: '#5b6068', edge: '#f2c41a', dash: '#f4f1e8', yard: '#bdb7ab', yardKind: 'concrete',
      hallStyle: 'hall', hallColors: [0x8fa3b3, 0xd8d2c4, 0x5d7f99, 0xc7b8a0], hallSigns: [['PREFABRIKACE'], ['VÝROBA DÍLCŮ']],
      props: ['rings', 'panels', 'palletStack', 'curbs', 'mould', 'parked', 'lamp', 'sign', 'rings', 'palletStack', 'lamp'],
      signs: ['oopp', 'vzv', 'safety'], gantry: 'gantry', obs: {},
      why: { cone: 'Narazil jsi do kuželů!', pallet: 'Zakopl jsi o palety!', block: 'Betonový blok nepovolí!', forklift: 'Pozor na VZV!', pipe: 'Nezapomeň se skrčit!', pipeWide: 'Nezapomeň se skrčit!', pit: 'Spadl jsi do výkopu!' },
    },
    kancelar: {
      name: 'Kancelář', icon: '🏢', sky: ['#6f8fb3', '#c3d2e2', '#eef1f4'], fog: 0xe6ebf1, hemiG: 0x8f96a0,
      track: '#c4c9d1', edge: '#2f6fd0', dash: '#ffffff', yard: '#9aa4ae', yardKind: 'tiles',
      hallStyle: 'office', hallColors: [0xdfe4ea, 0xc9d1da, 0xe9e4da, 0xb7c3cf], hallSigns: [['KANCELÁŘE'], ['OPEN SPACE']],
      props: ['plant', 'desk', 'cooler', 'bench', 'lamp', 'sign', 'plant', 'desk', 'bench'],
      signs: ['wet', 'exit', 'safety'], gantry: 'exitPortal',
      obs: { cone: 'wetSign', pallet: 'paperBoxes', block: 'cabinet', forklift: 'cleaningCart', pipe: 'cableBridge', pipeWide: 'cableBridgeWide', pit: 'floorHatch' },
      why: { cone: 'Uklouzl jsi na mokré podlaze!', pallet: 'Zakopl jsi o krabice!', block: 'Skříň nepřeskočíš!', forklift: 'Pozor na úklidový vozík!', pipe: 'Pozor na kabely, skrč se!', pipeWide: 'Pozor na kabely, skrč se!', pit: 'Spadl jsi do otevřeného kanálu!' },
    },
    stavba: {
      name: 'Stavba', icon: '🏗️', sky: ['#5c9fd6', '#b4d6ea', '#efe6d6'], fog: 0xe9e1d3, hemiG: 0x8f7454,
      track: '#7c7366', edge: '#ff7a1a', dash: '#e8e0d0', yard: '#a8875f', yardKind: 'dirt',
      hallStyle: 'frame', hallColors: [0xb9b4aa, 0xa9a49a, 0xc4bfb4, 0x9d988e], hallSigns: [['STAVENIŠTĚ'], ['VSTUP ZAKÁZÁN']],
      props: ['bricks', 'rebar', 'sand', 'rings', 'lamp', 'sign', 'mixer', 'bricks', 'sand'],
      signs: ['site', 'oopp', 'safety'], gantry: 'crane',
      obs: { pallet: 'brickPallet', block: 'skip', forklift: 'dumper', pipe: 'scaffold', pipeWide: 'scaffoldWide' },
      why: { cone: 'Narazil jsi do kuželů!', pallet: 'Zakopl jsi o cihly!', block: 'Kontejner nepovolí!', forklift: 'Pozor na stavební stroj!', pipe: 'Lešení – skrč se!', pipeWide: 'Lešení – skrč se!', pit: 'Spadl jsi do výkopu!' },
    },
    mlekarna: {
      name: 'Mlékárna', icon: '🥛', sky: ['#69b2e6', '#bfe0f2', '#f2f6f7'], fog: 0xe6f0f4, hemiG: 0x9aa7ad,
      track: '#d3d9dc', edge: '#2a9d5c', dash: '#ffffff', yard: '#e4e9ec', yardKind: 'tiles',
      hallStyle: 'hall', hallColors: [0xf4f6f8, 0xe8eef2, 0xdfe8ee, 0xf2f2ee], hallSigns: [['MLÉKÁRNA'], ['PASTERACE']],
      props: ['silo', 'crates', 'tanker', 'lamp', 'sign', 'crates', 'silo', 'lamp'],
      signs: ['hygiene', 'oopp', 'vzv'], gantry: 'pipeBridge',
      obs: { cone: 'milkCans', pallet: 'crates', block: 'steelTank', forklift: 'dairyForklift', pipe: 'steelPipe', pipeWide: 'steelPipeWide', pit: 'drain' },
      why: { cone: 'Zakopl jsi o konve na mléko!', pallet: 'Zakopl jsi o přepravky!', block: 'Nerezový tank nepovolí!', forklift: 'Pozor na VZV!', pipe: 'Potrubí – skrč se!', pipeWide: 'Potrubí – skrč se!', pit: 'Spadl jsi do odtokového kanálu!' },
    },
  };
  const store = {
    get(k, d) { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* bez úložiště */ } },
  };
  let themeKey = THEMES[store.get('safetyrun_theme', 'vyroba')] ? store.get('safetyrun_theme', 'vyroba') : 'vyroba';
  let TH = THEMES[themeKey];

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
  // celý svět (trať, překážky, dekorace) je ve skupině, aby se dal při odbočení otočit kolem hráče
  const world = new THREE.Group();
  scene.add(world);

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

  function paintSky(g, w, h) {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, TH.sky[0]);
    gr.addColorStop(0.55, TH.sky[1]);
    gr.addColorStop(1, TH.sky[2]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  const skyTex = canvasTex(2, 256, paintSky);
  skyTex.wrapS = skyTex.wrapT = THREE.ClampToEdgeWrapping;
  scene.background = skyTex;

  // jízdní dráha: 7.6 široká, jedna textura = 10 m
  const TRACK_W = 7.6, TRACK_L = 260, TRACK_REP = 10;
  function paintTrack(g, w, h) {
    g.fillStyle = TH.track; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 5000, TH.yardKind === 'tiles' ? 0.06 : 0.18);
    const u = x => (x + TRACK_W / 2) / TRACK_W * w;
    // stopy v pruzích
    g.fillStyle = 'rgba(0,0,0,0.08)';
    LANES.forEach(l => { g.fillRect(u(l) - 22, 0, 12, h); g.fillRect(u(l) + 10, 0, 12, h); });
    // krajní žluté čáry
    g.fillStyle = TH.edge;
    g.fillRect(u(-3.5) - 4, 0, 8, h); g.fillRect(u(3.5) - 4, 0, 8, h);
    // přerušované dělicí čáry
    g.fillStyle = TH.dash;
    [-1.1, 1.1].forEach(x => g.fillRect(u(x) - 3, 0, 6, h * 0.5));
  }
  const trackTex = canvasTex(256, 512, paintTrack, 1, TRACK_L / TRACK_REP);

  const YARD_TILE = 5;
  function paintYard(g, w, h) {
    g.fillStyle = TH.yard; g.fillRect(0, 0, w, h);
    if (TH.yardKind === 'tiles') {
      speckle(g, w, h, 1200, 0.06);
      g.fillStyle = 'rgba(0,0,0,0.13)';
      for (let i = 0; i <= 4; i++) { g.fillRect(i * 64 - 1, 0, 2, h); g.fillRect(0, i * 64 - 1, w, 2); }
    } else if (TH.yardKind === 'dirt') {
      speckle(g, w, h, 6000, 0.22);
      for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${90 + Math.random() * 60},${80 + Math.random() * 40},${60 + Math.random() * 30},0.8)`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1.5 + Math.random() * 3, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(70,50,30,0.15)';
      for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 30, 8 + Math.random() * 10, 0, 0, 7); g.fill(); }
    } else {
      speckle(g, w, h, 4000, 0.16);
      g.fillStyle = 'rgba(90,80,70,0.10)';
      for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 10 + Math.random() * 30, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(60,55,50,0.55)';
      g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);
    }
  }
  const yardTex = canvasTex(256, 256, paintYard, 40 / YARD_TILE, TRACK_L / YARD_TILE);

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
    wet: textTex(['POZOR', 'MOKRÁ PODLAHA'], '#ffc410', '#16181b'),
    exit: textTex(['ÚNIKOVÝ', 'VÝCHOD'], '#1f8f4e', '#ffffff'),
    site: textTex(['STAVENIŠTĚ', 'VSTUP ZAKÁZÁN'], '#d23a2a', '#ffffff'),
    hygiene: textTex(['HYGIENA', 'MYJ SI RUCE'], '#1d5fb8', '#ffffff'),
    cables: textTex(['POZOR – KABELY'], '#ffc410', '#16181b', true),
    scaffold: textTex(['POZOR – LEŠENÍ'], '#ffc410', '#16181b', true),
    hall: null, hall2: null,
  };
  const hallSignCache = {};
  function themeHallSigns() {
    TH.hallSigns.forEach((lines, i) => {
      const k = lines.join('|');
      if (!hallSignCache[k]) hallSignCache[k] = textTex(lines, '#ffffff', '#1d2a3a');
      signTex[i ? 'hall2' : 'hall'] = hallSignCache[k];
    });
  }
  themeHallSigns();

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

  // realistická ochranná přilba: kopule, hřeben, boční žebra, kšilt vpředu, lem, vnitřní páska
  const domeGeo = () => G('hhDome', () => new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2));
  const ridgeGeo = () => G('hhRidge', () => new THREE.TorusGeometry(1, 0.075, 8, 28, Math.PI));
  const ribGeo = () => G('hhRib', () => new THREE.TorusGeometry(1, 0.04, 6, 24, Math.PI));
  const brimGeo = () => G('hhBrim', () => {
    const pts = [new THREE.Vector2(0.98, 0.0), new THREE.Vector2(1.13, -0.015), new THREE.Vector2(1.14, -0.05), new THREE.Vector2(0.98, -0.04)];
    return new THREE.LatheGeometry(pts, 32);
  });
  const peakGeo = () => G('hhPeak', () => {
    const sh = new THREE.Shape();
    sh.moveTo(-0.92, 0);
    sh.absellipse(0, 0, 0.92, 0.55, Math.PI, Math.PI * 2, false, 0);
    sh.lineTo(-0.92, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 });
    geo.rotateX(Math.PI / 2);
    return geo;
  });
  function makeHardHat(r, opts = {}) {
    // r = poloměr hlavy pod přilbou; kšilt míří dopředu (−z)
    const g = new THREE.Group();
    const mat = opts.mat || C.hat, dark = C.hatDark;
    const sx = r * 1.06, sy = r * 0.98, sz = r * 1.14;
    const dome = mesh(domeGeo(), mat, [sx, sy, sz], [0, 0, 0]);
    g.add(dome);
    const ridge = mesh(ridgeGeo(), dark, [sx * 1.0, sy * 1.02, sz * 1.0], [0, 0, 0], false);
    ridge.rotation.y = Math.PI / 2;
    g.add(ridge);
    [-1, 1].forEach(sd => {
      const rib = mesh(ribGeo(), mat, [sx * 0.93, sy * 0.95, sz * 0.97], [sd * sx * 0.36, 0, 0], false);
      rib.rotation.y = Math.PI / 2;
      rib.scale.multiplyScalar(0.93);
      g.add(rib);
    });
    g.add(mesh(brimGeo(), mat, [sx, r, sz], [0, 0.005, 0]));
    const peak = mesh(peakGeo(), mat, [sx, r, sz * 0.95], [0, 0.01, -sz * 0.78]);
    peak.rotation.x = 0.14;
    g.add(peak);
    // vnitřní páska (náhlavní kříž) vidět pod okrajem
    g.add(mesh(G('hhBand', () => new THREE.CylinderGeometry(1, 1, 1, 28, 1, true)), C.rubber, [sx * 0.95, r * 0.12, sz * 0.95], [0, -r * 0.03, 0], false));
    if (opts.strap) {
      const strap = mesh(G('hhStrap', () => new THREE.TorusGeometry(1, 0.035, 6, 24, Math.PI)), C.rubber, [r * 0.95, r * 1.25, r], [0, 0, 0.0], false);
      strap.rotation.z = Math.PI;
      g.add(strap);
    }
    return g;
  }

  // barvy
  const C = {
    fur: M(0xf1e7d4, { r: 0.92 }),
    cream: M(0xfbf6ec, { r: 0.95 }),
    pink: M(0xe9a1a7, { r: 0.8 }),
    dark: M(0x24160f, { r: 0.4 }),
    white: M(0xffffff, { r: 0.3 }),
    vest: M(0xcdf51a, { r: 0.6, e: 0x2f3d00, side: THREE.DoubleSide }),
    refl: M(0xe3e8ec, { r: 0.25, m: 0.4, e: 0x505050 }),
    hat: M(0xffc410, { r: 0.28, e: 0x2a1c00 }),
    hatDark: M(0xe6a800, { r: 0.35, e: 0x221500 }),
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
    // kotě
    catFur: M(0xe39a52, { r: 0.9 }), catStripe: M(0xb8692c, { r: 0.9 }), catLight: M(0xfbe7cf, { r: 0.92 }),
    green: M(0x2fb36b, { r: 0.6 }),
    // člověk
    skin: M(0xf0c8a4, { r: 0.7 }), jeans: M(0x2f4f7a, { r: 0.85 }), shirt: M(0x3d6fb0, { r: 0.8 }), boot: M(0x3a2a1c, { r: 0.8 }), hair: M(0x4a3222, { r: 0.9 }),
    // šnek
    snail: M(0xc8b48a, { r: 0.6 }), snailDark: M(0x9a8460, { r: 0.6 }), shell: M(0xb5651d, { r: 0.55 }), shellLight: M(0xe0a35c, { r: 0.55 }),
    // kancelář
    whiteBoard: M(0xf3f4f6, { r: 0.5 }), grey: M(0x9aa2ab, { r: 0.6 }), greyDark: M(0x4b525a, { r: 0.6 }), paper: M(0xf5efe0, { r: 0.9 }),
    cardboard: M(0xb88a55, { r: 0.95 }), plant: M(0x3f9a4a, { r: 0.8 }), pot: M(0xcf6f3c, { r: 0.8 }), deskTop: M(0xd9b98a, { r: 0.7 }), water: M(0x8fd3ff, { r: 0.1, t: true, op: 0.7 }),
    exitGreen: M(0x1f8f4e, { r: 0.5, e: 0x0a3d20 }),
    // stavba
    brick: M(0xb5523a, { r: 0.9 }), skip: M(0xe0702a, { r: 0.6 }), sand: M(0xd8b97a, { r: 0.98 }), rebar: M(0x6b4a3a, { r: 0.6, m: 0.5 }), netGreen: M(0x3aa35a, { r: 0.9, t: true, op: 0.55, side: THREE.DoubleSide }),
    // mlékárna
    steelBright: M(0xe4e9ee, { r: 0.3, m: 0.35 }), milk: M(0xfcfcf8, { r: 0.4 }), crateBlue: M(0x2a7fd0, { r: 0.6 }), crateRed: M(0xd94343, { r: 0.6 }), dairyBlue: M(0x2b6cb0, { r: 0.5 }),
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
  world.add(trackMesh);

  const yardMat = M(0xffffff, { map: yardTex, r: 0.95 });
  const sideRails = { '-1': [], '1': [] }; // obrubník a zábradlí – na straně odbočky se skryjí
  const yardMeshes = [];
  [-1, 1].forEach(side => {
    const y = new THREE.Mesh(new THREE.PlaneGeometry(40, TRACK_L), yardMat);
    yardMeshes.push(y);
    y.rotation.x = -Math.PI / 2;
    y.position.set(side * (TRACK_W / 2 + 20), -0.01, 20 - TRACK_L / 2);
    y.receiveShadow = true;
    world.add(y);
    const curb = box(0.3, 0.16, TRACK_L, C.concrete, side * (TRACK_W / 2 + 0.1), 0.08, 20 - TRACK_L / 2, false);
    world.add(curb);
    sideRails[side].push(curb);
    const rail = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_L, 1.15), M(0xffffff, { map: railTex, at: 0.5, side: THREE.DoubleSide, r: 0.5 }));
    rail.rotation.y = Math.PI / 2;
    rail.position.set(side * (TRACK_W / 2 + 0.55), 0.58, 20 - TRACK_L / 2);
    world.add(rail);
    sideRails[side].push(rail);
  });

  // ---------------------------------------------------------------- postava: čivava
  function buildDog() {
    // dlouhosrstá krémově bílá čivava (podle předlohy): chundelatá srst, velké uši s růžovým vnitřkem,
    // velké tmavé oči, chlupatý ocas stočený nad hřbetem
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const tuft = (mat, s, p) => body.add(mesh(gSph(), mat, s, p));

    tuft(C.fur, [0.3, 0.29, 0.42], [0, 0.56, 0]);
    // chundelaté boky a hřbet
    [[-0.22, 0.6, 0.12], [0.22, 0.6, 0.12], [-0.2, 0.58, -0.14], [0.2, 0.58, -0.14], [0, 0.76, 0.2], [0, 0.42, 0.1]].forEach(p => tuft(C.fur, [0.15, 0.15, 0.17], p));
    // náprsenka (hříva na hrudi)
    tuft(C.cream, [0.25, 0.25, 0.2], [0, 0.55, -0.3]);
    [-1, 1].forEach(s => tuft(C.cream, [0.13, 0.15, 0.12], [s * 0.13, 0.44, -0.33]));
    tuft(C.cream, [0.14, 0.16, 0.12], [0, 0.38, -0.32]);

    // reflexní vesta
    const vg = G('vestCyl', () => new THREE.CylinderGeometry(1, 1, 1, 24, 1, true));
    const vest = mesh(vg, C.vest, [0.33, 0.5, 0.31], [0, 0.58, -0.02]);
    vest.rotation.x = Math.PI / 2;
    body.add(vest);
    [-0.13, 0.1].forEach(z => {
      const s = mesh(vg, C.refl, [0.336, 0.06, 0.316], [0, 0.58, z]);
      s.rotation.x = Math.PI / 2;
      body.add(s);
    });
    [-0.5, 0.5].forEach(a => {
      const s = box(0.07, 0.02, 0.44, C.refl, 0, 0.9, -0.02);
      s.rotation.y = a;
      body.add(s);
    });

    // hlava (kulatá „jablíčková“)
    const head = new THREE.Group();
    head.position.set(0, 0.98, -0.36);
    body.add(head);
    head.add(mesh(gSph(), C.fur, [0.28, 0.26, 0.26], [0, 0, 0]));
    [-1, 1].forEach(s => head.add(mesh(gSph(), C.cream, [0.13, 0.13, 0.12], [s * 0.19, -0.1, -0.04])));
    head.add(mesh(gSph(), C.cream, [0.13, 0.1, 0.12], [0, -0.08, -0.2]));
    head.add(mesh(gSph(), C.dark, [0.045, 0.035, 0.035], [0, -0.04, -0.32]));
    [-1, 1].forEach(s => {
      head.add(mesh(gSph(), C.dark, [0.07, 0.07, 0.05], [s * 0.115, 0.02, -0.2]));
      head.add(mesh(gSph(), C.white, [0.018, 0.018, 0.012], [s * 0.115 + 0.02, 0.045, -0.245], false));
      const ear = new THREE.Group();
      ear.position.set(s * 0.25, 0.07, 0.03);
      ear.rotation.z = -s * 0.95;
      ear.rotation.x = 0.15;
      ear.add(mesh(gCone(), C.fur, [0.18, 0.52, 0.07], [0, 0.26, 0]));
      ear.add(mesh(gCone(), C.pink, [0.12, 0.38, 0.03], [0, 0.22, -0.035]));
      // dlouhé chlupy na okrajích uší
      [0.08, 0.2, 0.32].forEach((y, i) => ear.add(mesh(gSph(), C.cream, [0.06 - i * 0.012, 0.08, 0.05], [s * (0.15 - y * 0.3), y, 0.01])));
      head.add(ear);
    });
    const hat = makeHardHat(0.27, { strap: true });
    hat.position.set(0, 0.05, -0.005);
    hat.rotation.x = -0.16;
    head.add(hat);

    // nohy (tenké, se „kalhotkami“ na zadních)
    const legs = [];
    [[-0.15, -0.22], [0.15, -0.22], [-0.15, 0.24], [0.15, 0.24]].forEach(([x, z], i) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.45, z);
      pivot.add(mesh(gCyl(10), C.fur, [0.07, 0.4, 0.07], [0, -0.2, 0]));
      if (i > 1) pivot.add(mesh(gSph(), C.cream, [0.11, 0.17, 0.12], [0, -0.06, 0.04]));
      pivot.add(mesh(gSph(), C.cream, [0.08, 0.055, 0.1], [0, -0.41, -0.03]));
      body.add(pivot);
      legs.push(pivot);
    });

    // ocas: chlupatý chochol stočený nad hřbet
    const tail = new THREE.Group();
    tail.position.set(0, 0.7, 0.36);
    const R = 0.3;
    for (let i = 0; i <= 7; i++) {
      const t = (i / 7) * 2.3;
      const r = 0.08 + Math.sin((i / 7) * Math.PI) * 0.07;
      tail.add(mesh(gSph(), i % 2 ? C.cream : C.fur, [r, r, r * 1.1], [0, R * Math.sin(t), -R * (1 - Math.cos(t)) + 0.06]));
    }
    body.add(tail);

    // štít
    const bubble = new THREE.Mesh(gSph(), M(0x9cf6ff, { t: true, op: 0.22, e: 0x2fd0ff, ei: 0.8, dw: false }));
    bubble.scale.set(0.9, 0.95, 1.05);
    bubble.position.y = 0.72;
    bubble.visible = false;
    root.add(bubble);

    return { root, body, head, legs, tail, bubble };
  }
  // společné: reflexní vesta na válcovém trupu a přilba
  function addVest(body, r, y, len, z = 0) {
    const vg = G('vestCyl', () => new THREE.CylinderGeometry(1, 1, 1, 24, 1, true));
    const v = mesh(vg, C.vest, [r, len, r * 0.95], [0, y, z]);
    v.rotation.x = Math.PI / 2;
    body.add(v);
    [-len * 0.25, len * 0.2].forEach(dz => {
      const s = mesh(vg, C.refl, [r * 1.02, 0.06, r * 0.97], [0, y, z + dz]);
      s.rotation.x = Math.PI / 2;
      body.add(s);
    });
  }
  function addHelmet(head, r, y, strap = false) {
    const hat = makeHardHat(r, { strap });
    hat.position.set(0, y, 0.01);
    hat.rotation.x = -0.12;
    head.add(hat);
    return hat;
  }
  function makeBubble(root, sx, sy, sz, y) {
    const bubble = new THREE.Mesh(gSph(), M(0x9cf6ff, { t: true, op: 0.22, e: 0x2fd0ff, ei: 0.8, dw: false }));
    bubble.scale.set(sx, sy, sz);
    bubble.position.y = y;
    bubble.visible = false;
    root.add(bubble);
    return bubble;
  }

  function buildCat() {
    // zrzavé mourovaté kotě
    const root = new THREE.Group(), body = new THREE.Group();
    root.add(body);
    body.add(mesh(gSph(), C.catFur, [0.26, 0.24, 0.4], [0, 0.52, 0]));
    [-0.12, 0.05, 0.2].forEach(z => body.add(mesh(gSph(), C.catStripe, [0.265, 0.07, 0.06], [0, 0.6, z])));
    body.add(mesh(gSph(), C.catLight, [0.18, 0.18, 0.16], [0, 0.48, -0.28]));
    addVest(body, 0.285, 0.54, 0.46, -0.02);
    const head = new THREE.Group();
    head.position.set(0, 0.88, -0.34);
    body.add(head);
    head.add(mesh(gSph(), C.catFur, [0.24, 0.21, 0.21], [0, 0, 0]));
    head.add(mesh(gSph(), C.catLight, [0.13, 0.09, 0.1], [0, -0.07, -0.15]));
    head.add(mesh(gSph(), C.pink, [0.035, 0.025, 0.025], [0, -0.03, -0.24]));
    [-1, 1].forEach(sd => {
      head.add(mesh(gSph(), C.green, [0.06, 0.065, 0.04], [sd * 0.1, 0.03, -0.17]));
      head.add(mesh(gSph(), C.dark, [0.02, 0.05, 0.02], [sd * 0.1, 0.03, -0.205]));
      const ear = new THREE.Group();
      ear.position.set(sd * 0.2, 0.07, 0.02);
      ear.rotation.z = -sd * 0.85;
      ear.add(mesh(gCone(), C.catFur, [0.1, 0.22, 0.06], [0, 0.11, 0]));
      ear.add(mesh(gCone(), C.pink, [0.06, 0.15, 0.03], [0, 0.09, -0.03]));
      head.add(ear);
      [-0.02, 0.02].forEach(dy => head.add(box(0.2, 0.006, 0.006, C.white, sd * 0.17, -0.06 + dy, -0.17, false)));
    });
    addHelmet(head, 0.235, 0.075, true).rotation.x = -0.22;
    const legs = [];
    [[-0.13, -0.2], [0.13, -0.2], [-0.13, 0.22], [0.13, 0.22]].forEach(([x, z]) => {
      const pv = new THREE.Group();
      pv.position.set(x, 0.42, z);
      pv.add(mesh(gCyl(10), C.catFur, [0.065, 0.38, 0.065], [0, -0.19, 0]));
      pv.add(mesh(gSph(), C.catLight, [0.075, 0.05, 0.09], [0, -0.39, -0.03]));
      body.add(pv);
      legs.push(pv);
    });
    // dlouhý ocas zvednutý nahoru
    const tail = new THREE.Group();
    tail.position.set(0, 0.62, 0.36);
    for (let i = 0; i < 9; i++) {
      const tt = i / 8;
      tail.add(mesh(gSph(), i % 3 === 2 ? C.catStripe : C.catFur, [0.05, 0.05, 0.05], [0, tt * 0.55, 0.12 * Math.sin(tt * 2.2)]));
    }
    body.add(tail);
    const bubble = makeBubble(root, 0.8, 0.85, 0.95, 0.66);
    return { root, body, head, legs, tail, bubble };
  }

  function buildHuman() {
    // pracovník v montérkách (přikrčená „chibi“ postava, aby seděla do průjezdů)
    const root = new THREE.Group(), body = new THREE.Group();
    root.add(body);
    body.add(box(0.42, 0.42, 0.26, C.shirt, 0, 0.78, 0));
    body.add(box(0.44, 0.3, 0.28, C.vest, 0, 0.82, 0));
    body.add(box(0.45, 0.05, 0.29, C.refl, 0, 0.74, 0));
    body.add(box(0.45, 0.05, 0.29, C.refl, 0, 0.9, 0));
    body.add(box(0.42, 0.12, 0.26, C.jeans, 0, 0.53, 0));
    const head = new THREE.Group();
    head.position.set(0, 1.15, 0);
    body.add(head);
    head.add(mesh(gSph(), C.skin, [0.2, 0.21, 0.2], [0, 0, 0]));
    head.add(mesh(gSph(), C.hair, [0.205, 0.12, 0.2], [0, 0.06, 0.03]));
    [-1, 1].forEach(sd => {
      head.add(mesh(gSph(), C.dark, [0.025, 0.03, 0.02], [sd * 0.07, 0.01, -0.18]));
      head.add(mesh(gSph(), C.skin, [0.04, 0.05, 0.03], [sd * 0.2, 0, 0]));
    });
    head.add(mesh(gSph(), C.skin, [0.035, 0.04, 0.04], [0, -0.04, -0.2]));
    addHelmet(head, 0.212, 0.05, true);
    const limb = (x, y, len, mat, end, endMat) => {
      const pv = new THREE.Group();
      pv.position.set(x, y, 0);
      pv.add(box(0.13, len, 0.14, mat, 0, -len / 2, 0));
      pv.add(box(end[0], end[1], end[2], endMat, 0, -len - end[1] / 2 + 0.02, end[3]));
      body.add(pv);
      return pv;
    };
    const legL = limb(-0.11, 0.5, 0.42, C.jeans, [0.15, 0.09, 0.22, -0.04], C.boot);
    const legR = limb(0.11, 0.5, 0.42, C.jeans, [0.15, 0.09, 0.22, -0.04], C.boot);
    const armL = limb(-0.28, 0.95, 0.36, C.shirt, [0.1, 0.09, 0.1, 0], C.skin);
    const armR = limb(0.28, 0.95, 0.36, C.shirt, [0.1, 0.09, 0.1, 0], C.skin);
    const tail = new THREE.Group(); // bez ocasu
    body.add(tail);
    const bubble = makeBubble(root, 0.7, 0.95, 0.7, 0.75);
    return { root, body, head, legs: [legL, legR, armL, armR], tail, bubble, biped: true };
  }

  function buildSnail() {
    // šnek s ulitou – „nohy“ jsou jen neviditelné klouby, aby šla použít společná animace
    const root = new THREE.Group(), body = new THREE.Group();
    root.add(body);
    body.add(mesh(gSph(), C.snail, [0.26, 0.16, 0.62], [0, 0.16, -0.05]));
    body.add(mesh(gSph(), C.snailDark, [0.27, 0.05, 0.6], [0, 0.04, -0.05]));
    // ulita: spirála z koulí
    const shell = new THREE.Group();
    shell.position.set(0, 0.55, 0.12);
    shell.add(mesh(gSph(), C.shell, [0.36, 0.36, 0.3], [0, 0, 0]));
    for (let i = 0; i < 14; i++) {
      const a = i * 0.55, r = 0.3 - i * 0.018;
      shell.add(mesh(gSph(), i % 2 ? C.shellLight : C.shell, [0.07, 0.07, 0.07], [0.31 * (i % 2 ? 1 : -1) * 0, Math.sin(a) * r, Math.cos(a) * r]));
    }
    [-1, 1].forEach(sd => shell.add(mesh(G('torusS', () => new THREE.TorusGeometry(1, 0.12, 8, 24)), C.shellLight, [0.2, 0.2, 0.2], [sd * 0.3, 0, 0])).rotation.y = Math.PI / 2);
    body.add(shell);
    // reflexní pás přes ulitu
    const band = mesh(G('vestCyl', () => new THREE.CylinderGeometry(1, 1, 1, 24, 1, true)), C.vest, [0.37, 0.14, 0.37], [0, 0.55, 0.12]);
    band.rotation.z = Math.PI / 2;
    body.add(band);
    const head = new THREE.Group();
    head.position.set(0, 0.36, -0.5);
    body.add(head);
    head.add(mesh(gSph(), C.snail, [0.17, 0.17, 0.17], [0, 0, 0]));
    head.add(mesh(gSph(), C.dark, [0.03, 0.02, 0.02], [0, -0.04, -0.16]));
    addHelmet(head, 0.175, 0.04);
    // tykadla s očima (vrtí se jako ocas)
    const tail = new THREE.Group();
    tail.position.set(0, -0.03, -0.13);
    tail.rotation.x = -1.15;
    [-1, 1].forEach(sd => {
      const st = new THREE.Group();
      st.position.set(sd * 0.08, 0, 0);
      st.rotation.z = -sd * 0.35;
      st.add(mesh(gCyl(8), C.snail, [0.025, 0.32, 0.025], [0, 0.16, 0]));
      st.add(mesh(gSph(), C.white, [0.055, 0.055, 0.055], [0, 0.34, 0]));
      st.add(mesh(gSph(), C.dark, [0.03, 0.03, 0.03], [0, 0.35, -0.04]));
      tail.add(st);
    });
    head.add(tail);
    const legs = [0, 1, 2, 3].map(() => { const g = new THREE.Group(); body.add(g); return g; });
    const bubble = makeBubble(root, 0.75, 0.75, 0.95, 0.45);
    return { root, body, head, legs, tail, bubble, snail: true };
  }

  const CHARS = {
    civava: { name: 'Čivava', icon: '🐕', build: buildDog },
    kote: { name: 'Kotě', icon: '🐈', build: buildCat },
    clovek: { name: 'Člověk', icon: '👷', build: buildHuman },
    snek: { name: 'Šnek', icon: '🐌', build: buildSnail },
  };
  let charKey = CHARS[store.get('safetyrun_char', 'civava')] ? store.get('safetyrun_char', 'civava') : 'civava';
  let dog = CHARS[charKey].build();
  scene.add(dog.root);
  function setChar(k) {
    if (!CHARS[k]) return;
    charKey = k; store.set('safetyrun_char', k);
    scene.remove(dog.root);
    dog = CHARS[k].build();
    scene.add(dog.root);
  }

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

  // --- překážky pro další prostředí (stejné rozměry kolizí jako originály)
  Object.assign(builders, {
    wetSign() {
      const g = new THREE.Group();
      [-0.45, 0.45].forEach(x => {
        [-1, 1].forEach(sd => { const p = box(0.42, 0.72, 0.03, C.hat, x, 0.36, sd * 0.13); p.rotation.x = sd * 0.35; g.add(p); });
        g.add(box(0.3, 0.08, 0.04, C.rubber, x, 0.45, -0.17, false));
      });
      g.add(mesh(G('puddle', () => new THREE.CircleGeometry(1, 20)), C.water, [0.9, 0.5, 1], [0, 0.012, 0.45], false)).rotation.x = -Math.PI / 2;
      return { g, boxes: [{ hx: 0.75, hz: 0.3, y0: 0, y1: 0.78 }] };
    },
    paperBoxes() {
      const g = new THREE.Group();
      [[-0.4, 0], [0.4, 0], [0, 0.42]].forEach(([x, y], i) => {
        g.add(box(0.7, 0.4, 0.9, C.cardboard, x, 0.2 + y, 0));
        g.add(box(0.72, 0.05, 0.2, C.paper, x, 0.4 + y, 0, false));
      });
      return { g, boxes: [{ hx: 0.78, hz: 0.58, y0: 0, y1: 0.8 }] };
    },
    cabinet() {
      const g = new THREE.Group();
      g.add(box(1.7, 2.2, 1.2, C.grey, 0, 1.1, 0));
      for (let i = 0; i < 4; i++) {
        g.add(box(1.6, 0.02, 0.02, C.greyDark, 0, 0.45 + i * 0.5, 0.61, false));
        g.add(box(0.3, 0.05, 0.04, C.silver, 0, 0.62 + i * 0.5, 0.62, false));
      }
      g.add(box(1.72, 0.28, 0.02, C.hazard, 0, 0.15, 0.61, false));
      return { g, boxes: [{ hx: 0.9, hz: 0.68, y0: 0, y1: 2.3 }] };
    },
    cleaningCart() {
      const g = new THREE.Group();
      g.add(box(1.2, 1.2, 2.2, C.dairyBlue, 0, 0.9, 0));
      g.add(box(1.25, 0.1, 2.25, C.greyDark, 0, 0.3, 0));
      [[-0.5, 0.9], [0.5, 0.9], [-0.5, -0.9], [0.5, -0.9]].forEach(([x, z]) => { const w = mesh(G('cwheel', () => new THREE.CylinderGeometry(0.15, 0.15, 0.12, 12)), C.rubber, null, [x, 0.15, z]); w.rotation.z = Math.PI / 2; g.add(w); });
      g.add(mesh(gCyl(), C.hat, [0.35, 0.5, 0.35], [0, 1.75, 0.4]));
      g.add(cyl(0.03, 1.6, C.wood, 0.3, 2.0, -0.4));
      g.add(box(1.25, 0.25, 0.04, C.hazard, 0, 1.1, 1.11, false));
      g.add(mesh(gCyl(), C.beacon, [0.08, 0.12, 0.08], [-0.4, 2.3, -0.6], false));
      return { g, boxes: [{ hx: 0.78, hz: 1.2, y0: 0, y1: 2.3 }], vz: 4.5 };
    },
    cableBridge() { return buildLowPass(false, 'cables'); },
    cableBridgeWide() { return buildLowPass(true, 'cables'); },
    floorHatch() { return buildHole('#3a3f46', C.grey, C.hat); },
    brickPallet() {
      const g = new THREE.Group();
      g.add(box(1.5, 0.12, 1.1, C.wood, 0, 0.06, 0));
      for (let y = 0; y < 3; y++) for (let x = -1; x <= 1; x++) g.add(box(0.46, 0.2, 1.0, y % 2 ? C.brick : M(0xa64a33, { r: 0.9 }), x * 0.48, 0.22 + y * 0.21, 0));
      return { g, boxes: [{ hx: 0.78, hz: 0.58, y0: 0, y1: 0.8 }] };
    },
    skip() {
      const g = new THREE.Group();
      g.add(box(1.75, 1.6, 1.3, C.skip, 0, 0.8, 0));
      g.add(box(1.4, 0.4, 1.0, C.concreteDark, 0, 1.75, 0));
      [-0.5, 0.5].forEach(x => g.add(box(0.12, 0.6, 1.32, C.steelDark, x, 2.0, 0)));
      g.add(box(1.77, 0.28, 0.02, C.hazard, 0, 0.3, 0.66, false));
      return { g, boxes: [{ hx: 0.9, hz: 0.68, y0: 0, y1: 2.3 }] };
    },
    dumper() {
      const g = new THREE.Group();
      g.add(box(1.3, 0.7, 1.5, C.skip, 0, 0.75, -0.4));
      const bucket = box(1.4, 0.8, 1.2, C.hat, 0, 1.2, 0.6); bucket.rotation.x = -0.25; g.add(bucket);
      [[-0.65, 0.6], [0.65, 0.6], [-0.65, -0.8], [0.65, -0.8]].forEach(([x, z]) => { const w = mesh(G('dwheel', () => new THREE.CylinderGeometry(0.42, 0.42, 0.3, 16)), C.rubber, null, [x, 0.42, z]); w.rotation.z = Math.PI / 2; g.add(w); });
      g.add(box(0.08, 1.1, 0.08, C.steelDark, 0.5, 1.6, -0.9));
      g.add(box(0.08, 1.1, 0.08, C.steelDark, -0.5, 1.6, -0.9));
      g.add(box(1.1, 0.06, 0.4, C.steelDark, 0, 2.15, -0.9));
      g.add(mesh(gCyl(), C.beacon, [0.09, 0.14, 0.09], [0.4, 2.28, -0.9], false));
      return { g, boxes: [{ hx: 0.78, hz: 1.5, y0: 0, y1: 2.3 }], vz: 5.5 };
    },
    scaffold() { return buildLowPass(false, 'scaffold'); },
    scaffoldWide() { return buildLowPass(true, 'scaffold'); },
    milkCans() {
      const g = new THREE.Group();
      [-0.45, 0.45].forEach(x => {
        g.add(mesh(gCyl(), C.steelBright, [0.22, 0.55, 0.22], [x, 0.28, 0]));
        g.add(mesh(gCyl(), C.steelBright, [0.12, 0.18, 0.12], [x, 0.64, 0]));
        g.add(mesh(gCyl(), C.dairyBlue, [0.14, 0.04, 0.14], [x, 0.74, 0]));
      });
      return { g, boxes: [{ hx: 0.75, hz: 0.3, y0: 0, y1: 0.78 }] };
    },
    crates() {
      const g = new THREE.Group();
      [[-0.38, 0, C.crateBlue], [0.38, 0, C.crateRed], [0, 0.38, C.crateBlue]].forEach(([x, y, m]) => {
        g.add(box(0.72, 0.36, 0.95, m, x, 0.18 + y, 0));
        for (let i = -1; i <= 1; i++) g.add(mesh(gCyl(), C.milk, [0.07, 0.3, 0.07], [x + i * 0.2, 0.42 + y, 0], false));
      });
      return { g, boxes: [{ hx: 0.78, hz: 0.58, y0: 0, y1: 0.8 }] };
    },
    steelTank() {
      const g = new THREE.Group();
      g.add(mesh(gCyl(24), C.steelBright, [0.85, 2.0, 0.65], [0, 1.15, 0]));
      g.add(mesh(gSph(), C.steelBright, [0.85, 0.25, 0.65], [0, 2.15, 0]));
      [-0.5, 0.5].forEach(x => g.add(box(0.08, 0.3, 0.08, C.steel, x, 0.15, 0)));
      g.add(box(1.0, 0.25, 0.02, C.dairyBlue, 0, 1.4, 0.66, false));
      return { g, boxes: [{ hx: 0.9, hz: 0.68, y0: 0, y1: 2.3 }] };
    },
    dairyForklift() {
      const g = buildForklift(C.dairyBlue);
      return { g, boxes: [{ hx: 0.78, hz: 1.5, y0: 0, y1: 2.3 }], vz: 5.5 };
    },
    steelPipe() { return buildLowPass(false, 'steel'); },
    steelPipeWide() { return buildLowPass(true, 'steel'); },
    drain() { return buildHole('#2a2f33', C.steelBright, C.dairyBlue); },
  });
  // nízký průjezd v různých prostředích (kolize = původní potrubí)
  function buildLowPass(wide, kind) {
    const r = buildPipe(wide);
    if (kind === 'steel') {
      r.g.traverse(o => { if (o.isMesh && (o.material === C.red || o.material === C.blue || o.material === C.silver)) o.material = C.steelBright; });
      return r;
    }
    const g = new THREE.Group();
    const half = wide ? 3.7 : 1.08, len = half * 2;
    const post = kind === 'scaffold' ? C.silver : C.greyDark;
    [-half, half].forEach(x => { g.add(box(0.12, 2.7, 0.12, post, x, 1.35, 0)); g.add(box(0.3, 0.05, 0.3, C.steelDark, x, 0.025, 0)); });
    if (kind === 'scaffold') {
      [1.05, 1.6].forEach(y => g.add(box(len, 0.08, 0.08, C.silver, 0, y, 0)));
      g.add(box(len, 0.06, 0.6, C.wood, 0, 1.12, -0.2));
      const d = box(len * 1.05, 0.06, 0.06, C.silver, 0, 1.8, 0); d.rotation.z = 0.25; g.add(d);
    } else {
      g.add(box(len, 0.08, 0.45, C.greyDark, 0, 1.05, 0));
      [-0.12, 0, 0.12].forEach((z, i) => g.add(box(len, 0.06, 0.06, [C.red, C.blue, C.hat][i], 0, 1.13, z)));
    }
    const sign = new THREE.Mesh(gBox(), [C.steelDark, C.steelDark, C.steelDark, C.steelDark, M(0xffffff, { map: signTex[kind], r: 0.6 }), C.steelDark]);
    sign.scale.set(wide ? 6.2 : len - 0.1, 0.7, 0.06); sign.position.set(0, 2.25, 0.1); sign.castShadow = true;
    g.add(sign);
    return { g, boxes: [{ hx: wide ? 3.8 : 1.1, hz: 0.24, y0: 0.93, y1: 2.6 }] };
  }
  function buildHole(inner, rimMat, postMat) {
    const g = new THREE.Group();
    const hole = new THREE.Mesh(G('pitPlane', () => new THREE.PlaneGeometry(1.8, 2.5)), M(0xffffff, { map: holeTex(inner), r: 1 }));
    hole.rotation.x = -Math.PI / 2; hole.position.y = 0.012;
    g.add(hole);
    g.add(box(1.9, 0.06, 0.12, rimMat, 0, 0.03, -1.28, false));
    g.add(box(1.9, 0.06, 0.12, rimMat, 0, 0.03, 1.28, false));
    [[-0.95, -1.3], [0.95, -1.3], [-0.95, 1.3], [0.95, 1.3]].forEach(([x, z]) => g.add(box(0.1, 0.7, 0.1, postMat === C.hat ? C.hazard : postMat, x, 0.35, z)));
    const lid = box(1.0, 0.04, 1.4, rimMat, -1.3, 0.3, -0.6); lid.rotation.z = 0.6; g.add(lid);
    return { g, boxes: [], pit: { hx: 0.8, hz: 1.12 } };
  }
  const holeTexCache = {};
  function holeTex(inner) {
    if (!holeTexCache[inner]) holeTexCache[inner] = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = inner; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 12; i++) { const p = i * 5; g.fillStyle = `rgba(0,0,0,${0.07 * i})`; g.fillRect(p, p, w - p * 2, h - p * 2); }
    });
    return holeTexCache[inner];
  }

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
      const keys = TH.signs;
      const t = signTex[keys[Math.floor(Math.random() * keys.length)]];
      [-0.9, 0.9].forEach(z => g.add(box(0.08, 2.2, 0.08, C.steel, 0, 1.1, z, false)));
      const b = new THREE.Mesh(gBox(), [M(0xffffff, { map: t }), M(0xffffff, { map: t }), C.steel, C.steel, C.steel, C.steel]);
      b.scale.set(0.06, 1.0, 2.2);
      b.position.y = 2.0;
      g.add(b);
      return g;
    },
  };
  Object.assign(decorBuilders, {
    plant() {
      const g = new THREE.Group();
      g.add(mesh(gCyl(), C.pot, [0.35, 0.6, 0.35], [0, 0.3, 0], false));
      [[0, 1.0, 0, 0.45], [0.2, 1.3, 0.1, 0.3], [-0.2, 1.25, -0.1, 0.32]].forEach(([x, y, z, r]) => g.add(mesh(gSph(), C.plant, [r, r, r], [x, y, z], false)));
      return g;
    },
    desk() {
      const g = new THREE.Group();
      g.add(box(1.2, 0.06, 2.0, C.deskTop, 0, 0.75, 0, false));
      [[-0.55, -0.9], [0.55, -0.9], [-0.55, 0.9], [0.55, 0.9]].forEach(([x, z]) => g.add(box(0.05, 0.75, 0.05, C.greyDark, x, 0.37, z, false)));
      g.add(box(0.05, 0.4, 0.6, C.rubber, 0.2, 1.05, 0, false));
      g.add(box(0.3, 0.02, 0.5, C.greyDark, -0.2, 0.79, 0, false));
      return g;
    },
    cooler() {
      const g = new THREE.Group();
      g.add(box(0.4, 1.0, 0.4, C.whiteBoard, 0, 0.5, 0, false));
      g.add(mesh(gCyl(), C.water, [0.17, 0.45, 0.17], [0, 1.23, 0], false));
      return g;
    },
    bench() {
      const g = new THREE.Group();
      g.add(box(0.5, 0.08, 2.0, C.wood, 0, 0.45, 0, false));
      g.add(box(0.08, 0.45, 2.0, C.wood, 0.22, 0.75, 0, false));
      [-0.8, 0.8].forEach(z => g.add(box(0.4, 0.45, 0.06, C.greyDark, 0, 0.22, z, false)));
      return g;
    },
    bricks() {
      const g = new THREE.Group();
      const n = 1 + Math.floor(Math.random() * 3);
      for (let c = 0; c < n; c++) { g.add(box(1.1, 0.12, 1.1, C.wood, 0, 0.06, c * 1.4, false)); g.add(box(1.0, 0.7, 1.0, C.brick, 0, 0.47, c * 1.4, false)); }
      return g;
    },
    rebar() {
      const g = new THREE.Group();
      [-0.6, 0.6].forEach(z => g.add(box(0.5, 0.2, 0.2, C.wood, 0, 0.1, z, false)));
      for (let i = 0; i < 10; i++) g.add(box(0.05, 0.05, 3.0, C.rebar, -0.2 + (i % 5) * 0.1, 0.24 + Math.floor(i / 5) * 0.06, 0, false));
      return g;
    },
    sand() {
      const g = new THREE.Group();
      g.add(mesh(gCone(), C.sand, [1.4, 1.1, 1.4], [0, 0.55, 0], false));
      return g;
    },
    mixer() {
      const g = new THREE.Group();
      const drum = mesh(gCyl(16), C.skip, [0.45, 0.9, 0.45], [0, 1.0, 0], false); drum.rotation.x = 0.6; g.add(drum);
      g.add(box(0.8, 0.1, 1.2, C.steelDark, 0, 0.45, 0, false));
      [-0.4, 0.4].forEach(x => { const w = mesh(G('mwheel', () => new THREE.CylinderGeometry(0.22, 0.22, 0.1, 12)), C.rubber, null, [x, 0.22, 0.3], false); w.rotation.z = Math.PI / 2; g.add(w); });
      return g;
    },
    silo() {
      const g = new THREE.Group();
      g.add(mesh(gCyl(20), C.steelBright, [1.3, 7, 1.3], [0, 3.8, 0], false));
      g.add(mesh(gCone(), C.steelBright, [1.3, 0.8, 1.3], [0, 7.7, 0], false));
      [-0.9, 0.9].forEach(x => [-0.9, 0.9].forEach(z => g.add(box(0.12, 0.6, 0.12, C.steel, x, 0.3, z, false))));
      g.add(box(1.4, 0.4, 0.02, C.dairyBlue, 0, 4.5, 1.31, false));
      return g;
    },
    crates() {
      const g = new THREE.Group();
      const n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) g.add(box(0.8, 0.36, 1.0, i % 2 ? C.crateRed : C.crateBlue, 0, 0.18 + i * 0.37, 0, false));
      return g;
    },
    tanker() {
      const g = new THREE.Group();
      const tank = mesh(gCyl(20), C.steelBright, [0.95, 5.5, 0.95], [0, 1.6, 0.6], false); tank.rotation.x = Math.PI / 2; g.add(tank);
      g.add(box(1.9, 1.6, 1.6, C.whiteBoard, 0, 1.25, -3.0, false));
      g.add(box(1.92, 0.5, 0.02, C.glass, 0, 1.6, -3.81, false));
      [[-0.85, -2.8], [0.85, -2.8], [-0.85, 1.8], [0.85, 1.8], [-0.85, 2.8], [0.85, 2.8]].forEach(([x, z]) => { const w = mesh(G('wheel', () => new THREE.CylinderGeometry(0.3, 0.3, 0.26, 16)), C.rubber, null, [x, 0.4, z], false); w.rotation.z = Math.PI / 2; g.add(w); });
      g.add(box(1.92, 0.3, 4.0, C.dairyBlue, 0, 0.75, 0.6, false));
      g.rotation.y = Math.PI / 2;
      return g;
    },
  });
  // haly
  let hallMats = [];
  const officeTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#7fa6c9'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#dfe5ea';
    for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 4, h);
    for (let y = 0; y < h; y += 42) g.fillRect(0, y, w, 6);
  }, 4, 3);
  const roofMat = M(0x5f6670, { r: 0.6, m: 0.3 });
  function buildOffice(side, len) {
    const g = new THREE.Group();
    const w = 14, h = 10 + Math.random() * 8;
    g.add(mesh(gBox(), M(0xffffff, { map: officeTex, r: 0.15, m: 0.3 }), [w, h, len], [0, h / 2, 0], false));
    g.add(box(w + 0.4, 0.4, len + 0.4, C.whiteBoard, 0, h + 0.2, 0, false));
    const face = -side * (w / 2 + 0.05);
    const door = box(0.1, 3, 4, C.glass, face, 1.5, 0, false); g.add(door);
    g.add(box(0.3, 0.3, 5, C.whiteBoard, face - side * 0.6, 3.2, 0, false));
    if (len > 22) {
      const t = new THREE.Mesh(G('plane', () => new THREE.PlaneGeometry(1, 1)), M(0xffffff, { map: Math.random() < 0.5 ? signTex.hall : signTex.hall2 }));
      t.scale.set(7, 1.75, 1); t.position.set(face - side * 0.02, 4.4, 4.5); t.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; g.add(t);
    }
    return g;
  }
  function buildFrame(side, len) {
    // rozestavěná budova: skelet, stropy, lešení se sítí
    const g = new THREE.Group();
    const w = 12, floors = 2 + Math.floor(Math.random() * 3), fh = 3.2;
    for (let f = 0; f <= floors; f++) g.add(box(w, 0.3, len, C.concrete, 0, f * fh + 0.15, 0, false));
    for (let f = 0; f < floors; f++) for (let z = -len / 2 + 1; z <= len / 2 - 1; z += 5) [-w / 2 + 0.5, w / 2 - 0.5].forEach(x => g.add(box(0.5, fh, 0.5, C.concreteDark, x, f * fh + fh / 2 + 0.3, z, false)));
    const face = -side * (w / 2 + 1.0);
    for (let z = -len / 2; z <= len / 2; z += 2.5) g.add(box(0.08, floors * fh, 0.08, C.silver, face, floors * fh / 2, z, false));
    for (let f = 1; f <= floors; f++) g.add(box(0.08, 0.08, len, C.silver, face, f * fh, 0, false));
    const net = new THREE.Mesh(G('plane', () => new THREE.PlaneGeometry(1, 1)), C.netGreen);
    net.scale.set(len * 0.6, floors * fh * 0.6, 1); net.position.set(face - side * 0.05, floors * fh * 0.55, (Math.random() - 0.5) * len * 0.3); net.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(net);
    if (len > 22) {
      const t = new THREE.Mesh(G('plane', () => new THREE.PlaneGeometry(1, 1)), M(0xffffff, { map: signTex.site }));
      t.scale.set(6, 1.5, 1); t.position.set(face - side * 0.1, 1.6, 0); t.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; g.add(t);
    }
    return g;
  }
  function buildHall(side, len) {
    if (TH.hallStyle === 'office') return buildOffice(side, len);
    if (TH.hallStyle === 'frame') return buildFrame(side, len);
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
  function buildPortal() {
    if (TH.gantry === 'exitPortal') {
      const g = new THREE.Group();
      [-6.2, 6.2].forEach(x => g.add(box(0.5, 6.5, 0.5, C.whiteBoard, x, 3.25, 0, false)));
      g.add(box(13, 0.6, 0.6, C.whiteBoard, 0, 6.6, 0, false));
      const sgn = new THREE.Mesh(gBox(), [C.exitGreen, C.exitGreen, C.exitGreen, C.exitGreen, M(0xffffff, { map: signTex.exit }), C.exitGreen]);
      sgn.scale.set(3.2, 0.9, 0.1); sgn.position.set(0, 5.9, 0.2); g.add(sgn);
      return g;
    }
    if (TH.gantry === 'crane') {
      // věžový jeřáb vedle trati s výložníkem nad tratí
      const g = new THREE.Group();
      const sx = Math.random() < 0.5 ? -9 : 9;
      g.add(box(1.0, 16, 1.0, C.hat, sx, 8, 0, false));
      g.add(box(2.6, 1.0, 2.6, C.concreteDark, sx, 0.5, 0, false));
      g.add(box(22, 0.6, 0.8, C.hat, sx * 0.1, 16.2, 0, false));
      g.add(box(1.6, 1.4, 1.4, C.steelDark, sx + Math.sign(sx) * 3, 15.6, 0, false));
      g.add(cyl(0.03, 6, C.steelDark, -sx * 0.4, 13, 0, false));
      g.add(box(0.8, 0.5, 0.8, C.concrete, -sx * 0.4, 9.8, 0, false));
      return g;
    }
    if (TH.gantry === 'pipeBridge') {
      const g = new THREE.Group();
      [-6.2, 6.2].forEach(x => g.add(box(0.4, 7, 0.4, C.steel, x, 3.5, 0, false)));
      g.add(box(13, 0.2, 1.2, C.steel, 0, 6.9, 0, false));
      [-0.4, 0, 0.4].forEach((z, i) => { const pp = mesh(G('pipeCyl', () => new THREE.CylinderGeometry(1, 1, 1, 14)), i === 1 ? C.dairyBlue : C.steelBright, [0.18, 13, 0.18], [0, 7.25, z], false); pp.rotation.z = Math.PI / 2; g.add(pp); });
      return g;
    }
    return buildGantry();
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

  const extraTex = []; // další textury trati (nájezdy, křižovatky), překreslují se se změnou prostředí
  function repaint(tex, fn) {
    const c = tex.image, g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    fn(g, c.width, c.height);
    tex.needsUpdate = true;
  }
  function applyTheme(k) {
    if (!THEMES[k]) return;
    themeKey = k; TH = THEMES[k]; store.set('safetyrun_theme', k);
    repaint(skyTex, paintSky); repaint(trackTex, paintTrack); repaint(yardTex, paintYard);
    extraTex.forEach(tx => repaint(tx, paintTrack));
    scene.fog.color.set(TH.fog);
    hemi.groundColor.set(TH.hemiG);
    hallMats = TH.hallColors.map(c => M(c, { map: hallTex, r: 0.7, m: 0.2 }));
    themeHallSigns();
  }
  applyTheme(themeKey);

  // ---------------------------------------------------------------- stav hry
  let state = 'menu';
  let speed = START_SPEED;
  let distance = 0;
  let score = 0;
  let helmets = 0;
  let best = 0;
  try { best = parseInt(localStorage.getItem('safetyrun_best') || '0', 10) || 0; } catch (e) { /* bez úložiště */ }

  const player = { lane: 1, x: 0, y: 0, vy: 0, ground: 0, jumped: false, turnDir: 0, slide: 0, slideQueued: false, dead: false, deadT: 0, fall: false, runPhase: 0 };
  const power = { vest: 0, boots: 0, goggles: 0 };

  const obstacles = [];
  const pickups = [];
  const decor = [];

  function addEntity(list, obj, z, data) {
    obj.position.z = z;
    world.add(obj);
    const e = Object.assign({ obj, z, len: 0, vz: 0 }, data);
    list.push(e);
    return e;
  }
  function clearList(list) { list.forEach(e => world.remove(e.obj)); list.length = 0; }

  // spawnery (kurzor = z konce posledního objektu, jede se světem)
  const streams = {};
  function resetStreams(withRows) {
    streams.rows = { cursor: withRows ? -38 : -1e9, blocked: false, untilFeature: 9 + Math.floor(Math.random() * 6) };
    turn.pending = null; turn.active = null;
    streams.propsL = { cursor: 16 };
    streams.propsR = { cursor: 16 };
    streams.hallL = { cursor: 30 };
    streams.hallR = { cursor: 30 };
    streams.gantry = { cursor: -20 };
  }

  function rowGap() { return 12 + speed * 0.75; }

  // ---------------------------------------------------------------- vyvýšená úroveň (nájezd nahoru, rovina, sjezd dolů)
  const DECK_H = 2.4, RAMP = 10;
  const deckTex = canvasTex(256, 512, paintTrack, 1, 1);
  extraTex.push(deckTex);
  function buildDeck(L) {
    const g = new THREE.Group();
    const tex = deckTex.clone(); tex.needsUpdate = true; tex.repeat.set(1, L / TRACK_REP);
    const top = M(0xffffff, { map: tex, r: 0.9 });
    const rampTex = deckTex.clone(); rampTex.needsUpdate = true; rampTex.repeat.set(1, RAMP / TRACK_REP);
    const rampMat = M(0xffffff, { map: rampTex, r: 0.9 });
    const th = 0.35, hyp = Math.hypot(RAMP, DECK_H), ang = Math.atan2(DECK_H, RAMP);
    const up = mesh(gBox(), rampMat, [TRACK_W, th, hyp], [0, DECK_H / 2 - th / 2, -RAMP / 2]); up.rotation.x = ang; g.add(up);
    g.add(mesh(gBox(), top, [TRACK_W, th, L], [0, DECK_H - th / 2, -RAMP - L / 2]));
    const dn = mesh(gBox(), rampMat, [TRACK_W, th, hyp], [0, DECK_H / 2 - th / 2, -RAMP * 1.5 - L]); dn.rotation.x = -ang; g.add(dn);
    // boky: výstražný pruh, zábradlí a podpěry
    [-1, 1].forEach(sd => {
      const x = sd * (TRACK_W / 2 + 0.06);
      g.add(box(0.12, 0.35, L, C.hazard, x, DECK_H - 0.17, -RAMP - L / 2, false));
      g.add(box(0.08, 0.08, L, C.hat, x, DECK_H + 1.0, -RAMP - L / 2, false));
      for (let z = 0; z <= L; z += 3) g.add(box(0.07, 1.0, 0.07, C.hat, x, DECK_H + 0.5, -RAMP - z, false));
      for (let z = 2; z < L; z += 7) g.add(box(0.6, DECK_H - 0.3, 0.6, C.concreteDark, sd * (TRACK_W / 2 - 0.5), (DECK_H - 0.3) / 2, -RAMP - z, false));
      [-1, 1].forEach(e => { const r = box(0.12, 0.35, hyp, C.hazard, x, DECK_H / 2 - 0.17, e < 0 ? -RAMP / 2 : -RAMP * 1.5 - L, false); r.rotation.x = e < 0 ? ang : -ang; g.add(r); });
    });
    return g;
  }
  function spawnDeck(z) {
    const L = 45 + Math.random() * 45;
    addEntity(decor, buildDeck(L), z, { deck: { L, total: 2 * RAMP + L }, len: 2 * (2 * RAMP + L) + 4 });
  }
  // výška terénu v místě z (0 = základní úroveň)
  function deckAt(zq) {
    let h = 0, ramp = false;
    for (const e of decor) {
      if (!e.deck) continue;
      const d = e.z - zq, { L, total } = e.deck;
      if (d < 0 || d > total) continue;
      if (d < RAMP) { h = Math.max(h, DECK_H * d / RAMP); ramp = true; }
      else if (d < RAMP + L) h = Math.max(h, DECK_H);
      else { h = Math.max(h, DECK_H * (total - d) / RAMP); ramp = true; }
    }
    return { h, ramp };
  }

  // ---------------------------------------------------------------- odbočka doleva / doprava
  const turn = { pending: null, active: null, old: null };
  const TURN_TIME = 0.8;
  // tvar oblouku: natočení s pozvolným náběhem i doběhem, rychlost běhu se nemění
  const turnEase = u => u * u * (3 - 2 * u);
  const TURN_C = (() => { let c = 0; const n = 200; for (let i = 0; i < n; i++) c += Math.cos(Math.PI / 2 * turnEase((i + 0.5) / n)) / n; return c; })();
  const turnLead = () => speed * TURN_TIME * TURN_C;   // kolik metrů před středem křižovatky začne oblouk
  const TURN_LEAD_MAX = MAX_SPEED * TURN_TIME * TURN_C;
  const arrowTex = {
    '-1': textTex(['◄  ODBOČ VLEVO'], '#ffc410', '#16181b', true),
    '1': textTex(['ODBOČ VPRAVO  ►'], '#ffc410', '#16181b', true),
  };
  const junctionTex = canvasTex(256, 512, paintTrack, 1, 6);
  extraTex.push(junctionTex);
  function buildJunction(dir) {
    const g = new THREE.Group();
    // příčná trať směrem odbočky
    const floor = new THREE.Mesh(G('jFloor', () => new THREE.PlaneGeometry(TRACK_W, 60)), M(0xffffff, { map: junctionTex, r: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.rotation.z = Math.PI / 2;
    floor.position.set(dir * 30, 0.006, 0);
    floor.receiveShadow = true;
    g.add(floor);
    // zeď na konci rovného úseku přes celou šířku
    const wz = -(TRACK_W / 2 + 1.2);
    g.add(box(64, 9, 2, hallMats[0] || C.concrete, 0, 4.5, wz - 1, false));
    g.add(box(64, 0.5, 2.2, C.hazard, 0, 0.25, wz - 1, false));
    // zeď na neprůjezdné straně
    g.add(box(2, 9, 30, hallMats[1] || C.concrete, -dir * (TRACK_W / 2 + 1.5), 4.5, wz - 14, false));
    g.add(box(30, 9, 2, hallMats[1] || C.concrete, -dir * (TRACK_W / 2 + 16), 4.5, TRACK_W / 2 + 1.2, false));
    const sign = new THREE.Mesh(G('plane', () => new THREE.PlaneGeometry(1, 1)), M(0xffffff, { map: arrowTex[dir] }));
    sign.scale.set(9, 2.2, 1); sign.position.set(0, 3.4, wz + 0.02);
    g.add(sign);
    // šipky na zemi
    for (let i = 0; i < 3; i++) {
      const a = mesh(gCone(), C.hat, [0.5, 1.2, 0.05], [dir * (2 + i * 3), 0.05, 0], false);
      a.rotation.x = -Math.PI / 2; a.rotation.z = -dir * Math.PI / 2;
      g.add(a);
    }
    return g;
  }
  function spawnJunction(z) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    const e = addEntity(decor, buildJunction(dir), z, { junction: dir, len: 140 });
    turn.pending = e;
    streams.rows.blocked = true;
    // uvolnit průchod na straně odbočky: pryč s halami a dekoracemi v okolí křižovatky
    for (let i = decor.length - 1; i >= 0; i--) {
      const d = decor[i];
      if (d === e || d.deck) continue;
      const near = d.z + d.len / 2 > z - 10 && d.z - d.len / 2 < z + 10;
      const side = Math.sign(d.obj.position.x);
      if (near && side === dir) { world.remove(d.obj); decor.splice(i, 1); }
      else if (d.z < z - 4) { world.remove(d.obj); decor.splice(i, 1); } // za zdí nic nebude vidět
    }
    for (let i = obstacles.length - 1; i >= 0; i--) if (obstacles[i].z < z + 8 + TURN_LEAD_MAX) { world.remove(obstacles[i].obj); obstacles.splice(i, 1); }
    for (let i = pickups.length - 1; i >= 0; i--) if (pickups[i].z < z + 6 + TURN_LEAD_MAX) { world.remove(pickups[i].obj); pickups.splice(i, 1); }
    streams.hallL.cursor = Math.min(streams.hallL.cursor, z - 40); streams.hallR.cursor = Math.min(streams.hallR.cursor, z - 40);
    streams.propsL.cursor = Math.min(streams.propsL.cursor, z - 40); streams.propsR.cursor = Math.min(streams.propsR.cursor, z - 40);
    streams.gantry.cursor = Math.min(streams.gantry.cursor, z - 60);
  }
  function spawnFeature(z) {
    if (deckAt(z).h > 0 || deckAt(z - 30).h > 0) return false;
    if (Math.random() < 0.5) spawnJunction(z); else spawnDeck(z);
    return true;
  }

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
    if (rowLevel > 0) type = { pit: 'cone', forklift: 'block' }[type] || type;
    const b = builders[TH.obs[type] || type]();
    const x = type === 'pipeWide' ? 0 : LANES[lane];
    b.g.position.x = x;
    b.g.position.y = rowLevel;
    return addEntity(obstacles, b.g, z, { type, lane, x, boxes: b.boxes, pit: b.pit || null, vz: b.vz || 0, len: 4, yOff: rowLevel });
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
      const h = makeHardHat(0.27, { mat: C.hatPickup });
      h.scale.setScalar(1.15);
      y += rowLevel;
      h.position.set(x, y, z);
      h.rotation.x = -0.25;
      addEntity(pickups, h, z, { kind: 'helmet', x, y, spin: i * 0.4 });
    }
  }

  function spawnPowerup(lane, z) {
    const types = ['vest', 'boots', 'goggles'];
    const type = types[Math.floor(Math.random() * 3)];
    const p = buildPowerup(type);
    p.g.position.set(LANES[lane], 1.0 + rowLevel, z);
    addEntity(pickups, p.g, z, { kind: 'power', type, x: LANES[lane], y: 1.0 + rowLevel, spinObj: p.spin, spin: 0 });
  }

  let rowLevel = 0;
  function spawnRowAt(z) {
    const info = deckAt(z);
    if (info.ramp) return;
    rowLevel = info.h;
    spawnRow(z);
    rowLevel = 0;
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

  function spawnProp(side, z) {
    const k = TH.props[Math.floor(Math.random() * TH.props.length)];
    const g = decorBuilders[k]();
    const x = side * (k === 'lamp' ? 5.2 : k === 'silo' || k === 'tanker' ? 9 + Math.random() * 2 : 6.2 + Math.random() * 2.5);
    g.position.x = x;
    if (k === 'lamp' && side > 0) g.rotation.y = Math.PI;
    if (k === 'sign') g.position.x = side * 5.4;
    addEntity(decor, g, z, { len: 5 });
  }

  function runStreams() {
    const s = streams;
    while (!s.rows.blocked && s.rows.cursor - rowGap() > SPAWN_Z) {
      s.rows.cursor -= rowGap();
      if (state === 'play' && distance > 140 && --s.rows.untilFeature <= 0) {
        s.rows.untilFeature = 12 + Math.floor(Math.random() * 10);
        if (spawnFeature(s.rows.cursor)) { if (s.rows.blocked) break; s.rows.cursor -= RAMP + 4; continue; }
      }
      spawnRowAt(s.rows.cursor);
    }
    const stopZ = turn.pending ? turn.pending.z - 4 : -Infinity;
    [['propsL', -1], ['propsR', 1]].forEach(([k, side]) => {
      while (s[k].cursor > Math.max(SPAWN_Z, stopZ)) {
        const step = 6 + Math.random() * 7;
        s[k].cursor -= step;
        spawnProp(side, s[k].cursor);
      }
    });
    [['hallL', -1], ['hallR', 1]].forEach(([k, side]) => {
      while (s[k].cursor > Math.max(SPAWN_Z - 30, stopZ)) {
        const len = 18 + Math.random() * 18;
        const gap = 3 + Math.random() * 8;
        const zc = s[k].cursor - gap - len / 2;
        const g = buildHall(side, len);
        g.position.x = side * 19;
        addEntity(decor, g, zc, { len });
        s[k].cursor = zc - len / 2;
      }
    });
    while (s.gantry.cursor > Math.max(SPAWN_Z, stopZ)) {
      s.gantry.cursor -= 90 + Math.random() * 70;
      addEntity(decor, buildPortal(), s.gantry.cursor, { len: 2 });
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
    if (turn.active && turn.active.old) dropOldTurn(turn.active);
    if (turn.old) { dropOldTurn(turn.old); turn.old = null; }
    world.position.y = 0;
    clearList(obstacles); clearList(pickups); clearList(decor);
    speed = START_SPEED; distance = 0; score = 0; helmets = 0;
    Object.assign(player, { lane: 1, x: 0, y: 0, vy: 0, ground: 0, jumped: false, turnDir: 0, slide: 0, slideQueued: false, dead: false, deadT: 0, fall: false });
    world.rotation.y = 0;
    [-1, 1].forEach(sd => sideRails[sd].forEach(m => (m.visible = true)));
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
    show(ui.menu, false); show(ui.over, false); show(ui.pause, false); show($('board'), false); show(ui.hud, true);
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
    lbSave({ score: s, dist: Math.floor(distance), helmets });
  }

  // ---------------------------------------------------------------- akce hráče
  function moveLane(dir) {
    if (state !== 'play' || turn.active) return;
    const j = turn.pending;
    if (j && j.z > -(turnLead() + 25)) { if (!player.turnDir) { player.turnDir = dir; sfx.lane(); toast(dir < 0 ? '◄' : '►'); } return; }
    const nl = Math.max(0, Math.min(2, player.lane + dir));
    if (nl !== player.lane) { player.lane = nl; sfx.lane(); }
  }
  function jump() {
    if (state !== 'play') return;
    if (player.y <= player.ground + 0.001 && !player.fall) {
      player.jumped = true;
      player.vy = power.boots > 0 ? JUMP_V_BOOTS : JUMP_V;
      player.slide = 0;
      player.slideQueued = false;
      sfx.jump();
    }
  }
  function slide() {
    if (state !== 'play') return;
    if (player.y > player.ground + 0.001) {
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
      if (!$('board').hidden) { if (k === 'Escape') lbClose(); return; }
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

  // ---------------------------------------------------------------- menu: postava a prostředí
  const heroImg = $('heroImg'), heroCv = $('heroCanvas');
  let prev = null;
  function setupPreview() {
    if (prev) return prev;
    try {
      const r = new THREE.WebGLRenderer({ canvas: heroCv, alpha: true, antialias: true });
      r.setPixelRatio(1); r.setSize(360, 360, false);
      r.toneMapping = THREE.ACESFilmicToneMapping;
      const sc = new THREE.Scene();
      sc.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1.7));
      const dl = new THREE.DirectionalLight(0xfff0d8, 2.2); dl.position.set(-2, 3, -3); sc.add(dl);
      const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
      prev = { r, sc, cam, model: null, key: null };
    } catch (e) { prev = { failed: true }; }
    return prev;
  }
  let forcePreview = false;
  function showHero() {
    const photo = charKey === 'civava' && !forcePreview;
    heroImg.hidden = !photo;
    heroCv.hidden = photo;
    if (photo) return;
    const pv = setupPreview();
    if (pv.failed) { heroCv.hidden = true; return; }
    if (pv.key !== charKey) {
      if (pv.model) pv.sc.remove(pv.model.root);
      pv.model = CHARS[charKey].build();
      pv.model.bubble.visible = false;
      pv.sc.add(pv.model.root);
      pv.key = charKey;
      const tall = pv.model.biped ? 1.35 : pv.model.snail ? 0.8 : 1.15;
      pv.cam.position.set(1.4, tall * 0.85, -3.0);
      pv.cam.lookAt(0, tall * 0.48, 0);
    }
  }
  function renderPreview() {
    if (!prev || prev.failed || heroCv.hidden || ui.menu.hidden) return;
    const m = prev.model;
    m.root.rotation.y = Math.sin(t * 0.8) * 0.7;
    const s = Math.sin(t * 6);
    m.legs.forEach((l, i) => (l.rotation.x = (i === 0 || i === 3 ? s : -s) * 0.5));
    m.tail.rotation.z = Math.sin(t * 8) * 0.4;
    prev.r.render(prev.sc, prev.cam);
  }
  function renderPickers() {
    $('charPick').innerHTML = Object.entries(CHARS).map(([k, c]) => `<button type="button" data-char="${k}" aria-pressed="${k === charKey}"><span>${c.icon}</span>${c.name}</button>`).join('');
    $('themePick').innerHTML = Object.entries(THEMES).map(([k, c]) => `<button type="button" data-theme="${k}" aria-pressed="${k === themeKey}"><span>${c.icon}</span>${c.name}</button>`).join('');
    heroImg.alt = CHARS[charKey].name + ' v ochranné přilbě';
    showHero();
  }
  $('charPick').addEventListener('click', e => {
    const b = e.target.closest('[data-char]'); if (!b) return;
    setChar(b.dataset.char);
    renderPickers();
  });
  $('themePick').addEventListener('click', e => {
    const b = e.target.closest('[data-theme]'); if (!b || b.dataset.theme === themeKey) return;
    applyTheme(b.dataset.theme);
    resetWorld(false);
    renderPickers();
  });

  // ---------------------------------------------------------------- žebříček (sdílená databáze artefaktu)
  // Dokument hraci/<id hráče>: nejlepší výsledky za dny, týdny a měsíce + osobní rekordy.
  const LB = { db: null, user: null, uid: null, players: [], ready: false, tab: 'den', names: {}, writeFailed: false };
  const TZ = 'Europe/Prague';
  function pragueParts(d = new Date()) {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    const v = k => p.find(x => x.type === k).value;
    return { y: +v('year'), m: +v('month'), d: +v('day') };
  }
  const pad2 = n => String(n).padStart(2, '0');
  function isoWeek(y, m, d) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    const day = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    return dt.getUTCFullYear() + '-W' + pad2(Math.ceil(((dt - y0) / 86400000 + 1) / 7));
  }
  function periodKeys(date = new Date()) {
    const { y, m, d } = pragueParts(date);
    return { den: `${y}-${pad2(m)}-${pad2(d)}`, tyden: isoWeek(y, m, d), mesic: `${y}-${pad2(m)}` };
  }
  const MAPKEY = { den: 'days', tyden: 'weeks', mesic: 'months' };
  const trim = (obj, n) => Object.fromEntries(Object.entries(obj || {}).sort((a, b) => b[0].localeCompare(a[0])).slice(0, n));
  async function lbInit() {
    const use = window.claude && window.claude.use;
    if (!use) { lbRender(); return; }
    const [db, user] = await Promise.all([use('db').catch(() => null), use('user').catch(() => null)]);
    LB.db = db; LB.user = user;
    if (user) { try { LB.uid = await user.id(); } catch (e) { LB.uid = null; } }
    if (db) {
      db.collection('hraci').onSnapshot(snap => {
        LB.players = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        LB.ready = true;
        lbRender();
      }, () => { LB.ready = true; lbRender(); });
    }
    lbRender();
  }
  async function lbNames(ids) {
    if (!LB.user || !ids.length) return {};
    try { return await LB.user.profiles(ids); } catch (e) { return {}; }
  }
  async function lbSave(run) {
    const st = $('lbStatus');
    st.textContent = '';
    if (!LB.db || !LB.uid) { st.textContent = LB.db ? '' : ''; return; }
    if (LB.writeFailed) return;
    const keys = periodKeys();
    const ref = LB.db.collection('hraci').doc(LB.uid);
    try {
      let cur = {};
      try { const sn = await ref.get(); if (sn.exists) cur = JSON.parse(JSON.stringify(sn.data())); } catch (e) { /* první zápis */ }
      const up = (map, k, v) => { const o = { ...(map || {}) }; o[k] = Math.max(o[k] || 0, v); return o; };
      const best = cur.best && cur.best.score >= run.score ? cur.best : { score: run.score, dist: run.dist, helmets: run.helmets, theme: themeKey, char: charKey, at: new Date().toISOString() };
      const next = {
        games: (cur.games || 0) + 1,
        total: (cur.total || 0) + run.score,
        best,
        bestDist: Math.max(cur.bestDist || 0, run.dist),
        bestHelmets: Math.max(cur.bestHelmets || 0, run.helmets),
        days: trim(up(cur.days, keys.den, run.score), 62),
        weeks: trim(up(cur.weeks, keys.tyden, run.score), 60),
        months: trim(up(cur.months, keys.mesic, run.score), 36),
        lastChar: charKey, lastTheme: themeKey,
        updatedAt: new Date().toISOString(),
      };
      await ref.set(next);
      const rank = per => { const k = periodKeys()[per], mk = MAPKEY[per]; const list = LB.players.map(p => (p.id === LB.uid ? next : p)).map(p => (p[mk] || {})[k] || 0).filter(v => v > 0).sort((a, b) => b - a); return list.indexOf(next[mk][k]) + 1; };
      const r = rank('den');
      st.textContent = run.score >= (cur.best ? cur.best.score : 0) && run.score > 0 ? `Osobní rekord! Zapsáno, dnes ${r}. místo.` : `Zapsáno do žebříčku, dnes ${r || '–'}. místo.`;
    } catch (e) {
      LB.writeFailed = true;
      st.textContent = 'Body se nezapsaly: do žebříčku může zapisovat jen pozvaný hráč.';
    }
  }
  function lbOpen() { show(ui.menu, false); show(ui.over, false); show($('board'), true); lbRender(); }
  function lbClose() { show($('board'), false); show(state === 'over' ? ui.over : ui.menu, true); }
  async function lbRender() {
    // řádek „hraješ jako“
    const who = $('whoLine');
    if (!LB.db) who.textContent = 'Žebříček funguje v aplikaci otevřené přes claude.ai.';
    else if (!LB.uid) who.textContent = 'Přihlas se na claude.ai, ať se ti body počítají do žebříčku.';
    else {
      const me = (await lbNames([LB.uid]))[LB.uid];
      who.innerHTML = ''; who.append('Hraješ jako ');
      const b = document.createElement('b'); b.textContent = (me && me.name) || 'ty'; who.append(b);
    }
    if ($('board').hidden) return;
    const list = $('boardList'), note = $('boardNote'), champs = $('boardChamps');
    document.querySelectorAll('#boardTabs button').forEach(x => x.setAttribute('aria-selected', String(x.dataset.tab === LB.tab)));
    if (!LB.db) { list.innerHTML = '<div class="lb-empty">Žebříček je dostupný jen v aplikaci otevřené přes claude.ai.</div>'; champs.innerHTML = ''; note.textContent = ''; return; }
    const keys = periodKeys(), P = LB.players;
    const top = (per, key) => P.map(p => ({ id: p.id, v: ((p[MAPKEY[per]] || {})[key]) || 0 })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
    const ids = P.map(p => p.id);
    const names = await lbNames(ids);
    const nm = id => (names[id] && names[id].name) || (id === LB.uid ? 'Ty' : 'Hráč');
    const av = id => (names[id] && names[id].avatarUrl) || '';
    champs.innerHTML = '';
    [['den', 'Hráč dne'], ['tyden', 'Hráč týdne'], ['mesic', 'Hráč měsíce']].forEach(([per, label]) => {
      const w = top(per, keys[per])[0];
      const c = document.createElement('div'); c.className = 'champ';
      const l = document.createElement('span'); l.className = 'label'; l.textContent = label;
      const n = document.createElement('span'); n.className = 'nm'; n.textContent = w ? nm(w.id) : '—';
      const v = document.createElement('b'); v.textContent = w ? w.v : '0';
      c.append(l, n, v); champs.append(c);
    });
    const rowsEl = (rows, unit = '') => {
      if (!rows.length) return '<div class="lb-empty">Zatím nikdo. Buď první!</div>';
      return rows.slice(0, 10).map((r, i) => `<div class="lb-row${r.id === LB.uid ? ' me' : ''}" data-id="${i}"><span class="rk">${i + 1}</span><img alt=""><span class="nm"></span><span class="val">${r.v}${unit}</span></div>`).join('');
    };
    const fill = (rows, sub) => {
      list.querySelectorAll('.lb-row').forEach((el, i) => {
        const r = rows[i];
        el.querySelector('img').src = av(r.id);
        const n = el.querySelector('.nm'); n.textContent = nm(r.id);
        if (sub) { const sm = document.createElement('small'); sm.textContent = sub(r); n.append(sm); }
      });
    };
    let rows = [];
    if (LB.tab === 'den' || LB.tab === 'tyden' || LB.tab === 'mesic') {
      rows = top(LB.tab, keys[LB.tab]);
      list.innerHTML = rowsEl(rows);
      fill(rows);
      note.textContent = { den: 'Nejlepší výsledky dnes.', tyden: `Týden ${keys.tyden.split('-W')[1]}.`, mesic: 'Tento měsíc.' }[LB.tab];
    } else if (LB.tab === 'rekordy') {
      const sec = (title, arr, unit, sub) => ({ title, arr, unit, sub });
      const parts = [
        sec('Nejvyšší skóre', P.filter(p => p.best).map(p => ({ id: p.id, v: p.best.score, p })).sort((a, b) => b.v - a.v), '', r => `${(THEMES[r.p.best.theme] || {}).name || ''} · ${(CHARS[r.p.best.char] || {}).name || ''}`),
        sec('Nejdelší trať', P.map(p => ({ id: p.id, v: p.bestDist || 0 })).filter(x => x.v > 0).sort((a, b) => b.v - a.v), ' m'),
        sec('Nejvíc přileb v jedné hře', P.map(p => ({ id: p.id, v: p.bestHelmets || 0 })).filter(x => x.v > 0).sort((a, b) => b.v - a.v), ''),
        sec('Nejvíc odehraných her', P.map(p => ({ id: p.id, v: p.games || 0 })).filter(x => x.v > 0).sort((a, b) => b.v - a.v), ''),
      ];
      list.innerHTML = parts.map(x => `<p class="lb-sec">${x.title}</p><div data-sec>${rowsEl(x.arr.slice(0, 5), x.unit)}</div>`).join('');
      list.querySelectorAll('[data-sec]').forEach((box, si) => {
        const x = parts[si];
        box.querySelectorAll('.lb-row').forEach((el, i) => {
          const r = x.arr[i]; el.querySelector('img').src = av(r.id);
          const n = el.querySelector('.nm'); n.textContent = nm(r.id);
          if (x.sub) { const sm = document.createElement('small'); sm.textContent = x.sub(r); n.append(sm); }
        });
      });
      note.textContent = 'Rekordy všech dob.';
    } else {
      // síň slávy: vítězové předchozích dnů, týdnů a měsíců
      const winner = (per, key) => top(per, key)[0];
      const out = [];
      const now = new Date();
      for (let i = 1; i <= 7; i++) { const k = periodKeys(new Date(now - i * 86400000)).den; const w = winner('den', k); if (w) out.push({ ...w, label: 'Den ' + k.split('-').reverse().slice(0, 2).map(Number).join('. ') + '.' }); }
      for (let i = 1; i <= 4; i++) { const k = periodKeys(new Date(now - i * 7 * 86400000)).tyden; const w = winner('tyden', k); if (w) out.push({ ...w, label: 'Týden ' + k.split('-W')[1] }); }
      for (let i = 1; i <= 6; i++) { const d = new Date(now); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); const k = periodKeys(d).mesic; const w = winner('mesic', k); if (w) out.push({ ...w, label: 'Měsíc ' + Number(k.slice(5)) + '/' + k.slice(0, 4) }); }
      list.innerHTML = out.length ? rowsEl(out) : '<div class="lb-empty">Síň slávy se zaplní po prvním dni hraní.</div>';
      fill(out, r => r.label);
      note.textContent = 'Vítězové minulých dnů, týdnů a měsíců.';
    }
    if (!LB.uid) note.textContent += ' Pro zápis vlastních bodů se přihlas na claude.ai.';
    else if (LB.writeFailed) note.textContent += ' Tvoje body se nezapisují – požádej správce o přístup.';
  }
  $('boardTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; LB.tab = b.dataset.tab; lbRender(); });
  $('boardBtn').addEventListener('click', lbOpen);
  $('overBoardBtn').addEventListener('click', lbOpen);
  $('boardClose').addEventListener('click', lbClose);
  renderPickers();
  lbInit();

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
    // odbočka: hráč dorazil na křižovatku
    const j = turn.pending;
    if (j && !turn.active && j.z >= -turnLead()) {
      if (player.turnDir === j.junction) { startTurn(j.junction, Math.max(0.6, -j.z)); return; }
      if (j.z >= TRACK_W / 2 - 0.6) { gameOver(player.turnDir ? 'Špatný směr!' : 'Narazil jsi do zdi – odboč!'); return; }
    }
    for (const o of obstacles) {
      if (o.knocked) continue;
      const dz = Math.abs(o.z);
      if (dz > 3) continue;
      if (o.pit) {
        if (power.vest > 0) continue;
        if (player.y <= player.ground + 0.02 && Math.abs(player.x - o.x) < o.pit.hx && dz < o.pit.hz - 0.15) {
          player.fall = true;
          player.x = o.x;
          gameOver(TH.why.pit);
          return;
        }
        continue;
      }
      for (const b of o.boxes) {
        const yo = o.yOff || 0;
        if (Math.abs(player.x - o.x) < b.hx + PHX && dz < b.hz + PHZ && player.y < b.y1 + yo && top > b.y0 + yo) {
          if (power.vest > 0) {
            o.knocked = true;
            o.kvy = 8; o.kvx = (o.x - player.x >= 0 ? 1 : -1) * 4 + (Math.random() - 0.5) * 2;
            o.kspin = (Math.random() - 0.5) * 8;
            sfx.smash();
            break;
          }
          const why = TH.why[o.type] || 'Náraz!';
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
      world.remove(p.obj);
      pickups.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- update
  let shake = 0;
  let t = 0;
  function startTurn(dir, F) {
    // Hráč jede po oblouku: za F metrů dopředu a F metrů do strany je na středu příčné chodby.
    // Stará i nová chodba tvoří po celou dobu jeden pevný celek – nic se nezastaví ani neposkočí.
    if (turn.old) dropOldTurn(turn.old);
    const old = new THREE.Group();
    old.position.y = -0.004;   // stará trať leží o chlup níž, žádné blikání
    scene.add(old);
    for (const list of [obstacles, pickups, decor]) for (const e of list) old.add(e.obj);
    const clones = [];
    [trackMesh, ...yardMeshes, ...sideRails['-1'], ...sideRails['1']].forEach(m => {
      const c = m.clone();
      clones.push(c);
      c.visible = m.visible;
      c.material = m.material.clone();
      if (c.material.map) { c.material.map = c.material.map.clone(); c.material.map.needsUpdate = true; } // zamrzlý posun textury
      old.add(c);
    });
    obstacles.length = 0; pickups.length = 0; decor.length = 0;
    // nová chodba vede ve směru odbočky, její osa je osa křižovatky
    resetStreams(true);
    streams.rows.cursor = -(F + 14 + speed * 0.6);
    streams.rows.untilFeature = 12 + Math.floor(Math.random() * 10);
    streams.gantry.cursor = -(F + 70) - Math.random() * 60;
    // zábradlí na straně, odkud hráč přijíždí, začne až za nárožím (kopie jede se světem, pak ji vystřídá původní)
    const gap = Math.ceil((F + TRACK_W / 2 + 2) / RAIL_REP) * RAIL_REP;   // násobek opakování textury = sloupky sedí
    const railG = new THREE.Group();
    sideRails[dir].forEach(m => {
      const c = m.clone();
      c.visible = true;
      c.material = m.material.clone();
      if (c.material.map) { c.material.map = c.material.map.clone(); c.material.map.needsUpdate = true; }
      clones.push(c);
      railG.add(c);
    });
    [-1, 1].forEach(sd => sideRails[sd].forEach(m => (m.visible = sd !== dir)));
    runStreams();
    const railE = addEntity(decor, railG, -(gap + 20), { len: 4 * TRACK_L });   // dlouhá → moveWorld ji sám neodklidí
    // u nároží, kudy hráč přijíždí, nesmí nic stát
    for (let i = decor.length - 1; i >= 0; i--) {
      const d = decor[i];
      if (Math.sign(d.obj.position.x) === dir && d.z - d.len / 2 < 0 && d.z + d.len / 2 > -(F + 14)) { world.remove(d.obj); decor.splice(i, 1); }
    }
    const v = Math.max(speed, 1);
    let T = F / (v * TURN_C);
    T = Math.min(1.2, Math.max(0.35, T));
    turn.active = { dir, t: 0, T, F, old, clones, railE, gap };
    placeTurn(turn.active, 0);
    player.lane = 1;
    player.turnDir = 0;
    sfx.lane();
  }
  // poloha hráče na oblouku (ve výchozím souřadném systému) pro u ∈ <0,1>
  function arcPos(a, u) {
    const n = Math.max(1, Math.ceil(u * 40));
    let x = 0, z = 0;
    for (let i = 0; i < n; i++) {
      const phi = Math.PI / 2 * turnEase(u * (i + 0.5) / n);
      x += Math.sin(phi); z -= Math.cos(phi);
    }
    const sc = a.F / TURN_C * u / n;   // celková délka oblouku = F / TURN_C
    return [a.dir * x * sc, z * sc];
  }
  function setRigid(obj, r0, p0x, p0z, ang, px, pz) {
    const c = Math.cos(ang), s = Math.sin(ang), x = p0x - px, z = p0z - pz;
    obj.rotation.y = r0 + ang;
    obj.position.x = x * c + z * s;
    obj.position.z = -x * s + z * c;
  }
  function placeTurn(a, u) {
    const [px, pz] = arcPos(a, u);
    const ang = a.dir * Math.PI / 2 * turnEase(u);
    setRigid(a.old, 0, 0, 0, ang, px, pz);
    setRigid(world, -a.dir * Math.PI / 2, 0, -a.F, ang, px, pz);
  }
  function dropOldTurn(a) {
    scene.remove(a.old);
    if (a.railE && a.railE.obj.parent) a.railE.obj.parent.remove(a.railE.obj);
    a.clones.forEach(c => { if (c.material.map) c.material.map.dispose(); c.material.dispose(); }); // geometrie jsou sdílené
  }
  function updateTurn(dt) {
    const a = turn.active;
    a.t += dt;
    const u = Math.min(1, a.t / a.T);
    placeTurn(a, u);
    if (u >= 1) {
      // nová chodba je teď rovně: posun z oblouku převezme běžný posun světa (beze skoku)
      const ox = world.position.x, oz = world.position.z;
      world.rotation.y = 0; world.position.set(0, 0, 0);
      moveWorld(oz, 0);
      a.old.position.x -= ox;
      player.x -= ox; camera.position.x -= ox;
      runStreams();
      turn.active = null;
      turn.old = { old: a.old, clones: a.clones, left: a.gap + 50, side: a.dir, railE: a.railE };   // stará chodba dojede za kameru a pak zmizí
      score += 50;
      toast('ODBOČENO! +50');
      sfx.power();
    }
  }
  function updateOldTurn(dz) {
    const o = turn.old;
    if (!o) return;
    o.old.position.z += dz;
    if ((o.left -= dz) <= 0) {
      const i = decor.indexOf(o.railE);
      if (i >= 0) { world.remove(o.railE.obj); decor.splice(i, 1); }
      dropOldTurn(o); turn.old = null;
    }
  }
  function moveWorld(dz, dt) {
    for (const list of [obstacles, pickups, decor]) {
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        e.z += dz + (e.vz && e.z > -70 ? e.vz * dt : 0);
        e.obj.position.z = e.z;
        if (e.z - e.len / 2 > DESPAWN_Z) { world.remove(e.obj); list.splice(i, 1); }
      }
    }
    for (const k in streams) streams[k].cursor += dz;
    trackTex.offset.y += dz / TRACK_REP;
    yardTex.offset.y += dz / YARD_TILE;
    railTex.offset.x += dz / RAIL_REP;
  }

  function animateDog(dt) {
    const p = player;
    const airborne = p.y > p.ground + 0.001;
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
      if (turn.active) {
        updateTurn(dt);
        player.x += (0 - player.x) * Math.min(1, dt * 15);
      }
      distance += dz;
      score += dz * (power.goggles > 0 ? 2 : 1);
      for (const k in power) power[k] = Math.max(0, power[k] - dt);

      // pohyb hráče
      const tx = LANES[player.lane];
      player.x += (tx - player.x) * Math.min(1, dt * 15);
      const gnd = deckAt(0).h;
      player.ground = gnd;
      if (!player.jumped && player.vy <= 0 && player.y - gnd < 0.7) {
        player.y = gnd; player.vy = 0;   // drží se nájezdu i sjezdu
      } else if (player.y > gnd || player.vy > 0) {
        player.vy -= GRAV * dt;
        player.y += player.vy * dt;
        if (player.y <= gnd) {
          player.y = gnd; player.vy = 0; player.jumped = false;
          if (player.slideQueued) { player.slide = SLIDE_TIME; player.slideQueued = false; sfx.slide(); }
        }
      }
      if (player.slide > 0) player.slide -= dt;

      const openSide = turn.active ? turn.active.dir : turn.old ? turn.old.side : turn.pending && turn.pending.z > -(turnLead() + 30) ? turn.pending.junction : 0;
      [-1, 1].forEach(sd => sideRails[sd].forEach(m => (m.visible = sd !== openSide)));
      if (!turn.active) {
        moveWorld(dz, dt);
        updateOldTurn(dz);
        runStreams();
        checkCollisions();
        // upozornění na nájezd, sjezd a odbočku
        for (const e of decor) {
          if (e.deck) {
            if (!e.w1 && e.z > -32) { e.w1 = true; toast('NÁJEZD NAHORU ▲'); }
            if (!e.w2 && e.z - RAMP - e.deck.L > -32) { e.w2 = true; toast('SJEZD DOLŮ ▼'); }
          } else if (e.junction && !e.w1 && e.z > -(turnLead() + 32)) { e.w1 = true; toast(e.junction < 0 ? '◄ ODBOČ VLEVO' : 'ODBOČ VPRAVO ►'); }
        }
      }
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
    camera.position.y = camH + (state === 'play' || state === 'dying' ? player.ground + (player.y - player.ground) * 0.35 : 0);
    camera.position.z = camDist;
    if (shake > 0) {
      shake -= dt;
      camera.position.x += (Math.random() - 0.5) * shake * 0.8;
      camera.position.y += (Math.random() - 0.5) * shake * 0.8;
    }
    camera.lookAt(camera.position.x * 0.8, 1.0 + player.ground + (player.y - player.ground) * 0.2, -8);

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
  let timeScale = 1;   // jen pro testy
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000) * timeScale;
    last = now;
    if (state !== 'paused') update(dt);
    renderer.render(scene, camera);
    renderPreview();
  }
  resetWorld(false);
  requestAnimationFrame(frame);

  // ladicí přístup pro testy
  window.__safetyRun = { forcePreview(on) { forcePreview = on; showHero(); }, get turn() { return turn; }, decor, streams, get distance() { return distance; }, set distance(v) { distance = v; }, get state() { return state; }, get score() { return score; }, get helmets() { return helmets; }, player, power, obstacles, set timeScale(v) { timeScale = v; } };
})();
