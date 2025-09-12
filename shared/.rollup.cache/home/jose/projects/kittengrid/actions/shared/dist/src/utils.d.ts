import * as github from '@actions/github'
export declare const AGENT_VERSION = '0.0.11'
/**
 * Downloads a .tar.gz from a given URL and extracts its single file.
 * Saves the extracted file to the specified destination directory.
 *
 * @param url - The .tar.gz URL
 * @param outputDir - Directory where the extracted file should go
 * @returns Promise<string> - Resolves with the extracted file path
 */
export declare function downloadAndExtract(
  url: string,
  outputDir?: string
): Promise<string>
export declare function downloadAgent(): Promise<string>
export declare function showContextInfo(): Promise<void>
export declare function populateEnv(ctx: typeof github.context): Promise<void>
