import type { GameCategory } from '../game/registry/types'

export interface HomeCategory {
  readonly id: GameCategory
  readonly title: string
  readonly artSrc: `/assets/home/${string}_v2.webp`
}

export const homeCategories: readonly HomeCategory[] = [
  {
    id: 'SPORTS',
    title: '運動競技',
    artSrc: '/assets/home/category_sports_v2.webp',
  },
  {
    id: 'PARTY',
    title: '派對挑戰',
    artSrc: '/assets/home/category_party_v2.webp',
  },
  {
    id: 'VOICE',
    title: '聲控挑戰',
    artSrc: '/assets/home/category_voice_v2.webp',
  },
  {
    id: 'HAND',
    title: '手部挑戰',
    artSrc: '/assets/home/category_hand_v2.webp',
  },
]
