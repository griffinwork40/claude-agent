// lib/mammoth-loader.ts
/**
 * Helper for lazily loading the optional `mammoth` dependency. This keeps Next.js
 * builds working in environments without network access (no preinstall step) and
 * provides a descriptive error when DOCX parsing isn't available.
 */

const OPTIONAL_DEPENDENCY_MESSAGE = 'DOCX parsing requires the optional dependency "mammoth". Install it to enable DOCX uploads.';

let cachedModule: typeof import('mammoth') | null = null;
let cachedError: Error | null = null;

export async function loadMammoth(): Promise<typeof import('mammoth')> {
  if (cachedModule) {
    return cachedModule;
  }

  if (cachedError) {
    throw cachedError;
  }

  try {
    const moduleName = 'mammoth';
    const mammothModule = await import(moduleName);
    cachedModule = mammothModule;
    return mammothModule;
  } catch (error) {
    const dependencyError = new Error(OPTIONAL_DEPENDENCY_MESSAGE, { cause: error instanceof Error ? error : undefined });
    cachedError = dependencyError;
    throw dependencyError;
  }
}

export function resetMammothCacheForTests() {
  cachedModule = null;
  cachedError = null;
}

export { OPTIONAL_DEPENDENCY_MESSAGE };
