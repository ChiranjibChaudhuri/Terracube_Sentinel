// ── Force-Directed Graph Layout Engine ──────────────────────────────
// Pure TypeScript implementation, no external dependencies.

export interface ForceNode {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  radius: number
}

export interface ForceLink {
  source: string
  target: string
}

export interface SimulationResult {
  nodes: Map<string, { x: number; y: number }>
}

// ── Simulation constants ────────────────────────────────────────────

const CHARGE = 2600
const SPRING_K = 0.04
const REST_LENGTH = 245
const GRAVITY = 0.012
const DAMPING = 0.85

// ── Force calculations ──────────────────────────────────────────────

function applyRepulsion(nodes: ForceNode[]): void {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]
      const b = nodes[j]

      const dx = a.x - b.x
      const dy = a.y - b.y
      let distSq = dx * dx + dy * dy

      // Avoid division by zero / extreme forces at near-zero distance
      if (distSq < 1) distSq = 1

      const dist = Math.sqrt(distSq)
      const force = CHARGE / distSq

      const fx = (dx / dist) * force
      const fy = (dy / dist) * force

      a.vx += fx
      a.vy += fy
      b.vx -= fx
      b.vy -= fy
    }
  }
}

function applySpring(nodes: Map<string, ForceNode>, links: ForceLink[]): void {
  for (const link of links) {
    const a = nodes.get(link.source)
    const b = nodes.get(link.target)
    if (!a || !b) continue

    const dx = b.x - a.x
    const dy = b.y - a.y
    let dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 1) dist = 1

    const displacement = dist - REST_LENGTH
    const force = SPRING_K * displacement

    const fx = (dx / dist) * force
    const fy = (dy / dist) * force

    a.vx += fx
    a.vy += fy
    b.vx -= fx
    b.vy -= fy
  }
}

function applyCenterGravity(nodes: ForceNode[], cx: number, cy: number): void {
  for (const node of nodes) {
    node.vx += (cx - node.x) * GRAVITY
    node.vy += (cy - node.y) * GRAVITY
  }
}

function integrate(nodes: ForceNode[]): void {
  for (const node of nodes) {
    node.vx *= DAMPING
    node.vy *= DAMPING
    node.x += node.vx
    node.y += node.vy
  }
}

// ── Public API ──────────────────────────────────────────────────────

export function simulate(
  nodeIds: string[],
  links: ForceLink[],
  width: number,
  height: number,
  iterations: number = 300,
): SimulationResult {
  const cx = width / 2
  const cy = height / 2

  // Initialize nodes in a circle around center
  const initRadius = Math.min(width, height) * 0.3
  const nodeArray: ForceNode[] = nodeIds.map((id, i) => {
    const angle = (2 * Math.PI * i) / nodeIds.length - Math.PI / 2
    return {
      id,
      x: cx + initRadius * Math.cos(angle),
      y: cy + initRadius * Math.sin(angle),
      vx: 0,
      vy: 0,
      radius: 20,
    }
  })

  const nodeMap = new Map<string, ForceNode>()
  for (const node of nodeArray) {
    nodeMap.set(node.id, node)
  }

  // Run simulation
  for (let i = 0; i < iterations; i++) {
    applyRepulsion(nodeArray)
    applySpring(nodeMap, links)
    applyCenterGravity(nodeArray, cx, cy)
    integrate(nodeArray)
  }

  // Build result
  const result = new Map<string, { x: number; y: number }>()
  for (const node of nodeArray) {
    result.set(node.id, { x: node.x, y: node.y })
  }

  return { nodes: result }
}
