'use client';

import { createContext, useContext } from 'react';

import { PERSONAL_RADAR_SCOPE, type RadarScope } from './scope';

export { radarHrefs, type RadarHrefs } from './scope';

/**
 * Where the Radar on screen lives, for every part of a Radar screen at once
 * (Radar in Spaces, 26 October 2026). The personal screens render no provider
 * and so stay personal; the space's Radar page wraps the same screen in one,
 * and its hooks then call the space routes and its links stay inside the space.
 * A context rather than a prop, because the scope is read six levels down
 * (a scan row's triage menu) by parts that otherwise know nothing about it.
 */
const RadarScopeContext = createContext<RadarScope>(PERSONAL_RADAR_SCOPE);

export function RadarScopeProvider({ scope, children }: { scope: RadarScope; children: React.ReactNode }) {
  return <RadarScopeContext.Provider value={scope}>{children}</RadarScopeContext.Provider>;
}

export function useRadarScope(): RadarScope {
  return useContext(RadarScopeContext);
}
