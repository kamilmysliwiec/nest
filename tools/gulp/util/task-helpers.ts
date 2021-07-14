import { readdirSync, statSync } from 'fs';
import { join } from 'path';

function isDirectory(path: string) {
  return statSync(path).isDirectory();
}

export function getFolders(dir: string) {
  return readdirSync(dir).filter(file => isDirectory(join(dir, file)));
}

export function getDirs(base: string) {
  return getFolders(base).map(path => `${base}/${path}`);
}

/**
 * Checks if the directory contains a package.json file
 * @param dir Path to the dircetory
 * @returns True if the directory contains a package.json
 */
export function containsPackageJson(dir: string) {
  return readdirSync(dir).some(file => file === 'package.json');
}
