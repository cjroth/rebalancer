/**
 * Storage abstraction for filesystem operations.
 * OpfsStorageAdapter uses Origin Private File System for browser use.
 * For Node.js, use FsStorageAdapter from './fs-storage.ts'.
 */

export interface StorageAdapter {
  read(key: string): Promise<string | null>
  write(key: string, data: string): Promise<void>
  exists(key: string): Promise<boolean>
  remove(key: string): Promise<void>
}

/**
 * Origin Private File System adapter — uses the browser OPFS API.
 * Used when running in the browser via ink-web.
 */
export class OpfsStorageAdapter implements StorageAdapter {
  private rootPromise: Promise<FileSystemDirectoryHandle> | null = null

  private getRoot(): Promise<FileSystemDirectoryHandle> {
    if (!this.rootPromise) {
      this.rootPromise = navigator.storage.getDirectory()
    }
    return this.rootPromise
  }

  async read(key: string): Promise<string | null> {
    try {
      const root = await this.getRoot()
      const fileHandle = await root.getFileHandle(key)
      const file = await fileHandle.getFile()
      return await file.text()
    } catch {
      return null
    }
  }

  async write(key: string, data: string): Promise<void> {
    const root = await this.getRoot()
    const fileHandle = await root.getFileHandle(key, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(data)
    await writable.close()
  }

  async exists(key: string): Promise<boolean> {
    try {
      const root = await this.getRoot()
      await root.getFileHandle(key)
      return true
    } catch {
      return false
    }
  }

  async remove(key: string): Promise<void> {
    try {
      const root = await this.getRoot()
      await root.removeEntry(key)
    } catch {
      // File doesn't exist, no-op
    }
  }
}
