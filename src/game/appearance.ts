import type { AvatarAppearance } from './types'

export const defaultAvatar: AvatarAppearance = { skin: 0, hair: 0, outfit: 0, hat: 0 }

export const avatarSkins = [
  { name: '浅暖', color: '#f1cda5', blush: '#e8ab96' },
  { name: '暖杏', color: '#e8b98d', blush: '#d9967b' },
  { name: '蜜糖', color: '#cd986e', blush: '#bd7860' },
  { name: '麦色', color: '#ac7757', blush: '#a26453' },
  { name: '栗色', color: '#89563f', blush: '#8e5145' },
  { name: '深棕', color: '#623e31', blush: '#75463e' },
] as const

export const avatarHair = [
  { name: '栗色短发', color: '#795439', style: 'short' },
  { name: '蜜糖卷发', color: '#c39050', style: 'curly' },
  { name: '浅棕双辫', color: '#a3744e', style: 'braids' },
  { name: '深棕丸子', color: '#584236', style: 'bun' },
  { name: '乌木短卷', color: '#353632', style: 'coils' },
  { name: '银灰短发', color: '#bfc0b4', style: 'bob' },
] as const

export const avatarOutfits = [
  { name: '苔绿工作服', color: '#638d77', accent: '#e4cea0', pants: '#5b6951', boots: '#68553d', style: 'jacket' },
  { name: '燕麦围裙', color: '#d8c7a6', accent: '#829a8a', pants: '#718083', boots: '#8a674c', style: 'overalls' },
  { name: '杏桃园丁', color: '#d99682', accent: '#f2ddba', pants: '#81785e', boots: '#80604a', style: 'scarf' },
  { name: '雾蓝牧歌', color: '#7e9eaf', accent: '#e4cb97', pants: '#576f7c', boots: '#755942', style: 'jacket' },
  { name: '薰衣草毛衣', color: '#aaa0c0', accent: '#eee0c2', pants: '#706777', boots: '#736455', style: 'knit' },
  { name: '向日葵背带', color: '#dcb75e', accent: '#839a79', pants: '#777b68', boots: '#8a6846', style: 'overalls' },
  { name: '松果旅人', color: '#997451', accent: '#cfb88b', pants: '#667457', boots: '#64513d', style: 'scarf' },
  { name: '莓果假日', color: '#b67483', accent: '#efd3bd', pants: '#635b74', boots: '#745653', style: 'knit' },
] as const

export const avatarHats = [
  { name: '小小草帽', color: '#dfc58b' },
  { name: '不戴帽子', color: '#c7c3b6' },
  { name: '软软贝雷帽', color: '#8fa394' },
  { name: '山谷花环', color: '#dfa8bc' },
] as const
