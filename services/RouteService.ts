import { Coordinates, MopedClass, RouteInstruction, TrafficIncident, AutocompleteSuggestion } from '../types';
import { resolveRoutingProfile } from './belgianTrafficLogic';

// ---------------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------------
// GET A FREE KEY AT: https://developer.tomtom.com/
// If left empty, the app falls back to OSRM (Basic/Offline capable, but stricter routing).
const TOMTOM_API_KEY = 'SrvDOQnAgj81DiUQDL9aaIf0woB3xRdA'; 

const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1';
const TOMTOM_BASE_URL = 'https://api.tomtom.com/routing/1/calculateRoute';
const TOMTOM_TRAFFIC_BASE_URL = 'https://api.tomtom.com/traffic/services/5/incidentDetails';

export interface RouteResult {
  coordinates: Coordinates[];
  distance: number; // meters
  duration: number; // seconds
  provider: 'tomtom' | 'osrm';
  instructions: RouteInstruction[];
}

/**
 * Helper: Parse OSRM Response
 * Note: OSRM basic demo steps are less detailed than TomTom, implementing basic support.
 */
const fetchOSRM = async (start: Coordinates, end: Coordinates, mopedClass: MopedClass): Promise<RouteResult | null> => {
  try {
    const profile = resolveRoutingProfile(mopedClass); 
    const startStr = `${start.lng},${start.lat}`;
    const endStr = `${end.lng},${end.lat}`;
    const url = `${OSRM_BASE_URL}/${profile}/${startStr};${endStr}?overview=full&geometries=geojson&steps=true`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`OSRM Status ${response.status}`);
    
    const data = await response.json();
    if (!data.routes || data.routes.length === 0) return null;

    const route = data.routes[0];
    
    // Simple instruction mapping for OSRM
    const instructions: RouteInstruction[] = route.legs[0].steps.map((step: any, index: number) => ({
      pointIndex: index, // OSRM steps don't map 1:1 to coord indices easily in this simple implementation
      distanceFromStart: 0, // Not calculated for OSRM fallback
      instruction: step.maneuver.type + ' ' + (step.name || ''),
      maneuver: 'GO_STRAIGHT', // Placeholder
      coordinates: { lat: step.maneuver.location[1], lng: step.maneuver.location[0] }
    }));

    return {
      coordinates: route.geometry.coordinates.map((c: number[]) => ({ lat: c[1], lng: c[0] })),
      distance: route.distance,
      duration: route.duration,
      provider: 'osrm',
      instructions
    };
  } catch (e) {
    console.warn("OSRM Fallback failed:", e);
    return null;
  }
};

/**
 * Helper: Parse TomTom Response (Handles Traffic & Class B Logic better)
 */
