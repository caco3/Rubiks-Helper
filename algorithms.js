// ==================== ALGORITHMS & UI ====================
const FACE_NAMES = {
  R: 'Rechte Seite', L: 'Linke Seite', U: 'Obere Seite',
  D: 'Untere Seite', F: 'Vorderseite', B: 'Rückseite'
};
// Swap modes: algo (optimal solver), grid coords of the A and B cubies
// Display mapping: internal Singmaster -> German letters
const DISPLAY = { R: 'R', L: 'L', U: 'O', D: 'U', F: 'V', B: 'H' };
function dispMove(m) { return DISPLAY[m[0]] + m.slice(1); }
function dispAlgo(seq) { return seq.split(' ').map(dispMove).join(' '); }

const MODES = {
  insert: { name: 'Erste Ebene: Ecke einsetzen (4 Züge)',
              algo: "R' D' R D",
              A: [1, 1, 1], B: [1, 0, 1] },   // URF slot + DFR slot
  adjacent: { name: 'Erste Ebene: Nebeneinander', algo: "R2 D L2 D2 B2 D R2",
              A: [1, 1, 1], B: [0, 1, 1] },   // UFR, UFL
  diagonal: { name: 'Erste Ebene: Diagonal', algo: "R2 F2 R2",
              A: [0, 1, 1], B: [1, 1, 0] },   // UFL, UBR
  top_cycle: { name: 'Erste Ebene: 3 Ecken falsch positioniert (8 Züge)',
              algo: "R U' L' U R' U' L U",
              A: [1, 1, 1], B: [1, 1, 0] },   // URF, UBR
  twist: { name: 'Erste Ebene: 2 Ecken verdreht (10 Züge)',
              algo: "B U B2 L2 U' B' U L' U L'",
              A: [1, 1, 1], B: [0, 1, 1] },   // URF, UFL - twisted in place
  twist3: { name: 'Erste Ebene: 3 Ecken verdreht – Sune (7 Züge)',
              algo: "R U R' U R U2 R'",
              A: [1, 1, 1], B: [0, 1, 1] },   // URF, UFL (+ ULB unmarked)
  twist3a: { name: 'Erste Ebene: 3 Ecken verdreht – Anti-Sune (7 Züge)',
              algo: "R U2 R' U' R U' R'",
              A: [1, 1, 1], B: [0, 1, 1] },   // URF, UFL (+ 3rd unmarked)
  twist4: { name: 'Erste Ebene: 4 Ecken verdreht (22 Züge)',
              algo: "B U B2 L2 U' B' U L' U L' U2 B U B2 L2 U' B' U L' U L' U2",
              A: [1, 1, 1], B: [1, 1, 0] },   // URF, UBR
  adjacent_bottom_cycle: { name: 'Zweite Ebene: 3 Ecken falsch positioniert (8 Züge)',
              algo: "R D' L' D R' D' L D",
              A: [1, 0, 1], B: [0, 0, 1] },   // DFR, DLF
  adjacent_bottom: { name: 'Zweite Ebene: 4 Ecken falsch – nebeneinander (11 Züge)',
              algo: "B2 D' R D' R' D2 B D' R' B2 R",
              A: [1, 0, 1], B: [0, 0, 1] },   // DFR, DLF
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
let animating = false;
let currentStep = -1;
let speedMs = 600; // animation duration (set by Tempo slider)
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
    `Rückgängig: ${describeMove(inv)}`;
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
    `${MODES[mode].name} (${MOVES.length} Züge)`;
  buildCube();
  updateAlgoDisplay();
  document.getElementById('statusText').textContent = '';
  document.getElementById('btnPlay').disabled = false;
  document.getElementById('btnStep').disabled = false;
}

// ==================== KEYBOARD ====================
window.addEventListener('keydown', e => {
  if (e.target.matches('select, input, button')) return;
  if (e.key === 'ArrowRight') stepNext();
  else if (e.key === 'ArrowLeft') stepPrev();
});

// ==================== START ====================
if (document.getElementById('cubeCanvas')) init();
