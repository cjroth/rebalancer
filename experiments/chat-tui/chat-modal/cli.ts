#!/usr/bin/env bun
/**
 * B4: Wizard with On-Demand Chat Modal
 * Press `/` at any time to open chat overlay.
 */
import { render } from 'ink'
import * as fs from 'fs'
import React from 'react'
import { FsStorageAdapter } from '../../../src/screens/fs-storage.ts'
import { ChatModalWizard } from './ChatModalWizard.tsx'

const dataDir = process.argv[2] || './portfolio-data'
const storage = new FsStorageAdapter(dataDir)
const readFile = (path: string) => fs.readFileSync(path, 'utf-8')

render(
  React.createElement(ChatModalWizard, { dataDir, storage, readFile }),
)
