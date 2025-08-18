/**
 * Integration tests for DownloadAgent functionality in utils.ts
 *
 * These tests download real files from GitHub releases and verify:
 * 1. Files are downloaded successfully
 * 2. Downloaded files are executable
 * 3. Error handling works properly
 */

import { describe, expect, beforeEach, afterEach, it } from '@jest/globals';
import { downloadAgent, downloadAndExtract } from '../src/utils.js'
import { promises as fs } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import * as os from 'os'

const execAsync = promisify(exec)

describe('DownloadAgent Integration Tests', () => {
  let tempDir: string

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'download-agent-test-'))
  })

  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
      } catch (error) {
        console.warn(`Failed to clean up temp directory ${tempDir}:`, error)
      }
    }
  })

  describe('downloadAgent', () => {
    it('downloads the agent for current platform and verifies it is executable', async () => {
      // Skip if not on Linux (as per utils.ts limitation)
      if (process.platform !== 'linux') {
        console.log('Skipping test: only Linux is supported')
        return
      }

      // Skip if not on supported architecture
      const arch = process.arch === 'x64' ? 'amd64' : process.arch
      if (arch !== 'amd64' && arch !== 'arm64') {
        console.log(`Skipping test: architecture ${process.arch} not supported`)
        return
      }

      const agentPath = await downloadAgent()

      // Verify file exists
      expect(agentPath).toBeTruthy()
      const stats = await fs.stat(agentPath)
      expect(stats.isFile()).toBe(true)
      expect(stats.size).toBeGreaterThan(0)

      // Verify file is executable
      try {
        await fs.access(agentPath, fs.constants.F_OK | fs.constants.X_OK)
      } catch (error) {
        throw new Error(`Downloaded file is not executable: ${agentPath}`)
      }

      // Test that the binary can be executed (should show help or version info)
      try {
        const { stdout, stderr } = await execAsync(`"${agentPath}" --help`, { timeout: 10000 })

        // We expect either stdout or stderr to contain output (help text)
        expect(stdout.length + stderr.length).toBeGreaterThan(0)
      } catch (error: any) {
        // If --help doesn't work, try --version
        try {
          const { stdout, stderr } = await execAsync(`"${agentPath}" --version`, { timeout: 10000 })
          expect(stdout.length + stderr.length).toBeGreaterThan(0)
        } catch (versionError) {
          // If neither help nor version work, at least verify it's a valid binary
          // by checking it doesn't fail with "permission denied" or "not found"
          expect(error.code).not.toBe(127) // Command not found
          expect(error.code).not.toBe(126) // Permission denied
        }
      }

      // Clean up the downloaded file
      await fs.unlink(agentPath)
    }, 30000) // 30 second timeout for download

    it('throws error for unsupported architecture', async () => {
      // Mock process.arch to simulate unsupported architecture
      const originalArch = process.arch
      Object.defineProperty(process, 'arch', { value: 'unsupported' })

      try {
        await expect(downloadAgent()).rejects.toThrow('Unsupported architecture')
      } finally {
        // Restore original architecture
        Object.defineProperty(process, 'arch', { value: originalArch })
      }
    })

    it('throws error for unsupported OS', async () => {
      // Mock process.platform to simulate unsupported OS
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'win32' })

      try {
        await expect(downloadAgent()).rejects.toThrow('Unsupported OS')
      } finally {
        // Restore original platform
        Object.defineProperty(process, 'platform', { value: originalPlatform })
      }
    })
  })

  describe('downloadAndExtract', () => {
    it('downloads and extracts a real tar.gz file', async () => {
      const testUrl = 'https://github.com/kittengrid/agent/releases/download/v0.0.8/kittengrid-agent-linux-amd64.tar.gz'
      const extractedPath = await downloadAndExtract(testUrl, tempDir)

      // Verify file was extracted
      expect(extractedPath).toBeTruthy()
      expect(extractedPath).toContain(tempDir)

      const stats = await fs.stat(extractedPath)
      expect(stats.isFile()).toBe(true)
      expect(stats.size).toBeGreaterThan(0)

      // Verify the extracted file is executable
      try {
        await fs.access(extractedPath, fs.constants.F_OK | fs.constants.X_OK)
      } catch (error) {
        throw new Error(`Extracted file is not executable: ${extractedPath}`)
      }
    }, 30000) // 30 second timeout

    it('handles download failures gracefully', async () => {
      const invalidUrl = 'https://github.com/nonexistent/repo/releases/download/v1.0.0/nonexistent.tar.gz'

      await expect(downloadAndExtract(invalidUrl, tempDir)).rejects.toThrow()
    }, 10000)

    it('handles invalid tar.gz files', async () => {
      // Use a URL that returns a non-tar.gz file
      const invalidTarUrl = 'https://httpbin.org/json'

      await expect(downloadAndExtract(invalidTarUrl, tempDir)).rejects.toThrow()
    }, 10000)
  })

  describe('File permissions and security', () => {
    it('sets correct executable permissions on downloaded agent', async () => {
      if (process.platform !== 'linux') {
        console.log('Skipping permission test: only Linux is supported')
        return
      }

      const arch = process.arch === 'x64' ? 'amd64' : process.arch
      if (arch !== 'amd64' && arch !== 'arm64') {
        console.log(`Skipping permission test: architecture ${process.arch} not supported`)
        return
      }

      const agentPath = await downloadAgent()

      // Check file permissions
      const stats = await fs.stat(agentPath)
      const permissions = stats.mode & parseInt('777', 8)

      // Should be executable (at least user execute bit set)
      expect(permissions & parseInt('100', 8)).toBeGreaterThan(0)

      // Clean up
      await fs.unlink(agentPath)
    }, 30000)
  })
})
