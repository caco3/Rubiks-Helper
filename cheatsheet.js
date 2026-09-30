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
// Unfolded layer view: 2x2 face in the middle, the side stickers of each
// corner unfolded around it – like looking at the layer flattened out:
//              [B][B]      <- stickers facing back
//        [L] [ c  c ] [R]  <- row of corners (back row)
//        [L] [ c  c ] [R]  <- front row
//              [F][F]      <- stickers facing front
function drawLayer(canvas, cubies, layer, cfg) {
  const isU = layer === 'U';
  const fy = isU ? 1 : -1;
  const s = 56, gap = 4, pad = 10, top = 22;
  canvas.width = 4 * s + 3 * gap + 2 * pad;
  canvas.height = 4 * s + 3 * gap + 2 * pad + top;
  const ctx = canvas.getContext('2d');
  const gridA = cfg.A.map(v => v * 2 - 1).join(',');
  const gridB = cfg.B.map(v => v * 2 - 1).join(',');

  ctx.fillStyle = '#222';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isU ? 'Obere Ebene' : 'Untere Ebene',
               canvas.width / 2, 14);

  const sq = (col, row, color) => {
    const px = pad + col * (s + gap), py = pad + top + row * (s + gap);
    ctx.fillStyle = HEX[color] || '#555';
    ctx.fillRect(px, py, s, s);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, s, s);
    return [px + s / 2, py + s / 2];
  };

  // trapezoid side sticker: right angles on the inner edge (touching the
  // 2x2 face), outer edge slanted – like a flap folded away from the cube
  const t = 0.35;                      // taper fraction
  const trap = (col, row, dir, slant, color) => {
    const x0 = pad + col * (s + gap), y0 = pad + top + row * (s + gap);
    const d = s * t;                   // taper offset
    ctx.beginPath();
    let cx, cy;
    if (dir === 'R') {                 // inner edge = left side (x0)
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + s, y0 + (slant < 0 ? d : 0));
      ctx.lineTo(x0 + s, y0 + s - (slant > 0 ? d : 0));
      ctx.lineTo(x0, y0 + s);
      cx = x0 + s * 0.55; cy = y0 + s / 2;
    } else if (dir === 'L') {          // inner edge = right side (x0+s)
      ctx.moveTo(x0 + s, y0);
      ctx.lineTo(x0, y0 + (slant < 0 ? d : 0));
      ctx.lineTo(x0, y0 + s - (slant > 0 ? d : 0));
      ctx.lineTo(x0 + s, y0 + s);
      cx = x0 + s * 0.45; cy = y0 + s / 2;
    } else if (dir === 'D') {          // inner edge = top side (y0)
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + s, y0);
      ctx.lineTo(x0 + s - (slant > 0 ? d : 0), y0 + s);
      ctx.lineTo(x0 + (slant < 0 ? d : 0), y0 + s);
      cx = x0 + s / 2; cy = y0 + s * 0.55;
    } else {                           // 'U': inner edge = bottom side (y0+s)
      ctx.moveTo(x0, y0 + s);
      ctx.lineTo(x0 + s, y0 + s);
      ctx.lineTo(x0 + s - (slant > 0 ? d : 0), y0);
      ctx.lineTo(x0 + (slant < 0 ? d : 0), y0);
      cx = x0 + s / 2; cy = y0 + s * 0.45;
    }
    ctx.closePath();
    ctx.fillStyle = HEX[color] || '#555';
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.stroke();
    return [cx, cy];
  };

  const label = (cx, cy, letter, size = 26) => {
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.font = `bold ${size}px sans-serif`;
    ctx.strokeText(letter, cx, cy + size * 0.3);
    ctx.fillText(letter, cx, cy + size * 0.3);
  };

  for (const c of cubies) {
    if (c.pos[1] !== fy) continue;
    const x = c.pos[0], z = c.pos[2];
    const col = (x + 1) / 2;         // 0 left, 1 right
    const row = (z + 1) / 2;         // 0 back (top), 1 front (bottom)
    // center cell (sticker facing the layer)
    const [ccx, ccy] = sq(1 + col, 1 + row, c.st[`0,${fy},0`]);
    // side stickers unfolded as trapezoids
    const [hx, hy] = trap(x > 0 ? 3 : 0, 1 + row, x > 0 ? 'R' : 'L',
                          row === 0 ? -1 : 1,
                          c.st[`${x > 0 ? 1 : -1},0,0`]);
    const [vx, vy] = trap(1 + col, z > 0 ? 3 : 0, z > 0 ? 'D' : 'U',
                          col === 0 ? -1 : 1,
                          c.st[`0,0,${z > 0 ? 1 : -1}`]);
    // mark A/B on all three stickers of the corner
    if (c.id === gridA || c.id === gridB) {
      const l = c.id === gridA ? 'A' : 'B';
      label(ccx, ccy, l);
      label(hx, hy, l, 16);
      label(vx, vy, l, 16);
    }
  }
}

// Draw the unfolded cube net: all 6 faces with letter + clockwise arrow
function drawNet(canvas) {
  const s = 64, pad = 8;
  // net layout:      [U=O]
  //            [L][F=V][R][B=H]
  //                  [D=U]
  const cells = {
    U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2]
  };
  canvas.width = 4 * s + 2 * pad;
  canvas.height = 3 * s + 2 * pad;
  const ctx = canvas.getContext('2d');
  for (const [face, [cx, cy]] of Object.entries(cells)) {
    const px = pad + cx * s, py = pad + cy * s;
    ctx.fillStyle = HEX[face];
    ctx.fillRect(px, py, s - 2, s - 2);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, s - 2, s - 2);
    // letter
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(DISPLAY[face], px + s / 2 - 1, py + s / 2 - 1);
    ctx.fillText(DISPLAY[face], px + s / 2 - 1, py + s / 2 - 1);
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

drawNet(document.getElementById('netCanvas'));
build();
