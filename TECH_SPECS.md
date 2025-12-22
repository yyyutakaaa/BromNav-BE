# Technische Specificaties & Architectuur - BromNav BE

## 1. Voorgestelde Tech Stack

**Front-end (PWA)**
*   **Core:** React 18 with TypeScript.
*   **Build Tool:** Vite (voor snelle HMR en optimized builds).
*   **State Management:** React Context API (lichtgewicht) of Zustand.
*   **Routing (App):** React-Router (indien multiple views), maar Single View aanbevolen.
*   **Map Visualization:** MapLibre GL JS (Vector tiles) voor offline performance en rotatie-mogelijkheden, of Leaflet voor bredere device support.
*   **Styling:** Tailwind CSS (Mobile-first, utility classes voor High Contrast).
*   **PWA:** Vite PWA Plugin (Workbox) voor Service Worker generatie en caching strategies.

**Routing Engine (Backend/Serverless)**
*   **Engine:** GraphHopper (Java) of OSRM (C++). GraphHopper heeft betere support voor custom flag encoders (nodig voor Klasse A/B logica).
*   **Hosting:** Docker container op AWS Fargate of DigitalOcean App Platform.
*   **Caching:** Redis (voor veelvoorkomende routes).
*   **API Layer:** Cloudflare Workers (Edge) voor authenticatie, rate-limiting en request validatie voordat de zware routing server wordt geraakt.

**Data & Storage**
*   **Kaartdata:** OpenStreetMap (OSM) - wekelijkse updates via Geofabrik.
*   **User Data:** Firebase Firestore (NoSQL) voor profielen/favorieten.
*   **Auth:** Firebase Auth (JWT).

---

## 2. JSON Config Velden (App Configuration)

Deze velden worden opgeslagen in de user profile of local storage en meegestuurd naar de Routing API.

```json
{
  "vehicle_profile": {
    "class": "B",             // "A" (25kmh) of "B" (45kmh)
    "max_speed": 45,          // Snelheidslimiet van het voertuig
    "fuel_type": "electric"   // "electric" | "petrol" (kan invloed hebben op milieuzones)
  },
  "routing_preferences": {
    "avoid_cobblestones": true,     // Vermijd kasseien (wegdek comfort)
    "avoid_unlit_roads": false,     // 's Nachts navigeren (veiligheid)
    "prioritize_cycle_paths": true, // Ook voor Klasse B, indien legaal
    "allow_ferries": false
  },
  "ui_preferences": {
    "high_contrast_mode": false,
    "voice_guidance_enabled": true,
    "auto_reroute": true
  },
  "offline_settings": {
    "downloaded_regions": ["BE-VLG", "BE-BRU"],
    "wifi_only_updates": true
  }
}
```

## 3. Privacy & Security (AVG/GDPR)

*   **Ephemeral Location:** GPS coördinaten worden enkel in RAM gehouden voor de routing engine sessie en niet naar disk geschreven in de backend logs.
*   **JWT:** Tokens vervallen na 1 uur.
*   **HTTPS:** Strict-Transport-Security (HSTS) ingeschakeld.
