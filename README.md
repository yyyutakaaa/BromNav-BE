# BromNav BE

**Progressive Web App voor Klasse A/B Bromfietsnavigatie in België**

BromNav BE is een gespecialiseerde navigatie-app voor bromfietsen die rekening houdt met de Belgische verkeerswetgeving en de unieke beperkingen van Klasse A (25 km/h) en Klasse B (45 km/h) bromfietsen.

## Features

### Bromfiets-specifieke Routing
- **Klasse A & B ondersteuning**: Automatische routeaanpassing op basis van je bromfietsklasse
- **Belgische verkeerswetten**: Routes die rekening houden met toegestane wegen
- **Wegdekcomfort**: Vermijd kasseien en onverharde wegen
- **Fietspadvoorrang**: Gebruik veilige fietspaden waar toegestaan

### Intelligente Navigatie
- **Live GPS tracking**: Real-time positiebepaling met snelheidsweergave
- **Turn-by-turn instructies**: Duidelijke richtaanwijzingen tijdens het rijden
- **Afstandsindicatie**: Zie hoever de volgende manoeuvre is
- **ETA berekening**: Geschatte aankomsttijd op basis van je voortgang

### Verkeersinformatie
- **Live traffic data**: Real-time verkeersinformatie via TomTom
- **Incidentenwaarschuwingen**: Meldingen van ongevallen en files
- **Dynamische herberekening**: Automatische route-aanpassing bij afwijking

### Route Management
- **Routes opslaan**: Bewaar je favoriete routes lokaal
- **Routes delen**: Genereer deelbare links voor anderen
- **URL import**: Open routes via gedeelde links

### Gebruikersvriendelijk
- **High contrast modus**: Voor betere leesbaarheid in fel zonlicht
- **Camera lock**: Automatisch gecentreerde kaart tijdens navigatie
- **Responsief design**: Werkt op alle schermformaten
- **Offline-ready**: PWA functionaliteit voor offline gebruik

## Technologie

### Frontend
- **React 19** met **TypeScript** voor type-veilige code
- **Vite** voor snelle development en geoptimaliseerde builds
- **Leaflet** voor kaartvisualisatie met OpenStreetMap data
- **Tailwind CSS** voor moderne, responsive UI

### Routing Services
- **TomTom Routing API**: Voor live traffic data en nauwkeurige routes
- **OSRM** als fallback voor basic routing zonder traffic
- **Nominatim**: Geocoding voor adreszoekfunctionaliteit

### Data Opslag
- **LocalStorage**: Voor opgeslagen routes en gebruikersvoorkeuren
- **In-memory state**: React Context API voor app-state management

## Installatie en Development

### Vereisten
- Node.js (versie 18 of hoger)
- npm of yarn package manager

### Setup

1. **Clone de repository**
```bash
git clone https://github.com/jouw-gebruikersnaam/bromnav-be.git
cd bromnav-be
```

2. **Installeer dependencies**
```bash
npm install
```

3. **Configureer API keys**

Maak een `.env.local` bestand aan in de root directory:
```env
VITE_TOMTOM_API_KEY=jouw_tomtom_api_key_hier
```

> **Opmerking**: TomTom API key is optioneel. Zonder key gebruikt de app OSRM als fallback (zonder live traffic).

4. **Start development server**
```bash
npm run dev
```

De app is nu beschikbaar op `http://localhost:5173`

### Build voor productie
```bash
npm run build
npm run preview
```

## Gebruik

### Basis Navigatie
1. **Selecteer je bromfietsklasse** (A of B) via de gele/rode badge bovenaan
2. **Voer een bestemming in** of klik op de kaart
3. **Bekijk de berekende route** met geschatte duur
4. **Start navigatie** met de groene knop
5. **Volg de turn-by-turn instructies**

### Geavanceerde Features
- **Eigen startpunt**: Laat het "Start" veld leeg voor huidige locatie, of voer een adres in
- **Route opslaan**: Druk op het save-icoon om routes op te slaan
- **Route delen**: Gebruik de share-knop om een link te kopiëren
- **Verkeerswaarschuwingen**: Rode punten op de kaart tonen verkeersinformatie

