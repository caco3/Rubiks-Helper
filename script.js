// ==================== GLOBALS ====================
const FACE_NAMES = {
  R: 'Rechte Seite', L: 'Linke Seite', U: 'Obere Seite',
  D: 'Untere Seite', F: 'Vorderseite', B: 'Rueckseite'
};
// Swap modes: algo (optimal solver), grid coords of the A and B cubies
// Display mapping: internal Singmaster -> German letters
const DISPLAY = { R: 'R', L: 'L', U: 'O', D: 'U', F: 'V', B: 'H' };
function dispMove(m) { return DISPLAY[m[0]] + m.slice(1); }
function dispAlgo(seq) { return seq.split(' ').map(dispMove).join(' '); }

const MODES = {
  adjacent: { name: 'Oben: Nebeneinander', algo: "R2 D L2 D2 B2 D R2",
              A: [1, 1, 1], B: [0, 1, 1] },   // UFR, UFL
  diagonal: { name: 'Oben: Diagonal', algo: "R2 F2 R2",
              A: [0, 1, 1], B: [1, 1, 0] },   // UFL, UBR
  adjacent_bottom_cycle: { name: 'Unten: 3 Ecken falsch (8 Zuege)',
              algo: "R D' L' D R' D' L D",
              A: [1, 0, 1], B: [0, 0, 1] },   // DFR, DLF
  adjacent_bottom: { name: 'Unten: 4 Ecken falsch – nebeneinander (11 Zuege)',
              algo: "B2 D' R D' R' D2 B D' R' B2 R",
              A: [1, 0, 1], B: [0, 0, 1] },   // DFR, DLF
  twist: { name: 'Oben: 2 Ecken verdreht (10 Zuege)',
              algo: "B U B2 L2 U' B' U L' U L'",
              A: [1, 1, 1], B: [0, 1, 1] },   // URF, UFL - twisted in place
};
let mode = 'adjacent';
let MOVES = MODES[mode].algo.split(' ');

function describeMove(m) {
  const dir = m.endsWith('2') ? '180°'
            : m.endsWith("'") ? '90° gegen Uhrzeigersinn'
            : '90° im Uhrzeigersinn';
  return `${dispMove(m)} – ${FACE_NAMES[m[0]]} ${dir}`;
}

function invertAlg(seq) {
  return seq.split(' ').reverse().map(m =>
    m.endsWith('2') ? m : m.endsWith("'") ? m[0] : m + "'"
  ).join(' ');
}

let scene, camera, renderer, cubeGroup, raycaster;
let cubies = []; // 8 cubies
let animating = false;
let currentStep = -1;
let speedMs = 600; // animation duration
let speedLabel = 'Normal';
let isDragging = false;
let prevMouse = { x: 0, y: 0 };
let rotX = -25, rotY = 35; // initial view angles

// Face colors
const COLORS = {
  U: 0xffffff, // white
  D: 0xffd500, // yellow
  F: 0xff0000, // red
  B: 0xff8800, // orange
  R: 0x00cc00, // green
  L: 0x0066ff, // blue
  inner: 0x111111
};

// ==================== INIT ====================
function init() {
  const container = document.getElementById('canvas-container');
  const w = container.clientWidth;
  const h = container.clientHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
  camera.position.set(0, 0, 8);

  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('cubeCanvas'), antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);
  const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
  dirLight2.position.set(-5, -5, -5);
  scene.add(dirLight2);

  cubeGroup = new THREE.Group();
  scene.add(cubeGroup);

  document.getElementById('algoName').textContent =
    `${MODES[mode].name} (${MOVES.length} Zuege)`;
  document.getElementById('algoText').textContent = dispAlgo(MODES[mode].algo);
  buildCube();
  updateAlgoDisplay();
  render();

  // Mouse interaction for orbit
  container.addEventListener('mousedown', onMouseDown);
  container.addEventListener('mousemove', onMouseMove);
  container.addEventListener('mouseup', onMouseUp);
  container.addEventListener('mouseleave', onMouseUp);
  container.addEventListener('touchstart', onTouchStart, { passive: false });
  container.addEventListener('touchmove', onTouchMove, { passive: false });
  container.addEventListener('touchend', onMouseUp);

  window.addEventListener('resize', onResize);
}

