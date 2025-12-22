import { RoadSegment, MopedClass } from '../types';

/**
 * TECHNICAL SPECIFICATION: Routing Logic & OSRM Profile Design
 * 
 * This file serves as the Single Source of Truth for Belgian Moped Traffic Laws.
 * In a production environment, the logic below is translated into an OSRM Lua profile (moped.lua).
 * 
 * --- OSRM LUA PROFILE SPECIFICATION ---
 * 
 * 1. GLOBAL EXCLUSIONS:
 *    - highway = motorway | trunk | motorway_link | trunk_link => WEIGHT: INFINITY
 * 
 * 2. SPEED HANDLING (Max Speed Logic):
 *    - moped_class_a: max_speed = 25 km/h
 *    - moped_class_b: max_speed = 45 km/h
 * 
 * 3. SURFACE PENALTIES:
 *    - surface = cobblestone | sett => PENALTY_FACTOR: 3.0 (Avoid unless necessary)
 * 
 * 4. BELGIAN EXCEPTIONS (The "Ring of Ghent" Rule):
 *    - IF maxspeed > 50 AND cycleway = * THEN prefer cycleway.
 *    - IF maxspeed > 50 AND cycleway = none THEN avoid (unsafe for Class B).
 *    - IF traffic_sign = "C6" (No Mopeds) THEN access = no.
 *    - IF oneway = yes AND (oneway:moped = no OR oneway:bicycle = no) THEN access = both_ways.
 */

/**
 * Checks if a specific road segment is legally traversable by the selected vehicle class.
 */
export const isSegmentAccessible = (segment: RoadSegment, vehicleClass: MopedClass): boolean => {
  // 1. HARD EXCLUSIONS (Both Classes)
  if (segment.type === 'motorway' || segment.type === 'trunk') {
    return false;
  }

  // 2. CLASS A SPECIFIC RULES (25 km/h)
  if (vehicleClass === MopedClass.A) {
    if (segment.type === 'cycleway' || segment.type === 'path') {
      return true; 
    }
    if (segment.mopedsProhibitedOnRoad && !segment.hasCyclePath) {
      return false;
    }
    return true;
  }

  // 3. CLASS B SPECIFIC RULES (45 km/h)
  if (vehicleClass === MopedClass.B) {
    if (segment.type === 'cycleway') {
       if (!segment.mopedsAllowedOnCyclePath) {
         return false;
       }
    }
    
    // High speed road logic
    if (segment.maxSpeed > 50) {
      // Must use cycle path if available
      if (segment.hasCyclePath && segment.mopedsAllowedOnCyclePath) {
        return true; 
      }
      // If no cycle path and speed > 50 (e.g. 70/90), it is technically allowed unless C6,
      // BUT highly discouraged for safety in our app.
      if (segment.mopedsProhibitedOnRoad) {
          return false;
      }
      return true; 
    }

    if (segment.mopedsProhibitedOnRoad) {
       if (segment.hasCyclePath && segment.mopedsAllowedOnCyclePath) {
         return true;
       }
       return false;
    }

    return true;
  }

  return false;
};

/**
 * Adapter to determine the best OSRM Profile for the active public API.
 * This ensures the frontend respects the safety constraints defined above.
 */
export const resolveRoutingProfile = (mopedClass: MopedClass): string => {
  // CRITICAL SAFETY ENFORCEMENT
  // Standard 'driving' profiles in OSRM allow motorways (120km/h) and trunk roads (90km/h).
  // This is ILLEGAL for Class A and DANGEROUS/ILLEGAL for Class B (if no cycle path).
  //
  // We strictly enforce the 'bike' profile for BOTH classes when using the public OSRM demo.
  // The 'bike' profile:
  // 1. Avoids highways/motorways entirely.
  // 2. Prioritizes cycle highways (F-snelwegen) and parallel service roads.
  // 3. Routes via infrastructure suitable for slow traffic.
  
  return 'bike';
};

export const getRoutingWarnings = (mopedClass: MopedClass): string | null => {
  // Warning removed as per user request
  return null;
};