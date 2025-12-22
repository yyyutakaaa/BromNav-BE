// Enum for Moped Classes in Belgium
export enum MopedClass {
  A = 'A', // Max 25 km/h
  B = 'B'  // Max 45 km/h
}

// Configuration object for routing preferences
export interface RoutingConfig {
  mopedClass: MopedClass;
  avoidCobblestones: boolean;
  highContrastMode: boolean;
  voiceGuidance: boolean;
}

// Simplified representation of an OSM Way/Segment for logic simulation
export interface RoadSegment {
  id: string;
  name: string;
  type: 'motorway' | 'trunk' | 'primary' | 'secondary' | 'residential' | 'cycleway' | 'path';
  maxSpeed: number; // km/h
  surface: 'asphalt' | 'cobblestone' | 'gravel';
  hasCyclePath: boolean;
  cyclePathCompulsory: boolean; // D7 sign
  mopedsAllowedOnCyclePath: boolean; // M sign (B permitted)
  mopedsProhibitedOnRoad: boolean; // C6 sign
  isOneWayCar: boolean;
  isOneWayMopedExempt: boolean; // M2/M3 sign
  isDestinationOnly: boolean; // "Uitgezonderd plaatselijk verkeer"
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RouteInstruction {
  pointIndex: number; // Index in the coordinate array
  distanceFromStart: number; // meters
  instruction: string;
  maneuver: 'TURN_LEFT' | 'TURN_RIGHT' | 'GO_STRAIGHT' | 'ROUNDABOUT' | 'U_TURN' | 'ARRIVE' | 'DEPART' | 'UNKNOWN';
  coordinates: Coordinates;
}

export interface TrafficIncident {
  id: string;
  coordinates: Coordinates;
  type: 'ACCIDENT' | 'FOG' | 'DANGEROUS_CONDITIONS' | 'RAIN' | 'ICE' | 'JAM' | 'LANE_CLOSED' | 'ROAD_CLOSED' | 'UNKNOWN';
  description: string;
  delayInSeconds: number;
  magnitude: number; // 0 (unknown) to 4 (very serious)
}

export interface AutocompleteSuggestion {
  id: string;
  label: string;
  coordinates: Coordinates;
  type?: 'favorite' | 'api'; // Distinguished type for UI
}

export interface SavedRoute {
  id: string;
  name: string;
  start: Coordinates;
  startAddress: string;
  end: Coordinates;
  endAddress: string;
  mopedClass: MopedClass;
  createdAt: number;
}

export interface FavoriteLocation {
  id: string;
  label: string;
  address: string; // The display name
  coordinates: Coordinates;
}

// Global declaration for Leaflet attached to window via CDN
declare global {
  interface Window {
    L: any;
  }
}