function onResize() {
  const container = document.getElementById('canvas-container');
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

// ==================== BUILD CUBE ====================
function buildCube() {
  // Clear
  while (cubeGroup.children.length) cubeGroup.remove(cubeGroup.children[0]);
  cubies = [];
  letterBillboards.length = 0;

  const gap = 0.04;
  const size = 1;

  for (let x = 0; x < 2; x++) {
    for (let y = 0; y < 2; y++) {
      for (let z = 0; z < 2; z++) {
        // Label the two corners that get swapped (per mode)
        const cfg = MODES[mode];
        let label = null;
        if (x === cfg.A[0] && y === cfg.A[1] && z === cfg.A[2]) label = 'A';
        if (x === cfg.B[0] && y === cfg.B[1] && z === cfg.B[2]) label = 'B';

        const cubie = createCubie(x, y, z, size, label);
        const px = (x - 0.5) * (size + gap);
        const py = (y - 0.5) * (size + gap);
        const pz = (z - 0.5) * (size + gap);
        cubie.position.set(px, py, pz);
        cubie.userData = { gx: x, gy: y, gz: z, label }; // grid position
        cubeGroup.add(cubie);
        cubies.push(cubie);
      }
    }
  }

  // Face name labels (R/L/U/D/F/B) – fixed to cubeGroup so they
  // mark the physical faces even when the view is rotated.
  const facePos = {
    R: [2.2, 0, 0], L: [-2.2, 0, 0], U: [0, 2.2, 0],
    D: [0, -2.2, 0], F: [0, 0, 2.2], B: [0, 0, -2.2]
  };
  for (const [face, pos] of Object.entries(facePos)) {
    const mesh = makeFaceLabel(face);
    mesh.position.set(pos[0], pos[1], pos[2]);
    cubeGroup.add(mesh);
  }

  // Scramble: apply the inverse of the algorithm instantly,
  // so A and B start on wrong positions and the algorithm solves it.
  invertAlg(MODES[mode].algo).split(' ').forEach(applyMoveInstant);
}

// Face marker: 3D arrow (torus arc + cone head) on the face plane
// + letter on a thin box that billboards toward the camera
const letterBillboards = [];

function makeFaceLabel(face) {
  const group = new THREE.Group();

  // --- 3D arrow: partial torus + cone head, flat on the face plane ---
  const arrowMat = new THREE.MeshLambertMaterial({ color: 0xff9800 });
  const arrow = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 12, 48, 2.4), arrowMat);
  arrow.add(tube);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.36, 16), arrowMat);
  head.position.set(0.55, 0, 0);          // at arc start (angle 0 = +x)
  head.rotation.z = Math.PI;              // cone apex -> -y = clockwise tangent
  arrow.add(head);
  const rotByFace = { F: [0,0,0], B: [0,Math.PI,0], R: [0,Math.PI/2,0],
                      L: [0,-Math.PI/2,0], U: [-Math.PI/2,0,0], D: [Math.PI/2,0,0] };
  arrow.rotation.set(...rotByFace[face]);
  group.add(arrow);

  // --- letter on a thin box; oriented toward camera in render() ---
  const lcanvas = document.createElement('canvas');
  lcanvas.width = lcanvas.height = 128;
  const lctx = lcanvas.getContext('2d');
  lctx.fillStyle = '#ffffff';
  lctx.strokeStyle = '#000000';
  lctx.lineWidth = 8;
  lctx.font = 'bold 84px Arial';
  lctx.textAlign = 'center';
  lctx.textBaseline = 'middle';
  lctx.strokeText(DISPLAY[face], 64, 68);
  lctx.fillText(DISPLAY[face], 64, 68);
  const letterMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.62),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(lcanvas), transparent: true })
  );
  const normals = { F: [0,0,1], B: [0,0,-1], R: [1,0,0],
                    L: [-1,0,0], U: [0,1,0], D: [0,-1,0] };
  const n = normals[face];
  letterMesh.position.set(n[0] * 0.15, n[1] * 0.15, n[2] * 0.15);
  letterBillboards.push(letterMesh);
  group.add(letterMesh);

  return group;
}

