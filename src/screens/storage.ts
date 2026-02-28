/**
 * Storage abstraction for filesystem operations.
 * FsStorageAdapter wraps Node fs for terminal use.
 * OpfsStorageAdapter uses Origin Private File System for browser use.
 */

export interface StorageAdapter {
  read(key: string): Promise<string | null>
  write(key: string, data: string): Promise<void>
  exists(key: string): Promise<boolean>
  remove(key: string): Promise<void>
}

/**
 * Node.js filesystem adapter — wraps readFileSync/writeFileSync.
 * Used when running in the terminal (Bun/Node).
 */
export class FsStorageAdapter implements StorageAdapter {
  constructor(private dir: string) {}

  async read(key: string): Promise<string | null> {
    const { join } = await import('path')
    const fs = await import('fs')
    const path = join(this.dir, key)
    try {
      return fs.readFileSync(path, 'utf-8')
    } catch {
      return null
    }
  }

  async write(key: string, data: string): Promise<void> {
    const { join } = await import('path')
    const fs = await import('fs')
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true })
    }
    fs.writeFileSync(join(this.dir, key), data)
  }

  async exists(key: string): Promise<boolean> {
    const { join } = await import('path')
    const fs = await import('fs')
    return fs.existsSync(join(this.dir, key))
  }

  async remove(key: string): Promise<void> {
    const { join } = await import('path')
    const fs = await import('fs')
    const path = join(this.dir, key)
    if (fs.existsSync(path)) {
      fs.unlinkSync(path)
    }
  }
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
