import { mkdir, readFile, writeFile, rm, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

/**
 * Default cache directory location.
 */
export const CACHE_DIR = join(homedir(), ".mcp-docs-cache");

/**
 * Ensures a directory exists, creating it and parents if needed.
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

/**
 * Ensures parent directory exists before writing a file.
 */
export async function ensureParentDir(filePath: string): Promise<void> {
  await ensureDir(dirname(filePath));
}

/**
 * Reads a JSON file and parses it.
 * Returns null if file doesn't exist.
 */
export async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Writes an object as JSON to a file, creating parent dirs if needed.
 */
export async function writeJson<T>(filePath: string, data: T): Promise<void> {
  await ensureParentDir(filePath);
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Reads a text file.
 * Returns null if file doesn't exist.
 */
export async function readText(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Writes text to a file, creating parent dirs if needed.
 */
export async function writeText(filePath: string, content: string): Promise<void> {
  await ensureParentDir(filePath);
  await writeFile(filePath, content, "utf-8");
}

/**
 * Removes a file or directory recursively.
 * Does nothing if path doesn't exist.
 */
export async function remove(targetPath: string): Promise<void> {
  try {
    await rm(targetPath, { recursive: true, force: true });
  } catch (error) {
    // Ignore if already doesn't exist
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

/**
 * Lists immediate subdirectories in a directory.
 * Returns empty array if directory doesn't exist.
 */
export async function listDirectories(dirPath: string): Promise<string[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

/**
 * Checks if a path exists.
 */
export async function exists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

