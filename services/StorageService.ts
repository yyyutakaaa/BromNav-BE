import { SavedRoute, FavoriteLocation, Coordinates, MopedClass } from '../types';

const ROUTES_KEY = 'bromnav_saved_routes';
const FAVORITES_KEY = 'bromnav_favorites';

export const StorageService = {
  // --- SAVED ROUTES ---
  getSavedRoutes: (): SavedRoute[] => {
    try {
      const stored = localStorage.getItem(ROUTES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Error reading saved routes", e);
      return [];
    }
  },

  saveRoute: (route: Omit<SavedRoute, 'id' | 'createdAt'>): SavedRoute => {
    const routes = StorageService.getSavedRoutes();
    const newRoute: SavedRoute = {
      ...route,
      id: crypto.randomUUID(),
      createdAt: Date.now()
    };
    const updated = [newRoute, ...routes];
    localStorage.setItem(ROUTES_KEY, JSON.stringify(updated));
    return newRoute;
  },

  deleteRoute: (id: string) => {
    const routes = StorageService.getSavedRoutes();
    const updated = routes.filter(r => r.id !== id);
    localStorage.setItem(ROUTES_KEY, JSON.stringify(updated));
  },

  // --- FAVORITES ---
  getFavorites: (): FavoriteLocation[] => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Error reading favorites", e);
      return [];
    }
  },

  isFavorite: (address: string): boolean => {
      const favs = StorageService.getFavorites();
      return favs.some(f => f.address === address);
  },

  addFavorite: (location: Omit<FavoriteLocation, 'id'>) => {
    const favs = StorageService.getFavorites();
    // Avoid duplicates by address
    if (favs.some(f => f.address === location.address)) return;
    
    const newFav: FavoriteLocation = {
      ...location,
      id: crypto.randomUUID()
    };
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([newFav, ...favs]));
  },

  removeFavorite: (address: string) => {
    const favs = StorageService.getFavorites();
    const updated = favs.filter(f => f.address !== address);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  },

  // --- SHARING ---
  generateShareUrl: (start: Coordinates, end: Coordinates, mopedClass: MopedClass, startAddr?: string, endAddr?: string) => {
    const params = new URLSearchParams();
    params.set('slat', start.lat.toString());
    params.set('slng', start.lng.toString());
    params.set('elat', end.lat.toString());
    params.set('elng', end.lng.toString());
    params.set('cls', mopedClass);
    if (startAddr) params.set('saddr', startAddr);
    if (endAddr) params.set('eaddr', endAddr);
    
    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }
};