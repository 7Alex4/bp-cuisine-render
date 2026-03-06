/**
 * Unit tests for lib/server/validation.ts
 * Run with: node --experimental-strip-types --test tests/validation.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  validateImageFile,
  parseDimensions,
  parseMaterials,
  MAX_FILE_SIZE,
} from '../lib/server/validation.ts'

// ── helpers ───────────────────────────────────────────────────────────────────

function makeFile(name: string, type: string, size: number): File {
  const blob = new Blob([new Uint8Array(size)], { type })
  return new File([blob], name, { type })
}

// ── validateImageFile ─────────────────────────────────────────────────────────

describe('validateImageFile', () => {
  it('returns null for a valid JPEG', () => {
    const file = makeFile('room.jpg', 'image/jpeg', 1024)
    assert.equal(validateImageFile(file, 'room'), null)
  })

  it('returns null for a valid PNG', () => {
    const file = makeFile('sketch.png', 'image/png', 512)
    assert.equal(validateImageFile(file, 'sketch'), null)
  })

  it('returns null for a valid WebP', () => {
    const file = makeFile('photo.webp', 'image/webp', 512)
    assert.equal(validateImageFile(file, 'photo'), null)
  })

  it('returns error for empty file (size = 0)', () => {
    const file = makeFile('empty.jpg', 'image/jpeg', 0)
    const err = validateImageFile(file, 'room')
    assert.notEqual(err, null)
    assert.match(err!.message, /requis/)
  })

  it('returns error when file exceeds 20 MB', () => {
    const file = makeFile('big.jpg', 'image/jpeg', MAX_FILE_SIZE + 1)
    const err = validateImageFile(file, 'room')
    assert.notEqual(err, null)
    assert.match(err!.message, /volumineux/)
  })

  it('returns null at exactly 20 MB (boundary)', () => {
    const file = makeFile('max.jpg', 'image/jpeg', MAX_FILE_SIZE)
    assert.equal(validateImageFile(file, 'room'), null)
  })

  it('returns error for unsupported MIME type', () => {
    const file = makeFile('doc.pdf', 'application/pdf', 1024)
    const err = validateImageFile(file, 'room')
    assert.notEqual(err, null)
    assert.match(err!.message, /invalide/)
  })

  it('accepts files with no MIME type (browser may omit)', () => {
    const file = makeFile('noext', '', 1024)
    // empty mime type is allowed (we skip the check when type is empty)
    assert.equal(validateImageFile(file, 'room'), null)
  })
})

// ── parseDimensions ───────────────────────────────────────────────────────────

describe('parseDimensions', () => {
  it('parses valid dimensions', () => {
    const { value, error } = parseDimensions('{"width":4,"depth":5,"height":2.6}')
    assert.equal(error, null)
    assert.deepEqual(value, { width: 4, depth: 5, height: 2.6 })
  })

  it('returns error for missing fields', () => {
    const { value, error } = parseDimensions('{"width":4}')
    assert.notEqual(error, null)
    assert.equal(value, null)
  })

  it('returns error for zero values', () => {
    const { value, error } = parseDimensions('{"width":0,"depth":5,"height":2.6}')
    assert.notEqual(error, null)
    assert.equal(value, null)
  })

  it('returns error for negative values', () => {
    const { value, error } = parseDimensions('{"width":-1,"depth":5,"height":2.6}')
    assert.notEqual(error, null)
    assert.equal(value, null)
  })

  it('returns error for non-numeric strings', () => {
    const { value, error } = parseDimensions('{"width":"abc","depth":5,"height":2.6}')
    assert.notEqual(error, null)
    assert.equal(value, null)
  })

  it('returns error for invalid JSON', () => {
    const { value, error } = parseDimensions('not-json')
    assert.notEqual(error, null)
    assert.equal(value, null)
  })

  it('returns error for empty string', () => {
    const { value, error } = parseDimensions('')
    assert.notEqual(error, null)
    assert.equal(value, null)
  })
})

// ── parseMaterials ────────────────────────────────────────────────────────────

describe('parseMaterials', () => {
  it('parses valid materials', () => {
    const { value, error } = parseMaterials('{"description":"laque blanche"}')
    assert.equal(error, null)
    assert.equal(value.description, 'laque blanche')
  })

  it('returns empty description for empty JSON object', () => {
    const { value, error } = parseMaterials('{}')
    assert.equal(error, null)
    assert.equal(value.description, '')
  })

  it('returns empty description for empty string input', () => {
    const { value, error } = parseMaterials('')
    assert.equal(error, null)
    assert.equal(value.description, '')
  })

  it('returns error for invalid JSON', () => {
    const { value, error } = parseMaterials('{bad json}')
    assert.notEqual(error, null)
    assert.equal(value.description, '')
  })
})
