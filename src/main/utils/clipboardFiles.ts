import { clipboard } from 'electron'
import fs from 'fs'
import os from 'os'
import path from 'path'
import plist from 'simple-plist'
import { ClipboardMonitor } from '../core/native'

export interface ClipboardFileItem {
  path: string
  name: string
  isDirectory: boolean
}

const MAC_FILE_PBOARD_TYPE = 'NSFilenamesPboardType'

function normalizeFilePaths(files: Array<string | { path: string }>): string[] {
  return files
    .map((file) => (typeof file === 'string' ? file : file.path))
    .filter((filePath): filePath is string => typeof filePath === 'string' && filePath.length > 0)
}

export function hasClipboardFiles(): boolean {
  if (os.platform() === 'darwin') {
    return clipboard.has(MAC_FILE_PBOARD_TYPE)
  }

  if (os.platform() === 'win32') {
    return readClipboardFiles().length > 0
  }

  return false
}

export function readClipboardFilePaths(): string[] {
  if (os.platform() === 'darwin') {
    if (!clipboard.has(MAC_FILE_PBOARD_TYPE)) {
      return []
    }

    const result = clipboard.read(MAC_FILE_PBOARD_TYPE)
    if (!result) {
      return []
    }

    const filePaths = plist.parse(result) as string[]
    return Array.isArray(filePaths) ? filePaths : []
  }

  if (os.platform() === 'win32') {
    return ClipboardMonitor.getClipboardFiles().map((file) => file.path)
  }

  return []
}

export function readClipboardFiles(): ClipboardFileItem[] {
  if (os.platform() === 'win32') {
    return ClipboardMonitor.getClipboardFiles()
  }

  if (os.platform() !== 'darwin') {
    return []
  }

  return readClipboardFilePaths().map((filePath) => {
    let isDirectory = false
    try {
      isDirectory = fs.statSync(filePath).isDirectory()
    } catch {
      // ignore
    }

    return {
      path: filePath,
      name: path.basename(filePath),
      isDirectory
    }
  })
}

export function writeClipboardFiles(files: Array<string | { path: string }>): boolean {
  const filePaths = normalizeFilePaths(files)
  if (filePaths.length === 0) {
    throw new Error('files array cannot be empty')
  }

  if (os.platform() === 'win32') {
    return ClipboardMonitor.setClipboardFiles(filePaths)
  }

  if (os.platform() === 'darwin') {
    const plistData = plist.stringify(filePaths)
    clipboard.writeBuffer(MAC_FILE_PBOARD_TYPE, Buffer.from(plistData))
    return true
  }

  return false
}
