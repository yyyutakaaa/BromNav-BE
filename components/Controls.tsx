import React, { useState, useEffect } from 'react';
import { MopedClass, RouteInstruction, AutocompleteSuggestion, Coordinates, SavedRoute } from '../types';
import { RouteService } from '../services/RouteService';
import { StorageService } from '../services/StorageService';

interface ControlsProps {
  mopedClass: MopedClass;
  setMopedClass: (c: MopedClass) => void;
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
  
  startAddress: string;
  setStartAddress: React.Dispatch<React.SetStateAction<string>>;
  endAddress: string;
  setEndAddress: React.Dispatch<React.SetStateAction<string>>;
  onSearchAddresses: () => void;
  onSelectSuggestion: (type: 'start' | 'end', coords: Coordinates, label: string) => void;

  startNavigation: () => void;
  cancelNavigation: () => void;
  
  onSaveRoute: () => void;
  onShareRoute: () => void;
  onLoadRoute: (route: SavedRoute) => void;

  isNavigating: boolean;
  hasDestination: boolean;
  isCalculating: boolean;

  // Nav Data
  currentSpeed?: number;
  nextInstruction?: RouteInstruction | null;
  distanceToNext?: number;
  etaSeconds?: number;
}

const formatTime = (seconds: number) => {
  if (seconds < 60) return '< 1 min';
  const min = Math.floor(seconds / 60);
  if (min > 60) {
      const hrs = Math.floor(min / 60);
      const m = min % 60;
      return `${hrs} u ${m} min`;
  }
  return `${min} min`;
};

