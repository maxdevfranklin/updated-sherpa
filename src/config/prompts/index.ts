// prompts/index.ts
// Loads all prompt files from the prompts directory using fs (server-side only)

// Use conditional require only on server-side
const isServerInit = typeof window === 'undefined';

console.log('[Prompts] 🚀 Initializing prompts module...');
console.log(`[Prompts] 📍 isServerInit: ${isServerInit}`);
console.log(`[Prompts] 📍 typeof window: ${typeof window}`);

// Load prompts once at module initialization (server-side only)
let prompts: Record<string, string> = {};
let promptsLoaded = false;

if (isServerInit) {
  console.log('[Prompts] ✅ Running on server, loading files...');
  try {
    const fs = require('fs');
    const path = require('path');

    // Get directory path - use project root approach for Next.js compatibility
    // In Next.js, we resolve from project root which is more reliable
    const projectRoot = process.cwd();
    const promptsDir = path.resolve(projectRoot, 'src/config/prompts');
    
    console.log(`[Prompts] 📁 Project root: ${projectRoot}`);
    console.log(`[Prompts] 📁 Prompts directory: ${promptsDir}`);
    console.log(`[Prompts] 📁 Directory exists: ${fs.existsSync(promptsDir)}`);

    // Helper to read a prompt file
    const readPrompt = (filePath: string): string => {
      try {
        const fullPath = path.resolve(promptsDir, filePath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf-8').trim();
          console.log(`[Prompts] ✅ Loaded: ${filePath} (${content.length} chars)`);
          return content;
        }
        console.warn(`[Prompts] ⚠️ File not found: ${filePath}`);
        console.warn(`[Prompts] ⚠️ Resolved path: ${fullPath}`);
        console.warn(`[Prompts] ⚠️ File exists: ${fs.existsSync(fullPath)}`);
        return '';
      } catch (error) {
        console.error(`[Prompts] ❌ Error loading file ${filePath}:`, error);
        return '';
      }
    };

    // Load all prompts from .txt files
    prompts = {
      'main/main-prompt': readPrompt('main/main-prompt.txt'),
      'trust-building': readPrompt('trust-building.txt'),
      'situation-discovery': readPrompt('situation-discovery.txt'),
      'lifestyle-discovery': readPrompt('lifestyle-discovery.txt'),
      'readiness-discovery': readPrompt('readiness-discovery.txt'),
      'priorities-discovery': readPrompt('priorities-discovery.txt'),
      'schedule-visit': readPrompt('schedule-visit.txt'),
      'good-bye': readPrompt('good-bye.txt'),
      'needs-matching': readPrompt('needs-matching.txt'),
    };
    
    promptsLoaded = true;
    console.log(`[Prompts] ✅ Loaded ${Object.keys(prompts).length} prompts from files`);
    console.log(`[Prompts] 📊 Prompt keys:`, Object.keys(prompts));
    console.log(`[Prompts] 📊 Sample content lengths:`, Object.entries(prompts).map(([k, v]) => `${k}:${v.length}`).join(', '));
  } catch (error) {
    console.error('[Prompts] ❌ Error loading prompts from files:', error);
    console.error('[Prompts] ❌ Error details:', error instanceof Error ? error.stack : error);
    // Fallback to empty prompts if loading fails
    prompts = {};
  }
} else {
  console.warn('[Prompts] ⚠️ Running on client-side - prompts cannot be loaded from .txt files');
  console.warn('[Prompts] ⚠️ Prompts will be empty. Config must be built server-side.');
}

