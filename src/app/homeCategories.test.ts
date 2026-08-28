import { describe, expect, it } from 'vitest'

import { homeCategories } from './homeCategories'

describe('home category metadata', () => {
  it('exposes the four canonical categories with Chinese labels and v2 artwork', () => {
    expect(homeCategories).toHaveLength(4)
    expect(homeCategories.map(({ id }) => id)).toEqual([
      'SPORTS',
      'PARTY',
      'VOICE',
      'HAND',
    ])

    for (const category of homeCategories) {
      expect(category.title.trim()).not.toBe('')
      expect(category.artSrc).toMatch(/_v2\.webp$/)
      expect(typeof category.objectPosition).toBe('string')
      expect(category.objectPosition.trim()).not.toBe('')
      expect('gameCount' in category).toBe(false)
    }
  })
})
