/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
import { jest, describe, expect, beforeEach, it } from '@jest/globals'

import * as shared from '../__fixtures__/shared.js'
jest.unstable_mockModule('@kittengrid-actions/shared', () => shared)

import * as core from '../__fixtures__/core.js'
jest.unstable_mockModule('@actions/core', () => core)

import * as github from '../__fixtures__/github.js'
jest.unstable_mockModule('@actions/github', () => github)

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const { run } = await import('../src/main.js')

const config = `
services:
  - name: service - a
    cmd: python3
    port: 10000
    health_check:
      path: /
    args:
      - -m
      - http.server
      - 10000
`

describe('main.ts', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    core.getInput.mockImplementation(() => {
      return config
    })
  })

  it('runs the agent in dry mode when dry-run is correctly set', async () => {
    shared.validateDryRunInput.mockImplementation(() => {
      return true
    })

    await run()
    expect(shared.startAgent).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      true
    )
  })

  it('exits with an error when dry mode is incorrecly set (Error type)', async () => {
    shared.validateDryRunInput.mockImplementation(() => {
      throw new Error('Invalid dry-run value')
    })

    await run()
    expect(core.setFailed).toHaveBeenCalledWith('Invalid dry-run value')
  })

  it('exits with an error when dry mode is incorrecly set (String)', async () => {
    shared.validateDryRunInput.mockImplementation(() => {
      throw 'Invalid dry-run value'
    })

    await run()
    expect(core.setFailed).toHaveBeenCalledWith('Invalid dry-run value')
  })

  it('adds --start-terminal true by default to the args', async () => {
    core.getInput.mockImplementation(() => {
      return ''
    })

    await run()
    expect(shared.startAgent).toHaveBeenCalledWith(
      expect.anything(),
      ['--start-terminal', 'true'],
      undefined
    )
  })

  it('starts services when the runner is a bot', async () => {
    github.context.actor = 'some-bot'

    await run()
    expect(shared.startAgent).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining(['--start-services', 'true']),
      undefined
    )
  })
})
