#!/bin/bash
# Fix GitHub authenticatie en push de code
# Voer uit: bash fix-github-auth.sh

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "🐦 Bird Palace – GitHub authenticatie herstellen"
echo "================================================="
echo ""

cd "$(dirname "$0")"

# ── Stap 1: Verwijder oude opgeslagen credentials ─────────────
echo "Stap 1: Oude GitHub credentials wissen..."
printf "protocol=https\nhost=github.com\n" | git credential-osxkeychain erase 2>/dev/null
echo -e "${GREEN}✓ Klaar${NC}"
echo ""

# ── Stap 2: GitHub CLI installeren indien nodig ───────────────
echo "Stap 2: GitHub CLI controleren..."

if command -v gh &> /dev/null; then
  echo -e "${GREEN}✓ GitHub CLI al geïnstalleerd$(gh --version | head -1)${NC}"
else
  echo -e "${YELLOW}→ GitHub CLI niet gevonden, installeren via Homebrew...${NC}"

  if ! command -v brew &> /dev/null; then
    echo -e "${RED}✗ Homebrew niet gevonden.${NC}"
    echo ""
    echo "  Installeer Homebrew eerst:"
    echo -e "  ${YELLOW}/bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"${NC}"
    echo ""
    echo "  Daarna opnieuw uitvoeren: bash fix-github-auth.sh"
    exit 1
  fi

  brew install gh
  echo -e "${GREEN}✓ GitHub CLI geïnstalleerd${NC}"
fi

echo ""

# ── Stap 3: Inloggen via browser ──────────────────────────────
echo "Stap 3: Inloggen bij GitHub via browser..."
echo -e "${YELLOW}→ Er opent een browserpagina — log in als 'Jorrevdb' en klik op Authorize${NC}"
echo ""

gh auth login --hostname github.com --git-protocol https --web

echo ""

# ── Stap 4: Remote instellen en pushen ────────────────────────
echo "Stap 4: Code naar GitHub pushen..."

git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/Jorrevdb/birdpalace-booking.git
git branch -M main
gh auth setup-git
git push -u origin main

echo ""
echo -e "${GREEN}✓ Code staat op GitHub!${NC}"
echo -e "  → https://github.com/Jorrevdb/birdpalace-booking"
echo ""
echo "Volgende stap: ga naar https://vercel.com en importeer je repository."
echo "Kom daarna terug in Cowork! 🚀"
