import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
// Post-processing imports removed — bloom strength was 0, saving 3 extra render passes per frame
// GUI loaded dynamically only when ?debug is in URL

/* ═══════════════════════════════════════════════
   THE PUPPET SHED — Three.js Scene
   DK Shop aesthetic + Puppet GLB character
   ═══════════════════════════════════════════════ */

class SceneManager {
  constructor(canvasId) {
    this._canvas = document.getElementById(canvasId);
    if (!this._canvas) return;

    this._clock = new THREE.Clock();
    this._mouse = { x: 0, y: 0 };
    this._targetMouse = { x: 0, y: 0 };
    this._model = null;
    this._modelBasePos = new THREE.Vector3();
    this._modelBaseRot = new THREE.Euler();
    this._modelBaseScale = new THREE.Vector3(1, 1, 1);
    this._hovered = false;
    this._clicked = false;
    this._clickTime = 0;
    this._selectedNFT = null;
    this._monitorMat = null;
    this._monitorNFTTexture = null;
    this._screenOnProgress = 0;
    this._screenPoweringOn = false;
    this._screenPoweredOn = false;
    this._steamParticles = [];
    this._dustParticles = null;
    this._canvasRect = null;
    this._lastFrameAt = 0;

    // Performance
    this._isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    this._isLowEnd = navigator.hardwareConcurrency <= 4;
    this._quality = (this._isMobile || this._isLowEnd) ? 'low' : 'high';
    this._targetFrameMs = this._quality === 'high' ? 16 : 33;

    this._initRenderer();
    this._initCamera();
    this._initScene();
    this._initLights();
    // Post-processing removed — bloom was strength 0 (no visible effect), saves 3 extra render passes/frame
    this._buildEnvironment();
    this._buildDustParticles();
    this._propsReady = this._loadProps();
    this._loadModel();
    this._initEvents();
    if (new URLSearchParams(location.search).has('debug')) {
      this._initDebugGUI();
    }
    this._animate();
  }

  // ─── RENDERER ───
  _initRenderer() {
    this._renderer = new THREE.WebGLRenderer({
      canvas: this._canvas,
      antialias: this._quality === 'high',
      alpha: false,
      powerPreference: 'high-performance'
    });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this._renderer.toneMapping = THREE.LinearToneMapping;
    this._renderer.toneMappingExposure = 1.73;
    this._renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (this._quality === 'high') {
      this._renderer.shadowMap.enabled = true;
      this._renderer.shadowMap.type = THREE.PCFShadowMap; // faster than PCFSoft, visually close
    }
    this._resize();
  }

  // ─── CAMERA ───
  _initCamera() {
    const aspect = this._canvas.clientWidth / this._canvas.clientHeight;
    this._camera = new THREE.PerspectiveCamera(this._isMobile ? 50 : 38, aspect, 0.1, 200);
    this._baseCameraPos = new THREE.Vector3();
    this._baseCameraTarget = new THREE.Vector3();
    this._applyResponsiveCamera();
    // Camera starts at intro position (set inside _applyResponsiveCamera) — don't override
  }

  _applyResponsiveCamera() {
    if (this._isMobile) {
      // Browse (zoomed out) — see the full shed
      this._browseFov = 30;
      this._browseCameraPos = new THREE.Vector3(0, 1.85, 7.8);
      this._browseCameraTarget = new THREE.Vector3(0, 1.45, 0);
      // Selected (zoomed in) — focus on puppet + CRT
      this._selectedFov = 23;
      this._selectedCameraPos = new THREE.Vector3(0, 1.8, 6.3);
      this._selectedCameraTarget = new THREE.Vector3(0, 1.5, 0);
    } else {
      // Browse (zoomed out) — from debug GUI screenshot
      this._browseFov = 22;
      this._browseCameraPos = new THREE.Vector3(0.5, 2, 7.2);
      this._browseCameraTarget = new THREE.Vector3(-0.5, 1.4, -5);
      // Selected (zoomed in) — tight punch-in on puppet + CRT
      this._selectedFov = 15;
      this._selectedCameraPos = new THREE.Vector3(0.5, 2, 7.2);
      this._selectedCameraTarget = new THREE.Vector3(-1.1, 1.4, -5);
    }

    // Start in browse mode
    this._targetFov = this._browseFov;
    this._baseCameraPos.copy(this._browseCameraPos);
    this._baseCameraTarget.copy(this._browseCameraTarget);
    this._cameraLerp = 0; // 0 = at target, used for smooth transitions
    this._cameraTransitioning = false;

    // ── Epic overhead → slow descent ──
    // Start high and wide, showing the entire room — every prop, the back wall art,
    // both sides of the shed. Then slowly glide down to eye level.
    if (this._isMobile) {
      this._introStartPos = new THREE.Vector3(0, 8, 1);
      this._introStartTarget = new THREE.Vector3(0, 0, -0.5);
      this._introFov = 50;
    } else {
      this._introStartPos = new THREE.Vector3(0, 8, 1);
      this._introStartTarget = new THREE.Vector3(0, 0, -0.5);
      this._introFov = 50;
    }

    this._camera.fov = this._targetFov;
    this._camera.position.copy(this._introStartPos);
    this._camera.lookAt(this._introStartTarget);
    this._introActive = false;
    this._introStartTime = 0;
    this._introDuration = 3.0;
    this._camera.updateProjectionMatrix();
  }

  _startIntro() {
    if (this._introActive || this._introDone) return;
    this._introActive = true;
    this._introDone = false;
    this._introStartTime = this._clock.elapsedTime;
  }

  _updateIntro(t) {
    if (!this._introActive) return;

    const elapsed = t - this._introStartTime;
    const linear = Math.min(elapsed / this._introDuration, 1);

    // Smooth ease-out — fast start, gentle landing
    const progress = 1 - Math.pow(1 - linear, 2.5);

    // Orbital sweep: camera starts ~90° to the left, overhead,
    // then sweeps around and descends to land EXACTLY at browse camera position.
    const startAngle = -Math.PI / 2; // 90° left
    // End angle computed from browse camera XZ so we land precisely
    const endAngle = Math.atan2(this._baseCameraPos.x, this._baseCameraPos.z);
    const angle = startAngle + (endAngle - startAngle) * progress;

    // Radius from XZ only (Y handled separately)
    const startRadius = 8;
    const endRadius = Math.sqrt(this._baseCameraPos.x ** 2 + this._baseCameraPos.z ** 2);
    const radius = startRadius + (endRadius - startRadius) * progress;

    const startY = this._introStartPos.y;
    const endY = this._baseCameraPos.y;
    const y = startY + (endY - startY) * progress;

    this._camera.position.set(
      Math.sin(angle) * radius,
      y,
      Math.cos(angle) * radius
    );

    const currentTarget = new THREE.Vector3().lerpVectors(this._introStartTarget, this._baseCameraTarget, progress);
    this._camera.lookAt(currentTarget);

    this._camera.fov = this._targetFov;
    this._camera.updateProjectionMatrix();

    if (linear >= 1) {
      this._introActive = false;
      this._introDone = true;

      // CRT powers on the moment we land — Nintendo timing
      if (!this._screenPoweringOn && !this._screenPoweredOn) {
        setTimeout(() => {
          this._screenPoweringOn = true;
          this._screenOnProgress = 0;
        }, 300); // tiny beat after landing, then *click*

        // Reveal marketplace slightly after screen starts
        setTimeout(() => {
          const mp = document.getElementById('marketplace');
          if (mp) mp.classList.add('revealed');
        }, 600);

        setTimeout(() => {
          if (window._shedApp && window._shedApp.revealGrid) window._shedApp.revealGrid();
        }, 1000);
      }
    }
  }

  // ─── SCENE ───
  _initScene() {
    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color('#1a0e04');
    this._scene.fog = new THREE.FogExp2('#1a0e04', 0.04);
  }

  // ─── LIGHTS (warm amber DK shop feel) ───
  _initLights() {
    // Hemisphere — warm ground bounce
    this._hemiLight = new THREE.HemisphereLight('#ffd8a0', '#4a2a14', 1.48);
    this._scene.add(this._hemiLight);

    // KEY — warm amber sunlight through window
    this._keyLight = new THREE.DirectionalLight('#FFE0A0', 2.25);
    this._keyLight.position.set(3, 5, 4);
    if (this._quality === 'high') {
      this._keyLight.castShadow = true;
      this._keyLight.shadow.mapSize.set(2048, 2048);
      this._keyLight.shadow.camera.near = 0.1;
      this._keyLight.shadow.camera.far = 20;
      this._keyLight.shadow.camera.left = -6;
      this._keyLight.shadow.camera.right = 6;
      this._keyLight.shadow.camera.top = 6;
      this._keyLight.shadow.camera.bottom = -2;
      this._keyLight.shadow.bias = -0.0005;
      this._keyLight.shadow.normalBias = 0.02;
    }
    this._scene.add(this._keyLight);

    // FILL — cool blue hint from left
    this._fillLight = new THREE.DirectionalLight('#a0b8d0', 0.85);
    this._fillLight.position.set(-4, 2, 2);
    this._scene.add(this._fillLight);

    // RIM — orange back-edge
    this._rimLight = new THREE.DirectionalLight('#f7931a', 2.6);
    this._rimLight.position.set(-2, 4, -3);
    this._scene.add(this._rimLight);

    // LANTERN point lights (left and right)
    this._lanternL = new THREE.PointLight('#ffd080', 5.7, 9, 2);
    this._lanternL.position.set(-2.5, 3.2, 0.5);
    this._scene.add(this._lanternL);

    this._lanternR = new THREE.PointLight('#ffd080', 5.7, 9, 2);
    this._lanternR.position.set(2.5, 3.6, 0.5);
    this._scene.add(this._lanternR);
    this._lanternBaseIntensity = 5.7;

    // CRT monitor glow
    this._crtLight = new THREE.PointLight('#00ff44', 4.6, 5.5, 0.5);
    this._crtLight.position.set(1.3, 4.2, 0.371);
    this._scene.add(this._crtLight);
  }

  // Post-processing removed — was UnrealBloomPass at strength 0 (no visible effect)

  // ─── PROCEDURAL WOOD TEXTURE GENERATOR ───
  _generateWoodTexture(seed, w = 256, h = 256, darkMode = false) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Base color palette — warm aged wood
    const baseColors = darkMode
      ? ['#3A2210', '#4A3018', '#352010', '#3E2815', '#2E1A0C']
      : ['#8B6B3A', '#7B5A32', '#9B7B4A', '#6B4A28', '#A08050'];
    const base = baseColors[(seed * 7 + 3) % baseColors.length];

    // Fill base
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    // Wood grain lines — horizontal for walls, vertical for floors
    const rng = (s) => { s = Math.sin(s) * 43758.5453; return s - Math.floor(s); };
    const grainCount = 40 + Math.floor(rng(seed * 13) * 30);

