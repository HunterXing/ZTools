#!/usr/bin/env node
/**
 * 写入 ZTools 自建同步配置（provider=private + 私服凭据）。
 *
 * 直接使用 @lmdb/lmdb —— 与 ZTools 运行时同一个库、同一个 encoding，
 * 避免手改 data.mdb 破坏 B+tree 页结构。
 *
 * 用法：node write-sync-config.mjs <ztoolsDir> <serverUrl> <uid> <token> <refreshToken>
 */
import { open } from 'lmdb'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const [ztoolsDir, serverUrl, uid, token, refreshToken] = process.argv.slice(2)
if (!ztoolsDir || !serverUrl || !uid || !token) {
  console.error(
    '用法: node write-sync-config.mjs <ztoolsDir> <serverUrl> <uid> <token> [refreshToken]'
  )
  process.exit(1)
}

const accountPath = join(ztoolsDir, 'lmdb', 'accounts', 'default')
const env = await open(accountPath, {
  encoding: 'json',
  name: 'data'
})

const now = Date.now()

// 1) 同步配置：与 macmini 完全一致的字段
const profile = {
  provider: 'private',
  enabled: true,
  serverUrl,
  syncInterval: 30,
  lastSyncTime: 0
}

const existing = await env.get('SYNC/profile')
await env.put('SYNC/profile', {
  _id: 'SYNC/profile',
  ...(existing?._rev ? { _rev: existing._rev } : {}),
  data: profile
})

// 2) 私服凭据（CredentialSession 结构）
const existingSession = await env.get('SYNC/private-session')
await env.put('SYNC/private-session', {
  _id: 'SYNC/private-session',
  ...(existingSession?._rev ? { _rev: existingSession._rev } : {}),
  data: {
    serverUrl,
    username: uid,
    token,
    refreshToken: refreshToken || ''
  }
})

// 3) 标记 official/private 分离迁移已完成，避免启动时反推 provider
await env.put('SYNC/separated-auth-migrated', {
  _id: 'SYNC/separated-auth-migrated',
  data: { completed: true, migratedAt: now }
})

// 4) 读回校验
const p = await env.get('SYNC/profile')
const s = await env.get('SYNC/private-session')
const m = await env.get('SYNC/separated-auth-migrated')

console.log('SYNC/profile           =', JSON.stringify(p.data))
console.log(
  'SYNC/private-session   = serverUrl=%s username=%s token=%dchars refresh=%dchars',
  s.data.serverUrl,
  s.data.username,
  s.data.token.length,
  (s.data.refreshToken || '').length
)
console.log('SYNC/separated-auth    =', JSON.stringify(m.data))

env.close()
