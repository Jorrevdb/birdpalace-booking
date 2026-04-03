#!/bin/bash
# Pusht de code naar GitHub
# Voer uit in Terminal: bash push-to-github.sh

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "🐦 Bird Palace – Push naar GitHub"
echo "=================================="
echo ""

cd "$(dirname "$0")"

# Koppel aan GitHub repository
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/Jorrevdb/birdpalace-booking.git
git branch -M main

echo "Code naar GitHub pushen..."
echo -e "${YELLOW}→ GitHub vraagt mogelijk om je gebruikersnaam en een 'Personal Access Token'${NC}"
echo -e "${YELLOW}  (NIET je GitHub wachtwoord — een token van github.com/settings/tokens)${NC}"
echo ""

git push -u origin main

echo ""
echo -e "${GREEN}✓ Code staat op GitHub!${NC}"
echo ""
echo "Volgende stap: ga naar https://vercel.com en importeer je repository."
echo "Kom daarna terug in Cowork! 🚀"
