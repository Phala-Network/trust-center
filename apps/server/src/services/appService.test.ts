import {describe, expect, test} from 'bun:test'

import {computeRevivedAppIds} from './appService'

describe('computeRevivedAppIds', () => {
  test('returns batch ids that are currently deleted', () => {
    const batchIds = ['a', 'b', 'c', 'd']
    const deletedIds = ['b', 'd', 'e']

    expect(computeRevivedAppIds(batchIds, deletedIds)).toEqual(['b', 'd'])
  })

  test('returns empty array when no batch app is deleted', () => {
    expect(computeRevivedAppIds(['a', 'b'], ['x', 'y'])).toEqual([])
  })

  test('returns empty array when deleted ids list is empty', () => {
    expect(computeRevivedAppIds(['a', 'b'], [])).toEqual([])
  })

  test('ignores deleted ids not present in the batch', () => {
    const batchIds = ['a']
    const deletedIds = ['gone-1', 'gone-2']

    expect(computeRevivedAppIds(batchIds, deletedIds)).toEqual([])
  })

  test('returns one entry per matching batch id when batch has duplicates', () => {
    // upsertApps dedupes the batch before calling this, but the filter stays
    // a faithful per-entry mapping
    const batchIds = ['a', 'a', 'b']
    const deletedIds = ['a']

    expect(computeRevivedAppIds(batchIds, deletedIds)).toEqual(['a', 'a'])
  })

  test('handles empty batch', () => {
    expect(computeRevivedAppIds([], ['a'])).toEqual([])
  })
})
