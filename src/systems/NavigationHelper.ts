import type { River } from '../entities/River';
import { ObstacleCircle } from '../types/game';

export interface NavigationAgentState {
  avoidSideSign: 1 | -1;
  waypoints: Array<{ x: number; y: number }>;
  repathCooldownMs: number;
  lastGoalX: number;
  lastGoalY: number;
  stuckTimerMs: number;
  stuckAnchorX: number;
  stuckAnchorY: number;
  stuckCount: number;
}

export function createNavAgentState(x: number, y: number, seed = 0): NavigationAgentState {
  return {
    avoidSideSign: seed % 2 === 0 ? 1 : -1,
    waypoints: [],
    repathCooldownMs: 0,
    lastGoalX: x,
    lastGoalY: y,
    stuckTimerMs: 0,
    stuckAnchorX: x,
    stuckAnchorY: y,
    stuckCount: 0,
  };
}

export function resetNavAgentState(nav: NavigationAgentState, x: number, y: number): void {
  nav.waypoints = [];
  nav.stuckTimerMs = 0;
  nav.stuckAnchorX = x;
  nav.stuckAnchorY = y;
  nav.stuckCount = 0;
}

export function resolveRiverCrossingGoal(
  x: number,
  y: number,
  tx: number,
  ty: number,
  river: River | null | undefined
): { x: number; y: number; viaCrossing: boolean } {
  if (!river || !river.segmentCrossesBlockedRiver(x, y, tx, ty)) {
    return { x: tx, y: ty, viaCrossing: false };
  }

  const crossings = river.getCrossings();
  if (crossings.length === 0) {
    return { x: tx, y: ty, viaCrossing: false };
  }

  let best: { x: number; y: number; radius: number } | null = null;
  let bestScore = Infinity;

  for (const c of crossings) {
    const dHere = Math.hypot(x - c.x, y - c.y);
    // Already standing right on this crossing: proceed onward toward next segment/target
    if (dHere <= Math.max(42, c.radius * 0.5)) {
      continue;
    }
    const dToTarget = Math.hypot(c.x - tx, c.y - ty);
    const kindWeight = c.kind === 'bridge' ? 0.94 : 1.0;
    const score = (dHere + dToTarget) * kindWeight;
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }

  if (best) {
    return { x: best.x, y: best.y, viaCrossing: true };
  }
  return { x: tx, y: ty, viaCrossing: false };
}

function isPointBlocked(
  px: number,
  py: number,
  obstacles: ObstacleCircle[],
  pad: number,
  ignoreOwner?: object
): boolean {
  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    if (ignoreOwner && obs.owner === ignoreOwner) continue;
    const dx = px - obs.x;
    const dy = py - obs.y;
    const r = obs.radius + pad;
    if (dx * dx + dy * dy < r * r) {
      return true;
    }
  }
  return false;
}

function rayClearance(
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  localObs: ObstacleCircle[],
  bodyRadius: number
): number {
  let minMargin = 90;
  for (const d of [24, 52, 82]) {
    const px = x + dirX * d;
    const py = y + dirY * d;
    for (let i = 0; i < localObs.length; i++) {
      const obs = localObs[i];
      const dist = Math.hypot(px - obs.x, py - obs.y) - (obs.radius + bodyRadius + 3);
      if (dist < minMargin) {
        minMargin = dist;
        if (minMargin <= -8) {
          return minMargin;
        }
      }
    }
  }
  return minMargin;
}

