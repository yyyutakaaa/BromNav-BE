import React, { useEffect, useRef } from 'react';
import { MopedClass, Coordinates, TrafficIncident } from '../types';

interface MapProps {
  userLocation: Coordinates | null;
  startLocation: Coordinates | null;
  destination: Coordinates | null;
  routeCoordinates: Coordinates[];
  trafficIncidents?: TrafficIncident[];
  mopedClass: MopedClass;
  highContrast: boolean;
  onMapClick: (coords: Coordinates) => void;
  isNavigating: boolean;
  isCameraLocked?: boolean;
  onUnlockCamera?: () => void;
  heading?: number;
}

const MapComponent: React.FC<MapProps> = ({ 
  userLocation, 
  startLocation,
  destination,
  routeCoordinates,
  trafficIncidents = [],
  mopedClass, 
  highContrast,
  onMapClick,
  isNavigating,
  isCameraLocked = false,
  onUnlockCamera,
  heading = 0
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const startMarkerRef = useRef<any>(null); 
  const destinationMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const incidentMarkersRef = useRef<any[]>([]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    if (window.L) {
      const defaultLat = 50.8503;
      const defaultLng = 4.3517;

      const map = window.L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true
      }).setView([defaultLat, defaultLng], 13);

      mapInstanceRef.current = map;

      // Use CartoDB Voyager for a cleaner "Google Maps" look
      const tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      
      window.L.tileLayer(tileUrl, {
        maxZoom: 20,
        attribution: '© OpenStreetMap & CartoDB',
        subdomains: 'abcd'
      }).addTo(map);

      map.on('click', (e: any) => {
        if (!isNavigating) {
            onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      });
      
      // IMPORTANT: Detect dragging start to unlock camera (Intuitive Interaction)
      map.on('dragstart', () => {
         if (isNavigating && isCameraLocked && onUnlockCamera) {
             onUnlockCamera();
         }
      });
    }
  }, []);

  // Handle High Contrast Mode
  useEffect(() => {
    const tiles = document.querySelectorAll('.leaflet-tile-pane');
    if (highContrast) {
      tiles.forEach((el) => {
        (el as HTMLElement).style.filter = 'grayscale(100%) invert(100%) contrast(200%)';
      });
    } else {
      tiles.forEach((el) => {
        (el as HTMLElement).style.filter = 'none';
      });
    }
  }, [highContrast]);

  // Update Real-time User Marker & Rotation Logic
  useEffect(() => {
    if (mapInstanceRef.current && window.L && userLocation) {
      const map = mapInstanceRef.current;

      // 1. Create/Update Marker
      if (!userMarkerRef.current) {
        const icon = window.L.divIcon({
          className: 'gps-marker',
          html: `<div id="user-puck-wrapper">
                    <div id="user-puck" style="transition: transform 0.2s linear; transform-origin: center;"></div>
                 </div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });
        userMarkerRef.current = window.L.marker([userLocation.lat, userLocation.lng], { icon, zIndexOffset: 1000 }).addTo(map);
      } else {
        userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
        
        // Update Icon Content based on Mode
        const puck = document.getElementById('user-puck');
        if (puck) {
             if (isNavigating) {
                 // ARROW for Navigation
                 // We rotate the PUCK to match the heading.
                 // Note: If Map is rotated -heading, Puck should be rotated +heading to point UP relative to screen.
                 // If Map is NOT rotated (unlocked), Puck should be rotated +heading to point Compass Direction.
                 // In both cases, rotating the Puck by `heading` is correct relative to the map's North.
                 puck.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
                             <circle cx="12" cy="12" r="11" fill="white"/>
                             <circle cx="12" cy="12" r="8" fill="#2563eb"/>
                             <path d="M12 5L17 16L12 13L7 16L12 5Z" fill="white"/>
                           </svg>`;
                 puck.style.transform = `rotate(${heading}deg)`;
             } else {
                 // DOT for Overview
                 puck.innerHTML = `<div style="background-color: #3b82f6; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3); margin: 11px;"></div>`;
                 puck.style.transform = 'rotate(0deg)';
             }
        }
      }

      // 2. Camera Locking Logic
      if (isNavigating && isCameraLocked) {
         // Smoothly pan to user
         map.setView([userLocation.lat, userLocation.lng], 18, { animate: false });
      }

    }
  }, [userLocation, isNavigating, isCameraLocked, heading]);

  // Handle Rotation & Interaction States
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const map = mapInstanceRef.current;

    // Detect user interaction on the container level to unlock BEFORE drag starts if possible
    const handleInteraction = () => {
        if (isNavigating && isCameraLocked && onUnlockCamera) {
            onUnlockCamera();
        }
    };
    // We add this to the container to catch touches that might not trigger leaflet drag immediately
    const container = mapContainerRef.current;
    if(container) {
        container.addEventListener('touchstart', handleInteraction, { passive: true });
        container.addEventListener('mousedown', handleInteraction, { passive: true });
    }

    if (isNavigating && isCameraLocked) {
        // LOCKED MODE
        // 1. Disable standard interactions to prevent fighting with the locked view
        map.dragging.disable();
        map.touchZoom.disable();
        map.doubleClickZoom.disable();
        map.scrollWheelZoom.disable();
        
        // 2. Rotate Container
        if (mapContainerRef.current) {
            mapContainerRef.current.style.transform = `rotate(-${heading}deg) scale(1.5)`;
        }
        
    } else {
        // UNLOCKED / OVERVIEW MODE
        // 1. Enable interactions
        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
        map.scrollWheelZoom.enable();

        // 2. Reset Rotation
        if (mapContainerRef.current) {
            mapContainerRef.current.style.transform = `rotate(0deg) scale(1)`;
        }

        // 3. Fit Bounds if just stopped navigating or entering overview
        if (!isNavigating && routeCoordinates.length > 0) {
            const latLngs = routeCoordinates.map(c => [c.lat, c.lng]);
            const bounds = window.L.latLngBounds(latLngs);
            map.fitBounds(bounds, { padding: [50, 50] });
        }
        
        // Fix Leaflet resize issue after transform change
        setTimeout(() => map.invalidateSize(), 350);
    }

    return () => {
        if(container) {
            container.removeEventListener('touchstart', handleInteraction);
            container.removeEventListener('mousedown', handleInteraction);
        }
    }

  }, [isNavigating, isCameraLocked, heading, routeCoordinates]);


  // Update Start/Dest Markers (No logic changes, just ensuring they render)
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const map = mapInstanceRef.current;

    // Start
    if (startLocation) {
        if (!startMarkerRef.current) {
          const color = mopedClass === MopedClass.A ? '#FCD116' : '#EF3340';
          const icon = window.L.divIcon({
            className: 'start-marker',
            html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.4);"></div>`,
            iconSize: [16, 16]
          });
          startMarkerRef.current = window.L.marker([startLocation.lat, startLocation.lng], { icon }).addTo(map);
        } else {
          startMarkerRef.current.setLatLng([startLocation.lat, startLocation.lng]);
        }
    } else if (startMarkerRef.current) {
        map.removeLayer(startMarkerRef.current);
        startMarkerRef.current = null;
    }

    // Destination
    if (destination) {
        if (!destinationMarkerRef.current) {
          const icon = window.L.divIcon({
            className: 'dest-marker',
            html: `<div style="position:relative; width:30px; height:30px;">
                     <div style="position:absolute; bottom:0; left:50%; transform:translateX(-50%); width: 2px; height: 10px; background:black;"></div>
                     <div style="position:absolute; top:0; left:50%; transform:translateX(-50%); background-color: #ef4444; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display:flex; align-items:center; justify-content:center; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
                        <div style="width:8px; height:8px; background:white; border-radius:50%"></div>
                     </div>
                   </div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 30]
          });
          destinationMarkerRef.current = window.L.marker([destination.lat, destination.lng], { icon }).addTo(map);
        } else {
          destinationMarkerRef.current.setLatLng([destination.lat, destination.lng]);
        }
    } else if (destinationMarkerRef.current) {
        map.removeLayer(destinationMarkerRef.current);
        destinationMarkerRef.current = null;
    }
  }, [destination, startLocation, mopedClass]);

  // Draw Route
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const map = mapInstanceRef.current;

    if (routeCoordinates.length > 0) {
        const latLngs = routeCoordinates.map(c => [c.lat, c.lng]);
        
        if (routePolylineRef.current) {
          routePolylineRef.current.setLatLngs(latLngs);
        } else {
          routePolylineRef.current = window.L.polyline(latLngs, {
            color: highContrast ? '#FFFF00' : '#4285F4',
            weight: 8,
            opacity: 1.0,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);
        }
    } else if (routePolylineRef.current) {
        map.removeLayer(routePolylineRef.current);
        routePolylineRef.current = null;
    }
  }, [routeCoordinates, highContrast]);

  // Draw Incidents
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const map = mapInstanceRef.current;

    incidentMarkersRef.current.forEach(m => map.removeLayer(m));
    incidentMarkersRef.current = [];

    trafficIncidents.forEach(inc => {
       if (!inc.coordinates || inc.coordinates.lat === undefined) return;
       const icon = window.L.divIcon({
        className: 'incident-marker',
        html: `<div style="background-color: #fbbf24; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; display:flex; align-items:center; justify-content:center; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">⚠️</div>`,
        iconSize: [20, 20]
      });
      const marker = window.L.marker([inc.coordinates.lat, inc.coordinates.lng], { icon }).addTo(map);
      incidentMarkersRef.current.push(marker);
    });
  }, [trafficIncidents]);

  return (
    <div className="absolute inset-0 z-0 h-full w-full overflow-hidden bg-slate-100">
        {/* Map Container Wrapper for Rotation */}
        <div 
            ref={mapContainerRef} 
            className="absolute bg-slate-100 origin-center"
            style={{
                width: '100%',
                height: '100%',
                transition: 'transform 0.5s ease-out',
                // Initial state
                transform: 'rotate(0deg)'
            }}
        />
        
        {/* Navigation Status Badge */}
        {isNavigating && isCameraLocked && (
            <div className="absolute top-24 right-4 z-[400] bg-white/80 backdrop-blur rounded-lg px-2 py-1 text-[10px] font-bold text-slate-500 shadow border border-slate-200 pointer-events-none">
                LOCKED
            </div>
        )}
    </div>
  );
};

export default MapComponent;