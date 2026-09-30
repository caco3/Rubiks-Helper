# Rubiks-Helper

Interaktiver 3D-Visualizer zum Lösen eines **2x2 Rubik's Cube** – zeigt Schritt für Schritt, wie man Ecken tauscht und ausrichtet.

## Live-Demo

**https://caco3.github.io/Rubiks-Helper/**

## Features

- **3D-Würfel** (Three.js) mit frei drehbarer Ansicht
- **Markierte Ecken A/B** – verfolgen, wie die Steine wandern
- **Flächen-Marker** (O/U/V/H/R/L) mit 3D-Richtungspfeilen – die Notation bleibt auch beim Drehen der Ansicht eindeutig
- **Schritt-für-Schritt-Animation** mit Highlight des aktuellen Zugs
- **Steuerung:** Abspielen, Einzelschritt, Rückwärts (Pfeiltasten ←/→), Reset, Tempo-Slider
- **Verdrehter Startzustand** – der Algorithmus löst den angezeigten Fall

## Zugfolgen (Auswahl)

| Fall | Beispiel |
|---|---|
| Nebeneinander tauschen | `R2 D L2 D2 B2 D R2` |
| Diagonal tauschen | `R2 F2 R2` |
| 3 Ecken falsch positioniert | `R U' L' U R' U' L U` |
| 2 Ecken verdreht | `B U B2 L2 U' B' U L' U L'` |
| 3 Ecken verdreht (Sune) | `R U R' U R U2 R'` |
| Zweite Ebene, erste bleibt gelöst | `R D' L' D R' D' L D` u.a. |

## Notation

Ein Zug ist "im Uhrzeigersinn" aus der Sicht, wenn man die jeweilige Fläche **von außen direkt anschaut**. `X'` = gegen Uhrzeigersinn, `X2` = 180°. Buchstaben: **O**ben, **U**nten, **V**orne, **H**inten, **R**echts, **L**inks.

## Lokal starten

Kein Build nötig – einfach `index.html` im Browser öffnen, oder:

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

## Deployment

GitHub Pages via `.github/workflows/deploy-pages.yml` – deployt automatisch bei Push auf `main`.