// Create a canvas texture: colored background with a bold letter
function makeStickerMaterial(color, letter) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
  ctx.fillRect(0, 0, 128, 128);
  if (letter) {
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.font = 'bold 90px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(letter, 64, 70);
    ctx.fillText(letter, 64, 70);
  }
  const texture = new THREE.CanvasTexture(canvas);
  return new THREE.MeshLambertMaterial({ map: texture, side: THREE.DoubleSide });
}

function createCubie(gx, gy, gz, size, label) {
  const group = new THREE.Group();

  // Base black cube (slightly smaller)
  const baseGeo = new THREE.BoxGeometry(size * 0.95, size * 0.95, size * 0.95);
  const baseMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  group.add(baseMesh);

  const stickerSize = size * 0.82;
  const stickerOffset = size * 0.481;
  const stickerGeo = new THREE.PlaneGeometry(stickerSize, stickerSize);
  const radius = 0; // could round corners

  const faceMat = (color) => label
    ? makeStickerMaterial(color, label)
    : new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });

  // Right face (x=1)
  if (gx === 1) {
    const sticker = new THREE.Mesh(stickerGeo, faceMat(COLORS.R));
    sticker.position.set(stickerOffset, 0, 0);
    sticker.rotation.y = Math.PI / 2;
    group.add(sticker);
  }
  // Left face (x=0)
  if (gx === 0) {
    const sticker = new THREE.Mesh(stickerGeo, faceMat(COLORS.L));
    sticker.position.set(-stickerOffset, 0, 0);
    sticker.rotation.y = -Math.PI / 2;
    group.add(sticker);
  }
  // Up face (y=1)
  if (gy === 1) {
    const sticker = new THREE.Mesh(stickerGeo, faceMat(COLORS.U));
    sticker.position.set(0, stickerOffset, 0);
    sticker.rotation.x = -Math.PI / 2;
    group.add(sticker);
  }
  // Down face (y=0)
  if (gy === 0) {
    const sticker = new THREE.Mesh(stickerGeo, faceMat(COLORS.D));
    sticker.position.set(0, -stickerOffset, 0);
    sticker.rotation.x = Math.PI / 2;
    group.add(sticker);
  }
  // Front face (z=1)
  if (gz === 1) {
    const sticker = new THREE.Mesh(stickerGeo, faceMat(COLORS.F));
    sticker.position.set(0, 0, stickerOffset);
    group.add(sticker);
  }
  // Back face (z=0)
  if (gz === 0) {
    const sticker = new THREE.Mesh(stickerGeo, faceMat(COLORS.B));
    sticker.position.set(0, 0, -stickerOffset);
    sticker.rotation.y = Math.PI;
    group.add(sticker);
  }

  return group;
}

