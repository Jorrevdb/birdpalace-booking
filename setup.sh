#!/bin/bash
# Bird Palace Booking – Automatische setup
# Dubbelklik op dit bestand of voer het uit in Terminal: bash setup.sh

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "🐦 Bird Palace Booking – Setup"
echo "================================"
echo ""

# ── Stap 1: Check Node.js ──────────────────────────────────────────
echo "Stap 1: Node.js controleren..."

if command -v node &> /dev/null; then
  NODE_VERSION=$(node --version)
  echo -e "${GREEN}✓ Node.js is al geïnstalleerd ($NODE_VERSION)${NC}"
else
  echo -e "${RED}✗ Node.js is niet geïnstalleerd.${NC}"
  echo ""
  echo "  Installeer Node.js via:"
  echo -e "  ${YELLOW}https://nodejs.org${NC} → kies de LTS versie"
  echo ""
  echo "  Na installatie: sluit Terminal, open opnieuw, en voer dit script opnieuw uit."
  exit 1
fi

echo ""

# ── Stap 2: Check Git ─────────────────────────────────────────────
echo "Stap 2: Git controleren..."

if command -v git &> /dev/null; then
  GIT_VERSION=$(git --version)
  echo -e "${GREEN}✓ Git is beschikbaar ($GIT_VERSION)${NC}"
else
  echo -e "${RED}✗ Git is niet geïnstalleerd.${NC}"
  echo ""
  echo "  Voer dit commando uit om Git te installeren:"
  echo -e "  ${YELLOW}xcode-select --install${NC}"
  echo ""
  echo "  Na installatie: voer dit script opnieuw uit."
  exit 1
fi

echo ""

# ── Stap 3: npm install ───────────────────────────────────────────
echo "Stap 3: Dependencies installeren (npm install)..."
echo "  Dit kan 1-2 minuten duren..."
echo ""

npm install

echo ""
echo -e "${GREEN}✓ Dependencies geïnstalleerd${NC}"
echo ""

# ── Stap 4: .env.local aanmaken ───────────────────────────────────
echo "Stap 4: Omgevingsbestand aanmaken..."

if [ ! -f ".env.local" ]; then
  cp .env.example .env.local
  echo -e "${GREEN}✓ .env.local aangemaakt (vul dit later in)${NC}"
else
  echo -e "${YELLOW}→ .env.local bestaat al, niet overschreven${NC}"
fi

echo ""

# ── Stap 5: Git initialiseren ─────────────────────────────────────
echo "Stap 5: Git initialiseren..."

if [ ! -d ".git" ]; then
  git init
  git add .
  git commit -m "Initial commit – Bird Palace Booking"
  echo -e "${GREEN}✓ Git repository aangemaakt${NC}"
else
  echo -e "${YELLOW}→ Git is al geïnitialiseerd${NC}"
fi

echo ""
echo "================================"
echo -e "${GREEN}✓ Lokale setup voltooid!${NC}"
echo ""
echo "Volgende stappen:"
echo ""
echo "  1. Maak een account op https://github.com (als je die nog niet hebt)"
echo "  2. Maak een nieuw repository aan op GitHub, naam: birdpalace-booking"
echo "  3. Kopieer de GitHub URL (bijv. https://github.com/JOUW_NAAM/birdpalace-booking.git)"
echo "  4. Voer daarna deze commando's uit in Terminal:"
echo ""
echo -e "     ${YELLOW}git remote add origin JOUW_GITHUB_URL${NC}"
echo -e "     ${YELLOW}git push -u origin main${NC}"
echo ""
echo "  5. Ga naar https://vercel.com en importeer je GitHub repository"
echo ""
echo "Kom daarna terug in Cowork voor de volgende stap! 🚀"
echo ""
