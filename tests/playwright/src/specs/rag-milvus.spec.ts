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

import { CONNECTED_RAG_ENVIRONMENT, MILVUS_CONNECTION_NAME } from '../fixtures/data/rag-test-data';
import { expect, test } from '../fixtures/provider-fixtures';
import { waitForNavigationReady } from '../utils/app-ready';

test.use({ ragEnvironments: [CONNECTED_RAG_ENVIRONMENT] });

test.describe
  .serial('RAG Pipeline with Milvus', { tag: '@rag-provider' }, () => {
    test.skip(
      process.platform !== 'linux' && !process.env.MILVUS_ENABLED,
      'RAG pipeline tests require Podman (set MILVUS_ENABLED=true on non-Linux)',
    );

    test.beforeEach(async ({ page }) => {
      await waitForNavigationReady(page);
    });

    test('[RAG-08] Milvus connection is visible in Settings Resources', async ({
      milvusSetup: _milvusSetup,
      workerNavigationBar,
    }) => {
      const settingsPage = await workerNavigationBar.navigateToSettingsPage();
      const resourcesPage = await settingsPage.openResources();
      await resourcesPage.waitForLoad();

      const milvusRegion = resourcesPage.getProviderRegion('milvus');
      await expect(milvusRegion).toBeVisible();

      const connection = resourcesPage.getCreatedConnectionFor('milvus', 'rag');
      await expect(connection).toBeVisible();
    });

    test('[RAG-09] Seeded RAG environment appears in the Knowledge Bases list', async ({ workerNavigationBar }) => {
      const ragPage = await workerNavigationBar.navigateToRagPage();
      await ragPage.waitForLoad();

      const isEmpty = await ragPage.checkIfRagPageIsEmpty();
      expect(isEmpty).toBe(false);
    });

    test('[RAG-10] RAG environment details show connected Milvus info', async ({ workerNavigationBar }) => {
      const ragPage = await workerNavigationBar.navigateToRagPage();
      const detailsPage = await ragPage.openEnvironmentDetails(CONNECTED_RAG_ENVIRONMENT.name);
      await detailsPage.waitForLoad();

      await detailsPage.switchToSummaryTab();
      await expect(detailsPage.getInfoValue('Vector Store')).toContainText(MILVUS_CONNECTION_NAME);
    });

    test('[RAG-11] VectorStore tab displays Milvus configuration', async ({ workerNavigationBar }) => {
      const ragPage = await workerNavigationBar.navigateToRagPage();
      const detailsPage = await ragPage.openEnvironmentDetails(CONNECTED_RAG_ENVIRONMENT.name);
      await detailsPage.waitForLoad();

      await detailsPage.switchToVectorStoreTab();

      await expect(detailsPage.getInfoRow('Database Type')).toBeVisible();

      const expectedCollection = CONNECTED_RAG_ENVIRONMENT.name.replace(/\W/g, '_');
      await expect(detailsPage.getInfoValue('Collection Name')).toHaveText(expectedCollection);
    });

    test('[RAG-12] Delete seeded RAG environment from details page', async ({ workerNavigationBar }) => {
      const ragPage = await workerNavigationBar.navigateToRagPage();
      await ragPage.waitForLoad();

      if (await ragPage.checkIfRagPageIsEmpty()) {
        return;
      }

      const detailsPage = await ragPage.openEnvironmentDetails(CONNECTED_RAG_ENVIRONMENT.name);
      await detailsPage.waitForLoad();

      const listPage = await detailsPage.deleteEnvironment();
      await listPage.waitForLoad();

      const isEmpty = await listPage.checkIfRagPageIsEmpty();
      expect(isEmpty).toBe(true);
    });
  });