const formatArrivalTime = (seconds: number) => {
  const now = new Date();
  const arrival = new Date(now.getTime() + seconds * 1000);
  const hours = arrival.getHours().toString().padStart(2, '0');
  const minutes = arrival.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Icon Component helper
const ManeuverIcon = ({ type, className }: { type: string, className?: string }) => {
  const props = { className: className || "w-12 h-12 text-white", fill: "currentColor", viewBox: "0 0 24 24" };
  
  switch (type) {
    case 'TURN_LEFT':
      return <svg {...props}><path d="M15 4l-8 8 8 8V4z" transform="rotate(90, 12, 12)" /><path d="M9 19h6v-8a4 4 0 00-4-4H5" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/></svg>;
    case 'TURN_RIGHT':
        return <svg {...props} viewBox="0 0 24 24"><path d="M5 19h6v-8a4 4 0 014-4h6" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/><path d="M17 3l4 4-4 4" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/></svg>;
    case 'GO_STRAIGHT':
      return <svg {...props}><path d="M12 4V20M8 8l4-4 4 4" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    case 'ROUNDABOUT':
      return <svg {...props}><path d="M12 2a10 10 0 1010 10A10 10 0 0012 2zm0 18a8 8 0 118-8 8 8 0 01-8 8z" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
    case 'U_TURN':
        return <svg {...props}><path d="M4 10v4a6 6 0 0012 0V8a2 2 0 00-4 0v2" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/><path d="M15 5l-3 3 3 3" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/></svg>;
    case 'ARRIVE':
        return <svg {...props}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>;
    default:
      return <svg {...props}><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M12 6v6l4 4" stroke="currentColor" strokeWidth="2"/></svg>;
  }
};

const Controls: React.FC<ControlsProps> = ({ 
  mopedClass, 
  setMopedClass, 
  highContrast, 
  setHighContrast,
  startAddress,
  setStartAddress,
  endAddress,
  setEndAddress,
  onSearchAddresses,
  onSelectSuggestion,
  startNavigation,
  cancelNavigation,
  onSaveRoute,
  onShareRoute,
  onLoadRoute,
  isNavigating,
  hasDestination,
  isCalculating,
  currentSpeed = 0,
  nextInstruction,
  distanceToNext = 0,
  etaSeconds = 0
}) => {
  
  const [startSuggestions, setStartSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [endSuggestions, setEndSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showSavedRoutes, setShowSavedRoutes] = useState(false);
  const [savedRoutesList, setSavedRoutesList] = useState<SavedRoute[]>([]);

  // Helpers for favorites
  const handleFavoriteToggle = (address: string, coords: Coordinates | null, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!address) return;
      
      const exists = StorageService.isFavorite(address);

      if (exists) {
          StorageService.removeFavorite(address);
      } else {
          if (!coords) return; // Cannot add without coords
          StorageService.addFavorite({
              label: address.split(',')[0],
              address: address,
              coordinates: coords
          });
      }
      setStartAddress(prev => prev + " "); 
      setTimeout(() => setStartAddress(prev => prev.trim()), 10);
  };

  const isStartFav = StorageService.isFavorite(startAddress);
  const isEndFav = StorageService.isFavorite(endAddress);

  // Debounce logic for Start Address
  useEffect(() => {
    const timer = setTimeout(async () => {
        if (startAddress.length > 2 && startAddress !== 'Huidige locatie') {
            const results = await RouteService.getSearchSuggestions(startAddress);
            const favs = StorageService.getFavorites();
            const matchedFavs = favs.filter(f => f.address.toLowerCase().includes(startAddress.toLowerCase()));
            
            const favSuggestions: AutocompleteSuggestion[] = matchedFavs.map(f => ({
                id: f.id, label: f.address, coordinates: f.coordinates, type: 'favorite'
            }));

            setStartSuggestions([...favSuggestions, ...results]);
        } else if (startAddress.length === 0) {
            const favs = StorageService.getFavorites();
             const favSuggestions: AutocompleteSuggestion[] = favs.map(f => ({
                id: f.id, label: f.address, coordinates: f.coordinates, type: 'favorite'
            }));
            setStartSuggestions(favSuggestions);
        } else {
            setStartSuggestions([]);
        }
    }, 300);
    return () => clearTimeout(timer);
  }, [startAddress]);

  // Debounce logic for End Address
  useEffect(() => {
    const timer = setTimeout(async () => {
        if (endAddress.length > 2) {
            const results = await RouteService.getSearchSuggestions(endAddress);
             const favs = StorageService.getFavorites();
            const matchedFavs = favs.filter(f => f.address.toLowerCase().includes(endAddress.toLowerCase()));
            
            const favSuggestions: AutocompleteSuggestion[] = matchedFavs.map(f => ({
                id: f.id, label: f.address, coordinates: f.coordinates, type: 'favorite'
            }));

            setEndSuggestions([...favSuggestions, ...results]);
        } else if (endAddress.length === 0) {
            const favs = StorageService.getFavorites();
             const favSuggestions: AutocompleteSuggestion[] = favs.map(f => ({
                id: f.id, label: f.address, coordinates: f.coordinates, type: 'favorite'
            }));
            setEndSuggestions(favSuggestions);
        } else {
            setEndSuggestions([]);
        }
    }, 300);
    return () => clearTimeout(timer);
  }, [endAddress]);

  useEffect(() => {
      if (showSavedRoutes) {
          setSavedRoutesList(StorageService.getSavedRoutes());
      }
  }, [showSavedRoutes]);


  const containerClass = highContrast 
    ? "bg-black border-t-4 border-yellow-400" 
    : "bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]";
  
  const textClass = highContrast ? "text-yellow-400 font-bold" : "text-slate-800 font-semibold";
  const inputClass = highContrast
    ? "bg-slate-900 border-2 border-yellow-400 text-yellow-400 placeholder-yellow-400/50"
    : "bg-slate-50 border border-slate-300 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500";
  
  // Compacted button base
  const buttonBase = "flex-1 py-2 text-sm font-bold rounded-lg transition-all active:scale-95 touch-manipulation";
  
  const activeBtnA = highContrast 
    ? "bg-yellow-400 text-black border-2 border-white" 
    : "bg-yellow-400 text-slate-900 shadow-sm ring-1 ring-yellow-400";
  const inactiveBtn = highContrast 
    ? "bg-slate-900 text-gray-400 border border-gray-600" 
    : "bg-slate-100 text-slate-400 hover:bg-slate-200";
  const activeBtnB = highContrast
    ? "bg-red-600 text-white border-2 border-white"
    : "bg-red-500 text-white shadow-sm ring-1 ring-red-500";

  // --- NAVIGATION HUD MODE ---
  if (isNavigating) {
    const bgColor = highContrast ? "bg-black" : "bg-slate-900";
    const accentColor = mopedClass === 'A' ? 'text-yellow-400' : 'text-red-500';

    return (
      <>
        {/* Top HUD: Instruction */}
        <div className={`fixed top-0 left-0 right-0 z-50 p-4 m-2 rounded-2xl shadow-2xl flex items-center gap-4 ${bgColor} text-white border border-slate-700`}>
           <div className={`p-3 rounded-xl ${mopedClass === 'A' ? 'bg-yellow-500 text-black' : 'bg-red-600 text-white'}`}>
             <ManeuverIcon type={nextInstruction?.maneuver || 'GO_STRAIGHT'} className="w-10 h-10" />
           </div>
           <div className="flex-1 overflow-hidden">
             <div className="text-4xl font-black tracking-tight">{distanceToNext} <span className="text-xl font-medium text-slate-400">m</span></div>
             <div className="text-lg font-bold leading-tight truncate">{nextInstruction?.instruction || "Volg de route"}</div>
           </div>
        </div>

        {/* Bottom HUD: Speed & Controls */}
        <div className={`fixed bottom-0 left-0 right-0 z-50 pb-8 pt-6 px-4 rounded-t-3xl ${bgColor} border-t border-slate-700 shadow-2xl flex flex-col gap-4`}>
          
          <div className="flex justify-between items-end">
             {/* Speedometer */}
             <div className="flex flex-col">
                <div className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-1">Snelheid</div>
                <div className="flex items-baseline gap-1">
                   <span className={`text-6xl font-black ${accentColor}`}>{currentSpeed}</span>
                   <span className="text-xl font-medium text-slate-500">km/u</span>
                </div>
             </div>

             {/* Arrival Time + ETA */}
             <div className="flex flex-col items-end">
                <div className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-1">Aankomst</div>
                <div className="text-4xl font-black text-white leading-none tracking-tight">
                    {formatArrivalTime(etaSeconds || 0)}
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-base font-bold text-slate-400">{formatTime(etaSeconds || 0)}</span>
                </div>
             </div>
          </div>

          <button
             onClick={cancelNavigation} 
             className="w-full bg-slate-800 text-slate-200 py-3 rounded-xl font-bold uppercase tracking-wider shadow-lg border border-slate-600 hover:bg-slate-700 active:scale-95 transition-all"
          >
            Stop Navigatie
          </button>
        </div>
      </>
    );
  }

  // --- SAVED ROUTES MODAL ---
  if (showSavedRoutes) {
      return (
          <div className={`fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur flex items-end sm:items-center justify-center p-4`}>
              <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                      <h3 className="font-bold text-lg dark:text-white">Opgeslagen Routes</h3>
                      <button onClick={() => setShowSavedRoutes(false)} className="text-slate-500 hover:text-slate-700 p-2">✕</button>
                  </div>
                  <div className="overflow-y-auto p-2 space-y-2 flex-1">
                      {savedRoutesList.length === 0 ? (
                          <div className="text-center p-8 text-slate-400">Nog geen opgeslagen routes.</div>
                      ) : (
                          savedRoutesList.map(route => (
                              <div key={route.id} onClick={() => { onLoadRoute(route); setShowSavedRoutes(false); }} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-slate-600 cursor-pointer border border-slate-200 dark:border-slate-600 transition-colors">
                                  <div className="flex justify-between items-start mb-1">
                                      <span className="font-bold text-slate-800 dark:text-white text-sm">{route.name}</span>
                                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${route.mopedClass === 'A' ? 'bg-yellow-200 text-yellow-800' : 'bg-red-200 text-red-800'}`}>
                                          Kl. {route.mopedClass}
                                      </span>
                                  </div>
                                  <div className="text-xs text-slate-500 truncate">Van: {route.startAddress}</div>
                                  <div className="text-xs text-slate-500 truncate">Naar: {route.endAddress}</div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      );
  }

  // --- PLANNING MODE (COMPACTED FOR MOBILE) ---
  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 p-3 pb-6 rounded-t-3xl transition-colors duration-300 ${containerClass} max-h-[80vh] overflow-y-auto`}>
      
      {/* Handle bar */}
      <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-3 opacity-50"></div>

        <div className="space-y-3">
          
          {/* Top Row: Title/HC toggle */}
          <div className="flex justify-between items-center">
            {/* Logo & App Name */}
            <div className="flex items-center gap-2">
                <img src="/logo.png" alt="BromNav" className="w-7 h-7 object-contain drop-shadow-sm" onError={(e) => e.currentTarget.style.display = 'none'} />
                <h2 className={`text-base ${textClass}`}>BromNav</h2>
            </div>

            <div className="flex gap-2">
                <button 
                  onClick={() => setShowSavedRoutes(true)}
                  className="px-2 py-1 rounded text-[10px] font-bold border border-slate-300 text-slate-600 bg-slate-100"
                >
                  Routes
                </button>
                <button 
                  onClick={() => setHighContrast(!highContrast)}
                  className={`px-2 py-1 rounded text-[10px] font-bold border ${highContrast ? 'border-yellow-400 text-yellow-400' : 'border-slate-300 text-slate-600'}`}
                >
                  {highContrast ? 'HC' : 'Contrast'}
                </button>
            </div>
          </div>

          {/* Address Inputs */}
          <div className="space-y-2">
            
            {/* Start Input & Suggestions */}
            <div className="relative">
              <div className="absolute left-3 top-3 w-2.5 h-2.5 rounded-full border-2 border-slate-400"></div>
              <input 
                type="text" 
                value={startAddress}
                onChange={(e) => setStartAddress(e.target.value)}
                onFocus={() => { if(startAddress === "") setStartAddress(""); }}
                placeholder="Huidige locatie"
                className={`w-full p-2.5 pl-8 pr-9 rounded-lg text-sm outline-none ${inputClass}`}
              />
              {/* Favorite Toggle Star */}
              {startAddress && startAddress !== 'Huidige locatie' && (
                  <button 
                    onClick={(e) => handleFavoriteToggle(startAddress, null, e)}
                    className={`absolute right-3 top-2.5 ${isStartFav ? 'text-yellow-500' : 'text-slate-300 hover:text-slate-400'}`}
                  >
                    ★
                  </button>
              )}

              {startSuggestions.length > 0 && (
                  <ul className="absolute z-50 bottom-full left-0 right-0 mb-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-600 overflow-hidden max-h-52 overflow-y-auto">
                      {startSuggestions.map((s, idx) => (
                          <li 
                            key={s.id + idx}
                            onClick={() => {
                                onSelectSuggestion('start', s.coordinates, s.label);
                                setStartSuggestions([]);
                            }}
                            className="px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0 text-xs truncate text-slate-700 dark:text-slate-200 flex items-center justify-between"
                          >
                              <span>{s.label}</span>
                              {s.type === 'favorite' && <span className="text-yellow-500 text-xs">★</span>}
                          </li>
                      ))}
                  </ul>
              )}
            </div>

            {/* End Input & Suggestions */}
            <div className="relative">
              <div className="absolute left-3 top-3">
                <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"/></svg>
              </div>
              <input 
                type="text" 
                value={endAddress}
                onChange={(e) => setEndAddress(e.target.value)}
                onFocus={() => { if(endAddress === "") setEndAddress(""); }}
                onKeyDown={(e) => e.key === 'Enter' && onSearchAddresses()}
                placeholder="Waarheen?"
                className={`w-full p-2.5 pl-8 pr-9 rounded-lg text-sm outline-none ${inputClass}`}
              />
              {endAddress && (
                  <button 
                    onClick={(e) => handleFavoriteToggle(endAddress, null, e)}
                    className={`absolute right-3 top-2.5 ${isEndFav ? 'text-yellow-500' : 'text-slate-300 hover:text-slate-400'}`}
                  >
                    ★
                  </button>
              )}

              {endSuggestions.length > 0 && (
                  <ul className="absolute z-50 bottom-full left-0 right-0 mb-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-600 overflow-hidden max-h-52 overflow-y-auto">
                      {endSuggestions.map((s, idx) => (
                          <li 
                            key={s.id + idx}
                            onClick={() => {
                                onSelectSuggestion('end', s.coordinates, s.label);
                                setEndSuggestions([]);
                            }}
                            className="px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0 text-xs truncate text-slate-700 dark:text-slate-200 flex items-center justify-between"
                          >
                              <span>{s.label}</span>
                              {s.type === 'favorite' && <span className="text-yellow-500 text-xs">★</span>}
                          </li>
                      ))}
                  </ul>
              )}
            </div>
          </div>

           {/* Search Button */}
           <button 
              onClick={onSearchAddresses}
              disabled={isCalculating}
              className={`w-full py-2 rounded-lg font-bold text-xs uppercase tracking-wide ${
                highContrast ? 'bg-slate-800 text-white' : 'bg-blue-600 text-white shadow-md'
              }`}
            >
              {isCalculating ? 'Zoeken...' : 'Adres zoeken'}
            </button>

          {/* Class Toggle */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setMopedClass(MopedClass.A)}
              className={`${buttonBase} ${mopedClass === MopedClass.A ? activeBtnA : inactiveBtn}`}
            >
              Kl. A (25)
            </button>
            <button
              onClick={() => setMopedClass(MopedClass.B)}
              className={`${buttonBase} ${mopedClass === MopedClass.B ? activeBtnB : inactiveBtn}`}
            >
              Kl. B (45)
            </button>
          </div>

          {/* Action Button Area */}
          {hasDestination && (
            <div className="flex flex-col gap-2 mt-2">
                {/* Save/Share Row - Using SVGs */}
                <div className="flex gap-2">
                    <button onClick={onSaveRoute} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors">
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3M16 5v4a1 1 0 01-1 1H9a1 1 0 01-1-1V5" /></svg>
                       <span>Opslaan</span>
                    </button>
                    <button onClick={onShareRoute} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors">
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                       <span>Delen</span>
                    </button>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={cancelNavigation}
                        className={`px-3 py-3 rounded-lg font-bold uppercase ${
                        highContrast 
                            ? "bg-slate-900 text-white border border-gray-600" 
                            : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                        }`}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    
                    <button
                        onClick={startNavigation}
                        disabled={isCalculating}
                        className={`flex-1 py-3 rounded-lg text-base font-bold uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 ${
                        highContrast 
                            ? "bg-white text-black border-4 border-black" 
                            : "bg-slate-900 text-white hover:bg-slate-800"
                        }`}
                    >
                        <span>Start Navigatie</span>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                    </button>
                </div>
            </div>
          )}
        </div>
    </div>
  );
};

export default Controls;