    for (let i = 0; i < grainCount; i++) {
      const y = rng(seed * 100 + i * 7.3) * h;
      const thickness = 0.5 + rng(seed * 200 + i * 3.1) * 2.5;
      const alpha = 0.03 + rng(seed * 300 + i * 11.7) * 0.12;
      const isDark = rng(seed * 400 + i * 5.9) > 0.4;

      ctx.strokeStyle = isDark
        ? `rgba(20, 10, 0, ${alpha})`
        : `rgba(180, 140, 80, ${alpha * 0.6})`;
      ctx.lineWidth = thickness;
      ctx.beginPath();

      // Wavy grain line
      const waveAmp = 1 + rng(seed * 500 + i) * 4;
      const waveFreq = 0.005 + rng(seed * 600 + i) * 0.015;
      for (let x = 0; x < w; x += 2) {
        const yOff = Math.sin(x * waveFreq + seed + i) * waveAmp;
        if (x === 0) ctx.moveTo(x, y + yOff);
        else ctx.lineTo(x, y + yOff);
      }
      ctx.stroke();
    }

    // Wood knots (1-3 per plank)
    const knotCount = Math.floor(rng(seed * 700) * 3) + 1;
    for (let k = 0; k < knotCount; k++) {
      const kx = rng(seed * 800 + k * 17) * w;
      const ky = rng(seed * 900 + k * 23) * h;
      const kr = 8 + rng(seed * 1000 + k) * 25;

      // Concentric rings
      for (let r = kr; r > 2; r -= 2) {
        const alpha = 0.04 + (1 - r / kr) * 0.08;
        ctx.strokeStyle = `rgba(30, 15, 0, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(kx, ky, r, r * (0.4 + rng(seed * 1100 + k) * 0.4), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Dark center
      ctx.fillStyle = `rgba(25, 12, 0, 0.15)`;
      ctx.beginPath();
      ctx.arc(kx, ky, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle noise overlay for texture
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (rng(i * 0.01 + seed) - 0.5) * 12;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // ─── ENVIRONMENT (DK Shop!) ───
  _buildEnvironment() {
    // Environment map for PBR
    try {
      const pmrem = new THREE.PMREMGenerator(this._renderer);
      pmrem.compileEquirectangularShader();
      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color('#4A3218');
      envScene.add(new THREE.HemisphereLight('#FFD8A0', '#3A2010', 2.5));
      const envRT = pmrem.fromScene(envScene, 0, 0.1, 100);
      this._scene.environment = envRT.texture;
      this._scene.environmentIntensity = 0.3;
      pmrem.dispose();
    } catch(e) { console.warn('Env map skipped:', e); }

    // ─── WOOD FLOOR (DK planks running into screen) ───
    const floorGroup = new THREE.Group();
    const plankW = 0.6;
    const plankCount = 140;
    const floorDepth = 80;

    // Share 3 textures across all planks (saves ~11 texture generations)
    const floorTexPool = [0, 1, 2].map(i => {
      const t = this._generateWoodTexture(i * 13 + 7);
      t.repeat.set(1, 12);
      return t;
    });

    for (let i = 0; i < plankCount; i++) {
      const x = (i - plankCount / 2) * plankW + plankW / 2;

      const woodTex = floorTexPool[i % 3];

      const plankGeo = new THREE.BoxGeometry(plankW - 0.02, 0.06, floorDepth);
      const plankMat = new THREE.MeshStandardMaterial({
        map: woodTex,
        roughness: 0.72,
        metalness: 0.02,
        envMapIntensity: 0.15
      });
      // Rotate UVs so grain runs along plank length (Z axis)
      const uvAttr = plankGeo.attributes.uv;
      for (let j = 0; j < uvAttr.count; j++) {
        const u = uvAttr.getX(j);
        const v = uvAttr.getY(j);
        uvAttr.setXY(j, v, u);
      }

      const plank = new THREE.Mesh(plankGeo, plankMat);
      plank.position.set(x, -0.03, -floorDepth / 2 + 15);
      plank.receiveShadow = true;
      floorGroup.add(plank);

      // Gap shadow strip
      if (i < plankCount - 1) {
        const gapGeo = new THREE.BoxGeometry(0.025, 0.01, floorDepth);
        const gapMat = new THREE.MeshStandardMaterial({ color: 0x1a0e04, roughness: 1 });
        const gap = new THREE.Mesh(gapGeo, gapMat);
        gap.position.set(x + plankW / 2, 0.001, -floorDepth / 2 + 15);
        floorGroup.add(gap);
      }
    }
    this._scene.add(floorGroup);

    // ─── BACK WALL (horizontal shiplap planks) ───
    const wallGroup = new THREE.Group();
    const wallPlankH = 0.45;
    const wallPlankCount = 10;
    const wallW = 20;
    const wallZ = -3.5;

    // Share 3 textures across all wall planks
    const wallTexPool = [0, 1, 2].map(i => {
      const t = this._generateWoodTexture(i * 17 + 42, 256, 128, true);
      t.repeat.set(6, 1);
      return t;
    });

    for (let i = 0; i < wallPlankCount; i++) {
      const y = i * wallPlankH + 0.2;

      const wallTex = wallTexPool[i % 3];

      const wpGeo = new THREE.BoxGeometry(wallW, wallPlankH - 0.02, 0.08);
      const wpMat = new THREE.MeshStandardMaterial({
        map: wallTex,
        roughness: 0.82,
        metalness: 0.01
      });
      const wp = new THREE.Mesh(wpGeo, wpMat);
      wp.position.set(0, y, wallZ);
      wp.receiveShadow = true;
      wallGroup.add(wp);

      // Gap shadow
      if (i < wallPlankCount - 1) {
        const gGeo = new THREE.BoxGeometry(wallW, 0.02, 0.02);
        const gMat = new THREE.MeshStandardMaterial({ color: 0x0a0604, roughness: 1 });
        const g = new THREE.Mesh(gGeo, gMat);
        g.position.set(0, y + wallPlankH / 2, wallZ + 0.04);
        wallGroup.add(g);
      }
    }
    this._scene.add(wallGroup);

    // ─── OUTER WALLS (dark wood shell — the "outside" of the house) ───
    // No inner side walls — wide open room. These outer walls catch the void on ultrawide.
    // Hallway = the open space between the photo back wall and these outer walls.
    const outerX = 18;
    const outerDepth = 40;
    const outerHeight = 10;
    const outerPlankH = 0.5;
    const outerPlankCount = Math.ceil(outerHeight / outerPlankH);
    const outerStart = -15;

    const outerTexPool = [0, 1, 2].map(i => {
      const t = this._generateWoodTexture(i * 31 + 111, 256, 128, true);
      t.repeat.set(10, 1);
      return t;
    });

    for (const side of [-1, 1]) {
      const outerGroup = new THREE.Group();
      const xPos = side * outerX;

      for (let i = 0; i < outerPlankCount; i++) {
        const y = i * outerPlankH + 0.1;
        const outerTex = outerTexPool[i % 3];

        const opGeo = new THREE.BoxGeometry(0.12, outerPlankH - 0.02, outerDepth);
        const opMat = new THREE.MeshStandardMaterial({
          map: outerTex,
          roughness: 0.9,
          metalness: 0.0
        });
        const op = new THREE.Mesh(opGeo, opMat);
        op.position.set(xPos, y, outerStart + outerDepth / 2);
        outerGroup.add(op);

        if (i < outerPlankCount - 1) {
          const gGeo = new THREE.BoxGeometry(0.04, 0.02, outerDepth);
          const gMat = new THREE.MeshStandardMaterial({ color: 0x060301, roughness: 1 });
          const g = new THREE.Mesh(gGeo, gMat);
          g.position.set(xPos + side * 0.04, y + outerPlankH / 2, outerStart + outerDepth / 2);
          outerGroup.add(g);
        }
      }
      this._scene.add(outerGroup);
    }

    // ─── OUTER BACK WALL (behind the photo wall, closing the back) ───
    const outerBackWallW = outerX * 2;
    for (let i = 0; i < outerPlankCount; i++) {
      const y = i * outerPlankH + 0.1;
      const outerTex = outerTexPool[i % 3];
      const obGeo = new THREE.BoxGeometry(outerBackWallW, outerPlankH - 0.02, 0.12);
      const obMat = new THREE.MeshStandardMaterial({
        map: outerTex,
        roughness: 0.9,
        metalness: 0.0
      });
      const ob = new THREE.Mesh(obGeo, obMat);
      ob.position.set(0, y, outerStart);
      this._scene.add(ob);
    }

    // ─── OUTER CEILING (covers hallway + room) ───
    const outerCeilMat = new THREE.MeshStandardMaterial({ color: 0x120904, roughness: 0.95 });
    const outerCeilGeo = new THREE.BoxGeometry(outerX * 2 + 0.5, 0.1, outerDepth);
    const outerCeil = new THREE.Mesh(outerCeilGeo, outerCeilMat);
    outerCeil.position.set(0, outerHeight, outerStart + outerDepth / 2);
    this._scene.add(outerCeil);

    // ─── DIM HALLWAY LIGHTS (warm glow in the open space flanking the room) ───
    for (const side of [-1, 1]) {
      const hallLight = new THREE.PointLight('#FFD080', 2.0, 12, 2);
      hallLight.position.set(side * 14, 4, 0);
      this._scene.add(hallLight);
    }

    // ─── CEILING (dark beams) ───
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0x1A0E04, roughness: 0.9 });
    const ceilGeo = new THREE.BoxGeometry(20, 0.1, 20);
    const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
    ceiling.position.set(0, 9, -1);
    this._scene.add(ceiling);

    // Cross beams (main room only)
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x3A2010, roughness: 0.8 });
    for (let i = 0; i < 14; i++) {
      const beamGeo = new THREE.BoxGeometry(0.15, 0.2, 20);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(-10 + i * 1.5, 8.9, -1);
      beam.castShadow = true;
      this._scene.add(beam);
    }

    // ─── WORKBENCH (like DK's shop counter) ───
    const bench = new THREE.Group();
    bench.position.set(1.0, 0, -1.0);

    // Bench top — wider to hold the big CRT
    const benchTex = this._generateWoodTexture(99, 512, 256);
    benchTex.repeat.set(3, 1);
    const benchTopGeo = new THREE.BoxGeometry(3.6, 0.1, 1.2);
    const benchTopMat = new THREE.MeshStandardMaterial({
      map: benchTex,
      roughness: 0.55,
      metalness: 0.02,
      envMapIntensity: 0.15
    });
    const benchTop = new THREE.Mesh(benchTopGeo, benchTopMat);
    benchTop.position.y = 0.9;
    benchTop.castShadow = true;
    benchTop.receiveShadow = true;
    bench.add(benchTop);

    // Top edge highlight
    const edgeGeo = new THREE.BoxGeometry(3.6, 0.025, 0.04);
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0x8B6B3A, roughness: 0.5 });
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.position.set(0, 0.87, 0.58);
    bench.add(edge);

    // Legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0x4A2A14, roughness: 0.75 });
    const legGeo = new THREE.BoxGeometry(0.1, 0.9, 1.0);
    [[-1.65, 0], [1.65, 0], [0, 0]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(x, 0.45, z);
      leg.castShadow = true;
      bench.add(leg);
    });

    this._scene.add(bench);
    this._bench = bench;

    // ─── CRT MONITOR — Load GLB model + screen overlay ───
    this._loadCRTMonitor();

    // ─── BARREL (left side) ───
    this._buildBarrel(-2.8, 0, 0.5);
    this._buildBarrel(-2.3, 0, 1.2, 0.8);

    // ─── LANTERN MESHES ───
    this._buildLantern(-2.5, 3.0, 0.5);
    this._buildLantern(2.5, 3.0, 0.5);

    // ─── FRAMED PUPPETS & OPIUM on walls ───
    // Salon-style gallery wall — all unique, ~90% puppets / ~10% OPIUM
    const wallArt = [
      // ── Far left cluster ──
      { x: -8.2, y: 2.3, tilt: 0.03, id: 'a4ff5b9518fe1abb7a7fdbed4e015a842757e491a61d4efb2266c8d0a6581eb9i0' },
      { x: -8.0, y: 3.4, tilt: -0.04, id: '1edd323c21245b52f5c501dbfcebb7c373269236c626f21cdf22486177c43d73i0' },
      { x: -7.0, y: 2.8, tilt: -0.02, id: 'db52aedec9ed58d640639d84447eccac766e8d591d8d76c69785efb462bc3240i0' },
      { x: -6.8, y: 1.6, tilt: 0.05, id: '5ed9c51d2cf566cb95f482d59fcc9c37441c47ff6291d663318de03dcb500b58i0' }, // OPIUM
      { x: -5.8, y: 3.2, tilt: 0.02, id: '743ef68772b2bad0dc89ee183c8e4ef30e9323601236876db9f77c92c7dc8ebci0' },
      { x: -5.6, y: 2.1, tilt: -0.03, id: 'dc87ce1caca5ab3449daf60ea5363be107ce31fb091916b8063a7974bd5997b0i0' },
      // ── Left of center ──
      { x: -4.3, y: 2.6, tilt: 0.04, id: '301f47a13ab67c21f3c869c417ffa1a3c484abeaa8c3c618ece77523d9b11f94i0' },
      { x: -4.1, y: 3.5, tilt: -0.02, id: 'e4520773d3d7a182ed4bd8875626419db5db3ec73fcacd4cc48ad060afb02a30i0' },
      { x: -3.2, y: 1.8, tilt: -0.05, id: 'abff81d75b0dc256edc38dd773dabf3cf624d9ce087709e69e6af4f65a7d0d8ei0' },
      // ── Center-left ──
      { x: -2.5, y: 2.8, tilt: -0.05, id: '790088daaf0a16b756bacbb8f636dbefb76ce0b753ab18057f196ace902d5effi0' },
      { x: -1.5, y: 3.1, tilt: 0.03, id: '9a4e74444435604f9fbc0e742e379961574b6f3174bbf4c123cb81d418f1136bi0' },
      // ── Center (above bench) ──
      { x: 0.0, y: 2.6, tilt: -0.02, id: '2fc3b614beb5af22cd09fa9abf7beff719da953524175dd8924e7d9d2c5e0eebi0' },
      { x: 0.8, y: 3.3, tilt: 0.03, id: 'bb7e246b534e98cffd3a7ccd1dec370a471728ab6c14b8f060711784bf8509f9i0' },
      // ── Center-right ──
      { x: 1.5, y: 2.9, tilt: 0.04, id: '56636ffca4c65b73b46003682d9f8ba10e8af0a8012adebf40f0c849c0b16084i0' },
      { x: 2.8, y: 2.7, tilt: -0.03, id: '84d2d1cfc9b0eace65762e2181b5dfb48995fd28e60c22a0e6eac5539daf13f1i0' },
      { x: 2.6, y: 3.6, tilt: 0.02, id: 'cc842ad72d1bb622736403c232c3a4de5d6ec56fb3669ad519d843a15329983ei0' }, // OPIUM
      // ── Right cluster ──
      { x: 3.8, y: 2.2, tilt: -0.04, id: '176ab6d821dc25341c91aa764dc0c3755f30aaf783dc26ad65601a0a4f3304e4i0' },
      { x: 4.2, y: 3.1, tilt: 0.03, id: '73e39b0a6b429ce89153c77bd4b4a06d082dbcf10720d8f8295e09ffe09a00d0i0' },
      { x: 5.0, y: 2.7, tilt: -0.02, id: 'f6da7980e1e1d198b2fbd585c03ad9161034f0e882e4c178e7cf6bfe045ca0cei0' },
      { x: 5.2, y: 1.7, tilt: 0.05, id: '4aa41a4bf0a3feab322207f97ba7d4bc87b1c8e374ee9990674a4e3042aa7dcdi0' },
      // ── Far right cluster ──
      { x: 6.0, y: 3.3, tilt: -0.03, id: '58a40ba25c5b2e5e04e1b2ad1abd1df2d89161874807cc276ceea17e48ff1ec2i0' },
      { x: 6.2, y: 2.2, tilt: 0.04, id: 'b127d9843e62f1cf88f5bf766bdc85f1c378b49059a29845924190ca91e7b8a5i0' }, // OPIUM
      { x: 7.0, y: 2.8, tilt: -0.02, id: '548adcf32a76ccc3075a4c8aa6c177ec3806a81689ec0962cd43e9e06952faaai0' },
      { x: 7.2, y: 3.6, tilt: 0.03, id: 'a78fd335090d133649f5fe559ef7fdda79bb032e4e3e758d0ba125225b85139bi0' },
      { x: 8.0, y: 2.4, tilt: -0.04, id: '79e875190cbe79b47547ab744cade8c7295351763c76ac0e81878070c8f4d474i0' },
    ];
    wallArt.forEach((f, i) => {
      this._buildWallFrame(f.x, f.y, wallZ + 0.06, i * 13 + 7, f.tilt, f.id);
    });

    // Old hardcoded rug removed — replaced by GLB rug prop

    // ─── Contact shadow under character ───
    const cShadowGeo = new THREE.PlaneGeometry(2.0, 2.0);
    const cShadowMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {},
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec2 vUv;
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          float alpha = smoothstep(1.0, 0.15, d) * 0.3;
          gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
        }`
    });
    this._contactShadow = new THREE.Mesh(cShadowGeo, cShadowMat);
    this._contactShadow.rotation.x = -Math.PI / 2;
    this._contactShadow.position.set(-1.2, 0.006, 1.0);
    this._scene.add(this._contactShadow);

