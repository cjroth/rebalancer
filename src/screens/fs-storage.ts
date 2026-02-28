/**
 * Node.js filesystem adapter — wraps readFileSync/writeFileSync.
 * Used when running in the terminal (Bun/Node).
 *
 * This file is intentionally separate from storage.ts so that
 * browser bundles never pull in dynamic import('fs')/import('path').
 */
import type { StorageAdapter } from './storage.ts'

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
