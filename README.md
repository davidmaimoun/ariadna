# 🧬 BioViewer

Viewer génomique haute performance — React + Tailwind + Flask (optionnel).

## Structure du projet

```
bioviewer/
├── frontend/          ← App React (Vite + Tailwind)
│   ├── src/
│   │   ├── components/
│   │   │   ├── SequenceCanvas.jsx     ← Renderer Canvas 2D principal
│   │   │   ├── SequenceTextPanel.jsx  ← Séquence complète numérotée
│   │   │   ├── MSAViewer.jsx          ← Multiple Sequence Alignment viewer
│   │   │   ├── TopBar.jsx
│   │   │   ├── SidePanel.jsx
│   │   │   ├── MiniMap.jsx
│   │   │   ├── DropZone.jsx
│   │   │   └── Notification.jsx
│   │   ├── workers/
│   │   │   └── sequenceParser.worker.js  ← Parsing off-thread (Web Worker)
│   │   ├── store/useStore.js             ← Zustand global state
│   │   ├── utils/bioUtils.js             ← GFF3/BED/GTF, translate, ORF, export
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
│
├── backend/           ← Flask API (optionnel)
│   ├── app.py         ← /api/parse, /api/analyze, /api/export, /api/blast
│   └── requirements.txt
│
├── install.sh         ← Installation (Linux/Mac)
├── start.sh           ← Démarrage (Linux/Mac)
├── install.bat        ← Installation (Windows)
└── start.bat          ← Démarrage (Windows)
```

## Installation & démarrage

### Linux / Mac

```bash
chmod +x install.sh start.sh
./install.sh    # installe npm deps + Flask venv (une seule fois)
./start.sh      # lance frontend + backend, ouvre le navigateur
```

### Windows

```
Double-cliquer install.bat   (une seule fois)
Double-cliquer start.bat
```

### Manuel

```bash
# Frontend uniquement (suffisant pour utiliser l'app)
cd frontend
npm install
npm run dev
# → http://localhost:5173

# Backend Flask (optionnel — BLAST local, fichiers serveur)
cd backend
pip install -r requirements.txt
python app.py
# → http://localhost:5000
```

## Formats supportés

| Format | Séquence | Annotations |
|--------|----------|-------------|
| FASTA / FASTQ | ✅ | — |
| GenBank (.gb, .gbk) | ✅ | ✅ (CDS, gene, exon…) |
| GFF3 | — | ✅ |
| BED | — | ✅ |
| GTF | — | ✅ |
| FASTA multiple aligné (.afa, .aln) | **MSA Viewer** | — |

## Fonctionnalités

- **Streaming parser** (Web Worker, 64KB/chunk) — fichiers plusieurs GB sans bloquer l'UI
- **Canvas 2D virtualisé** — 3 niveaux de zoom : overview density / region / nucléotide
- **Nucléotides colorés** A🟢 T🟠 G🔵 C🟡 avec fond coloré
- **Brin complémentaire** et **traduction 3 cadres**
- **Track GC %** temps réel
- **Tracks d'annotations** multi-types avec brins et labels
- **Sélection drag** → copy / FASTA / cut
- **Édition inline** replace / insert / delete + undo/redo illimité
- **Recherche de motif** avec navigation prev/next
- **ORF finder** 6 cadres côté client
- **Séquence complète** numérotée en bas (blocs 10bp, 60bp/ligne)
- **MSA Viewer** : conservation, consensus, scroll horizontal/vertical, zoom
- **MiniMap** navigateur global cliquable
- **Export** FASTA + GFF3

## Raccourcis clavier

| Touche | Action |
|--------|--------|
| `←` / `→` | Pan |
| `+` / `-` | Zoom |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl` + molette | Zoom |
| Molette | Pan horizontal |
| Shift + molette (MSA) | Scroll séquences |
