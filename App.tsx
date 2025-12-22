import React, { useState, useEffect } from 'react';
import MapComponent from './components/MapComponent';
import Controls from './components/Controls';
import { MopedClass, Coordinates, RouteInstruction, TrafficIncident, SavedRoute } from './types';
import { RouteService } from './services/RouteService';
import { StorageService } from './services/StorageService';
import { getRoutingWarnings } from './services/belgianTrafficLogic';

// Helper to calculate distance between two coords (Haversine)
const getDistance = (c1: Coordinates, c2: Coordinates) => {
  const R = 6371e3; // metres
  const φ1 = c1.lat * Math.PI/180;
  const φ2 = c2.lat * Math.PI/180;
  const Δφ = (c2.lat-c1.lat) * Math.PI/180;
  const Δλ = (c2.lng-c1.lng) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};

// Helper to calculate bearing (heading) between two coords
const getBearing = (start: Coordinates, end: Coordinates) => {
  const startLat = start.lat * Math.PI / 180;
  const startLng = start.lng * Math.PI / 180;
  const endLat = end.lat * Math.PI / 180;
  const endLng = end.lng * Math.PI / 180;

  const y = Math.sin(endLng - startLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) -
            Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
            
  const θ = Math.atan2(y, x);
  const brng = (θ * 180 / Math.PI + 360) % 360; // in degrees
  return brng;
};

