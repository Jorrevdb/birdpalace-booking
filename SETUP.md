# Bird Palace Booking – Setup Guide

Follow these steps in order. Each step takes 5–10 minutes.

---

## Stap 1 – Project op je computer zetten

1. Download en installeer **Node.js** van https://nodejs.org (kies de LTS versie)
2. Download en installeer **Git** van https://git-scm.com
3. Maak een account op **GitHub** (https://github.com) als je die nog niet hebt
4. Maak een nieuw (leeg) repository aan op GitHub, noem het `birdpalace-booking`
5. Open Terminal (Mac) of Command Prompt (Windows)
6. Ga naar de map waar je dit project hebt opgeslagen:
   ```
   cd pad/naar/birdpalace-booking
   ```
7. Installeer alle dependencies:
   ```
   npm install
   ```
8. Push naar GitHub:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/JOUWGEBRUIKERSNAAM/birdpalace-booking.git
   git push -u origin main
   ```

---

## Stap 2 – Supabase instellen

1. Ga naar https://supabase.com en log in
2. Klik op je project `birdpalace-booking`
3. Ga naar **SQL Editor** (linkermenu)
4. Klik op **New Query**, plak de volledige inhoud van `supabase-schema.sql` erin
5. Klik op **Run**
6. Ga naar **Project Settings → API** en kopieer:
   - `Project URL` → dit is je `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → dit is je `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → dit is je `SUPABASE_SERVICE_ROLE_KEY`

### Medewerkers toevoegen
Ga naar **Table Editor → workers** en voeg de 3 medewerkers toe:
- name: Jan, email: jan@birdpalace.be, google_calendar_id: jan@gmail.com (het gmail-adres van de medewerker)
- Herhaal voor Lena en Tom

---

## Stap 3 – Resend instellen

1. Ga naar https://resend.com en log in
2. Ga naar **Domains** en voeg `birdpalace.be` toe
3. Volg de instructies om DNS-records toe te voegen bij je domeinbeheerder
4. Ga naar **API Keys → Create API Key**
5. Kopieer de key → dit is je `RESEND_API_KEY`

---

## Stap 4 – Google Calendar API instellen

Dit is de meest technische stap. Volg dit precies:

### 4a. Google Cloud project aanmaken
1. Ga naar https://console.cloud.google.com
2. Maak een nieuw project aan: naam `birdpalace-booking`
3. Ga naar **APIs & Services → Library**
4. Zoek `Google Calendar API` en klik **Enable**

### 4b. Service account aanmaken
1. Ga naar **APIs & Services → Credentials**
2. Klik **Create Credentials → Service Account**
3. Naam: `birdpalace-calendar`, klik door (geen extra rechten nodig)
4. Klik op het aangemaakte service account
5. Ga naar tabblad **Keys → Add Key → Create new key → JSON**
6. Download het JSON-bestand
7. Open het JSON-bestand in een teksteditor
8. Kopieer de VOLLEDIGE inhoud (inclusief de `{` en `}`)
9. Dit is je `GOOGLE_SERVICE_ACCOUNT_JSON`

### 4c. Kalenders delen met het service account
Het JSON-bestand bevat een `client_email` adres (bijv. `birdpalace-calendar@birdpalace-booking.iam.gserviceaccount.com`)

Elke medewerker moet hun Google Agenda delen met dit e-mailadres:
1. Open Google Agenda op je computer
2. Klik naast de agenda op de drie puntjes → **Instellingen en delen**
3. Scroll naar **Personen die toegang hebben**
4. Voeg het `client_email` toe met de rechten **"Alle afspraken bekijken"**

### 4d. Hoe medewerkers beschikbaarheid instellen
Medewerkers maken een event in hun Google Agenda wanneer ze beschikbaar zijn voor tours:
- **Hele dag beschikbaar**: maak een all-day event → alle 3 tours (11:00, 13:00, 15:00) verschijnen
- **Gedeeltelijk beschikbaar**: maak een event van bijv. 13:00–17:00 → alleen de 13:00 en 15:00 tour verschijnen
- De naam van het event maakt niet uit

---

## Stap 5 – Omgevingsvariabelen instellen

1. Kopieer `.env.example` naar een nieuw bestand genaamd `.env.local`
2. Vul alle waarden in met wat je in de vorige stappen hebt verzameld
3. Voor `GOOGLE_SERVICE_ACCOUNT_JSON`: plak de JSON op één regel (geen enters)

---

## Stap 6 – Lokaal testen

```
npm run dev
```

Open http://localhost:3000 in je browser. Je zou de boekingspagina moeten zien.

**Test het volledige proces:**
1. Maak een event in de Google Agenda van een medewerker
2. Ga naar localhost:3000 en check of die datum beschikbaar is
3. Maak een testboeking
4. Check of je een e-mail ontvangt
5. Check of de medewerker een e-mail ontvangt met accept/decline links

---

## Stap 7 – Deployen op Vercel

1. Ga naar https://vercel.com en log in
2. Klik **Add New Project**
3. Importeer je `birdpalace-booking` GitHub repository
4. Klik op **Environment Variables** en voeg alle variabelen uit `.env.local` toe
5. Klik **Deploy**
6. Vercel geeft je een URL (bijv. `birdpalace-booking.vercel.app`)

### Eigen domein instellen (optioneel)
In Vercel → je project → **Settings → Domains**: voeg `booking.birdpalace.be` toe en stel de DNS in bij je domeinbeheerder.

Update daarna `NEXT_PUBLIC_SITE_URL` in Vercel naar `https://booking.birdpalace.be`.

---

## Stap 8 – Embedden in WordPress

1. Open WordPress → de pagina **Bezoeken** in Elementor
2. Sleep een **HTML** widget naar de pagina
3. Plak de volgende code:

```html
<iframe
  src="https://booking.birdpalace.be"
  width="100%"
  height="800"
  frameborder="0"
  style="border-radius: 12px; overflow: hidden;"
  title="Tour boeken"
></iframe>
```

4. Pas de `height` aan naar wens (of gebruik JavaScript om de hoogte automatisch aan te passen)

---

## Tour tijden aanpassen

Wil je de tourtijden of -duur aanpassen? Pas dit aan in `lib/config.ts`:

```ts
export const TOUR_TIMES = ['11:00', '13:00', '15:00']  // verander tijden hier
export const TOUR_DURATION_MINUTES = 90                  // verander duur hier
```

Commit daarna de wijziging naar GitHub — Vercel deployt automatisch.

---

## Vragen of problemen?

Breng het project mee in een Claude Cowork sessie en beschrijf wat er misgaat — dan lossen we het samen op.
