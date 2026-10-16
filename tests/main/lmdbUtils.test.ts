import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createErrorResult,
  createSuccessResult,
  isValidDocId,
  isDocSizeExceeded,
  safeJsonParse,
  safeJsonStringify,
  generateNewRev
} from '../../src/main/core/lmdb/utils'

// ========== isValidDocId ==========

describe('isValidDocId', () => {
  it('有效的字符串 ID 应返回 true', () => {
    expect(isValidDocId('my-doc')).toBe(true)
    expect(isValidDocId('a')).toBe(true)
    expect(isValidDocId('doc-123')).toBe(true)
  })

  it('空字符串应返回 false', () => {
    expect(isValidDocId('')).toBe(false)
  })

  it('非字符串类型应返回 false', () => {
    expect(isValidDocId(123)).toBe(false)
    expect(isValidDocId(null)).toBe(false)
    expect(isValidDocId(undefined)).toBe(false)
    expect(isValidDocId({})).toBe(false)
    expect(isValidDocId([])).toBe(false)
    expect(isValidDocId(true)).toBe(false)
  })
})

// ========== isDocSizeExceeded ==========

describe('isDocSizeExceeded', () => {
  it('小文档不应超过默认限制', () => {
    expect(isDocSizeExceeded({ key: 'value' })).toBe(false)
  })

  it('大文档应超过限制', () => {
    const largeDoc = { data: 'x'.repeat(1024 * 1024 + 1) }
    expect(isDocSizeExceeded(largeDoc)).toBe(true)
  })

  it('应支持自定义限制', () => {
    const doc = { data: 'hello' }
    expect(isDocSizeExceeded(doc, 5)).toBe(true) // JSON 序列化后 > 5 字节
    expect(isDocSizeExceeded(doc, 10000)).toBe(false)
  })

  it('边界值：刚好在限制内', () => {
    const doc = { a: 1 }
    const size = Buffer.byteLength(JSON.stringify(doc), 'utf8')
    expect(isDocSizeExceeded(doc, size)).toBe(false) // 等于限制不超过
    expect(isDocSizeExceeded(doc, size - 1)).toBe(true) // 超过限制
  })
})

// ========== safeJsonParse ==========

describe('safeJsonParse', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('应正确解析有效 JSON', () => {
    expect(safeJsonParse('{"key":"value"}')).toEqual({ key: 'value' })
    expect(safeJsonParse('[1,2,3]')).toEqual([1, 2, 3])
    expect(safeJsonParse('"hello"')).toBe('hello')
    expect(safeJsonParse('123')).toBe(123)
    expect(safeJsonParse('null')).toBe(null)
  })

  it('无效 JSON 应返回 null 并打印错误', () => {
    expect(safeJsonParse('{')).toBeNull()
    expect(safeJsonParse('not json')).toBeNull()
    expect(safeJsonParse('')).toBeNull()
    expect(console.error).toHaveBeenCalledTimes(3)
  })
})

// ========== safeJsonStringify ==========

describe('safeJsonStringify', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('应正确序列化对象', () => {
    expect(safeJsonStringify({ key: 'value' })).toBe('{"key":"value"}')
    expect(safeJsonStringify([1, 2, 3])).toBe('[1,2,3]')
    expect(safeJsonStringify('hello')).toBe('"hello"')
  })

  it('循环引用应返回空字符串并打印错误', () => {
    const obj: any = { a: 1 }
    obj.self = obj
    expect(safeJsonStringify(obj)).toBe('')
    expect(console.error).toHaveBeenCalledTimes(1)
  })
})

// ========== createErrorResult ==========

describe('createErrorResult', () => {
  it('应创建包含错误信息的结果', () => {
    const result = createErrorResult('not_found', 'Document not found', 'doc-123')
    expect(result).toEqual({
      id: 'doc-123',
      error: true,
      name: 'not_found',
      message: 'Document not found'
    })
  })

  it('id 不提供时应默认为空字符串', () => {
    const result = createErrorResult('error', 'Something went wrong')
    expect(result.id).toBe('')
    expect(result.error).toBe(true)
  })
})

// ========== createSuccessResult ==========

describe('createSuccessResult', () => {
  it('应创建成功结果', () => {
    const result = createSuccessResult('doc-123', '1-abc')
    expect(result).toEqual({
      id: 'doc-123',
      ok: true,
      rev: '1-abc'
    })
  })

  it('不提供 rev 时不应包含 rev 字段', () => {
    const result = createSuccessResult('doc-123')
    expect(result).toEqual({
      id: 'doc-123',
      ok: true
    })
    expect(result).not.toHaveProperty('rev')
  })
})

// ========== generateNewRev ==========

describe('generateNewRev', () => {
  it('无已有版本时应生成序列号 1', () => {
    const rev = generateNewRev()
    expect(rev).toMatch(/^1-[a-f0-9]{32}$/)
  })

  it('有已有版本时应递增序列号', () => {
    const rev = generateNewRev('1-abc123')
    expect(rev).toMatch(/^2-[a-f0-9]{32}$/)
  })

  it('应正确处理较大的序列号', () => {
    const rev = generateNewRev('99-abc123')
    expect(rev).toMatch(/^100-[a-f0-9]{32}$/)
  })

  it('无效版本格式应使用默认序列号 1', () => {
    const rev = generateNewRev('invalid')
    expect(rev).toMatch(/^1-[a-f0-9]{32}$/)
  })

  it('每次生成的哈希应不同', () => {
    const rev1 = generateNewRev()
    const rev2 = generateNewRev()
    const hash1 = rev1.split('-')[1]
    const hash2 = rev2.split('-')[1]
    expect(hash1).not.toBe(hash2)
  })
})
