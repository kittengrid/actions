/**
 * Integration tests for DownloadAgent functionality in utils.ts
 *
 * These tests download real files from GitHub releases and verify:
 * 1. Files are downloaded successfully
 * 2. Downloaded files are executable
 * 3. Error handling works properly
 */

import { describe, expect, beforeEach, afterEach, it } from '@jest/globals'
import { downloadAgent, downloadAndExtract } from '../src/utils.js'
import { promises as fs } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import * as os from 'os'
import { platform } from '@actions/core'

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
      if (platform.platform !== 'linux') {
        console.log('Skipping test: only Linux is supported')
        return
      }

      // Skip if not on supported architecture
      const arch = platform.arch === 'x64' ? 'amd64' : platform.arch
      if (arch !== 'amd64' && arch !== 'arm64') {
        console.log(
          `Skipping test: architecture ${platform.arch} not supported`
        )
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
        throw new Error(
          `Downloaded file is not executable: ${agentPath} - ${error}`
        )
      }

      // Test that the binary can be executed (should show help or version info)
      const { stdout, stderr } = await execAsync(`"${agentPath}" --help`, {
        timeout: 10000
      })

      // We expect either stdout or stderr to contain output (help text)
      expect(stdout.length + stderr.length).toBeGreaterThan(0)

      // Clean up the downloaded file
      await fs.unlink(agentPath)
    }, 30000) // 30 second timeout for download

    it('throws error for unsupported architecture', async () => {
      // Mock platform.arch to simulate unsupported architecture
      const originalArch = platform.arch
      Object.defineProperty(platform, 'arch', { value: 'unsupported' })

      try {
        await expect(downloadAgent()).rejects.toThrow(
          'Unsupported architecture'
        )
      } finally {
        // Restore original architecture
        Object.defineProperty(platform, 'arch', { value: originalArch })
      }
    })

    it('throws error for unsupported OS', async () => {
      // Mock platform.platform to simulate unsupported OS
      const originalPlatform = platform.platform
      Object.defineProperty(platform, 'platform', { value: 'win32' })

      try {
        await expect(downloadAgent()).rejects.toThrow('Unsupported OS')
      } finally {
        // Restore original platform
        Object.defineProperty(platform, 'platform', { value: originalPlatform })
      }
    })
  })

  describe('downloadAndExtract', () => {
    it('downloads and extracts a real tar.gz file', async () => {
      const testUrl =
        'https://github.com/kittengrid/agent/releases/download/v0.0.8/kittengrid-agent-linux-amd64.tar.gz'
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
        throw new Error(
          `Extracted file is not executable: ${extractedPath} ${error.message}`
        )
      }
    }, 30000) // 30 second timeout

    it('handles download failures gracefully', async () => {
      const invalidUrl =
        'https://github.com/nonexistent/repo/releases/download/v1.0.0/nonexistent.tar.gz'

      await expect(downloadAndExtract(invalidUrl, tempDir)).rejects.toThrow()
    })

    it('handles invalid tar.gz files', async () => {
      // Use a URL that returns a non-tar.gz file
      const invalidTarUrl = 'https://httpbin.org/json'

      await expect(downloadAndExtract(invalidTarUrl, tempDir)).rejects.toThrow()
    }, 10000)
  })

  describe('File permissions and security', () => {
    it('sets correct executable permissions on downloaded agent', async () => {
      if (platform.platform !== 'linux') {
        console.log('Skipping permission test: only Linux is supported')
        return
      }

      const arch = platform.arch === 'x64' ? 'amd64' : platform.arch
      if (arch !== 'amd64' && arch !== 'arm64') {
        console.log(
          `Skipping permission test: architecture ${platform.arch} not supported`
        )
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
