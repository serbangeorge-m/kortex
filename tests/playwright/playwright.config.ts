/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/
import { execFileSync } from 'node:child_process';

import type { PlaywrightTestConfig } from '@playwright/test';

import type { ResourceId } from './src/model/core/types';

// Check if Ollama is running locally by trying to connect to its port
function isOllamaRunning(): boolean {
  // If OLLAMA_ENABLED is set (CI), trust it
  if (process.env.OLLAMA_ENABLED) {
    return true;
  }

  // For local development, check if Ollama server is accessible
  // Uses node subprocess to make an HTTP request (avoids PATH security issues with curl)
  try {
    const checkScript = `
      const http = require('http');
      const req = http.get('http://localhost:11434/api/tags', { timeout: 1000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          process.exit(data.includes('models') ? 0 : 1);
        });
      });
      req.on('error', () => process.exit(1));
      req.on('timeout', () => { req.destroy(); process.exit(1); });
    `;
    execFileSync(process.execPath, ['-e', checkScript], { timeout: 2000, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const ollamaAvailable = isOllamaRunning();
if (ollamaAvailable) {
  console.log('Ollama detected - enabling Ollama-Provider project');
}

const config: PlaywrightTestConfig & {
  projects?: Array<{
    use?: { resource?: ResourceId };
    [key: string]: unknown;
  }>;
} = {
  testDir: './src',
  timeout: 180_000,

  workers: 1,

  reporter: [
    ['html', { outputFolder: './output/html-report' }],
    ['json', { outputFile: './output/test-results.json' }],
    ['junit', { outputFile: './output/junit-results.xml' }],
    ['list'],
  ],

  use: {
    actionTimeout: 15_000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  preserveOutput: 'always',

  projects: [
    {
      name: 'Kortex-App-Core',
      testMatch: ['**/*.spec.ts'],
      testIgnore: ['**/provider-specs/*.spec.ts'],
    },
    {
      name: 'Gemini-Provider',
      testMatch: ['**/provider-specs/*.spec.ts'],
      use: {
        resource: 'gemini',
      },
      testIgnore: process.env.GEMINI_API_KEY ? [] : ['**/*'], // Skip if GEMINI_API_KEY is not set
    },
    {
      name: 'OpenAI-Provider',
      testMatch: ['**/provider-specs/*.spec.ts'],
      use: {
        resource: 'openai',
      },
      testIgnore: process.env.OPENAI_API_KEY ? [] : ['**/*'], // Skip if OPENAI_API_KEY is not set
    },
    {
      name: 'OpenShift-AI-Provider',
      testMatch: ['**/provider-specs/*.spec.ts'],
      use: {
        resource: 'openshift-ai',
      },
      testIgnore: ['**/*'], // Disabled until OpenShift AI resource creation is implemented
    },
    {
      name: 'Ollama-Provider',
      testMatch: ['**/provider-specs/*.spec.ts'],
      use: {
        resource: 'ollama',
      },
      testIgnore: ollamaAvailable
        ? ['**/provider-specs/flows-smoke.spec.ts'] // Flows not yet supported for Ollama
        : ['**/*'], // Skip all if Ollama is not running
    },
  ],

  outputDir: './output/test-results',
};

export default config;
