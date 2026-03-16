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

import { TEST_RAG_ENVIRONMENT } from '../fixtures/data/rag-test-data';
import { expect, test } from '../fixtures/provider-fixtures';
import { waitForNavigationReady } from '../utils/app-ready';

test.use({ ragEnvironments: [TEST_RAG_ENVIRONMENT] });

test.describe
  .serial('RAG page - seeded data', { tag: '@smoke' }, () => {
    test.beforeEach(async ({ page }) => {
      await waitForNavigationReady(page);
    });

    test('[RAG-05] Table displays seeded RAG environment row', async ({ workerNavigationBar }) => {
      const ragPage = await workerNavigationBar.navigateToRagPage();
      const isEmpty = await ragPage.checkIfRagPageIsEmpty();
      expect(isEmpty).toBeFalsy();

      await ragPage.ensureRowExists(TEST_RAG_ENVIRONMENT.name);
    });

    test('[RAG-06] Clicking environment name navigates to details page', async ({ workerNavigationBar }) => {
      const ragPage = await workerNavigationBar.navigateToRagPage();
      const detailsPage = await ragPage.openEnvironmentDetails(TEST_RAG_ENVIRONMENT.name);

      await expect(detailsPage.heading).toBeVisible();
      await expect(detailsPage.heading).toContainText(TEST_RAG_ENVIRONMENT.name);
      await expect(detailsPage.summaryTabLink).toBeVisible();
      await expect(detailsPage.sourcesTabLink).toBeVisible();
      await expect(detailsPage.vectorStoreTabLink).toBeVisible();
      await expect(detailsPage.chunkerTabLink).toBeVisible();
    });

    test('[RAG-07] Sources tab shows correct file count', async ({ workerNavigationBar }) => {
      const ragPage = await workerNavigationBar.navigateToRagPage();
      const detailsPage = await ragPage.openEnvironmentDetails(TEST_RAG_ENVIRONMENT.name);

      await detailsPage.switchToSourcesTab();
      const headerText = await detailsPage.getUploadedFilesHeader();
      const expectedCount = TEST_RAG_ENVIRONMENT.files.length;
      expect(headerText).toContain(`${expectedCount}`);
    });
  });