const fetchTomTom = async (start: Coordinates, end: Coordinates, mopedClass: MopedClass): Promise<RouteResult | null> => {
  try {
    const startStr = `${start.lat},${start.lng}`;
    const endStr = `${end.lat},${end.lng}`;
    
    const travelMode = mopedClass === MopedClass.A ? 'bicycle' : 'motorcycle';
    
    // departAt='now' forces the engine to consider CURRENT traffic conditions for dynamic re-routing
    let params = `key=${TOMTOM_API_KEY}&traffic=true&departAt=now&travelMode=${travelMode}&language=nl-NL&instructionsType=text`;
    
    if (mopedClass === MopedClass.B) {
      params += `&vehicleMaxSpeed=45&avoid=motorways`; 
    }

    const url = `${TOMTOM_BASE_URL}/${startStr}:${endStr}/json?${params}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`TomTom Status ${response.status}`);

    const data = await response.json();
    if (!data.routes || data.routes.length === 0) return null;

    const route = data.routes[0];
    const points = route.legs[0].points;
    const guidance = route.guidance.instructions;

    // Map TomTom instructions to our internal format
    const instructions: RouteInstruction[] = guidance.map((instr: any) => {
        let maneuverType: RouteInstruction['maneuver'] = 'UNKNOWN';
        const m = instr.maneuver ? instr.maneuver.toUpperCase() : '';
        
        if (m.includes('LEFT')) maneuverType = 'TURN_LEFT';
        else if (m.includes('RIGHT')) maneuverType = 'TURN_RIGHT';
        else if (m.includes('STRAIGHT')) maneuverType = 'GO_STRAIGHT';
        else if (m.includes('ROUNDABOUT')) maneuverType = 'ROUNDABOUT';
        else if (m.includes('UTURN')) maneuverType = 'U_TURN';
        else if (m === 'DEPART') maneuverType = 'DEPART';
        else if (m === 'ARRIVE') maneuverType = 'ARRIVE';

        // Validating point existence
        const point = points[instr.pointIndex];
        const lat = point ? point.latitude : 0;
        const lng = point ? point.longitude : 0;

        return {
            pointIndex: instr.pointIndex,
            distanceFromStart: instr.routeOffsetInMeters,
            instruction: instr.message,
            maneuver: maneuverType,
            coordinates: { lat, lng }
        };
    });

    return {
      coordinates: points.map((p: any) => ({ lat: p.latitude, lng: p.longitude })),
      distance: route.summary.lengthInMeters,
      duration: route.summary.travelTimeInSeconds + (route.summary.trafficDelayInSeconds || 0),
      provider: 'tomtom',
      instructions
    };
  } catch (e) {
    console.warn("TomTom Routing failed (Check API Key):", e);
    return null;
  }
};

export const RouteService = {
  calculateRoute: async (
    start: Coordinates, 
    end: Coordinates, 
    mopedClass: MopedClass
  ): Promise<RouteResult | null> => {
    
    // 1. Try TomTom if Key is present
    if (TOMTOM_API_KEY) {
      const tomTomResult = await fetchTomTom(start, end, mopedClass);
      if (tomTomResult) return tomTomResult;
    }

    // 2. Fallback to OSRM
    return await fetchOSRM(start, end, mopedClass);
  },

  geocode: async (query: string): Promise<Coordinates | null> => {
    if (!query || query.trim().length === 0) return null;

    // 1. Try TomTom Search
    if (TOMTOM_API_KEY) {
      try {
        const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?key=${TOMTOM_API_KEY}&countrySet=BE&limit=1`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
            return {
                lat: data.results[0].position.lat,
                lng: data.results[0].position.lon
            };
        }
      } catch (e) {
        console.warn("TomTom Geocode failed, falling back", e);
      }
    }

    // 2. Fallback to Nominatim (OSM)
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=be&limit=1`;
        const response = await fetch(url);
        const data = await response.json();
        if (data && data.length > 0) {
          return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon)
          };
        }
    } catch (e) {
        console.error("Nominatim Geocode failed", e);
    }
    return null;
  },

  // NEW: Autocomplete Suggestions
  getSearchSuggestions: async (query: string): Promise<AutocompleteSuggestion[]> => {
    if (!query || query.length < 3) return [];

    if (TOMTOM_API_KEY) {
        try {
            const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?key=${TOMTOM_API_KEY}&countrySet=BE&limit=5&typeahead=true`;
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.results) {
                return data.results.map((r: any) => ({
                    id: r.id,
                    label: r.address.freeformAddress,
                    coordinates: { lat: r.position.lat, lng: r.position.lon }
                }));
            }
        } catch (e) {
            console.warn("TomTom Autocomplete failed", e);
        }
    } else {
        // Fallback to Nominatim (less suited for autocomplete but works)
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=be&limit=5&addressdetails=1`;
            const res = await fetch(url);
            const data = await res.json();
            return data.map((r: any) => ({
                id: r.place_id,
                label: r.display_name,
                coordinates: { lat: parseFloat(r.lat), lng: parseFloat(r.lon) }
            }));
        } catch (e) {
             console.warn("Nominatim Autocomplete failed", e);
        }
    }

    return [];
  },

  getTrafficIncidents: async (routeCoords: Coordinates[]): Promise<TrafficIncident[]> => {
    if (!TOMTOM_API_KEY || routeCoords.length === 0) return [];

    try {
      // Calculate Bounding Box of the route
      let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
      routeCoords.forEach(c => {
        if (c.lat < minLat) minLat = c.lat;
        if (c.lat > maxLat) maxLat = c.lat;
        if (c.lng < minLng) minLng = c.lng;
        if (c.lng > maxLng) maxLng = c.lng;
      });

      // Add padding to bbox
      const PAD = 0.01;
      const bbox = `${minLng - PAD},${minLat - PAD},${maxLng + PAD},${maxLat + PAD}`;

      const url = `${TOMTOM_TRAFFIC_BASE_URL}?key=${TOMTOM_API_KEY}&bbox=${bbox}&fields={incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description,code,iconCategory}}}}&language=nl-NL`;

      const response = await fetch(url);
      if(!response.ok) return [];

      const data = await response.json();
      if (!data.incidents) return [];

      const incidents: (TrafficIncident | null)[] = data.incidents.map((inc: any, index: number) => {
         const props = inc.properties;
         
         // Fix: Check geometry type to handle Point vs LineString
         let lat: number | undefined;
         let lng: number | undefined;

         if (inc.geometry.type === 'Point') {
             lng = inc.geometry.coordinates[0];
             lat = inc.geometry.coordinates[1];
         } else if (inc.geometry.type === 'LineString' && inc.geometry.coordinates.length > 0) {
             // Take start of line string
             lng = inc.geometry.coordinates[0][0];
             lat = inc.geometry.coordinates[0][1];
         }

         // If we couldn't parse coordinates, skip
         if (lat === undefined || lng === undefined) {
             return null;
         }

         let type: TrafficIncident['type'] = 'UNKNOWN';
         const icon = props.iconCategory;
         
         if (icon === 0) type = 'UNKNOWN';
         else if (icon === 1) type = 'ACCIDENT';
         else if (icon === 2) type = 'FOG';
         else if (icon === 3) type = 'DANGEROUS_CONDITIONS';
         else if (icon === 4) type = 'RAIN';
         else if (icon === 5) type = 'ICE';
         else if (icon === 6) type = 'JAM';
         else if (icon === 7) type = 'LANE_CLOSED';
         else if (icon === 8) type = 'ROAD_CLOSED';

         return {
           id: `inc-${index}`,
           coordinates: { lat, lng },
           type: type,
           description: props.events?.[0]?.description || 'Verkeershinder',
           delayInSeconds: 0,
           magnitude: props.magnitudeOfDelay || 0
         };
      });

      // Filter out nulls
      return incidents.filter((i): i is TrafficIncident => i !== null);

    } catch (e) {
      console.warn("Failed to fetch traffic incidents", e);
      return [];
    }
  }
};