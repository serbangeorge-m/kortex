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

import { expect, test } from '../fixtures/provider-fixtures';
import { waitForNavigationReady } from '../utils/app-ready';

const ENVIRONMENT_NAME = 'connected-knowledge-base';
const VECTOR_STORE_NAME = 'e2e-milvus';
const EMBEDDING_MODEL_NAME = 'docling';

test.use({ milvusConnectionName: VECTOR_STORE_NAME });

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

    test('[RAG-09] Create RAG environment via UI and verify it appears', async ({ workerNavigationBar }) => {
      const ragPage = await workerNavigationBar.navigateToRagPage();
      await ragPage.createEnvironment(ENVIRONMENT_NAME, VECTOR_STORE_NAME, EMBEDDING_MODEL_NAME);

      const isEmpty = await ragPage.checkIfRagPageIsEmpty();
      expect(isEmpty).toBe(false);
    });

    test('[RAG-10] RAG environment details show connected Milvus info', async ({ workerNavigationBar }) => {
      const ragPage = await workerNavigationBar.navigateToRagPage();
      const detailsPage = await ragPage.openEnvironmentDetails(ENVIRONMENT_NAME);
      await detailsPage.waitForLoad();

      await detailsPage.switchToSummaryTab();
      await expect(detailsPage.getInfoValue('Vector Store')).toContainText(VECTOR_STORE_NAME);
    });

    test('[RAG-11] VectorStore tab displays Milvus configuration', async ({ workerNavigationBar }) => {
      const ragPage = await workerNavigationBar.navigateToRagPage();
      const detailsPage = await ragPage.openEnvironmentDetails(ENVIRONMENT_NAME);
      await detailsPage.waitForLoad();

      await detailsPage.switchToVectorStoreTab();

      await expect(detailsPage.getInfoRow('Database Type')).toBeVisible();

      const expectedCollection = ENVIRONMENT_NAME.replace(/\W/g, '_');
      await expect(detailsPage.getInfoValue('Collection Name')).toHaveText(expectedCollection);
    });

    test('[RAG-12] Delete RAG environment from details page', async ({ workerNavigationBar }) => {
      const ragPage = await workerNavigationBar.navigateToRagPage();
      const detailsPage = await ragPage.openEnvironmentDetails(ENVIRONMENT_NAME);
      await detailsPage.waitForLoad();

      const listPage = await detailsPage.deleteEnvironment();
      await listPage.waitForLoad();
      await listPage.ensureRowDoesNotExist(ENVIRONMENT_NAME);
    });
  });