// Helper function to load prompts on-demand (in case they weren't loaded at module init)
function ensurePromptsLoaded(): void {
  const currentIsServer = typeof window === 'undefined';
  const promptCount = Object.keys(prompts).filter(k => prompts[k]).length;
  
  console.log(`[Prompts] 🔍 ensurePromptsLoaded: isServer=${currentIsServer}, promptCount=${promptCount}, totalKeys=${Object.keys(prompts).length}, promptsLoaded=${promptsLoaded}`);
  
  // If prompts were already loaded server-side, don't try to reload
  if (promptsLoaded && promptCount > 0) {
    console.log(`[Prompts] ℹ️ Prompts already loaded, using cached version`);
    return;
  }
  
  if (currentIsServer && promptCount === 0) {
    console.log('[Prompts] 🔄 Attempting to load prompts on-demand...');
    try {
      const fs = require('fs');
      const path = require('path');
      const projectRoot = process.cwd();
      const promptsDir = path.resolve(projectRoot, 'src/config/prompts');
      
      console.log(`[Prompts] 📁 On-demand load - Project root: ${projectRoot}`);
      console.log(`[Prompts] 📁 On-demand load - Prompts dir: ${promptsDir}`);
      console.log(`[Prompts] 📁 On-demand load - Directory exists: ${fs.existsSync(promptsDir)}`);
      
      const readPrompt = (filePath: string): string => {
        try {
          const fullPath = path.resolve(promptsDir, filePath);
          if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, 'utf-8').trim();
            console.log(`[Prompts] ✅ On-demand loaded: ${filePath} (${content.length} chars)`);
            return content;
          }
          console.warn(`[Prompts] ⚠️ On-demand - File not found: ${fullPath}`);
          return '';
        } catch (error) {
          console.error(`[Prompts] ❌ On-demand - Error loading ${filePath}:`, error);
          return '';
        }
      };

      prompts = {
        'main/main-prompt': readPrompt('main/main-prompt.txt'),
        'trust-building': readPrompt('trust-building.txt'),
        'situation-discovery': readPrompt('situation-discovery.txt'),
        'lifestyle-discovery': readPrompt('lifestyle-discovery.txt'),
        'readiness-discovery': readPrompt('readiness-discovery.txt'),
        'priorities-discovery': readPrompt('priorities-discovery.txt'),
        'schedule-visit': readPrompt('schedule-visit.txt'),
        'good-bye': readPrompt('good-bye.txt'),
        'needs-matching': readPrompt('needs-matching.txt'),
      };
      const loadedCount = Object.keys(prompts).filter(k => prompts[k]).length;
      console.log(`[Prompts] ✅ Loaded ${loadedCount} prompts on-demand`);
      console.log(`[Prompts] 📊 On-demand loaded keys:`, Object.keys(prompts));
    } catch (error) {
      console.error('[Prompts] ❌ Error loading prompts on-demand:', error);
      console.error('[Prompts] ❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
    }
  } else {
    console.log(`[Prompts] ℹ️ Skipping on-demand load - isServer: ${currentIsServer}, hasPrompts: ${promptCount > 0}`);
  }
}

// Helper function to get a prompt by key (for backward compatibility)
export function getPrompt(key: string): string {
  console.log(`[Prompts] 🔍 getPrompt called with key: ${key}`);
  console.log(`[Prompts] 🔍 Current prompts object:`, Object.keys(prompts));
  console.log(`[Prompts] 🔍 Current prompts with content:`, Object.keys(prompts).filter(k => prompts[k]).map(k => `${k}:${prompts[k].length}`));
  
  // Ensure prompts are loaded (on-demand loading)
  ensurePromptsLoaded();
  
  // Map old format to new format
  const keyMap: Record<string, string> = {
    'prompts/main/main-prompt.txt': 'main/main-prompt',
    'prompts/trust-building.txt': 'trust-building',
    'prompts/situation-discovery.txt': 'situation-discovery',
    'prompts/lifestyle-discovery.txt': 'lifestyle-discovery',
    'prompts/readiness-discovery.txt': 'readiness-discovery',
    'prompts/verify_identity.txt': 'priorities-discovery', // Maps to priorities-discovery.txt
    'prompts/priorities-discovery.txt': 'priorities-discovery',
    'prompts/schedule-visit.txt': 'schedule-visit',
  };

  // Check if we have a direct mapping
  if (keyMap[key]) {
    const mappedKey = keyMap[key];
    const result = prompts[mappedKey] || '';
    console.log(`[Prompts] 🔍 Mapped key: ${key} -> ${mappedKey}, result length: ${result.length}`);
    if (!result) {
      console.warn(`[Prompts] ⚠️ Prompt empty for key: ${key} -> ${mappedKey}`);
      console.warn(`[Prompts] ⚠️ Available prompts:`, Object.keys(prompts));
    }
    return result;
  }

  // Otherwise, try to extract the key from the path
  const mappedKey = key.replace('prompts/', '').replace('.txt', '').replace('main/', 'main/');
  const result = prompts[mappedKey] || '';
  console.log(`[Prompts] 🔍 Extracted key: ${key} -> ${mappedKey}, result length: ${result.length}`);
  if (!result && mappedKey) {
    console.warn(`[Prompts] ⚠️ Prompt empty for key: ${key} -> ${mappedKey}`);
    console.warn(`[Prompts] ⚠️ Available prompts:`, Object.keys(prompts));
  }
  return result;
}

// Export all prompts for direct access if needed
export { prompts };

