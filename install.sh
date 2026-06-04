#!/usr/bin/env bash
set -e

# ─────────────────────────────────────────────
#  BioViewer — Installation script
#  Installe le frontend (Node/npm) et optionnellement le backend Flask
# ─────────────────────────────────────────────

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

echo -e "${CYAN}"
echo "  ╔══════════════════════════════════╗"
echo "  ║   🧬  BioViewer — Install        ║"
echo "  ╚══════════════════════════════════╝"
echo -e "${NC}"

# ── 1. Check Node ──────────────────────────────────────────────────────
echo -e "${CYAN}[1/3] Vérification de Node.js...${NC}"
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js non trouvé. Installez Node.js ≥ 18 depuis https://nodejs.org${NC}"
  exit 1
fi
NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo -e "${RED}✗ Node.js $NODE_VER détecté. Version ≥ 18 requise.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v) — OK${NC}"

# ── 2. Install frontend ─────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[2/3] Installation des dépendances frontend...${NC}"
cd "$(dirname "$0")/frontend"
npm install
echo -e "${GREEN}✓ Frontend prêt${NC}"

# ── 3. Backend Flask (optionnel) ────────────────────────────────────────
echo ""
echo -e "${CYAN}[3/3] Backend Flask (optionnel)...${NC}"
cd ../backend

if ! command -v python3 &>/dev/null; then
  echo -e "${YELLOW}⚠  Python3 non trouvé — le backend Flask sera ignoré.${NC}"
  echo -e "${YELLOW}   L'app fonctionne sans lui (parsing 100% client-side).${NC}"
else
  echo -e "${GREEN}✓ Python $(python3 --version)${NC}"
  
  # Create venv
  if [ ! -d ".venv" ]; then
    echo "   Création de l'environnement virtuel..."
    python3 -m venv .venv
  fi
  
  # Activate and install
  source .venv/bin/activate 2>/dev/null || source .venv/Scripts/activate 2>/dev/null || true
  pip install -q --upgrade pip
  pip install -q -r requirements.txt
  echo -e "${GREEN}✓ Backend Flask installé dans .venv/${NC}"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗"
echo -e "║  ✅  Installation terminée !              ║"
echo -e "║                                          ║"
echo -e "║  Lancez l'app avec :  ./start.sh          ║"
echo -e "╚══════════════════════════════════════════╝${NC}"
