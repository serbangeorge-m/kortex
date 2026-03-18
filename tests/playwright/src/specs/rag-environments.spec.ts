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

const ENVIRONMENT_NAME = 'test-knowledge-base';
const VECTOR_STORE_NAME = 'e2e-milvus';
const EMBEDDING_MODEL_NAME = 'docling';

test.use({ milvusConnectionName: VECTOR_STORE_NAME });

test.describe
  .serial('RAG page - UI creation', { tag: '@rag-provider' }, () => {
    test.skip(
      process.platform !== 'linux' && !process.env.MILVUS_ENABLED,
      'RAG UI creation tests require Podman (set MILVUS_ENABLED=true on non-Linux)',
    );

    test.beforeEach(async ({ page }) => {
      await waitForNavigationReady(page);
    });

    test('[RAG-05] Create RAG environment via UI and verify row appears', async ({
      milvusSetup: _milvusSetup,
      workerNavigationBar,
    }) => {
      const ragPage = await workerNavigationBar.navigateToRagPage();
      await ragPage.createEnvironment(ENVIRONMENT_NAME, VECTOR_STORE_NAME, EMBEDDING_MODEL_NAME);

      const isEmpty = await ragPage.checkIfRagPageIsEmpty();
      expect(isEmpty).toBeFalsy();
      await ragPage.ensureRowExists(ENVIRONMENT_NAME);
    });

    test('[RAG-06] Clicking environment name navigates to details page', async ({ workerNavigationBar }) => {
      const ragPage = await workerNavigationBar.navigateToRagPage();
      const detailsPage = await ragPage.openEnvironmentDetails(ENVIRONMENT_NAME);

      await expect(detailsPage.heading).toBeVisible();
      await expect(detailsPage.heading).toContainText(ENVIRONMENT_NAME);
      await expect(detailsPage.summaryTabLink).toBeVisible();
      await expect(detailsPage.sourcesTabLink).toBeVisible();
      await expect(detailsPage.vectorStoreTabLink).toBeVisible();
      await expect(detailsPage.chunkerTabLink).toBeVisible();
    });

    test('[RAG-07] Sources tab shows zero files for freshly created environment', async ({ workerNavigationBar }) => {
      const ragPage = await workerNavigationBar.navigateToRagPage();
      const detailsPage = await ragPage.openEnvironmentDetails(ENVIRONMENT_NAME);

      await detailsPage.switchToSourcesTab();
      const headerText = await detailsPage.getUploadedFilesHeader();
      expect(headerText).toContain('0');
    });

    test('[RAG-13] Delete RAG environment from details page', async ({ workerNavigationBar }) => {
      const ragPage = await workerNavigationBar.navigateToRagPage();
      const detailsPage = await ragPage.openEnvironmentDetails(ENVIRONMENT_NAME);
      await detailsPage.waitForLoad();

      const listPage = await detailsPage.deleteEnvironment();
      await listPage.waitForLoad();
      await listPage.ensureRowDoesNotExist(ENVIRONMENT_NAME);
    });
  });