    // ─── VIGNETTE overlay (dark edges via large ring) ───
    // We handle this in post CSS instead
  }

  // ─── SHED PROPS (GLB items from traits) ───
  _loadProps() {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    this._props = {};

    const PROPS = [
      {
        name: 'candle',
        file: 'public/items/Meshy_AI_green_wax_candle_made_0301025842_texture.glb',
        pos: [-2.82, 0.69, 0.5],
        rot: [0, 0, 0],
        scale: 0.43
      },
      {
        name: 'basketball',
        file: 'public/items/Meshy_AI_Basketball_Sphere_0301025647_texture.glb',
        pos: [2.65, 0, -3.01],
        rot: [17, -39, 11],
        scale: 0.74
      },
      {
        name: 'purpleDrank',
        file: 'public/items/Meshy_AI_Purple_Spill_0301024631_texture.glb',
        pos: [1.08, 0.97, -1.12],
        rot: [0, -20, 0],
        scale: 0.93
      },
      {
        name: 'banana',
        file: 'public/items/Meshy_AI_Banana_0301025912_texture.glb',
        pos: [2.45, 1.03, -0.53],
        rot: [-95, -4, 39],
        scale: 0.34
      },
      {
        name: 'skateboard',
        file: 'public/items/Meshy_AI_Skateboard_Neon_Glide_0301025726_texture.glb',
        pos: [2.71, 0.05, -2.14],
        rot: [-1, 39, 0],
        scale: 0.29
      },
      {
        name: 'blunt',
        file: 'public/items/Meshy_AI_Cigar_Essence_blunt_0301025436_texture.glb',
        pos: [1.34, 1.02, -0.61],
        rot: [-48, -28, 2],
        scale: 0.06
      },
      {
        name: 'ashtray',
        file: 'public/items/Meshy_AI_Alien_Ashtray_0301025408_texture.glb',
        pos: [1.22, 0.95, -0.7],
        rot: [2, 0, 0],
        scale: 0.35
      },
      {
        name: 'bong',
        file: 'public/items/Meshy_AI_Little_Green_Man_Bong_0301025538_texture.glb',
        pos: [2.26, 0.97, -1.1],
        rot: [0, -22, 0],
        scale: 0.76
      },
      {
        name: 'hotdog',
        file: 'public/items/Meshy_AI_Classic_Hot_Dog_0301024940_texture.glb',
        pos: [1.76, 0.94, -0.96],
        rot: [-1, -62, 2],
        scale: 0.21
      },
      {
        name: 'gameboy',
        file: 'public/items/Meshy_AI_game_boy_0301034039_texture.glb',
        pos: [2.35, 1.01, -0.27],
        rot: [-71, -5, -13],
        scale: 0.51
      },
      {
        name: 'atm',
        file: 'public/items/Meshy_AI_Bitcoin_ATM_Machine_C_0301033547_texture.glb',
        pos: [-3.67, -0.12, -3],
        rot: [0, 14.9999, 0],
        scale: 3.25
      },
      {
        name: 'keyboard',
        file: 'public/items/Meshy_AI_Wireless_Keyboard_on__0301025242_texture.glb',
        pos: [0.1, 0.96, -0.68],
        rot: [-5, 0, 0],
        scale: 0.09
      },
      {
        name: 'officeChair',
        file: 'public/items/Meshy_AI_Ergonomic_Office_Chai_0301200802_texture.glb',
        pos: [1.09, 0, 0.5],
        rot: [0, -53, 0],
        scale: 2.15
      },
      {
        name: 'rug',
        file: 'public/items/Meshy_AI_Lion_s_Emblem_Rug_0301193710_texture.glb',
        pos: [0.96, -0.04, -1.15],
        rot: [0, -90, 0],
        scale: [0.07, 0.1, 0.1]
      },
      {
        name: 'sofa',
        file: 'public/items/Meshy_AI_sofa_0302005917_texture.glb',
        pos: [-4.94, 0, -0.61],
        rot: [0, 64, 0],
        scale: 1.56
      },
      {
        name: 'bitcoinStaff',
        file: 'public/items/Meshy_AI_bitcoin_staff_0301233932_texture.glb',
        pos: [-4.86, 0, -2.5],
        rot: [-10, -7, -8],
        scale: 2.37
      },
      {
        name: 'lamboBed',
        file: 'public/items/Meshy_AI_Orange_Supercar_Bed_0302023753_texture.glb',
        pos: [5.82, 0, -0.03],
        rot: [0, 12, 0],
        scale: 1.35
      },
      {
        name: 'miningRig',
        file: 'public/items/Meshy_AI_Bitcoin_Mining_Rig_0302021802_texture.glb',
        pos: [5, -0.12, -2.79],
        rot: [0, 180, 0],
        scale: 2.96
      }
    ];

    const promises = PROPS.map(cfg => new Promise(resolve => {
      loader.load(cfg.file, (gltf) => {
        const model = gltf.scene;
        model.position.set(...cfg.pos);
        model.rotation.set(
          THREE.MathUtils.degToRad(cfg.rot[0]),
          THREE.MathUtils.degToRad(cfg.rot[1]),
          THREE.MathUtils.degToRad(cfg.rot[2])
        );
        if (Array.isArray(cfg.scale)) {
          model.scale.set(cfg.scale[0], cfg.scale[1], cfg.scale[2]);
        } else {
          model.scale.setScalar(cfg.scale);
        }
        model.traverse(child => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) child.material.envMapIntensity = 0.25;
          }
        });
        model.name = 'prop_' + cfg.name;
        this._scene.add(model);
        this._props[cfg.name] = { model, cfg };

        // Attach live clock hands
        if (cfg.name === 'clock') this._attachClockHands(model);

        // If debug GUI is active, add controls for this prop
        if (this._propsFolder) this._addPropGUI(cfg.name, model);
        resolve();
      }, undefined, (err) => {
        console.warn(`Failed to load prop ${cfg.name}:`, err.message);
        resolve(); // don't block intro on a failed prop
      });
    }));
    return Promise.all(promises);
  }

  // ─── LIVE CLOCK HANDS ───
  _attachClockHands(clockModel) {
    // Pivot group sits at center of clock face
    // Adjust offset via debug GUI — these are relative to clock model origin
    this._clockPivot = new THREE.Group();
    this._clockPivot.position.set(0, 0.55, 0); // center of face relative to model
    clockModel.add(this._clockPivot);

    const handMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.3 });
    const secMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.3, metalness: 0.2 });

    // Hour hand — short, thick
    const hourGeo = new THREE.BoxGeometry(0.018, 0.22, 0.008);
    hourGeo.translate(0, 0.11, 0); // pivot at bottom
    this._hourHand = new THREE.Mesh(hourGeo, handMat);
    this._clockPivot.add(this._hourHand);

    // Minute hand — longer, thinner
    const minGeo = new THREE.BoxGeometry(0.013, 0.32, 0.006);
    minGeo.translate(0, 0.16, 0);
    this._minuteHand = new THREE.Mesh(minGeo, handMat);
    this._clockPivot.add(this._minuteHand);

    // Second hand — longest, thinnest, red
    const secGeo = new THREE.BoxGeometry(0.006, 0.35, 0.004);
    secGeo.translate(0, 0.175, 0);
    this._secondHand = new THREE.Mesh(secGeo, secMat);
    this._secondHand.position.z = 0.005; // slightly in front
    this._clockPivot.add(this._secondHand);

    // Center cap
    const capGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.012, 12);
    capGeo.rotateX(Math.PI / 2);
    const cap = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 }));
    cap.position.z = 0.006;
    this._clockPivot.add(cap);
  }

  _updateClockHands() {
    if (!this._hourHand) return;
    const now = new Date();
    const s = now.getSeconds() + now.getMilliseconds() / 1000;
    const m = now.getMinutes() + s / 60;
    const h = (now.getHours() % 12) + m / 60;

    this._secondHand.rotation.z = -s * (Math.PI / 30);
    this._minuteHand.rotation.z = -m * (Math.PI / 30);
    this._hourHand.rotation.z = -h * (Math.PI / 6);
  }

  _addPropGUI(name, model) {
    const f = this._propsFolder.addFolder(name);
    f.add(model.position, 'x', -15, 15, 0.01).name('X');
    f.add(model.position, 'y', -1, 4, 0.01).name('Y');
    f.add(model.position, 'z', -10, 10, 0.01).name('Z');
    const rotProxy = {
      rotX: THREE.MathUtils.radToDeg(model.rotation.x),
      rotY: THREE.MathUtils.radToDeg(model.rotation.y),
      rotZ: THREE.MathUtils.radToDeg(model.rotation.z)
    };
    f.add(rotProxy, 'rotX', -180, 180, 1).name('Rot X').onChange(v => { model.rotation.x = THREE.MathUtils.degToRad(v); });
    f.add(rotProxy, 'rotY', -180, 180, 1).name('Rot Y').onChange(v => { model.rotation.y = THREE.MathUtils.degToRad(v); });
    f.add(rotProxy, 'rotZ', -180, 180, 1).name('Rot Z').onChange(v => { model.rotation.z = THREE.MathUtils.degToRad(v); });
    f.add(model.scale, 'x', 0.01, 5, 0.01).name('Scale').onChange(v => { model.scale.setScalar(v); });
    f.add({ visible: true }, 'visible').name('Visible').onChange(v => { model.visible = v; });

    // Rug: separate width/height controls (non-uniform scale)
    if (name === 'rug') {
      f.add(model.scale, 'x', 0.01, 5, 0.01).name('Width');
      f.add(model.scale, 'y', 0.01, 5, 0.01).name('Height');
      f.add(model.scale, 'z', 0.01, 5, 0.01).name('Depth');
    }

    // Clock hands pivot controls
    if (name === 'clock' && this._clockPivot) {
      const cf = f.addFolder('Hands Pivot');
      cf.add(this._clockPivot.position, 'x', -1, 1, 0.005).name('Pivot X');
      cf.add(this._clockPivot.position, 'y', -1, 1, 0.005).name('Pivot Y');
      cf.add(this._clockPivot.position, 'z', -0.5, 0.5, 0.005).name('Pivot Z');
      const pivRotProxy = {
        rotX: THREE.MathUtils.radToDeg(this._clockPivot.rotation.x),
        rotY: THREE.MathUtils.radToDeg(this._clockPivot.rotation.y),
        rotZ: THREE.MathUtils.radToDeg(this._clockPivot.rotation.z)
      };
      cf.add(pivRotProxy, 'rotX', -90, 90, 1).name('Face Tilt X').onChange(v => { this._clockPivot.rotation.x = THREE.MathUtils.degToRad(v); });
      cf.add(pivRotProxy, 'rotY', -90, 90, 1).name('Face Tilt Y').onChange(v => { this._clockPivot.rotation.y = THREE.MathUtils.degToRad(v); });
    }

    f.close();
  }

  _loadCRTMonitor() {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    // Create the screen shader material — placed directly on the CRT glass face
    const screenMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uHasNFT: { value: 0 },
        uNFTColor: { value: new THREE.Color('#0f0') },
        uNFTTexture: { value: null },
        uHasTexture: { value: 0 },
        uBootTexture: { value: null },
        uHasBoot: { value: 0 },
        uScreenOn: { value: 0 },
        uOpacity: { value: 0.75 }
      },
      transparent: true,
      depthWrite: true,
      blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime;
        uniform float uHasNFT;
        uniform vec3 uNFTColor;
        uniform sampler2D uNFTTexture;
        uniform float uHasTexture;
        uniform sampler2D uBootTexture;
        uniform float uHasBoot;
        uniform float uScreenOn;
        uniform float uOpacity;
        varying vec2 vUv;

        void main() {
          vec3 bg = vec3(0.03, 0.04, 0.03);
          vec3 col;

          if (uHasTexture > 0.5) {
            col = texture2D(uNFTTexture, vUv).rgb;
            col *= 0.92 + 0.08 * sin(vUv.y * 180.0);
            float vig = 1.0 - 0.2 * length(vUv - 0.5);
            col *= vig;
            col = mix(col, col * vec3(0.85, 1.1, 0.85), 0.12);
          } else if (uHasNFT > 0.5) {
            vec2 c = vUv - 0.5;
            float r = length(c);
            col = bg;
            float ring = smoothstep(0.25, 0.2, r) * smoothstep(0.1, 0.15, r);
            col += uNFTColor * ring * 0.4;
            float inner = smoothstep(0.15, 0.0, r);
            col += uNFTColor * inner * 0.6;
            float priceLine = smoothstep(0.015, 0.0, abs(vUv.y - 0.12)) * step(0.3, vUv.x) * step(vUv.x, 0.7);
            col += vec3(0.0, 1.0, 0.0) * priceLine * 0.3;
            col *= 0.92 + 0.08 * sin(vUv.y * 180.0);
            float vig = 1.0 - 0.2 * length(vUv - 0.5);
            col *= vig;
          } else if (uHasBoot > 0.5) {
            // Shrink smile image with padding around edges
            float pad = 0.2;
            vec2 shrunkUv = (vUv - pad) / (1.0 - pad * 2.0);
            col = bg;
            // Only draw the bright (white) parts of smile on top of CRT bg
            if (shrunkUv.x > 0.0 && shrunkUv.x < 1.0 && shrunkUv.y > 0.0 && shrunkUv.y < 1.0) {
              vec3 tex = texture2D(uBootTexture, shrunkUv).rgb;
              float brightness = max(tex.r, max(tex.g, tex.b));
              col = mix(bg, tex, smoothstep(0.15, 0.4, brightness));
            }
            // Gentle CRT warmth + scanlines
            col *= 0.90 + 0.10 * sin(vUv.y * 200.0);
            float vig = 1.0 - 0.15 * length(vUv - 0.5);
            col *= vig;
            col = mix(col, col * vec3(0.9, 1.05, 0.9), 0.08);
          } else {
            col = bg;
            vec2 p = vUv * 12.0;
            float gx = abs(fract(p.x) - 0.5) / fwidth(p.x);
            float gy = abs(fract(p.y) - 0.5) / fwidth(p.y);
            float grid = (1.0 - min(min(gx, gy), 1.0)) * 0.05;
            col += vec3(0.0, grid, 0.0);
            float blink = step(0.5, fract(uTime * 0.8));
            float textArea = step(0.3, vUv.x) * step(vUv.x, 0.7) *
                            step(0.42, vUv.y) * step(vUv.y, 0.58);
            col += vec3(0.0, 0.7, 0.0) * textArea * blink * 0.35;
            col *= 0.92 + 0.08 * sin(vUv.y * 180.0);
            float vig = 1.0 - 0.25 * length(vUv - 0.5);
            col *= vig;
          }

          // CRT power-on: horizontal line expands vertically (classic TV turn-on)
          float powerOn = clamp(uScreenOn, 0.0, 1.0);
          float vertDist = abs(vUv.y - 0.5) * 2.0; // 0 at center, 1 at edge
          float powerMask = smoothstep(powerOn, powerOn - 0.15, vertDist);
          // Phosphor brightness boost during early power-on
          float phosphorBoost = 1.0 + (1.0 - powerOn) * 0.6;
          col *= powerMask * phosphorBoost;

          gl_FragColor = vec4(col, uOpacity * step(0.001, powerOn));
        }`
    });
    this._monitorMat = screenMat;

    // Try loading GLB CRT monitor
    loader.load(
      'public/Meshy_AI_CRT_Computer_Monitor_0228035713_texture.glb',
      (gltf) => {
        const crt = gltf.scene;

        // Scale and position — tuned via GUI
        crt.scale.setScalar(1.55);
        crt.position.set(0.05, 1, -1.65);
        this._scene.add(crt);

        this._crtModel = crt;

        // Enable shadows on the CRT body mesh
        crt.traverse(child => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // ─── SCREEN OVERLAY ───
        // Plane child positioned on the CRT glass face — tuned via GUI
        const screenGeo = new THREE.PlaneGeometry(0.69, 0.63);
        const screenPlane = new THREE.Mesh(screenGeo, screenMat);
        screenPlane.position.set(0.01, 0.63, 0.49);
        crt.add(screenPlane);
        this._screenMesh = screenPlane;

        // Load smile.png as boot/idle screen
        const bootImg = new Image();
        bootImg.crossOrigin = 'anonymous';
        bootImg.onload = () => {
          const tex = new THREE.Texture(bootImg);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.needsUpdate = true;
          screenMat.uniforms.uBootTexture.value = tex;
          screenMat.uniforms.uHasBoot.value = 1;
        };
        bootImg.src = 'public/img/smile.png';

        console.log('CRT GLB loaded! Screen overlay placed on glass face.');
        if (this._setupCRTGUI) this._setupCRTGUI();
      },
      undefined,
      (err) => {
        console.warn('CRT GLB failed, using fallback procedural CRT:', err);
        this._buildFallbackCRT();
      }
    );
  }

  // Fallback procedural CRT if GLB fails
  _buildFallbackCRT() {
    const crtGroup = new THREE.Group();

    // Frame — MUCH bigger now
    const frameGeo = new THREE.BoxGeometry(1.6, 1.1, 0.14);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0xA09888, metalness: 0.1, roughness: 0.5, envMapIntensity: 0.3
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = 0.55;
    frame.castShadow = true;
    crtGroup.add(frame);

    // Screen bezel
    const bezelGeo = new THREE.BoxGeometry(1.4, 0.9, 0.04);
    const bezelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3 });
    const bezel = new THREE.Mesh(bezelGeo, bezelMat);
    bezel.position.set(0, 0.55, 0.07);
    crtGroup.add(bezel);

    // Screen plane with shader
    const screenGeo = new THREE.PlaneGeometry(1.28, 0.78);
    const screen = new THREE.Mesh(screenGeo, this._monitorMat);
    screen.position.set(0, 0.55, 0.09);
    crtGroup.add(screen);
    this._screenMesh = screen;

    // Stand
    const standGeo = new THREE.CylinderGeometry(0.06, 0.1, 0.2, 8);
    const standMat = new THREE.MeshStandardMaterial({ color: 0x787068, roughness: 0.4 });
    const stand = new THREE.Mesh(standGeo, standMat);
    stand.position.set(0, 0.1, 0);
    crtGroup.add(stand);

    // Base
    const baseGeo = new THREE.BoxGeometry(0.6, 0.04, 0.35);
    const base = new THREE.Mesh(baseGeo, standMat);
    crtGroup.add(base);

    // Position on bench
    if (this._bench) {
      crtGroup.position.set(0.2, 0.95, -0.15);
      this._bench.add(crtGroup);
    } else {
      crtGroup.position.set(1.2, 0.95, -1.15);
      this._scene.add(crtGroup);
    }

    // Power LED
    const ledGeo = new THREE.SphereGeometry(0.015, 6, 6);
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    this._powerLED = new THREE.Mesh(ledGeo, ledMat);
    this._powerLED.position.set(0.6, 0.08, 0.07);
    crtGroup.add(this._powerLED);
  }

  _buildBarrel(x, y, z, scale = 1) {
    const barrel = new THREE.Group();

    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.32 * scale, 0.28 * scale, 0.7 * scale, 12);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x5A3A18,
      roughness: 0.8,
      metalness: 0.02
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.35 * scale;
    body.castShadow = true;
    barrel.add(body);

    // Metal bands
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xB8A060, metalness: 0.4, roughness: 0.4 });
    [0.25, 0.5].forEach(pct => {
      const bandGeo = new THREE.TorusGeometry(0.31 * scale, 0.015 * scale, 6, 16);
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.y = pct * 0.7 * scale;
      band.rotation.x = Math.PI / 2;
      barrel.add(band);
    });

    barrel.position.set(x, y, z);
    this._scene.add(barrel);
  }

  _buildLantern(x, y, z) {
    const group = new THREE.Group();

    // Chain
    const chainGeo = new THREE.CylinderGeometry(0.01, 0.01, 1.2, 4);
    const chainMat = new THREE.MeshStandardMaterial({ color: 0x4A3A20, roughness: 0.6 });
    const chain = new THREE.Mesh(chainGeo, chainMat);
    chain.position.y = 0.6;
    group.add(chain);

    // Housing
    const housingGeo = new THREE.BoxGeometry(0.2, 0.18, 0.2);
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x5A4A28, roughness: 0.7 });
    const housing = new THREE.Mesh(housingGeo, housingMat);
    group.add(housing);

    // Glass (emissive)
    const glassGeo = new THREE.BoxGeometry(0.14, 0.12, 0.14);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xFFD080,
      emissive: 0xFFD080,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.7
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    group.add(glass);

    group.position.set(x, y, z);
    this._scene.add(group);
  }

  _buildWallFrame(x, y, z, seed, tilt, inscriptionId) {
    const group = new THREE.Group();

    // Nail
    const nailGeo = new THREE.SphereGeometry(0.02, 6, 6);
    const nailMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
    const nail = new THREE.Mesh(nailGeo, nailMat);
    nail.position.y = 0.22;
    group.add(nail);

    // Frame
    const frameGeo = new THREE.BoxGeometry(0.35, 0.4, 0.03);
    const frameColors = [0x6B4A28, 0x7B5A32, 0x5A3A1E, 0x8B6914, 0xD4A843];
    const frameMat = new THREE.MeshStandardMaterial({
      color: frameColors[seed % frameColors.length],
      roughness: 0.7,
      metalness: 0.05
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.castShadow = true;
    group.add(frame);

    // Canvas inside — load real puppet from ordinals.com
    const canvasGeo = new THREE.PlaneGeometry(0.28, 0.33);
    const canvasMat = new THREE.MeshStandardMaterial({ color: 0x1a1208 });
    const canvasMesh = new THREE.Mesh(canvasGeo, canvasMat);
    canvasMesh.position.z = 0.016;
    group.add(canvasMesh);

    if (inscriptionId) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const tex = new THREE.Texture(img);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        canvasMesh.material = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.9,
          metalness: 0.0,
          envMapIntensity: 0.1
        });
      };
      img.src = 'https://ordinals.com/content/' + inscriptionId;
    }

    group.position.set(x, y, z);
    group.rotation.z = tilt;
    this._scene.add(group);
  }

  _buildDustParticles() {
    const count = this._quality === 'high' ? 80 : 30;
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 1] = Math.random() * 4 + 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
      speeds[i] = 0.01 + Math.random() * 0.02;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xFFE0A0,
      size: 0.02,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this._dustParticles = new THREE.Points(geo, mat);
    this._dustParticles.userData.speeds = speeds;
    this._scene.add(this._dustParticles);
  }

  // ─── MODEL LOADING ───
  _loadModel() {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const loadingBar = document.getElementById('loading-bar-fill');
    const loadingStatus = document.getElementById('loading-status');

    const updateStatus = (msg, pct) => {
      if (loadingStatus) loadingStatus.textContent = msg;
      if (loadingBar) loadingBar.style.width = pct + '%';
    };

    updateStatus('Loading puppet master...', 20);

    loader.load(
      'public/Meshy_AI_lefou_real_0228044530_texture.glb',
      (gltf) => {
        updateStatus('Puppet master arrived!', 90);
        this._model = gltf.scene;

        // If the GLB has animations, play them
        if (gltf.animations && gltf.animations.length > 0) {
          this._mixer = new THREE.AnimationMixer(this._model);
          gltf.animations.forEach(clip => {
            const action = this._mixer.clipAction(clip);
            action.play();
          });
        }

        // Position the model (like Dr. ICU - left side, facing camera)
        const box = new THREE.Box3().setFromObject(this._model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Scale and position — tuned via GUI
        this._model.scale.setScalar(2.18);
        this._model.position.set(-1.1, 0.2, 0.75);
        this._model.rotation.y = THREE.MathUtils.degToRad(12);

        this._modelBasePos.copy(this._model.position);
        this._modelBaseRot.copy(this._model.rotation);
        this._modelBaseScale.copy(this._model.scale);

        // Enable shadows
        this._model.traverse(child => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.envMapIntensity = 0.3;
            }
          }
        });

        this._scene.add(this._model);

        // Hardcoded head offset based on known model geometry
        // (bounding box can be skewed by arms/bunny ears)
        this._headOffsetY = 2.2;
        this._bubbleVec = new THREE.Vector3();

        if (this._setupCharGUI) this._setupCharGUI();

        // Wait for all props to finish loading, then start intro
        updateStatus('Setting up the shed...', 92);
        (this._propsReady || Promise.resolve()).then(() => {
          updateStatus('Welcome to the Shed!', 100);
          setTimeout(() => {
            const loading = document.getElementById('scene-loading');
            if (loading) {
              loading.classList.add('hidden');
              setTimeout(() => loading.style.display = 'none', 600);
            }
            this._startIntro();
            setTimeout(() => {
              if (window._shedApp) window._shedApp.showInitialBubble();
            }, 1800);
          }, 400);
        });
      },
      (progress) => {
        if (progress.total > 0) {
          const pct = Math.round((progress.loaded / progress.total) * 70) + 20;
          updateStatus('Loading puppet master...', Math.min(pct, 88));
        }
      },
      (error) => {
        console.warn('Model load error:', error);
        updateStatus('Puppet is shy... proceeding without 3D', 100);
        setTimeout(() => {
          const loading = document.getElementById('scene-loading');
          if (loading) {
            loading.classList.add('hidden');
            setTimeout(() => loading.style.display = 'none', 600);
          }
          // Fallback reveal
          const mp = document.getElementById('marketplace');
          if (mp) mp.classList.add('revealed');
          if (window._shedApp && window._shedApp.revealGrid) window._shedApp.revealGrid();
        }, 1000);
      }
    );
  }

  // ─── EVENTS ───
  _initEvents() {
    // ResizeObserver fires during CSS height transitions (window 'resize' does not)
    this._roRAF = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(this._roRAF);
      this._roRAF = requestAnimationFrame(() => this._resize());
    });
    ro.observe(this._canvas);

    // Pause rendering when tab is hidden (saves GPU/battery)
    document.addEventListener('visibilitychange', () => {
      this._tabHidden = document.hidden;
    });

    this._canvas.addEventListener('mousemove', (e) => {
      this._canvasRect = this._canvasRect || this._canvas.getBoundingClientRect();
      this._targetMouse.x = ((e.clientX - this._canvasRect.left) / this._canvasRect.width) * 2 - 1;
      this._targetMouse.y = -((e.clientY - this._canvasRect.top) / this._canvasRect.height) * 2 + 1;
    });

    this._canvas.addEventListener('click', () => {
      this._clicked = true;
      this._clickTime = this._clock.getElapsedTime();
    });
  }

  _resize() {
    const w = this._canvas.clientWidth;
    const h = this._canvas.clientHeight;
    if (w === 0 || h === 0) return;
    // setSize handles DPR internally via setPixelRatio — pass CSS pixels only
    this._renderer.setSize(w, h, false);
    if (this._camera) {
      this._camera.aspect = w / h;
      this._camera.updateProjectionMatrix();
    }
    this._canvasRect = null;
  }

  // ─── BUBBLE POSITION TRACKING ───
  // Projects the character's head position to screen coordinates
  // Returns { x, y } in pixels relative to the scene container, or null if model not loaded
  getBubbleScreenPos() {
    if (!this._model || !this._bubbleVec || !this._camera) return null;

    // World position of head (follows model's animated position including breathing)
    this._bubbleVec.set(
      this._model.position.x,
      this._model.position.y + this._headOffsetY,
      this._model.position.z
    );

    // Project to normalized device coords (-1 to 1)
    this._bubbleVec.project(this._camera);

    // Convert to pixel coords relative to canvas
    const rect = this._canvas.getBoundingClientRect();
    const x = (this._bubbleVec.x * 0.5 + 0.5) * rect.width;
    const y = (-this._bubbleVec.y * 0.5 + 0.5) * rect.height;

    return { x, y };
  }

  // ─── DEBUG GUI (lil-gui) ───
  async _initDebugGUI() {
    const { default: GUI } = await import('https://cdn.jsdelivr.net/npm/lil-gui@0.19/+esm');
    const gui = new GUI({ title: 'SHED SCENE EDITOR', width: 320 });
    gui.domElement.style.zIndex = '9999';
    this._gui = gui;

    // Helper: color uniform → hex string
    const c2h = (c) => '#' + c.getHexString();

    // ═══ RENDERER ═══
    const rFolder = gui.addFolder('Renderer');
    rFolder.add(this._renderer, 'toneMappingExposure', 0, 3, 0.01).name('Exposure');
    const tmOptions = { None: THREE.NoToneMapping, Linear: THREE.LinearToneMapping, Reinhard: THREE.ReinhardToneMapping, Cineon: THREE.CineonToneMapping, ACES: THREE.ACESFilmicToneMapping, AgX: THREE.AgXToneMapping, Neutral: THREE.NeutralToneMapping };
    const tmProxy = { toneMapping: this._renderer.toneMapping };
    rFolder.add(tmProxy, 'toneMapping', tmOptions).name('Tone Mapping').onChange(v => { this._renderer.toneMapping = v; });
    rFolder.close();

    // ═══ SCENE ═══
    const sFolder = gui.addFolder('Scene');
    const sceneBg = { color: '#' + this._scene.background.getHexString() };
    sFolder.addColor(sceneBg, 'color').name('Background').onChange(v => { this._scene.background.set(v); });
    if (this._scene.fog) {
      const fogP = { color: '#' + this._scene.fog.color.getHexString(), density: this._scene.fog.density };
      sFolder.addColor(fogP, 'color').name('Fog Color').onChange(v => this._scene.fog.color.set(v));
      sFolder.add(fogP, 'density', 0, 0.3, 0.001).name('Fog Density').onChange(v => { this._scene.fog.density = v; });
    }
    sFolder.close();

    // ═══ CAMERA ═══
    const cFolder = gui.addFolder('Camera');
    cFolder.add(this._camera, 'fov', 15, 90, 1).name('FOV').onChange(() => this._camera.updateProjectionMatrix());
    cFolder.add(this._baseCameraPos, 'x', -10, 10, 0.1).name('Pos X');
    cFolder.add(this._baseCameraPos, 'y', -5, 10, 0.1).name('Pos Y');
    cFolder.add(this._baseCameraPos, 'z', 0, 15, 0.1).name('Pos Z');
    cFolder.add(this._baseCameraTarget, 'x', -5, 5, 0.1).name('Look X');
    cFolder.add(this._baseCameraTarget, 'y', -2, 5, 0.1).name('Look Y');
    cFolder.add(this._baseCameraTarget, 'z', -5, 5, 0.1).name('Look Z');
    cFolder.close();

    // ═══ HEMISPHERE LIGHT ═══
    if (this._hemiLight) {
      const hFolder = gui.addFolder('Hemisphere Light');
      hFolder.add(this._hemiLight, 'intensity', 0, 3, 0.01).name('Intensity');
      const hSky = { color: c2h(this._hemiLight.color) };
      const hGnd = { color: c2h(this._hemiLight.groundColor) };
      hFolder.addColor(hSky, 'color').name('Sky Color').onChange(v => this._hemiLight.color.set(v));
      hFolder.addColor(hGnd, 'color').name('Ground Color').onChange(v => this._hemiLight.groundColor.set(v));
      hFolder.close();
    }

    // ═══ KEY LIGHT (Directional) ═══
    if (this._keyLight) {
      const kFolder = gui.addFolder('Key Light (Sun)');
      kFolder.add(this._keyLight, 'intensity', 0, 8, 0.05).name('Intensity');
      const kColor = { color: c2h(this._keyLight.color) };
      kFolder.addColor(kColor, 'color').name('Color').onChange(v => this._keyLight.color.set(v));
      kFolder.add(this._keyLight.position, 'x', -10, 10, 0.1).name('Pos X');
      kFolder.add(this._keyLight.position, 'y', -5, 15, 0.1).name('Pos Y');
      kFolder.add(this._keyLight.position, 'z', -10, 10, 0.1).name('Pos Z');
      if (this._keyLight.shadow) {
        kFolder.add(this._keyLight.shadow, 'bias', -0.01, 0.01, 0.0001).name('Shadow Bias');
        kFolder.add(this._keyLight.shadow, 'normalBias', 0, 0.1, 0.001).name('Shadow Normal Bias');
      }
      kFolder.close();
    }

    // ═══ FILL LIGHT ═══
    if (this._fillLight) {
      const fFolder = gui.addFolder('Fill Light');
      fFolder.add(this._fillLight, 'intensity', 0, 3, 0.01).name('Intensity');
      const fColor = { color: c2h(this._fillLight.color) };
      fFolder.addColor(fColor, 'color').name('Color').onChange(v => this._fillLight.color.set(v));
      fFolder.add(this._fillLight.position, 'x', -10, 10, 0.1).name('Pos X');
      fFolder.add(this._fillLight.position, 'y', -5, 15, 0.1).name('Pos Y');
      fFolder.add(this._fillLight.position, 'z', -10, 10, 0.1).name('Pos Z');
      fFolder.close();
    }

    // ═══ RIM LIGHT ═══
    if (this._rimLight) {
      const rLFolder = gui.addFolder('Rim Light');
      rLFolder.add(this._rimLight, 'intensity', 0, 5, 0.05).name('Intensity');
      const rimColor = { color: c2h(this._rimLight.color) };
      rLFolder.addColor(rimColor, 'color').name('Color').onChange(v => this._rimLight.color.set(v));
      rLFolder.add(this._rimLight.position, 'x', -10, 10, 0.1).name('Pos X');
      rLFolder.add(this._rimLight.position, 'y', -5, 15, 0.1).name('Pos Y');
      rLFolder.add(this._rimLight.position, 'z', -10, 10, 0.1).name('Pos Z');
      rLFolder.close();
    }

    // ═══ LANTERN LIGHTS ═══
    if (this._lanternL) {
      const lFolder = gui.addFolder('Lanterns');
      const lanternProxy = { intensity: this._lanternBaseIntensity, distance: this._lanternL.distance, decay: this._lanternL.decay };
      const lColor = { color: c2h(this._lanternL.color) };
      lFolder.add(lanternProxy, 'intensity', 0, 10, 0.1).name('Base Intensity').onChange(v => {
        // Store for flicker reference
        this._lanternBaseIntensity = v;
      });
      lFolder.addColor(lColor, 'color').name('Color').onChange(v => { this._lanternL.color.set(v); this._lanternR.color.set(v); });
      lFolder.add(lanternProxy, 'distance', 1, 20, 0.5).name('Distance').onChange(v => { this._lanternL.distance = v; this._lanternR.distance = v; });
      lFolder.add(lanternProxy, 'decay', 0, 5, 0.1).name('Decay').onChange(v => { this._lanternL.decay = v; this._lanternR.decay = v; });
      lFolder.add(this._lanternL.position, 'x', -6, 0, 0.1).name('Left X');
      lFolder.add(this._lanternL.position, 'y', 0, 6, 0.1).name('Left Y');
      lFolder.add(this._lanternR.position, 'x', 0, 6, 0.1).name('Right X');
      lFolder.add(this._lanternR.position, 'y', 0, 6, 0.1).name('Right Y');
      lFolder.close();
    }

    // ═══ CRT GLOW ═══
    if (this._crtLight) {
      const crtFolder = gui.addFolder('CRT Glow');
      crtFolder.add(this._crtLight, 'intensity', 0, 10, 0.1).name('Intensity');
      const crtColor = { color: c2h(this._crtLight.color) };
      crtFolder.addColor(crtColor, 'color').name('Color').onChange(v => this._crtLight.color.set(v));
      crtFolder.add(this._crtLight, 'distance', 0, 15, 0.5).name('Distance');
      crtFolder.add(this._crtLight, 'decay', 0, 5, 0.1).name('Decay');
      crtFolder.add(this._crtLight.position, 'x', -5, 5, 0.1).name('Pos X');
      crtFolder.add(this._crtLight.position, 'y', -2, 5, 0.1).name('Pos Y');
      crtFolder.add(this._crtLight.position, 'z', -5, 5, 0.1).name('Pos Z');
      crtFolder.close();
    }

    // ═══ BLOOM ═══
    if (this._bloomPass) {
      const bFolder = gui.addFolder('Bloom');
      bFolder.add(this._bloomPass, 'strength', 0, 2, 0.01).name('Strength');
      bFolder.add(this._bloomPass, 'radius', 0, 2, 0.01).name('Radius');
      bFolder.add(this._bloomPass, 'threshold', 0, 2, 0.01).name('Threshold');
      bFolder.close();
    }

    // ═══ CHARACTER (deferred — set up after model loads) ═══
    this._guiCharFolder = gui.addFolder('Character');
    this._guiCharFolder.close();
    this._setupCharGUI = () => {
      if (!this._model || this._guiCharReady) return;
      this._guiCharReady = true;
      const cf = this._guiCharFolder;
      cf.add(this._modelBasePos, 'x', -5, 5, 0.05).name('Pos X').onChange(() => this._model.position.copy(this._modelBasePos));
      cf.add(this._modelBasePos, 'y', -2, 5, 0.05).name('Pos Y').onChange(() => this._model.position.copy(this._modelBasePos));
      cf.add(this._modelBasePos, 'z', -5, 5, 0.05).name('Pos Z').onChange(() => this._model.position.copy(this._modelBasePos));
      const rotProxy = { y: THREE.MathUtils.radToDeg(this._modelBaseRot.y) };
      cf.add(rotProxy, 'y', -180, 180, 1).name('Rotation Y°').onChange(v => {
        this._modelBaseRot.y = THREE.MathUtils.degToRad(v);
        this._model.rotation.y = this._modelBaseRot.y;
      });
      const scaleProxy = { scale: this._modelBaseScale.x };
      cf.add(scaleProxy, 'scale', 0.1, 5, 0.01).name('Scale').onChange(v => {
        this._modelBaseScale.setScalar(v);
        this._model.scale.setScalar(v);
      });
    };

    // ═══ CRT MONITOR (deferred) ═══
    this._guiCRTFolder = gui.addFolder('CRT Monitor');
    this._guiCRTFolder.close();
    this._setupCRTGUI = () => {
      if (!this._crtModel || this._guiCRTReady) return;
      this._guiCRTReady = true;
      const mf = this._guiCRTFolder;
      mf.add(this._crtModel.position, 'x', -5, 5, 0.05).name('Pos X');
      mf.add(this._crtModel.position, 'y', -2, 5, 0.05).name('Pos Y');
      mf.add(this._crtModel.position, 'z', -5, 5, 0.05).name('Pos Z');
      const crtScaleProxy = { scale: this._crtModel.scale.x };
      mf.add(crtScaleProxy, 'scale', 0.1, 5, 0.01).name('Scale').onChange(v => this._crtModel.scale.setScalar(v));
      // Screen overlay position (child of CRT)
      if (this._screenMesh) {
        const sf = mf.addFolder('Screen Overlay');
        sf.add(this._screenMesh.position, 'x', -2, 2, 0.01).name('Screen X');
        sf.add(this._screenMesh.position, 'y', -2, 2, 0.01).name('Screen Y');
        sf.add(this._screenMesh.position, 'z', -2, 2, 0.01).name('Screen Z');
        const scrScaleProxy = { w: this._screenMesh.geometry.parameters.width, h: this._screenMesh.geometry.parameters.height };
        sf.add(scrScaleProxy, 'w', 0.05, 3, 0.01).name('Width').onChange(v => {
          const h = this._screenMesh.geometry.parameters.height;
          this._screenMesh.geometry.dispose();
          this._screenMesh.geometry = new THREE.PlaneGeometry(v, h);
        });
        sf.add(scrScaleProxy, 'h', 0.05, 3, 0.01).name('Height').onChange(v => {
          const w = this._screenMesh.geometry.parameters.width;
          this._screenMesh.geometry.dispose();
          this._screenMesh.geometry = new THREE.PlaneGeometry(w, v);
        });
        // Blending modes
        const blendOpts = {
          Normal: THREE.NormalBlending,
          Additive: THREE.AdditiveBlending,
          Subtractive: THREE.SubtractiveBlending,
          Multiply: THREE.MultiplyBlending
        };
        const mat = this._screenMesh.material;
        const blendProxy = { blending: 'Normal', opacity: 1.0, transparent: mat.transparent, depthWrite: mat.depthWrite };
        sf.add(blendProxy, 'blending', Object.keys(blendOpts)).name('Blend Mode').onChange(v => {
          mat.blending = blendOpts[v];
          mat.transparent = (v !== 'Normal');
          mat.depthWrite = (v === 'Normal');
          mat.needsUpdate = true;
          blendProxy.transparent = mat.transparent;
          blendProxy.depthWrite = mat.depthWrite;
        });
        sf.add(blendProxy, 'opacity', 0, 1, 0.01).name('Opacity').onChange(v => {
          mat.uniforms.uOpacity = mat.uniforms.uOpacity || { value: 1 };
          mat.uniforms.uOpacity.value = v;
          mat.transparent = v < 1;
          mat.needsUpdate = true;
        });
        sf.add(blendProxy, 'transparent').name('Transparent').onChange(v => {
          mat.transparent = v;
          mat.needsUpdate = true;
        });
        sf.add(blendProxy, 'depthWrite').name('Depth Write').onChange(v => {
          mat.depthWrite = v;
          mat.needsUpdate = true;
        });
        // Side rendering
        const sideOpts = { Front: THREE.FrontSide, Back: THREE.BackSide, Double: THREE.DoubleSide };
        const sideProxy = { side: 'Front' };
        sf.add(sideProxy, 'side', Object.keys(sideOpts)).name('Side').onChange(v => {
          mat.side = sideOpts[v];
          mat.needsUpdate = true;
        });
      }
    };

    // ═══ PROPS ═══
    this._propsFolder = gui.addFolder('Props (Items)');
    // Props loaded async — GUI controls added as they load via _addPropGUI
    const propsExport = {
      exportProps: () => {
        const lines = Object.entries(this._props).map(([name, { model }]) => {
          const p = (v) => Math.round(v * 100) / 100;
          return `${name}: pos(${p(model.position.x)}, ${p(model.position.y)}, ${p(model.position.z)}), rot(${p(THREE.MathUtils.radToDeg(model.rotation.x))}, ${p(THREE.MathUtils.radToDeg(model.rotation.y))}, ${p(THREE.MathUtils.radToDeg(model.rotation.z))}), scale=${p(model.scale.x)}`;
        });
        const s = lines.join('\n');
        navigator.clipboard.writeText(s).catch(() => {});
        console.log('Props positions:\n' + s);
      }
    };
    this._propsFolder.add(propsExport, 'exportProps').name('📋 Copy Props Positions');
    // Add GUI controls for any props that already loaded
    if (this._props) {
      Object.entries(this._props).forEach(([name, { model }]) => {
        this._addPropGUI(name, model);
      });
    }

    // ═══ EXPORT BUTTON ═══
    const exportProxy = {
      exportSettings: () => {
        const s = this._exportSettings();
        navigator.clipboard.writeText(s).then(() => console.log('Settings copied to clipboard!')).catch(() => {});
        console.log(s);
      }
    };
    gui.add(exportProxy, 'exportSettings').name('📋 Copy Settings to Console');
  }

  _exportSettings() {
    const c2h = (c) => '#' + c.getHexString();
    const p = (v) => Math.round(v * 1000) / 1000;
    const lines = [
      '// ─── SHED SCENE SETTINGS (paste into code) ───',
      `renderer.toneMappingExposure = ${p(this._renderer.toneMappingExposure)};`,
      `renderer.toneMapping = ${this._renderer.toneMapping}; // THREE.ACESFilmicToneMapping = 4`,
      `scene.background = new THREE.Color('${c2h(this._scene.background)}');`,
    ];
    if (this._scene.fog) {
      lines.push(`scene.fog = new THREE.FogExp2('${c2h(this._scene.fog.color)}', ${p(this._scene.fog.density)});`);
    }
    lines.push(
      `camera.fov = ${p(this._camera.fov)};`,
      `baseCameraPos.set(${p(this._baseCameraPos.x)}, ${p(this._baseCameraPos.y)}, ${p(this._baseCameraPos.z)});`,
      `baseCameraTarget.set(${p(this._baseCameraTarget.x)}, ${p(this._baseCameraTarget.y)}, ${p(this._baseCameraTarget.z)});`,
    );
    if (this._hemiLight) {
      lines.push(`hemiLight: intensity=${p(this._hemiLight.intensity)}, sky='${c2h(this._hemiLight.color)}', ground='${c2h(this._hemiLight.groundColor)}';`);
    }
    if (this._keyLight) {
      lines.push(`keyLight: intensity=${p(this._keyLight.intensity)}, color='${c2h(this._keyLight.color)}', pos=(${p(this._keyLight.position.x)}, ${p(this._keyLight.position.y)}, ${p(this._keyLight.position.z)});`);
    }
    if (this._fillLight) {
      lines.push(`fillLight: intensity=${p(this._fillLight.intensity)}, color='${c2h(this._fillLight.color)}', pos=(${p(this._fillLight.position.x)}, ${p(this._fillLight.position.y)}, ${p(this._fillLight.position.z)});`);
    }
    if (this._rimLight) {
      lines.push(`rimLight: intensity=${p(this._rimLight.intensity)}, color='${c2h(this._rimLight.color)}', pos=(${p(this._rimLight.position.x)}, ${p(this._rimLight.position.y)}, ${p(this._rimLight.position.z)});`);
    }
    if (this._lanternL) {
      lines.push(`lanterns: intensity=${p(this._lanternBaseIntensity || 3)}, color='${c2h(this._lanternL.color)}', dist=${p(this._lanternL.distance)}, decay=${p(this._lanternL.decay)};`);
      lines.push(`  left pos=(${p(this._lanternL.position.x)}, ${p(this._lanternL.position.y)}, ${p(this._lanternL.position.z)});`);
      lines.push(`  right pos=(${p(this._lanternR.position.x)}, ${p(this._lanternR.position.y)}, ${p(this._lanternR.position.z)});`);
    }
    if (this._crtLight) {
      lines.push(`crtLight: intensity=${p(this._crtLight.intensity)}, color='${c2h(this._crtLight.color)}', dist=${p(this._crtLight.distance)}, decay=${p(this._crtLight.decay)}, pos=(${p(this._crtLight.position.x)}, ${p(this._crtLight.position.y)}, ${p(this._crtLight.position.z)});`);
    }
    if (this._bloomPass) {
      lines.push(`bloom: strength=${p(this._bloomPass.strength)}, radius=${p(this._bloomPass.radius)}, threshold=${p(this._bloomPass.threshold)};`);
    }
    if (this._model) {
      lines.push(`character: pos=(${p(this._modelBasePos.x)}, ${p(this._modelBasePos.y)}, ${p(this._modelBasePos.z)}), rotY=${p(THREE.MathUtils.radToDeg(this._modelBaseRot.y))}°, scale=${p(this._modelBaseScale.x)};`);
    }
    if (this._crtModel) {
      lines.push(`crtModel: pos=(${p(this._crtModel.position.x)}, ${p(this._crtModel.position.y)}, ${p(this._crtModel.position.z)}), scale=${p(this._crtModel.scale.x)};`);
    }
    if (this._screenMesh) {
      const sm = this._screenMesh.material;
      const blendNames = { [THREE.NormalBlending]: 'Normal', [THREE.AdditiveBlending]: 'Additive', [THREE.SubtractiveBlending]: 'Subtractive', [THREE.MultiplyBlending]: 'Multiply' };
      lines.push(`screenOverlay: pos=(${p(this._screenMesh.position.x)}, ${p(this._screenMesh.position.y)}, ${p(this._screenMesh.position.z)}), w=${p(this._screenMesh.geometry.parameters.width)}, h=${p(this._screenMesh.geometry.parameters.height)};`);
      lines.push(`  blending=${blendNames[sm.blending] || sm.blending}, opacity=${p(sm.uniforms.uOpacity?.value ?? 1)}, transparent=${sm.transparent}, depthWrite=${sm.depthWrite};`);
    }
    if (this._props) {
      lines.push('// Props:');
      Object.entries(this._props).forEach(([name, { model }]) => {
        lines.push(`  ${name}: pos(${p(model.position.x)}, ${p(model.position.y)}, ${p(model.position.z)}), rot(${p(THREE.MathUtils.radToDeg(model.rotation.x))}, ${p(THREE.MathUtils.radToDeg(model.rotation.y))}, ${p(THREE.MathUtils.radToDeg(model.rotation.z))}), scale=${p(model.scale.x)}`);
      });
    }
    return lines.join('\n');
  }

  // ─── CAMERA ZOOM TRANSITIONS ───
  _zoomToSelected() {
    if (this._introActive) return;
    this._cameraFromPos = this._baseCameraPos.clone();
    this._cameraFromTarget = this._baseCameraTarget.clone();
    this._cameraFromFov = this._camera.fov;
    this._cameraToPos = this._selectedCameraPos.clone();
    this._cameraToTarget = this._selectedCameraTarget.clone();
    this._cameraToFov = this._selectedFov;
    this._cameraLerp = 0;
    this._cameraTransitioning = true;
  }

  _zoomToBrowse() {
    if (this._introActive) return;
    this._cameraFromPos = this._baseCameraPos.clone();
    this._cameraFromTarget = this._baseCameraTarget.clone();
    this._cameraFromFov = this._camera.fov;
    this._cameraToPos = this._browseCameraPos.clone();
    this._cameraToTarget = this._browseCameraTarget.clone();
    this._cameraToFov = this._browseFov;
    this._cameraLerp = 0;
    this._cameraTransitioning = true;
  }

  // ─── PUBLIC API ───
  setSelectedNFT(nft) {
    this._selectedNFT = nft;
    if (this._monitorMat) {
      if (nft) {
        this._monitorMat.uniforms.uHasNFT.value = 1;
        const rarColors = {
          common: '#888888', uncommon: '#4aa3ff', rare: '#a855f7',
          epic: '#F7931A', legendary: '#ff4488', mythic: '#ff6b2b',
          Genesis: '#ff6b2b'
        };
        this._monitorMat.uniforms.uNFTColor.value.set(rarColors[nft.rarity] || '#0f0');
      } else {
        this._monitorMat.uniforms.uHasNFT.value = 0;
        this._monitorMat.uniforms.uHasTexture.value = 0;
      }
    }
    if (this._crtLight) {
      this._crtLight.color.set(nft ? (nft.col === 'OPIUM' ? '#ff6b2b' : '#00ff44') : '#00ff44');
      this._crtLight.intensity = nft ? 4.6 : 4.6;
    }
    // Trigger camera zoom
    if (nft) {
      this._zoomToSelected();
    } else {
      this._zoomToBrowse();
    }
  }

  // Load a real NFT image from URL onto the CRT screen
  loadNFTImage(url) {
    if (!this._monitorMat || !url) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;

      this._monitorMat.uniforms.uNFTTexture.value = tex;
      this._monitorMat.uniforms.uHasTexture.value = 1;

      // Dispose old texture
      if (this._monitorNFTTexture) this._monitorNFTTexture.dispose();
      this._monitorNFTTexture = tex;
    };
    img.onerror = () => {
      console.warn('Failed to load NFT image:', url);
      // Keep the color-only CRT display
    };
    img.src = url;
  }

  // ─── ANIMATION LOOP ───
  _animate() {
    requestAnimationFrame(() => this._animate());

    // Skip rendering when tab is hidden (saves GPU cycles + battery)
    if (this._tabHidden) return;

    const now = performance.now();
    if (now - this._lastFrameAt < this._targetFrameMs) return;
    this._lastFrameAt = now;

    const dt = Math.min(this._clock.getDelta(), 0.05);
    const t = this._clock.elapsedTime;

    // Update animation mixer (for GLB animations)
    if (this._mixer) this._mixer.update(dt);

    // Smooth mouse
    this._mouse.x += (this._targetMouse.x - this._mouse.x) * 0.05;
    this._mouse.y += (this._targetMouse.y - this._mouse.y) * 0.05;

    // Cinematic intro zoom
    this._updateIntro(t);

    // Camera zoom transition (smooth lerp between browse/selected states)
    if (this._cameraTransitioning && this._camera) {
      this._cameraLerp = Math.min(this._cameraLerp + dt * 1.8, 1); // ~0.55s
      // easeOutCubic for a satisfying settle
      const p = 1 - Math.pow(1 - this._cameraLerp, 3);
      this._baseCameraPos.lerpVectors(this._cameraFromPos, this._cameraToPos, p);
      this._baseCameraTarget.lerpVectors(this._cameraFromTarget, this._cameraToTarget, p);
      this._camera.fov = this._cameraFromFov + (this._cameraToFov - this._cameraFromFov) * p;
      this._camera.updateProjectionMatrix();
      if (this._cameraLerp >= 1) this._cameraTransitioning = false;
    }

    // Camera subtle sway (only after intro finishes — intro controls camera fully)
    if (this._camera && !this._introActive) {
      this._camera.position.x = this._baseCameraPos.x + this._mouse.x * 0.15;
      this._camera.position.y = this._baseCameraPos.y + this._mouse.y * 0.08;
      this._camera.position.z = this._baseCameraPos.z;
      this._camera.lookAt(this._baseCameraTarget);
    }

    // Model idle animation
    if (this._model) {
      // Gentle breathing bob
      this._model.position.y = this._modelBasePos.y + Math.sin(t * 1.2) * 0.015;
      // Slight turn following mouse
      this._model.rotation.y = this._modelBaseRot.y + this._mouse.x * 0.08;
      // Subtle head tilt
      this._model.rotation.z = Math.sin(t * 0.7) * 0.01;

      // Click reaction
      if (this._clicked && t - this._clickTime < 0.5) {
        const bounce = Math.sin((t - this._clickTime) * Math.PI * 4) * 0.02;
        this._model.position.y += bounce;
        this._model.scale.setScalar(this._modelBaseScale.x * (1 + Math.sin((t - this._clickTime) * Math.PI * 2) * 0.02));
      } else if (this._clicked && t - this._clickTime >= 0.5) {
        this._clicked = false;
        this._model.scale.copy(this._modelBaseScale);
      }
    }

    // Monitor shader time + power-on animation
    if (this._monitorMat) {
      this._monitorMat.uniforms.uTime.value = t;

      if (this._screenPoweringOn) {
        this._screenOnProgress = Math.min(this._screenOnProgress + dt * 1.8, 1); // ~0.55s
        // easeOutCubic for a satisfying settle
        const p = 1 - Math.pow(1 - this._screenOnProgress, 3);
        this._monitorMat.uniforms.uScreenOn.value = p;
        if (this._screenOnProgress >= 1) {
          this._screenPoweringOn = false;
          this._screenPoweredOn = true;
          this._monitorMat.uniforms.uScreenOn.value = 1;
        }
      }
    }

    // Power LED blink
    if (this._powerLED) {
      this._powerLED.material.color.setHSL(0.33, 1, 0.3 + Math.sin(t * 2) * 0.15);
    }

    // Lantern flicker
    if (this._lanternL) {
      const lBase = this._lanternBaseIntensity || 5.7;
      this._lanternL.intensity = lBase + Math.sin(t * 3.1) * 0.3 + Math.sin(t * 7.3) * 0.15;
      this._lanternR.intensity = lBase + Math.sin(t * 2.7 + 1) * 0.3 + Math.sin(t * 6.1 + 2) * 0.15;
    }

    // Dust particles
    if (this._dustParticles) {
      const pos = this._dustParticles.geometry.attributes.position;
      const speeds = this._dustParticles.userData.speeds;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + speeds[i];
        let x = pos.getX(i) + Math.sin(t + i) * 0.001;
        if (y > 6) {
          y = 0.5;
          x = (Math.random() - 0.5) * 8;
        }
        pos.setY(i, y);
        pos.setX(i, x);
      }
      pos.needsUpdate = true;
    }

    // Update bubble position to track character head
    this._updateBubblePos();

    // Update CRT buy panel to track monitor screen
    this._updateCRTPanel();

    // Live clock
    this._updateClockHands();

    // Render
    this._renderer.render(this._scene, this._camera);
  }

  _updateBubblePos() {
    if (!this._bubbleEl) this._bubbleEl = document.getElementById('char-bubble');
    if (!this._bubbleEl || !this._model) return;

    const pos = this.getBubbleScreenPos();
    if (!pos) return;

    // Clamp top so bubble (which renders above this point via transform) stays in view
    const bubbleH = this._bubbleEl.offsetHeight || 60;
    const minTop = bubbleH + 12; // 12px breathing room from top edge
    const clampedY = Math.max(pos.y, minTop);

    this._bubbleEl.style.left = pos.x + 'px';
    this._bubbleEl.style.top = clampedY + 'px';
  }

  // ─── CRT SCREEN → PIXEL RECT ───
  // Returns { x, y, width, height } of the CRT screen in pixel coords relative to canvas
  getCRTScreenRect() {
    if (!this._screenMesh || !this._camera) return null;

    const rect = this._canvas.getBoundingClientRect();
    const _v = new THREE.Vector3();

    // Get world position of screen center
    this._screenMesh.getWorldPosition(_v);
    const centerWorld = _v.clone();

    // Project center
    _v.project(this._camera);
    const cx = (_v.x * 0.5 + 0.5) * rect.width;
    const cy = (-_v.y * 0.5 + 0.5) * rect.height;

    // Get screen dimensions in world space (account for parent scale)
    const geo = this._screenMesh.geometry.parameters;
    const parentScale = this._crtModel ? this._crtModel.scale.x : 1;
    const halfW = (geo.width * parentScale) / 2;
    const halfH = (geo.height * parentScale) / 2;

    // Project top-left and bottom-right corners
    const tl = new THREE.Vector3(centerWorld.x - halfW, centerWorld.y + halfH, centerWorld.z);
    tl.project(this._camera);
    const tlx = (tl.x * 0.5 + 0.5) * rect.width;
    const tly = (-tl.y * 0.5 + 0.5) * rect.height;

    const br = new THREE.Vector3(centerWorld.x + halfW, centerWorld.y - halfH, centerWorld.z);
    br.project(this._camera);
    const brx = (br.x * 0.5 + 0.5) * rect.width;
    const bry = (-br.y * 0.5 + 0.5) * rect.height;

    return { x: tlx, y: tly, width: brx - tlx, height: bry - tly, cx, cy };
  }

  _updateCRTPanel() {
    if (!this._crtPanel) this._crtPanel = document.getElementById('crt-buy-panel');
    if (!this._crtPanel) return;

    const r = this.getCRTScreenRect();
    if (!r) return;

    this._crtPanel.style.left = r.x + 'px';
    this._crtPanel.style.top = r.y + 'px';
    this._crtPanel.style.width = r.width + 'px';
    this._crtPanel.style.height = r.height + 'px';
  }
}

// ─── INIT ───
window._sceneManager = new SceneManager('scene-canvas');
