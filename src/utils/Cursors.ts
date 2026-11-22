import { ResourceType } from '../types/game';

function svgToCursor(svg: string, hotX = 4, hotY = 4): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg.trim())}") ${hotX} ${hotY}, pointer`;
}

// Stone-headed prehistoric axe cursor
const AXE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <g stroke="#2b1e14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 27 L21 10" stroke="#7c4d2b" stroke-width="4.5"/>
    <path d="M9 27 L21 10" stroke="#a46c3e" stroke-width="2"/>
    <path d="M12 6 C18 4, 24 6, 26 12 C22 14, 17 15, 13 13 Z" fill="#9ca3af"/>
    <path d="M13 7 C17 6, 22 7, 24 11" fill="none" stroke="#e5e7eb" stroke-width="1.4"/>
    <path d="M17 11 L21 14" stroke="#d9a05b" stroke-width="2.2"/>
  </g>
</svg>
`;

// Stone-headed prehistoric pickaxe cursor
const PICKAXE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <g stroke="#2b1e14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8 26 L22 10" stroke="#7c4d2b" stroke-width="4.5"/>
    <path d="M8 26 L22 10" stroke="#a46c3e" stroke-width="2"/>
    <path d="M10 7 Q20 6 27 16 L24 17 Q19 10 11 10 Z" fill="#9ca3af"/>
    <path d="M12 8 Q19 8 24 14" fill="none" stroke="#e5e7eb" stroke-width="1.3"/>
    <circle cx="19" cy="11" r="2.2" fill="#d9a05b"/>
  </g>
</svg>
`;

// Gathering hand cursor
const HAND_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <g stroke="#2b1e14" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M11 16 V9 a2 2 0 0 1 4 0 v5 V7 a2 2 0 0 1 4 0 v7 V9 a2 2 0 0 1 4 0 v6 V12 a1.8 1.8 0 0 1 3.5 0 v7 c0 5-3.5 9-8.5 9 h-2 c-3.5 0-6-2.5-7.5-6 l-2-4.5 a1.9 1.9 0 0 1 3.3-1.8 Z" fill="#f7c8a4"/>
    <circle cx="16" cy="21" r="1.5" fill="#d90429" stroke="none"/>
  </g>
</svg>
`;

// Fishing spear cursor
const FISH_SPEAR_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <g stroke="#2b1e14" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M7 27 L23 9" stroke="#7c4d2b" stroke-width="3.6"/>
    <path d="M7 27 L23 9" stroke="#b07542" stroke-width="1.5"/>
    <path d="M20 9 L27 5 L24 13 Z" fill="#cbd5e1"/>
    <path d="M10 18 Q13 15 15 18 T20 18" fill="none" stroke="#38bdf8" stroke-width="1.6"/>
  </g>
</svg>
`;

// Builder stone mallet cursor
const BUILD_MALLET_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <g stroke="#2b1e14" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8 27 L20 13" stroke="#7c4d2b" stroke-width="4"/>
    <path d="M8 27 L20 13" stroke="#b07542" stroke-width="1.8"/>
    <rect x="13" y="5" width="14" height="9" rx="3" transform="rotate(-35 20 9.5)" fill="#9ca3af"/>
    <path d="M16 10 L21 14" stroke="#e6c29f" stroke-width="2"/>
  </g>
</svg>
`;

// Hunting spear/target cursor
const HUNT_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <g stroke="#2b1e14" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="16" cy="16" r="10" fill="none" stroke="#ef4444" stroke-width="2.2"/>
    <path d="M16 3 V9 M16 23 V29 M3 16 H9 M23 16 H29" stroke="#ef4444" stroke-width="2"/>
    <circle cx="16" cy="16" r="2.6" fill="#fde047" stroke="#b91c1c"/>
  </g>
</svg>
`;

// Workstation artisan hammer & gear cursor
const WORK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <g stroke="#2b1e14" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M7 26 L18 15" stroke="#8b5a2b" stroke-width="4"/>
    <path d="M12 10 L22 6 L26 12 L16 16 Z" fill="#fbbf24"/>
    <circle cx="22" cy="22" r="5" fill="#cbd5e1"/>
    <circle cx="22" cy="22" r="1.8" fill="#475569"/>
  </g>
</svg>
`;

export const CURSORS: Record<
  ResourceType | 'fish' | 'build' | 'hunt' | 'attack' | 'work' | 'blocked' | 'pointer' | 'default',
  string
> = {
  wood: svgToCursor(AXE_SVG, 6, 6),
  stone: svgToCursor(PICKAXE_SVG, 6, 6),
  food: svgToCursor(HAND_SVG, 8, 6),
  bone: svgToCursor(HAND_SVG, 8, 6),
  hide: svgToCursor(HAND_SVG, 8, 6),
  fish: svgToCursor(FISH_SPEAR_SVG, 25, 6),
  build: svgToCursor(BUILD_MALLET_SVG, 6, 6),
  hunt: svgToCursor(HUNT_SVG, 16, 16),
  attack: svgToCursor(HUNT_SVG, 16, 16),
  work: svgToCursor(WORK_SVG, 8, 8),
  blocked: 'not-allowed',
  pointer: 'pointer',
  default: 'default'
};
