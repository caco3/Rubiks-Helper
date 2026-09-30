// ==================== CHEAT SHEET ====================
// 2D sticker simulator + card renderer.
// Reuses MODES, describeMove, dispAlgo, invertAlg from algorithms.js.

const HEX = { U: '#ffffff', D: '#ffff00', F: '#00cc00', B: '#0066ff',
              R: '#cc0000', L: '#ff9100' };

// Solved cube as list of cubies: pos in {-1,1}^3, st maps dir-vector-string -> face key
function solvedCubies() {
  const res = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    const st = {};
    if (x === 1) st['1,0,0'] = 'R'; else st['-1,0,0'] = 'L';
    if (y === 1) st['0,1,0'] = 'U'; else st['0,-1,0'] = 'D';
    if (z === 1) st['0,0,1'] = 'F'; else st['0,0,-1'] = 'B';
    res.push({ pos: [x, y, z], st, id: `${x},${y},${z}` });
  }
  return res;
}

// Rotate vector by sign*90° around +axis (right-hand rule)
function rotVec(v, axis, sgn) {
  const [x, y, z] = v;
  if (axis === 'x') return sgn > 0 ? [x, -z, y] : [x, z, -y];
  if (axis === 'y') return sgn > 0 ? [z, y, -x] : [-z, y, x];
  return sgn > 0 ? [-y, x, z] : [y, -x, z];
}

const LAYERS = { R: ['x', 1], L: ['x', -1], U: ['y', 1], D: ['y', -1],
                 F: ['z', 1], B: ['z', -1] };

function applyMove(cubies, m) {
  const [axis, lsign] = LAYERS[m[0]];
  const ai = 'xyz'.indexOf(axis);
  const times = m.endsWith('2') ? 2 : 1;
  // CW viewed from outside the face: dir -1; layer sign flips the axis
  const dir = (m.endsWith("'") ? 1 : -1) * lsign;
  for (let t = 0; t < times; t++) {
    for (const c of cubies) {
      if (c.pos[ai] !== lsign) continue;
      c.pos = rotVec(c.pos, axis, dir);
      const nst = {};
      for (const [ds, col] of Object.entries(c.st)) {
        nst[rotVec(ds.split(',').map(Number), axis, dir).join(',')] = col;
      }
      c.st = nst;
    }
  }
}

function applySeq(cubies, seq) {
  seq.trim().split(/\s+/).filter(Boolean).forEach(m => applyMove(cubies, m));
}

// ---- Drawing ----
// Draw one layer as 2x2 cells; each cell: big square = face sticker,
// two small squares = the two side stickers, plus A/B letter.
function drawLayer(canvas, cubies, layer, cfg) {
  const isU = layer === 'U';
  const fy = isU ? 1 : -1;
  const size = 90, pad = 10, gap = 8;
  canvas.width = 2 * size + gap + 2 * pad;
  canvas.height = 2 * size + gap + 2 * pad + 18;
  const ctx = canvas.getContext('2d');
  const gridA = cfg.A.map(v => v * 2 - 1).join(',');
  const gridB = cfg.B.map(v => v * 2 - 1).join(',');

  ctx.fillStyle = '#222';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isU ? 'Obere Ebene (Draufsicht)' : 'Untere Ebene (von unten)',
               canvas.width / 2, 14);

  for (const c of cubies) {
    if (c.pos[1] !== fy) continue;
    const x = c.pos[0], z = c.pos[2];
    // U: front (z=+1) at bottom; D: viewed from below -> mirror x
    const col = isU ? (x + 1) / 2 : (1 - x) / 2;
    const row = isU ? (1 - z) / 2 : (1 - z) / 2;
    const px = pad + col * (size + gap);
    const py = pad + 18 + row * (size + gap);

    // main face sticker
    const faceKey = `0,${fy},0`;
    ctx.fillStyle = HEX[c.st[faceKey]] || '#555';
    ctx.fillRect(px, py, size, size);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, size, size);

    // side stickers: x-dir and z-dir facing colors
    const sx = c.st[`${x > 0 ? 1 : -1},0,0`];
    const sz = c.st[`0,0,${z > 0 ? 1 : -1}`];
    ctx.fillStyle = HEX[sx] || '#555';
    ctx.fillRect(px + 4, py + size - 24, 20, 20);
    ctx.strokeRect(px + 4, py + size - 24, 20, 20);
    ctx.fillStyle = HEX[sz] || '#555';
    ctx.fillRect(px + size - 24, py + size - 24, 20, 20);
    ctx.strokeRect(px + size - 24, py + size - 24, 20, 20);

    // A/B label if this cubie is a marked one
    const id = c.id;
    if (id === gridA || id === gridB) {
      ctx.fillStyle = '#000';
      ctx.font = 'bold 34px sans-serif';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 5;
      const letter = id === gridA ? 'A' : 'B';
      ctx.strokeText(letter, px + size / 2, py + size / 2 + 6);
      ctx.fillText(letter, px + size / 2, py + size / 2 + 6);
    }
  }
}

// ---- Page build ----
const ORDER = ['insert', 'adjacent', 'diagonal', 'top_cycle', 'twist',
               'twist3', 'twist3a', 'twist4',
               'adjacent_bottom_cycle', 'adjacent_bottom'];

function build() {
  const root = document.getElementById('cards');
  for (const key of ORDER) {
    const cfg = MODES[key];
    const layer = key.includes('bottom') ? 'D' : 'U';
    const before = solvedCubies();
    applySeq(before, invertAlg(cfg.algo));

    const card = document.createElement('div');
    card.className = 'card';
    const h = document.createElement('h2');
    h.textContent = cfg.name;
    card.appendChild(h);

    const seq = document.createElement('p');
    seq.className = 'seq';
    seq.textContent = dispAlgo(cfg.algo);
    card.appendChild(seq);

    const imgs = document.createElement('div');
    imgs.className = 'imgs';
    const mkFig = (label, cubies) => {
      const f = document.createElement('figure');
      const cv = document.createElement('canvas');
      drawLayer(cv, cubies, layer, cfg);
      const cap = document.createElement('figcaption');
      cap.textContent = label;
      f.appendChild(cv); f.appendChild(cap);
      return f;
    };
    imgs.appendChild(mkFig('Vorher', before));
    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '→';
    imgs.appendChild(arrow);
    imgs.appendChild(mkFig('Nachher', solvedCubies()));
    card.appendChild(imgs);

    const ol = document.createElement('ol');
    cfg.algo.split(' ').forEach(m => {
      const li = document.createElement('li');
      li.textContent = describeMove(m);
      ol.appendChild(li);
    });
    card.appendChild(ol);
    root.appendChild(card);
  }
}

build();
