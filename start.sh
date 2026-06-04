#!/usr/bin/env bash

# ─────────────────────────────────────────────
#  BioViewer — Start script
#  Lance le frontend Vite + le backend Flask (si disponible)
# ─────────────────────────────────────────────

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND="$ROOT/frontend"
BACKEND="$ROOT/backend"

echo -e "${CYAN}"
echo "  ╔══════════════════════════════════╗"
echo "  ║   🧬  BioViewer — Starting...    ║"
echo "  ╚══════════════════════════════════╝"
echo -e "${NC}"

# Check frontend deps installed
if [ ! -d "$FRONTEND/node_modules" ]; then
  echo -e "${RED}✗ Dépendances manquantes. Lancez d'abord :  ./install.sh${NC}"
  exit 1
fi

# ── Start backend if available ──────────────────────────────────────────
BACKEND_STARTED=false
VENV="$BACKEND/.venv"

if [ -d "$VENV" ]; then
  echo -e "${CYAN}▶ Démarrage du backend Flask (port 5000)...${NC}"
  
  # Activate venv (cross-platform)
  if [ -f "$VENV/bin/activate" ]; then
    source "$VENV/bin/activate"
  elif [ -f "$VENV/Scripts/activate" ]; then
    source "$VENV/Scripts/activate"
  fi
  
  cd "$BACKEND"
  python3 app.py &
  BACKEND_PID=$!
  BACKEND_STARTED=true
  sleep 1
  
  if kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${GREEN}✓ Backend Flask démarré (PID $BACKEND_PID) → http://localhost:5000${NC}"
  else
    echo -e "${YELLOW}⚠  Backend Flask n'a pas démarré (l'app fonctionne quand même sans lui)${NC}"
    BACKEND_STARTED=false
  fi
else
  echo -e "${YELLOW}⚠  Backend Flask non installé (optionnel). L'app fonctionne en mode client-only.${NC}"
fi

echo ""

# ── Start frontend ──────────────────────────────────────────────────────
echo -e "${CYAN}▶ Démarrage du frontend Vite (port 5173)...${NC}"
cd "$FRONTEND"

# Open browser after short delay (cross-platform)
(sleep 2 && \
  (command -v xdg-open &>/dev/null && xdg-open http://localhost:5173) || \
  (command -v open &>/dev/null && open http://localhost:5173) || \
  (command -v start &>/dev/null && start http://localhost:5173) || \
  true \
) &

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════╗"
echo -e "║  🧬  BioViewer est prêt !                     ║"
echo -e "║                                               ║"
echo -e "║  Frontend  →  http://localhost:5173           ║"
if $BACKEND_STARTED; then
echo -e "║  Backend   →  http://localhost:5000           ║"
fi
echo -e "║                                               ║"
echo -e "║  Ctrl+C pour arrêter                          ║"
echo -e "╚═══════════════════════════════════════════════╝${NC}"
echo ""

# Trap Ctrl+C to kill everything cleanly
cleanup() {
  echo ""
  echo -e "${YELLOW}Arrêt de BioViewer...${NC}"
  if $BACKEND_STARTED; then
    kill $BACKEND_PID 2>/dev/null
  fi
  exit 0
}
trap cleanup INT TERM

# Run Vite (blocking)
npm run dev -- --host 0.0.0.0