// ==================== MOUSE ORBIT ====================
function onMouseDown(e) {
  isDragging = true;
  prevMouse = { x: e.clientX, y: e.clientY };
}
function onMouseMove(e) {
  if (!isDragging) return;
  const dx = e.clientX - prevMouse.x;
  const dy = e.clientY - prevMouse.y;
  rotY += dx * 0.5;
  rotX -= dy * 0.5;
  rotX = Math.max(-89, Math.min(89, rotX));
  prevMouse = { x: e.clientX, y: e.clientY };
}
function onMouseUp() { isDragging = false; }
function onTouchStart(e) {
  e.preventDefault();
  if (e.touches.length === 1) {
    isDragging = true;
    prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
}
function onTouchMove(e) {
  e.preventDefault();
  if (!isDragging || e.touches.length !== 1) return;
  const dx = e.touches[0].clientX - prevMouse.x;
  const dy = e.touches[0].clientY - prevMouse.y;
  rotY += dx * 0.5;
  rotX -= dy * 0.5;
  rotX = Math.max(-89, Math.min(89, rotX));
  prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}

// ==================== RENDER ====================
function render() {
  requestAnimationFrame(render);
  // Apply orbit rotation
  const rx = THREE.MathUtils.degToRad(rotX);
  const ry = THREE.MathUtils.degToRad(rotY);
  cubeGroup.rotation.x = rx;
  cubeGroup.rotation.y = ry;
  // Billboard the face letters toward the camera (keeps 3D thickness)
  const invQ = cubeGroup.quaternion.clone().invert();
  letterBillboards.forEach(m => m.quaternion.copy(invQ).multiply(camera.quaternion));
  renderer.render(scene, camera);
}

// ==================== MOVE LOGIC ====================
// Each cubie tracks its logical position in local space.
// We avoid world-space conversions entirely to prevent drift.

function getCubiesForMove(move) {
  const base = move.replace("'", "").replace("2", "");
  const half = 0.52 / 2; // half of (size + gap), threshold
  return cubies.filter(c => {
    // Use the cubie's local position inside cubeGroup directly
    const p = c.position;
    switch (base) {
      case 'R': return p.x > half;
      case 'L': return p.x < -half;
      case 'U': return p.y > half;
      case 'D': return p.y < -half;
      case 'F': return p.z > half;
      case 'B': return p.z < -half;
    }
    return false;
  });
}

function getMoveAxis(move) {
  const base = move.replace("'", "").replace("2", "");
  switch (base) {
    case 'R': return new THREE.Vector3(1, 0, 0);
    case 'L': return new THREE.Vector3(-1, 0, 0);
    case 'U': return new THREE.Vector3(0, 1, 0);
    case 'D': return new THREE.Vector3(0, -1, 0);
    case 'F': return new THREE.Vector3(0, 0, 1);
    case 'B': return new THREE.Vector3(0, 0, -1);
  }
}

function getMoveAngle(move) {
  let angle = -Math.PI / 2; // CW 90°
  if (move.includes("'")) angle = Math.PI / 2; // CCW
  if (move.includes("2")) angle = Math.PI; // 180°
  return angle;
}

// Apply a rotation matrix to position and quaternion of a cubie (in local space)
function applyRotationToCubie(cubie, axis, angle) {
  const rotMatrix = new THREE.Matrix4().makeRotationAxis(axis, angle);
  // Rotate position around origin
  cubie.position.applyMatrix4(rotMatrix);
  // Rotate orientation
  const rotQuat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  cubie.quaternion.premultiply(rotQuat);
  // Snap position to grid to avoid floating point drift
  const snap = 0.52; // size + gap = 1.04, half = 0.52
  cubie.position.x = Math.round(cubie.position.x / snap) * snap;
  cubie.position.y = Math.round(cubie.position.y / snap) * snap;
  cubie.position.z = Math.round(cubie.position.z / snap) * snap;
}

// Apply a move instantly without animation (used for the initial scramble)
function applyMoveInstant(move) {
  const affected = getCubiesForMove(move);
  const axis = getMoveAxis(move);
  const angle = getMoveAngle(move);
  affected.forEach(c => applyRotationToCubie(c, axis, angle));
}

function animateMove(move) {
  return new Promise(resolve => {
    if (animating) { resolve(); return; }
    animating = true;

    const affectedCubies = getCubiesForMove(move);
    const axis = getMoveAxis(move);
    const totalAngle = getMoveAngle(move);

    // Save original positions and quaternions
    const origState = affectedCubies.map(c => ({
      pos: c.position.clone(),
      quat: c.quaternion.clone()
    }));

    const startTime = performance.now();
    const duration = speedMs;

    function step(now) {
      const t = Math.min((now - startTime) / duration, 1);
      // Ease in-out
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const currentAngle = totalAngle * ease;

      const rotQuat = new THREE.Quaternion().setFromAxisAngle(axis, currentAngle);
      const rotMatrix = new THREE.Matrix4().makeRotationAxis(axis, currentAngle);

      affectedCubies.forEach((c, i) => {
        // Interpolate from original state
        c.position.copy(origState[i].pos).applyMatrix4(rotMatrix);
        c.quaternion.copy(origState[i].quat).premultiply(rotQuat);
      });

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        // Snap to final positions
        const finalRotMatrix = new THREE.Matrix4().makeRotationAxis(axis, totalAngle);
        const finalRotQuat = new THREE.Quaternion().setFromAxisAngle(axis, totalAngle);
        const snap = 0.52;
        affectedCubies.forEach((c, i) => {
          c.position.copy(origState[i].pos).applyMatrix4(finalRotMatrix);
          c.quaternion.copy(origState[i].quat).premultiply(finalRotQuat);
          // Snap position
          c.position.x = Math.round(c.position.x / snap) * snap;
          c.position.y = Math.round(c.position.y / snap) * snap;
          c.position.z = Math.round(c.position.z / snap) * snap;
        });

        animating = false;
        resolve();
      }
    }
    requestAnimationFrame(step);
  });
}

