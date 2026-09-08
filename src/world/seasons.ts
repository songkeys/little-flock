import type { Season } from '../game/types'

const leafColors = ['#468356', '#58954f', '#73a450', '#83af58', '#3d7951']
function palette(leaves: string[], flowers: [string, string]) {
  return { ...Object.fromEntries(leafColors.map((color, i) => [color, leaves[i]])), '#dda9b2': flowers[0], '#efd0c0': flowers[1] }
}

export const seasonArt: Record<Season, { ground: string; grassBottom: string; grassTop: string; particles: string; palette: Record<string, string> }> = {
  春日: { ground: '#709d54', grassBottom: '#739a51', grassTop: '#a5bd68', particles: '#eac0cb', palette: {} },
  夏日: { ground: '#60934e', grassBottom: '#628e4b', grassTop: '#96b667', particles: '#e4d897', palette: palette(['#347449', '#41834a', '#60954b', '#74a253', '#306c49'], ['#d5c6a3', '#f0ddb1']) },
  秋日: { ground: '#969650', grassBottom: '#8b9250', grassTop: '#c0b36b', particles: '#d4a064', palette: palette(['#a68548', '#bc9453', '#d4ac60', '#c0935d', '#8c8150'], ['#ceab77', '#dcc18b']) },
  冬日: { ground: '#93aaa1', grassBottom: '#819e91', grassTop: '#bdcec0', particles: '#e4eddf', palette: palette(['#7e9b90', '#94ad9c', '#aac1ad', '#c0d1b9', '#6b9187'], ['#c6d4c2', '#dbe1ce']) },
}