function App() {
  const [mopedClass, setMopedClass] = useState<MopedClass>(MopedClass.B);
  const [highContrast, setHighContrast] = useState<boolean>(false);
  
  // Locations
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [manualStartLocation, setManualStartLocation] = useState<Coordinates | null>(null);
  const [destination, setDestination] = useState<Coordinates | null>(null);
  
  // Addresses
  const [startAddress, setStartAddress] = useState<string>("");
  const [endAddress, setEndAddress] = useState<string>("");

  // Route Data
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinates[]>([]);
  const [instructions, setInstructions] = useState<RouteInstruction[]>([]);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [trafficIncidents, setTrafficIncidents] = useState<TrafficIncident[]>([]);
  
  // Navigation State
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [isCameraLocked, setIsCameraLocked] = useState<boolean>(false);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0); // km/h
  const [nextInstruction, setNextInstruction] = useState<RouteInstruction | null>(null);
  const [distanceToNext, setDistanceToNext] = useState<number>(0);
  const [etaSeconds, setEtaSeconds] = useState<number>(0);
  const [currentHeading, setCurrentHeading] = useState<number>(0);

  // UX State
  const [activeWarning, setActiveWarning] = useState<string | null>(null);
  const [routeProvider, setRouteProvider] = useState<'tomtom' | 'osrm' | null>(null);

  // 1. Initial Geolocation & Speed Tracking
  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newLoc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(newLoc);
          
          if (position.coords.speed !== null) {
            setCurrentSpeed(Math.round(position.coords.speed * 3.6));
          } else {
            setCurrentSpeed(0);
          }
        },
        (error) => {
          console.warn(`Geolocation Error: ${error.message}`);
          setUserLocation(prev => {
             if (!prev) return { lat: 50.8466, lng: 4.3528 }; // Default to Brussels
             return prev;
          });
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      console.warn("Geolocation not supported by this browser.");
      setUserLocation({ lat: 50.8466, lng: 4.3528 });
    }
  }, []);

  // 2. Parse URL Parameters for Sharing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slat = params.get('slat');
    const slng = params.get('slng');
    const elat = params.get('elat');
    const elng = params.get('elng');
    const cls = params.get('cls');
    const saddr = params.get('saddr');
    const eaddr = params.get('eaddr');

    if (slat && slng && elat && elng) {
        // Hydrate from URL
        const start = { lat: parseFloat(slat), lng: parseFloat(slng) };
        const end = { lat: parseFloat(elat), lng: parseFloat(elng) };
        
        setManualStartLocation(start);
        setDestination(end);
        if (saddr) setStartAddress(saddr);
        if (eaddr) setEndAddress(eaddr);
        if (cls === 'A') setMopedClass(MopedClass.A);
        else setMopedClass(MopedClass.B);

        // Auto calculate
        setTimeout(() => {
             calculateRoute(start, end, cls === 'A' ? MopedClass.A : MopedClass.B);
        }, 500);
        
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    setActiveWarning(getRoutingWarnings(mopedClass));
  }, [mopedClass]);

  const calculateRoute = async (start: Coordinates, end: Coordinates, overrideClass?: MopedClass) => {
    setIsCalculating(true);
    setRouteProvider(null);
    setRouteCoordinates([]);
    setInstructions([]);
    setTrafficIncidents([]);
    
    const cls = overrideClass || mopedClass;

    try {
      const result = await RouteService.calculateRoute(start, end, cls);
      
      if (result) {
        setRouteCoordinates(result.coordinates);
        setInstructions(result.instructions);
        setRouteProvider(result.provider);
        setTotalDuration(result.duration);
        setEtaSeconds(result.duration);

        if (result.provider === 'tomtom') {
           const incidents = await RouteService.getTrafficIncidents(result.coordinates);
           setTrafficIncidents(incidents);
        }
      } else {
        alert("Geen route gevonden.");
      }
    } catch (error) {
      console.error("Failed", error);
      alert("Kon route niet berekenen.");
    } finally {
      setIsCalculating(false);
    }
  };

  const updateNavigationState = (currentIndex: number, currentPos: Coordinates) => {
    if (!instructions.length || !routeCoordinates.length) return;

    const progress = currentIndex / routeCoordinates.length;
    const remaining = totalDuration * (1 - progress);
    setEtaSeconds(Math.round(remaining));

    const next = instructions.find(i => i.pointIndex > currentIndex);
    
    const lookAheadIndex = Math.min(currentIndex + 3, routeCoordinates.length - 1);
    const lookAheadPoint = routeCoordinates[lookAheadIndex];
    if (lookAheadPoint) {
        const bearing = getBearing(currentPos, lookAheadPoint);
        setCurrentHeading(bearing);
    }

    if (next) {
      setNextInstruction(next);
      const dist = getDistance(currentPos, next.coordinates);
      setDistanceToNext(Math.round(dist));
    } else {
      setNextInstruction({
        pointIndex: 99999,
        distanceFromStart: 0,
        instruction: "Bestemming bereikt",
        maneuver: 'ARRIVE',
        coordinates: routeCoordinates[routeCoordinates.length - 1]
      });
      setDistanceToNext(0);
    }
  };

  useEffect(() => {
    if (isNavigating && userLocation && routeCoordinates.length > 0) {
      let minDist = Infinity;
      let closestIndex = 0;
      
      for(let i = 0; i < routeCoordinates.length; i += 2) { 
        const d = getDistance(userLocation, routeCoordinates[i]);
        if (d < minDist) {
           minDist = d;
           closestIndex = i;
        }
      }
      
      updateNavigationState(closestIndex, userLocation);
    }
  }, [userLocation, isNavigating, routeCoordinates]);

  const handleAddressSearch = async () => {
    setIsCalculating(true);
    let effectiveStart = manualStartLocation || userLocation;
    
    if (startAddress && startAddress.toLowerCase() !== "huidige locatie" && startAddress.trim() !== "") {
       const startCoords = await RouteService.geocode(startAddress);
       if (startCoords) {
         setManualStartLocation(startCoords);
         effectiveStart = startCoords;
       }
    } else {
       setManualStartLocation(null);
       effectiveStart = userLocation;
    }

    let effectiveEnd = destination;
    if (endAddress && endAddress.trim() !== "") {
      const endCoords = await RouteService.geocode(endAddress);
      if (endCoords) {
        setDestination(endCoords);
        effectiveEnd = endCoords;
      }
    }

    if (effectiveStart && effectiveEnd) {
      await calculateRoute(effectiveStart, effectiveEnd);
    } else {
      setIsCalculating(false);
    }
  };

  const handleSelectSuggestion = async (type: 'start' | 'end', coords: Coordinates, addressLabel: string) => {
      if (type === 'start') {
          setManualStartLocation(coords);
          setStartAddress(addressLabel);
      } else {
          setDestination(coords);
          setEndAddress(addressLabel);
      }
  };

  const handleMapClick = (coords: Coordinates) => {
    if (!isNavigating) {
      setDestination(coords);
      setEndAddress("Kaartlocatie");
      const effectiveStart = manualStartLocation || userLocation;
      if (effectiveStart) calculateRoute(effectiveStart, coords);
    }
  };

  useEffect(() => {
    const effectiveStart = manualStartLocation || userLocation;
    if (effectiveStart && destination) calculateRoute(effectiveStart, destination);
  }, [mopedClass]);

  const handleStartNavigation = () => {
    if (routeCoordinates.length > 0) {
      setIsNavigating(true);
      setIsCameraLocked(true); 
      if (userLocation) {
         updateNavigationState(0, userLocation);
      }
    }
  };

  const handleCancelNavigation = () => {
    setIsNavigating(false);
    setIsCameraLocked(false);
    setDestination(null);
    setManualStartLocation(null);
    setStartAddress("");
    setEndAddress("");
    setRouteCoordinates([]);
    setRouteProvider(null);
    setInstructions([]);
    setTrafficIncidents([]);
    setCurrentHeading(0);
  };

  // --- SAVE & SHARE HANDLERS ---

  const handleSaveRoute = () => {
     if (!destination) return;
     const start = manualStartLocation || userLocation;
     if (!start) return;

     const name = prompt("Geef deze route een naam:", `${startAddress || 'Start'} naar ${endAddress}`);
     if (name) {
        StorageService.saveRoute({
            name,
            start,
            startAddress: startAddress || "Huidige locatie",
            end: destination,
            endAddress,
            mopedClass
        });
        alert("Route opgeslagen!");
     }
  };

  const handleShareRoute = () => {
      if (!destination) return;
      const start = manualStartLocation || userLocation;
      if (!start) return;

      const url = StorageService.generateShareUrl(start, destination, mopedClass, startAddress, endAddress);
      navigator.clipboard.writeText(url).then(() => {
          alert("Link gekopieerd naar klembord!");
      });
  };

  const handleLoadSavedRoute = (route: SavedRoute) => {
      setManualStartLocation(route.start);
      setDestination(route.end);
      setStartAddress(route.startAddress);
      setEndAddress(route.endAddress);
      setMopedClass(route.mopedClass);
      
      // Slight delay to allow state updates
      setTimeout(() => {
          calculateRoute(route.start, route.end, route.mopedClass);
      }, 100);
  };

  const displayStartLocation = manualStartLocation || userLocation;

  return (
    <div className={`h-screen w-screen relative overflow-hidden ${highContrast ? 'grayscale contrast-125' : ''}`}>
      
      {!isNavigating && (
        <div className="absolute top-0 left-0 right-0 z-40 p-4 pointer-events-none flex flex-col items-start gap-2">
            <div className="flex justify-between w-full items-center">
                <div className={`inline-block px-4 py-2 rounded-full font-mono text-sm font-bold shadow-lg backdrop-blur-md ${
                mopedClass === MopedClass.A 
                    ? 'bg-yellow-400/90 text-black border border-white/20' 
                    : 'bg-red-600/90 text-white border border-white/20'
                }`}>
                {mopedClass === MopedClass.A ? 'Klasse A (25)' : 'Klasse B (45)'}
                </div>
                {routeProvider && (
                    <div className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shadow border bg-slate-500 text-white border-slate-400 flex flex-col items-end">
                      <span>{routeProvider === 'tomtom' ? 'Live Traffic' : 'Basic Maps'}</span>
                      {trafficIncidents.length > 0 && <span className="text-yellow-300">{trafficIncidents.length} Incidenten</span>}
                    </div>
                )}
            </div>
            {activeWarning && (
            <div className="bg-slate-800/90 backdrop-blur text-blue-200 text-xs px-3 py-2 rounded-xl border border-blue-500/30 shadow-lg max-w-[80%] animate-fade-in-down">
                ℹ️ {activeWarning}
            </div>
            )}
        </div>
      )}
      
      {isNavigating && !isCameraLocked && (
         <div className="absolute top-24 right-4 z-[60]">
            <button 
              onClick={() => setIsCameraLocked(true)}
              className="bg-white text-blue-600 font-bold px-4 py-3 rounded-full shadow-xl border border-blue-100 flex items-center gap-2 animate-bounce-in"
            >
              <span>📍</span> Hercenteren
            </button>
         </div>
      )}

      <MapComponent 
        userLocation={userLocation} 
        startLocation={displayStartLocation} 
        destination={destination}
        routeCoordinates={routeCoordinates}
        trafficIncidents={trafficIncidents}
        mopedClass={mopedClass}
        highContrast={highContrast}
        onMapClick={handleMapClick}
        isNavigating={isNavigating}
        isCameraLocked={isCameraLocked}
        onUnlockCamera={() => setIsCameraLocked(false)}
        heading={currentHeading}
      />

      <Controls 
        mopedClass={mopedClass} 
        setMopedClass={setMopedClass}
        highContrast={highContrast}
        setHighContrast={setHighContrast}
        
        startAddress={startAddress}
        setStartAddress={setStartAddress}
        endAddress={endAddress}
        setEndAddress={setEndAddress}
        onSearchAddresses={handleAddressSearch}
        onSelectSuggestion={handleSelectSuggestion}

        startNavigation={handleStartNavigation}
        cancelNavigation={handleCancelNavigation}
        
        onSaveRoute={handleSaveRoute}
        onShareRoute={handleShareRoute}
        onLoadRoute={handleLoadSavedRoute}

        isNavigating={isNavigating}
        hasDestination={!!destination && routeCoordinates.length > 0}
        isCalculating={isCalculating}
        
        currentSpeed={currentSpeed}
        nextInstruction={nextInstruction}
        distanceToNext={distanceToNext}
        etaSeconds={etaSeconds}
      />
    </div>
  );
}

export default App;