// ==================== ALGORITHM CONTROL ====================
function updateAlgoDisplay() {
  const container = document.getElementById('algoDisplay');
  container.innerHTML = MOVES.map((m, i) => {
    let cls = 'pending';
    if (i < currentStep) cls = 'done';
    if (i === currentStep) cls = 'active';
    return `<span class="move ${cls}">${dispMove(m)}</span>`;
  }).join(' ');
}

async function stepNext() {
  if (animating) return;
  currentStep++;
  if (currentStep >= MOVES.length) {
    document.getElementById('statusText').textContent =
      'Algorithmus abgeschlossen! A und B sind jetzt korrekt.';
    document.getElementById('btnPlay').disabled = true;
    document.getElementById('btnStep').disabled = true;
    updateAlgoDisplay();
    return;
  }
  const move = MOVES[currentStep];
  document.getElementById('statusText').textContent =
    `Schritt ${currentStep + 1}/${MOVES.length}: ${describeMove(move)}`;
  updateAlgoDisplay();
  await animateMove(move);
  // If it was the last step
  if (currentStep === MOVES.length - 1) {
    document.getElementById('statusText').textContent =
      'Algorithmus abgeschlossen! A und B sind jetzt korrekt.';
    // Mark last as done
    currentStep = MOVES.length;
    updateAlgoDisplay();
  }
}

async function stepPrev() {
  if (animating) return;
  const idx = Math.min(currentStep, MOVES.length - 1);
  if (idx < 0) return;
  const move = MOVES[idx];
  const inv = move.endsWith('2') ? move
            : move.endsWith("'") ? move[0]
            : move + "'";
  currentStep = idx - 1;
  document.getElementById('statusText').textContent =
    `Rueckgaengig: ${describeMove(inv)}`;
  document.getElementById('btnPlay').disabled = false;
  document.getElementById('btnStep').disabled = false;
  updateAlgoDisplay();
  await animateMove(inv);
}

async function playAll() {
  if (animating) return;
  const startFrom = currentStep + 1;
  for (let i = startFrom; i < MOVES.length; i++) {
    currentStep = i;
    const move = MOVES[i];
    document.getElementById('statusText').textContent =
      `Schritt ${i + 1}/${MOVES.length}: ${describeMove(move)}`;
    updateAlgoDisplay();
    await animateMove(move);
    // Small pause between moves
    await new Promise(r => setTimeout(r, 150));
  }
  document.getElementById('statusText').textContent =
    'Algorithmus abgeschlossen! A und B sind jetzt korrekt.';
  currentStep = MOVES.length;
  updateAlgoDisplay();
}

function setMode(m) {
  mode = m;
  MOVES = MODES[mode].algo.split(' ');
  resetCube();
}

function resetCube() {
  if (animating) return;
  currentStep = -1;
  document.getElementById('algoName').textContent =
    `${MODES[mode].name} (${MOVES.length} Zuege)`;
  document.getElementById('algoText').textContent = dispAlgo(MODES[mode].algo);
  buildCube();
  updateAlgoDisplay();
  document.getElementById('statusText').textContent =
    'Verdreht! A und B sind auf falschen Positionen – loese den Cube.';
  document.getElementById('btnPlay').disabled = false;
  document.getElementById('btnStep').disabled = false;
}

function toggleSpeed() {
  const btn = document.getElementById('btnSpeed');
  if (speedLabel === 'Normal') {
    speedMs = 300;
    speedLabel = 'Schnell';
  } else if (speedLabel === 'Schnell') {
    speedMs = 150;
    speedLabel = 'Sehr schnell';
  } else if (speedLabel === 'Sehr schnell') {
    speedMs = 1000;
    speedLabel = 'Langsam';
  } else {
    speedMs = 600;
    speedLabel = 'Normal';
  }
  btn.textContent = `Tempo: ${speedLabel}`;
}

// ==================== KEYBOARD ====================
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') stepNext();
  else if (e.key === 'ArrowLeft') stepPrev();
});

// ==================== START ====================
init();
