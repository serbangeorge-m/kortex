/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
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

import { _electron as electron } from '@playwright/test';

import {
  closeAllWindows,
  createLaunchConfig,
  type ElectronFixtures,
  getTestHomeDir,
  type RagEnvironmentSeed,
  seedRagEnvironments,
  test as base,
} from './electron-app';

export const TEST_RAG_ENVIRONMENT: RagEnvironmentSeed = {
  name: 'test-knowledge-base',
  ragConnection: { name: 'test-milvus-db', providerId: 'test-milvus-provider' },
  chunkerId: 'test-docling-chunker',
  files: [
    { path: '/docs/readme.md', status: 'indexed' },
    { path: '/docs/guide.md', status: 'pending' },
  ],
};

export const test = base.extend<ElectronFixtures>({
  // eslint-disable-next-line no-empty-pattern
  electronApp: async ({}, use): Promise<void> => {
    const launchConfig = createLaunchConfig();
    seedRagEnvironments(getTestHomeDir(), [TEST_RAG_ENVIRONMENT]);

    let electronApp;
    try {
      electronApp = await electron.launch(launchConfig);
      await use(electronApp);
    } finally {
      if (electronApp) {
        try {
          await closeAllWindows(electronApp);
          await electronApp.close();
        } catch (error) {
          console.error('Error closing Electron app:', error);
          try {
            await electronApp.close();
          } catch {
            // Ignore errors during forced close
          }
        }
      }
    }
  },
});

export { expect } from '@playwright/test';
