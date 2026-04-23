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

import { expect, workerTest as test } from '../fixtures/electron-app';
import { waitForNavigationReady } from '../utils/app-ready';

test.describe('Workspaces page - initial state', { tag: '@smoke' }, () => {
  test.beforeEach(async ({ page, navigationBar }) => {
    await waitForNavigationReady(page);
    await navigationBar.navigateToWorkspacesPage();
  });

  test('[WKS-INIT-01] Workspaces page renders with heading and create button', async ({ agentWorkspacesPage }) => {
    await expect(agentWorkspacesPage.heading).toBeVisible();
    await expect(agentWorkspacesPage.createButton).toBeVisible();
    await expect(agentWorkspacesPage.createButton).toBeEnabled();
    await expect(agentWorkspacesPage.searchInput).toBeVisible();
  });

  test('[WKS-INIT-02] Empty state is shown when no workspaces exist', async ({ agentWorkspacesPage }) => {
    await expect(agentWorkspacesPage.noWorkspacesMessage).toBeVisible();
    await expect(agentWorkspacesPage.table).not.toBeVisible();
  });
});

test.describe('Workspaces page - create form', { tag: '@smoke' }, () => {
  test.beforeEach(async ({ page, navigationBar }) => {
    await waitForNavigationReady(page);
    await navigationBar.navigateToWorkspacesPage();
  });

  test('[WKS-CREATE-01] Create page loads with correct heading', async ({ agentWorkspacesPage }) => {
    const createPage = await agentWorkspacesPage.openCreatePage();
    await expect(createPage.heading).toBeVisible();
  });

  test('[WKS-CREATE-02] Session details form fields are present', async ({ agentWorkspacesPage }) => {
    const createPage = await agentWorkspacesPage.openCreatePage();

    await expect(createPage.sessionNameInput).toBeVisible();
    await expect(createPage.workingDirInput).toBeVisible();
    await expect(createPage.browseButton).toBeVisible();
    await expect(createPage.descriptionInput).toBeVisible();
  });

  test('[WKS-CREATE-03] Agent selector displays all coding agents', async ({ agentWorkspacesPage }) => {
    const createPage = await agentWorkspacesPage.openCreatePage();

    await expect(createPage.agentSelector).toBeVisible();
    for (const agent of ['OpenCode', 'Claude', 'Cursor', 'Goose']) {
      await expect(createPage.agentSelector.getByLabel(agent)).toBeVisible();
    }
  });

  test('[WKS-CREATE-04] File access selector displays all options', async ({ agentWorkspacesPage }) => {
    const createPage = await agentWorkspacesPage.openCreatePage();

    await expect(createPage.fileAccessSelector).toBeVisible();
    for (const option of ['Working Directory Only', 'Home Directory', 'Custom Paths', 'Full System Access']) {
      await expect(createPage.fileAccessSelector.getByLabel(option)).toBeVisible();
    }
  });

  test('[WKS-CREATE-05] Submit button is disabled when form is empty', async ({ agentWorkspacesPage }) => {
    const createPage = await agentWorkspacesPage.openCreatePage();
    await expect(createPage.submitButton).toBeDisabled();
  });

  test('[WKS-CREATE-06] Cancel button navigates back to workspaces list', async ({ agentWorkspacesPage }) => {
    const createPage = await agentWorkspacesPage.openCreatePage();
    await createPage.cancel();
    await expect(agentWorkspacesPage.heading).toBeVisible();
  });
});

test.describe('Workspaces page - create form interactions', { tag: '@smoke' }, () => {
  test.beforeEach(async ({ page, navigationBar }) => {
    await waitForNavigationReady(page);
    await navigationBar.navigateToWorkspacesPage();
  });

  test('[WKS-CREATE-07] Agent card can be selected', async ({ agentWorkspacesPage }) => {
    const createPage = await agentWorkspacesPage.openCreatePage();
    const openCodeCard = createPage.agentSelector.getByLabel('OpenCode');

    await openCodeCard.click();

    await expect(openCodeCard).toHaveClass(/border-\[var\(--pd-content-card-border-selected\)\]/);
  });

  test('[WKS-CREATE-08] Custom paths section appears when Custom Paths is selected', async ({
    agentWorkspacesPage,
  }) => {
    const createPage = await agentWorkspacesPage.openCreatePage();

    await expect(createPage.addPathButton).not.toBeVisible();

    await createPage.selectFileAccess('Custom Paths');

    await expect(createPage.customPathsContainer).toBeVisible();
    await expect(createPage.addPathButton).toBeVisible();
  });

  test('[WKS-CREATE-09] Custom paths section hides when switching away from Custom Paths', async ({
    agentWorkspacesPage,
  }) => {
    const createPage = await agentWorkspacesPage.openCreatePage();

    await createPage.selectFileAccess('Custom Paths');
    await expect(createPage.addPathButton).toBeVisible();

    await createPage.selectFileAccess('Working Directory Only');
    await expect(createPage.addPathButton).not.toBeVisible();
  });

  test('[WKS-CREATE-10] Form fields can be filled', async ({ agentWorkspacesPage }) => {
    const createPage = await agentWorkspacesPage.openCreatePage();

    await createPage.fillSessionName('Test Workspace');
    await createPage.fillWorkingDir('/tmp/test-project');
    await createPage.fillDescription('A test workspace');

    await expect(createPage.sessionNameInput).toHaveValue('Test Workspace');
    await expect(createPage.workingDirInput).toHaveValue('/tmp/test-project');
    await expect(createPage.descriptionInput).toHaveValue('A test workspace');
  });
});

test.describe('Workspaces page - search', { tag: '@smoke' }, () => {
  test.beforeEach(async ({ page, navigationBar }) => {
    await waitForNavigationReady(page);
    await navigationBar.navigateToWorkspacesPage();
  });

  test('[WKS-SEARCH-01] Search with no matches shows filtered empty state', async ({ agentWorkspacesPage }) => {
    await agentWorkspacesPage.search('non-existent-workspace-xyz');
    await expect(agentWorkspacesPage.filteredEmptyMessage).toBeVisible();
    await expect(agentWorkspacesPage.clearFilterButton).toBeVisible();
  });

  test('[WKS-SEARCH-02] Clear filter button restores the view', async ({ agentWorkspacesPage }) => {
    await agentWorkspacesPage.search('non-existent-workspace-xyz');
    await expect(agentWorkspacesPage.filteredEmptyMessage).toBeVisible();

    await agentWorkspacesPage.clearFilterButton.click();
    await expect(agentWorkspacesPage.filteredEmptyMessage).not.toBeVisible();
    await expect(agentWorkspacesPage.searchInput).toHaveValue('');
  });
});
