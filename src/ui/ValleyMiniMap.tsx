import { useId } from 'react'
import type { Vec2 } from '../game/types'
import regions from '../game/regions.json'
import { regionPaths, riverX } from '../world/geometry'

const regionIds = ['meadow', 'forest', 'highland'] as const
const basePaths = [
  [[0, 17], [1, 14], [.2, 7], [-.2, 1], [-3, -3.5], [-9.4, -5.9]],
  [[-.2, 4.5], [6, 4.5], [riverX(5), 5], [17, 5]],
]
const forestTrees = [[20, -10], [26, -11], [36, -12], [43, -9], [44, 1], [44, 12], [37, 17], [26, 16], [21, 10], [23, -2], [34, 7]]
const meadowTrees = [[-27, 23], [-25, 34], [-8, 36], [5, 30]]

/** One geographic drawing serves the compact locator and the larger valley map. */
export default function ValleyMiniMap({ position, sheep = [], progressionStep, detailed = false }: {
  position: Vec2; sheep?: Vec2[]; progressionStep: number; detailed?: boolean
}) {
  const clipId = useId(), grainId = useId()
  const width = detailed ? 660 : 130, height = detailed ? 340 : 110, padding = detailed ? 24 : 7
  const mapX = (x: number) => padding + (x - regions.bounds.minX) / (regions.bounds.maxX - regions.bounds.minX) * (width - padding * 2)
  const mapY = (z: number) => padding + (z - regions.bounds.minZ) / (regions.bounds.maxZ - regions.bounds.minZ) * (height - padding * 2)
  const sx = (width - padding * 2) / (regions.bounds.maxX - regions.bounds.minX)
  const sy = (height - padding * 2) / (regions.bounds.maxZ - regions.bounds.minZ)
  const line = (points: number[][]) => points.map(([x, z], i) => `${i ? 'L' : 'M'}${mapX(x).toFixed(2)} ${mapY(z).toFixed(2)}`).join(' ')
  const river = line(Array.from({ length: 58 }, (_, i) => { const z = regions.bounds.minZ - 4 + i * (regions.bounds.maxZ - regions.bounds.minZ + 8) / 57; return [riverX(z), z] }))
  const unit = detailed ? 2.8 : .77
  const label = (x: number, z: number, name: string, open = true) => detailed && <text x={mapX(x)} y={mapY(z)} textAnchor="middle" fontSize="14" fontWeight="700" fill={open ? '#5c7055' : '#879080'} paintOrder="stroke" stroke="#e9e8d2" strokeWidth="4" strokeLinejoin="round">{name}</text>
  const tree = ([x, z]: number[], index: number, open: boolean) => <g key={`${x}-${z}`} transform={`translate(${mapX(x)} ${mapY(z)}) scale(${unit})`} opacity={open ? 1 : .55}>
    <path d="M0 1v3" stroke="#95825e" strokeWidth="1.1" />
    <ellipse cy="-.7" rx={index % 2 ? 2.2 : 2.7} ry="3" fill={open ? index % 2 ? '#76965f' : '#8aa36a' : '#a5ad95'} />
    <ellipse cx="-.5" cy="-1.3" rx="1.4" ry="1.8" fill={open ? '#9ab37c' : '#b6bba7'} />
  </g>
  return <svg className={detailed ? undefined : 'minimap'} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={detailed ? '山谷地图：你的所在位置、基地、花坡、秘林与高地' : '山谷小地图：橙色是你，白色是羊群'}>
    <defs>
      <clipPath id={clipId}><rect x="3" y="3" width={width - 6} height={height - 6} rx={detailed ? 20 : 20} /></clipPath>
      <pattern id={grainId} width={detailed ? 17 : 7} height={detailed ? 17 : 7} patternUnits="userSpaceOnUse"><circle cx="3" cy="4" r={detailed ? .7 : .3} fill="#809666" opacity=".15" /></pattern>
    </defs>
    <g clipPath={`url(#${clipId})`}>
      <rect width={width} height={height} fill="#dce2bd" />
      <rect width={width} height={height} fill={`url(#${grainId})`} />
      <ellipse cx={mapX(-8)} cy={mapY(1)} rx={16 * sx} ry={17 * sy} fill="#c5d3a5" />
      {regionIds.map(id => {
        const region = regions[id], bounds = region.bounds, open = progressionStep >= region.unlockStep
        const color = id === 'meadow' ? '#bdd39e' : id === 'forest' ? '#afc297' : '#c4c9b9'
        return <rect key={id} x={mapX(bounds.minX)} y={mapY(bounds.minZ)} width={(bounds.maxX - bounds.minX) * sx} height={(bounds.maxZ - bounds.minZ) * sy} rx={detailed ? 22 : 7} fill={open ? color : '#c9ceba'} stroke={open ? 'none' : '#b7bfaa'} strokeWidth={detailed ? 1 : .5} strokeDasharray={open ? undefined : detailed ? '4 5' : '1.5 2'} />
      })}
      <path d={river} fill="none" stroke="#c9dac4" strokeWidth={5.5 * sx} />
      <path d={river} fill="none" stroke="#86bcb1" strokeWidth={3.55 * sx} />
      <path d={river} fill="none" stroke="#b8d8c8" strokeWidth={.45 * sx} strokeDasharray={detailed ? '11 22' : '3 7'} />
      {basePaths.map((points, i) => <path key={i} d={line(points)} fill="none" stroke="#e8d7ab" strokeWidth={detailed ? 6 : 2.6} strokeLinecap="round" strokeLinejoin="round" />)}
      {regionIds.flatMap(id => regionPaths[id].map((points, i) => <path key={`${id}-${i}`} d={line(points)} fill="none" stroke={progressionStep >= regions[id].unlockStep ? '#e9d9ad' : '#b4baa2'} strokeWidth={detailed ? 5 : 2} strokeDasharray={progressionStep >= regions[id].unlockStep ? undefined : detailed ? '4 5' : '1.2 2'} strokeLinecap="round" strokeLinejoin="round" />))}
      <path d={line([[riverX(5) - 2.85, 5], [riverX(5) + 2.85, 5]])} stroke="#ab9067" strokeWidth={detailed ? 10 : 3.1} />
      {[-1, 1].map(side => <path key={side} d={line([[riverX(5) - 2.85, 5 + side * 1.35], [riverX(5) + 2.85, 5 + side * 1.35]])} stroke="#826f52" strokeWidth={detailed ? 1.4 : .55} />)}
      <ellipse cx={mapX(regions.meadow.waterPoint.x)} cy={mapY(regions.meadow.waterPoint.z)} rx={3.1 * sx} ry={2.1 * sy} fill={progressionStep >= 10 ? '#89c1b5' : '#b6c7b8'} stroke="#e6dfbd" strokeWidth={detailed ? 2 : .8} />
      {forestTrees.map((point, i) => tree(point, i, progressionStep >= 13))}
      {meadowTrees.map((point, i) => tree(point, i, progressionStep >= 10))}
      {[[-18, -12], [-20, 4], [5, -15], [5, 15]].map((point, i) => tree(point, i, true))}
      {[[27, -36], [36, -40], [52, -35], [55, -23]].map(([x, z], i) => <g key={x} transform={`translate(${mapX(x)} ${mapY(z)}) scale(${unit * 1.15})`} opacity={progressionStep >= 15 ? 1 : .52}><path d="m-4 3 3-7 3 3 2-1 4 5Z" fill={i % 2 ? '#a3afa9' : '#aeb7ac'} /><path d="m-1-4 1.7 1.7-1.5.1-1 .9Z" fill="#f0eed9" /></g>)}
      {progressionStep > 0 && <>
        <rect x={mapX(-15)} y={mapY(-3.5)} width={13.8 * sx} height={14 * sy} rx={detailed ? 4 : 1} fill="none" stroke="#a19c70" strokeWidth={detailed ? 1.6 : .65} strokeDasharray={detailed ? '4 3' : '1.6 1'} />
        <g transform={`translate(${mapX(-10)} ${mapY(-9)}) scale(${unit})`}><path d="M-3.2 0h6.4v4h-6.4Z" fill="#d1b583" /><path d="m-4 0 4-4 4 4Z" fill="#c3886b" /><path d="m-4.2.1 4.2-4.2L4.2.1" stroke="#9f755b" strokeWidth="1" fill="none" /><rect x="-.8" y="1.3" width="1.6" height="2.7" rx=".5" fill="#779c87" /></g>
      </>}
      {progressionStep >= 6 && <g>
        {[0, 1].flatMap(row => [0, 1, 2].map(col => <rect key={`${row}-${col}`} x={mapX(2.5 + col * 2)} y={mapY(-3.5 + row * 2.5)} width={1.6 * sx} height={1.6 * sy} rx={detailed ? 1.5 : .5} fill="#a68e66" />))}
        <g transform={`translate(${mapX(7)} ${mapY(10)}) scale(${unit * .72})`}><rect x="-3" y="-1" width="6" height="3" rx=".7" fill="#aa8b63" /><path d="M-3.4-1v-2h6.8v2" stroke="#e8d6ac" strokeWidth="1.4" fill="none" /><circle cx="-2" cy="2.7" r=".85" fill="#807459" /><circle cx="2" cy="2.7" r=".85" fill="#807459" /></g>
      </g>}
      <g transform={`translate(${mapX(regions.highland.viewPoint.x)} ${mapY(regions.highland.viewPoint.z)}) scale(${unit})`} opacity={progressionStep >= 15 ? 1 : .42}><path d="m0-4 .95 2.4L3.5-1l-2 1.8.35 2.7L0 2.1l-2.5 1.4L-2 .8-3.7-1l2.7-.6Z" fill="#a994b5" stroke="#f4e9ce" strokeWidth=".7" /></g>
      {regionIds.map(id => progressionStep < regions[id].unlockStep && <g key={id} transform={`translate(${mapX(regions[id].gate.x)} ${mapY(regions[id].gate.z)}) scale(${detailed ? 1.5 : .65})`}><rect x="-3.4" y="-1.3" width="6.8" height="5.5" rx="1.1" fill="#f0ead5" stroke="#9ba28c" strokeWidth="1" /><path d="M-2-1.5v-1.2a2 2 0 0 1 4 0v1.2" fill="none" stroke="#87917b" strokeWidth="1.1" /></g>)}
      {label(-9, 13, '羊羊基地')}
      {label(-11, 34, '铃兰花坡', progressionStep >= 10)}
      {label(33, 15, '蘑菇秘林', progressionStep >= 13)}
      {label(42, -20, '星落高地', progressionStep >= 15)}
      {sheep.map((point, i) => <circle key={i} cx={mapX(point.x)} cy={mapY(point.z)} r={detailed ? 3 : 1.55} fill="#fff8df" stroke="#889a73" strokeWidth={detailed ? .8 : .45} />)}
      <circle cx={mapX(position.x)} cy={mapY(position.z)} r={detailed ? 7 : 3.4} fill="#dea060" stroke="#fff8e5" strokeWidth={detailed ? 3 : 1.65} />
      {detailed && <text x="30" y="40" fontSize="11" fill="#83916f" letterSpacing="3">风 之 山 谷</text>}
      <g transform={`translate(${width - (detailed ? 33 : 12)} ${detailed ? 30 : 12})`}><path d="M0 5V-3m-2.5 2.5L0-3l2.5 2.5" stroke="#6e8063" strokeWidth={detailed ? 1.3 : .8} fill="none" /><text x="0" y="-6" textAnchor="middle" fontSize={detailed ? 8 : 5.5} fontWeight="700" fill="#6e8063">N</text></g>
    </g>
    <rect x="2" y="2" width={width - 4} height={height - 4} rx="20" fill="none" stroke="#fff5dc" strokeWidth={detailed ? 3 : 3.5} />
  </svg>
}