function computeLocalAStarPath(
  sx: number,
  sy: number,
  gx: number,
  gy: number,
  obstacles: ObstacleCircle[],
  bodyRadius: number,
  worldW: number,
  worldH: number,
  ignoreOwner?: object
): Array<{ x: number; y: number }> {
  const cellSize = 48;
  const halfCells = 11; // 23x23 local grid (~1100x1100 px window)
  const gridDim = halfCells * 2 + 1;
  const totalCells = gridDim * gridDim;

  const originX = sx - halfCells * cellSize;
  const originY = sy - halfCells * cellSize;

  const targetCol = Math.max(
    0,
    Math.min(gridDim - 1, Math.round((gx - originX) / cellSize))
  );
  const targetRow = Math.max(
    0,
    Math.min(gridDim - 1, Math.round((gy - originY) / cellSize))
  );
  const startCol = halfCells;
  const startRow = halfCells;

  if (startCol === targetCol && startRow === targetRow) {
    return [];
  }

  // Filter obstacles to bounding box of local grid
  const minX = originX - 96;
  const maxX = originX + gridDim * cellSize + 96;
  const minY = originY - 96;
  const maxY = originY + gridDim * cellSize + 96;
  const localObs: ObstacleCircle[] = [];
  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    if (ignoreOwner && obs.owner === ignoreOwner) continue;
    if (
      obs.x + obs.radius >= minX &&
      obs.x - obs.radius <= maxX &&
      obs.y + obs.radius >= minY &&
      obs.y - obs.radius <= maxY
    ) {
      localObs.push(obs);
    }
  }

  const blocked = new Uint8Array(totalCells);
  for (let r = 0; r < gridDim; r++) {
    const cy = originY + r * cellSize;
    for (let c = 0; c < gridDim; c++) {
      if (r === startRow && c === startCol) continue;
      if (r === targetRow && c === targetCol) continue;
      const cx = originX + c * cellSize;
      if (cx < 55 || cx > worldW - 55 || cy < 65 || cy > worldH - 55) {
        blocked[r * gridDim + c] = 1;
        continue;
      }
      // Always allow start/goal vicinity so arrival spots aren't self-blocked
      if (Math.hypot(cx - gx, cy - gy) <= 44 || Math.hypot(cx - sx, cy - sy) <= 32) {
        continue;
      }
      if (isPointBlocked(cx, cy, localObs, Math.max(8, bodyRadius - 2))) {
        blocked[r * gridDim + c] = 1;
      }
    }
  }

  const gScore = new Float32Array(totalCells).fill(1e9);
  const fScore = new Float32Array(totalCells).fill(1e9);
  const parent = new Int16Array(totalCells).fill(-1);
  const closed = new Uint8Array(totalCells);
  const open: number[] = [];

  const startIdx = startRow * gridDim + startCol;
  const goalIdx = targetRow * gridDim + targetCol;
  gScore[startIdx] = 0;
  fScore[startIdx] = Math.hypot(targetCol - startCol, targetRow - startRow);
  open.push(startIdx);

  let bestIdx = startIdx;
  let bestH = Math.hypot(targetCol - startCol, targetRow - startRow);
  let expansions = 0;

  const dirs = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.414],
    [1, -1, 1.414],
    [-1, 1, 1.414],
    [-1, -1, 1.414],
  ];

  while (open.length > 0 && expansions < 180) {
    expansions++;
    let minOpenPos = 0;
    for (let i = 1; i < open.length; i++) {
      if (fScore[open[i]] < fScore[open[minOpenPos]]) {
        minOpenPos = i;
      }
    }
    const curr = open[minOpenPos];
    open[minOpenPos] = open[open.length - 1];
    open.pop();

    if (curr === goalIdx) {
      bestIdx = curr;
      break;
    }

    closed[curr] = 1;
    const cr = Math.floor(curr / gridDim);
    const cc = curr % gridDim;
    const h = Math.hypot(targetCol - cc, targetRow - cr);
    if (h < bestH) {
      bestH = h;
      bestIdx = curr;
    }

    for (let d = 0; d < dirs.length; d++) {
      const nc = cc + dirs[d][0];
      const nr = cr + dirs[d][1];
      if (nc < 0 || nc >= gridDim || nr < 0 || nr >= gridDim) continue;
      const nIdx = nr * gridDim + nc;
      if (closed[nIdx] || blocked[nIdx]) continue;
      // Prevent diagonal corner clipping through obstacles
      if (dirs[d][0] !== 0 && dirs[d][1] !== 0) {
        if (blocked[cr * gridDim + nc] && blocked[nr * gridDim + cc]) continue;
      }
      const tentG = gScore[curr] + dirs[d][2];
      if (tentG < gScore[nIdx]) {
        parent[nIdx] = curr;
        gScore[nIdx] = tentG;
        fScore[nIdx] = tentG + Math.hypot(targetCol - nc, targetRow - nr);
        if (!open.includes(nIdx)) {
          open.push(nIdx);
        }
      }
    }
  }

  if (bestIdx === startIdx) {
    return [];
  }

  const rawPath: Array<{ x: number; y: number }> = [];
  let trace: number = bestIdx;
  while (trace !== -1 && trace !== startIdx) {
    const tr = Math.floor(trace / gridDim);
    const tc = trace % gridDim;
    rawPath.push({
      x: Math.max(55, Math.min(worldW - 55, originX + tc * cellSize)),
      y: Math.max(65, Math.min(worldH - 55, originY + tr * cellSize)),
    });
    trace = parent[trace];
  }
  rawPath.reverse();
  // Skip near-zero waypoints at the start
  while (rawPath.length > 1 && Math.hypot(rawPath[0].x - sx, rawPath[0].y - sy) < 20) {
    rawPath.shift();
  }
  return rawPath;
}

