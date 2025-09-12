import type * as shared from '@kittengrid-actions/shared'
import { jest } from '@jest/globals'

export const validateDryRunInput = jest.fn<typeof shared.validateDryRunInput>()
export const startAgent = jest.fn<typeof shared.startAgent>()
