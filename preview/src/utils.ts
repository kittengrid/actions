import fetch from "node-fetch";
import { basename } from "path";
import * as tar from "tar";
const AGENT_VERSION = "0.0.8";

/**
 * Downloads a .tar.gz from a given URL and extracts its single file.
 * Saves the extracted file to the specified destination directory.
 *
 * @param url - The .tar.gz URL
 * @param outputDir - Directory where the extracted file should go
 * @returns Promise<string> - Resolves with the extracted file path
 */
export async function downloadAndExtract(url: string, outputDir: string = "."): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }


  // Extract directly from the response stream
  return new Promise((resolve, reject) => {
    let extractedFilePath = "";

    if (!response.body || response.body === null) {
      throw new Error(`No response body received from ${url}`);
    }

    response.body
      .pipe(
        tar.x({
          cwd: outputDir,      // where to extract
          strict: true,
          onentry: (entry) => {
            extractedFilePath = `${outputDir}/${basename(entry.path)}`;
          },
        })
      )
      .on("error", reject)
      .on("close", () => resolve(extractedFilePath));
  });
}

/**
 * Downloads the Kittengrid agent for a specific architecture, OS, and version.
 *
 * @param arch - The architecture (e.g., 'amd64', 'arm64')
 * @param os - The operating system (e.g., 'linux', 'darwin')
 * @param version - The version of the agent to download
 * @param outputDir - Destination path to save the downloaded file
 * @returns Promise<string> - Resolves with the path to the downloaded agent
**/
async function downloadAgentInternal(arch: string, os: string, version: string, outputDir: string): Promise<string> {
  var url = `https://github.com/kittengrid/agent/releases/download/v${version}/kittengrid-agent-${os}-${arch}.tar.gz`;
  return downloadAndExtract(url, outputDir)
}

export async function downloadAgent(): Promise<string> {
  const arch = process.arch === "x64" ? "amd64" : process.arch;

  if (arch !== "amd64" && arch !== "arm64") {
    throw new Error(`Unsupported architecture: ${process.arch}. Only amd64 and arm64 are supported.`);
  }

  const os = process.platform;
  if (os !== "linux") {
    throw new Error(`Unsupported OS: ${process.platform}. Only linux is currently supported.`);
  }

  return downloadAgentInternal(arch, os, AGENT_VERSION, `/tmp`);
}