### Navigatiemodus
- **Camera lock**: De kaart roteert automatisch met je rijrichting
- **Snelheidsweergave**: Zie je huidige snelheid in km/h
- **Afstandsindicator**: Meters tot de volgende bocht
- **Annuleren**: Stop navigatie met de rode X-knop

## Projectstructuur

```
bromnav-be/
├── components/
│   ├── Controls.tsx          # UI controls en input formulieren
│   └── MapComponent.tsx       # Leaflet kaart integratie
├── services/
│   ├── RouteService.ts        # Routing API's (TomTom/OSRM)
│   ├── StorageService.ts      # LocalStorage management
│   └── belgianTrafficLogic.ts # Belgische verkeerswetten
├── App.tsx                    # Hoofdcomponent en state management
├── types.ts                   # TypeScript type definities
├── index.tsx                  # App entry point
└── TECH_SPECS.md              # Technische specificaties
```

## 🇧🇪 Belgische Verkeerswetgeving

De app houdt rekening met specifieke Belgische regels:

### Klasse A (25 km/h)
- **Snelweg**: Niet toegestaan
- **Ringwegen**: Niet toegestaan op hoofdrijbanen
- **Fietspaden**: Verplicht gebruik waar beschikbaar
- **Minimumleeftijd**: 16 jaar

### Klasse B (45 km/h)
- **Snelweg**: Niet toegestaan
- **Ringwegen**: Beperkt toegestaan
- **Fietspaden**: Optioneel
- **Rijbewijs**: Vereist (A1, A, B)

## Privacy & Beveiliging

- **Geen tracking**: GPS-coördinaten worden alleen lokaal opgeslagen
- **HTTPS only**: Veilige communicatie met routing API's
- **Geen account vereist**: Volledig anoniem te gebruiken
- **LocalStorage only**: Alle opgeslagen data blijft op je apparaat

## Roadmap

### Geplande Features
- [ ] **Offline kaarten**: Download regio's voor offline gebruik
- [ ] **Spraaknavigatie**: Gesproken richtaanwijzingen
- [ ] **Donkere modus**: Nachtvriendelijk kleurenschema
- [ ] **Waypoints**: Tussenstops toevoegen aan routes
- [ ] **Milieuzones**: Waarschuwingen voor LEZ zones
- [ ] **Tankstations**: Vind tankstations langs de route
- [ ] **Weersintegratie**: Waarschuwingen bij slecht weer
- [ ] **Community routes**: Deel en ontdek populaire routes

### Technische Verbeteringen
- [ ] Service Worker voor volledige offline functionaliteit
- [ ] PWA installatie prompts
- [ ] GraphQL backend voor gebruikersdata
- [ ] Real-time route sharing met vrienden
- [ ] Firebase integratie voor cross-device sync

## Bijdragen

Bijdragen zijn welkom! Volg deze stappen:

1. Fork het project
2. Maak een feature branch (`git checkout -b feature/geweldige-feature`)
3. Commit je wijzigingen (`git commit -m 'feat: voeg geweldige feature toe'`)
4. Push naar de branch (`git push origin feature/geweldige-feature`)
5. Open een Pull Request

### Code Style
- Gebruik TypeScript voor type safety
- Volg de bestaande code formatting
- Schrijf beschrijvende commit messages
- Voeg comments toe voor complexe logica

## Licentie

Dit project is gelicenseerd onder de MIT License - zie het [LICENSE](LICENSE) bestand voor details.

## Credits

- **Kaartdata**: [OpenStreetMap](https://www.openstreetmap.org/) contributors
- **Routing**: [TomTom Maps API](https://developer.tomtom.com/) & [OSRM](http://project-osrm.org/)
- **Geocoding**: [Nominatim](https://nominatim.org/)
- **Iconen**: Emoji's voor eenvoudige UI

## Contact & Support

- **Issues**: Meld bugs via [GitHub Issues](https://github.com/jouw-gebruikersnaam/bromnav-be/issues)
- **Discussies**: Stel vragen in [GitHub Discussions](https://github.com/jouw-gebruikersnaam/bromnav-be/discussions)

## Disclaimer

BromNav BE is een hulpmiddel voor navigatie. Bestuurders zijn verantwoordelijk voor het naleven van verkeersregels en het nemen van veilige beslissingen. Gebruik de app niet tijdens het rijden zonder handsfree setup.

---

**Gemaakt met ❤️ voor de Belgische bromfiets community**