export function stepSmartMove(
  x: number,
  y: number,
  tx: number,
  ty: number,
  dt: number,
  speed: number,
  bodyRadius: number,
  arrivalRadius: number,
  obstacles: ObstacleCircle[],
  river: River | null | undefined,
  worldW: number,
  worldH: number,
  nav: NavigationAgentState,
  ignoreOwner?: object
): { x: number; y: number; dx: number; dy: number; arrived: boolean } {
  const rawDist = Math.hypot(tx - x, ty - y);
  if (rawDist <= arrivalRadius + 0.5) {
    resetNavAgentState(nav, x, y);
    return { x, y, dx: tx - x, dy: ty - y, arrived: true };
  }

  const dtMs = dt * 1000;
  nav.repathCooldownMs = Math.max(0, nav.repathCooldownMs - dtMs);

  // Clear stale waypoints if final goal shifted significantly
  if (Math.hypot(tx - nav.lastGoalX, ty - nav.lastGoalY) > 65) {
    nav.waypoints = [];
    nav.lastGoalX = tx;
    nav.lastGoalY = ty;
  }

  // 1. Cross-river routing via Fords or player-built Bridges
  const crossingGoal = resolveRiverCrossingGoal(x, y, tx, ty, river);
  const subGoalX = crossingGoal.x;
  const subGoalY = crossingGoal.y;

  // Pop reached local waypoints
  while (nav.waypoints.length > 0) {
    const wp = nav.waypoints[0];
    if (Math.hypot(wp.x - x, wp.y - y) <= 22) {
      nav.waypoints.shift();
    } else {
      break;
    }
  }

  // 2. Stuck detector -> triggers local A* detour around palisades/buildings
  nav.stuckTimerMs += dtMs;
  if (nav.stuckTimerMs >= 460) {
    const moved = Math.hypot(x - nav.stuckAnchorX, y - nav.stuckAnchorY);
    nav.stuckAnchorX = x;
    nav.stuckAnchorY = y;
    nav.stuckTimerMs = 0;

    if (moved < Math.max(8, speed * 0.16)) {
      nav.stuckCount += 1;
      if (nav.stuckCount % 2 === 1) {
        nav.avoidSideSign = nav.avoidSideSign === 1 ? -1 : 1;
      }
      if (nav.repathCooldownMs <= 0) {
        nav.waypoints = computeLocalAStarPath(
          x,
          y,
          subGoalX,
          subGoalY,
          obstacles,
          bodyRadius,
          worldW,
          worldH,
          ignoreOwner
        );
        nav.repathCooldownMs = 1100;
      }
    } else {
      nav.stuckCount = 0;
    }
  }

  const activeGoalX = nav.waypoints.length > 0 ? nav.waypoints[0].x : subGoalX;
  const activeGoalY = nav.waypoints.length > 0 ? nav.waypoints[0].y : subGoalY;

  const dx = activeGoalX - x;
  const dy = activeGoalY - y;
  const dist = Math.hypot(dx, dy);
  const dirX = dist > 0.001 ? dx / dist : 0;
  const dirY = dist > 0.001 ? dy / dist : 1;
  const desiredAngle = Math.atan2(dirY, dirX);

  // Gather nearby obstacles within lookahead range
  const localObs: ObstacleCircle[] = [];
  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    if (ignoreOwner && obs.owner === ignoreOwner) continue;
    const ox = x - obs.x;
    const oy = y - obs.y;
    const maxR = obs.radius + 135;
    if (ox * ox + oy * oy <= maxR * maxR) {
      localObs.push(obs);
    }
  }

  // 3. Multi-ray predictive obstacle avoidance
  let moveDirX = dirX;
  let moveDirY = dirY;

  if (localObs.length > 0) {
    const s = nav.avoidSideSign;
    const candidateAngles = [
      0,
      s * 0.36,
      -s * 0.36,
      s * 0.72,
      -s * 0.72,
      s * 1.12,
      -s * 1.12,
      s * 1.54,
      -s * 1.54,
      s * 2.02,
      -s * 2.02,
    ];

    const straightClear = rayClearance(x, y, dirX, dirY, localObs, bodyRadius);
    if (straightClear < 8) {
      let bestScore = -1e9;
      let chosenAngle = desiredAngle;
      let chosenClear = straightClear;

      for (let i = 0; i < candidateAngles.length; i++) {
        const off = candidateAngles[i];
        const a = desiredAngle + off;
        const rx = Math.cos(a);
        const ry = Math.sin(a);
        const clr = rayClearance(x, y, rx, ry, localObs, bodyRadius);
        const clampedClr = Math.min(28, clr);
        const sideBonus = off * s > 0 ? 1.5 : 0;
        const score = clampedClr * 2.2 - Math.abs(off) * 14 + sideBonus;
        if (score > bestScore) {
          bestScore = score;
          chosenAngle = a;
          chosenClear = clr;
        }
      }

      moveDirX = Math.cos(chosenAngle);
      moveDirY = Math.sin(chosenAngle);

      // Proactive A* wall bypass if even angled rays are blocked!
      if (chosenClear < 0 && nav.waypoints.length === 0 && nav.repathCooldownMs <= 0) {
        nav.waypoints = computeLocalAStarPath(
          x,
          y,
          subGoalX,
          subGoalY,
          obstacles,
          bodyRadius,
          worldW,
          worldH,
          ignoreOwner
        );
        nav.repathCooldownMs = 1100;
      }
    }
  }

  const stepDist = speed * dt;
  const aligned = moveDirX * dirX + moveDirY * dirY > 0.72;
  if (
    nav.waypoints.length === 0 &&
    !crossingGoal.viaCrossing &&
    aligned &&
    rawDist - stepDist <= arrivalRadius + 0.5
  ) {
    const nx = Math.max(55, Math.min(worldW - 55, tx - dirX * arrivalRadius));
    const ny = Math.max(65, Math.min(worldH - 55, ty - dirY * arrivalRadius));
    resetNavAgentState(nav, nx, ny);
    return { x: nx, y: ny, dx: dirX, dy: dirY, arrived: true };
  }

  let nx = x + moveDirX * stepDist;
  let ny = y + moveDirY * stepDist;

  // 4. Hard separation pass
  for (let i = 0; i < localObs.length; i++) {
    const obs = localObs[i];
    const ox = nx - obs.x;
    const oy = ny - obs.y;
    const oDist = Math.hypot(ox, oy);
    const minSep = obs.radius + bodyRadius;
    if (oDist < minSep) {
      if (oDist > 0.01) {
        nx = obs.x + (ox / oDist) * minSep;
        ny = obs.y + (oy / oDist) * minSep;
      } else {
        nx = obs.x;
        ny = obs.y + minSep;
      }
    }
  }

  nx = Math.max(55, Math.min(worldW - 55, nx));
  ny = Math.max(65, Math.min(worldH - 55, ny));

  return {
    x: nx,
    y: ny,
    dx: nx - x,
    dy: ny - y,
    arrived: false,
  };
}
