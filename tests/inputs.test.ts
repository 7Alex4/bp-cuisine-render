import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseLocaleNumber } from '../lib/inputs.ts'

describe('parseLocaleNumber', () => {
  it('parses decimal values written with a dot', () => {
    assert.equal(parseLocaleNumber('2.7'), 2.7)
  })

  it('parses decimal values written with a comma', () => {
    assert.equal(parseLocaleNumber('5,9'), 5.9)
  })

  it('ignores spaces around the value', () => {
    assert.equal(parseLocaleNumber(' 3,5 '), 3.5)
  })

  it('returns 0 for invalid values', () => {
    assert.equal(parseLocaleNumber('abc'), 0)
  })
})
