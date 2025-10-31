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

import { expect, type Locator, type Page } from '@playwright/test';
import { clearAllToasts, dropdownAction, handleDialogIfPresent } from 'src/utils/app-ready';

import { BasePage } from './base-page';

export class ChatPage extends BasePage {
  readonly toggleSidebarButton: Locator;
  readonly mcpDropdown: Locator;
  readonly newChatButton: Locator;
  readonly sidebarNewChatButton: Locator;
  readonly deleteAllChatsButton: Locator;
  readonly modelDropdownSelector: Locator;
  readonly messageField: Locator;
  readonly sendButton: Locator;
  readonly suggestedMessagesGrid: Locator;
  readonly chatHistoryItems: Locator;
  readonly conversationMessages: Locator;
  readonly chatHistoryItem: Locator;
  readonly chatHistoryItemMenuAction: Locator;
  readonly chatHistoryItemDeleteButton: Locator;
  readonly chatHistoryEmptyMessage: Locator;
  readonly toasts: Locator;
  readonly modelMenuItems: Locator;
  readonly activeModelMenuItem: Locator;

  constructor(page: Page) {
    super(page);
    this.toggleSidebarButton = page.getByRole('button', { name: 'Toggle sidebar' });
    this.mcpDropdown = page.getByRole('button', { name: 'Select MCP servers' });
    this.newChatButton = page.getByRole('button', { name: 'New Chat' });
    this.sidebarNewChatButton = page.locator('[data-sidebar="header"] button[data-tooltip-trigger]').first();
    this.deleteAllChatsButton = page.getByRole('button', { name: 'Delete all chats' });
    this.modelDropdownSelector = page.getByRole('button', { name: 'Select model' });
    this.messageField = page.getByPlaceholder('Send a message...');
    this.sendButton = page.getByRole('button', { name: 'Send message' });
    this.suggestedMessagesGrid = page.getByRole('region', { name: 'Suggested prompts' });
    this.chatHistoryItems = page.locator('li[data-sidebar="menu-item"]');
    this.conversationMessages = page.locator('div[data-role]');
    this.chatHistoryItem = page.locator('button[data-sidebar="menu-button"]');
    this.chatHistoryItemMenuAction = page.locator('button[data-sidebar="menu-action"]');
    this.chatHistoryItemDeleteButton = page.getByRole('menuitem', { name: 'Delete' });
    this.chatHistoryEmptyMessage = page.getByText('Your conversations will appear here once you start chatting!');
    this.toasts = page.locator('[data-sonner-toast]');
    this.modelMenuItems = page.getByRole('menuitem');
    this.activeModelMenuItem = page.locator('[role="menuitem"][data-active="true"]');
  }

  async waitForLoad(): Promise<void> {
    await expect(this.messageField).toBeVisible({ timeout: 10_000 });
    await expect(this.toggleSidebarButton).toBeVisible({ timeout: 10_000 });
  }

  getSuggestedMessages(): Locator {
    return this.suggestedMessagesGrid.getByRole('button');
  }

  async verifyHeaderElementsVisible(): Promise<void> {
    await expect(this.toggleSidebarButton).toBeVisible();
    await expect(this.mcpDropdown).toBeVisible();
    await expect(this.newChatButton).toBeVisible();
    await expect(this.modelDropdownSelector).toBeVisible();
  }

  async verifyInputAreaVisible(): Promise<void> {
    await expect(this.messageField).toBeVisible();
    await expect(this.sendButton).toBeVisible();
  }

  async verifySuggestedMessagesVisible(minCount = 4): Promise<void> {
    const suggestedMessages = this.getSuggestedMessages();
    const count = await suggestedMessages.count();
    expect(count).toBeGreaterThanOrEqual(minCount);
    for (let i = 0; i < minCount; i++) {
      await expect(suggestedMessages.nth(i)).toBeVisible();
    }
  }

  async ensureSidebarVisible(): Promise<void> {
    const isSidebarOpen = await this.sidebarNewChatButton.isVisible();
    if (!isSidebarOpen) {
      await this.toggleSidebarButton.click();
      await expect(this.sidebarNewChatButton).toBeVisible();
    }
  }

  async ensureSidebarHidden(): Promise<void> {
    const isSidebarOpen = await this.sidebarNewChatButton.isVisible();
    if (isSidebarOpen) {
      await this.toggleSidebarButton.click();
      await expect(this.sidebarNewChatButton).not.toBeVisible();
    }
  }

  async sendMessage(message: string, timeout = 5_000): Promise<void> {
    await this.messageField.fill(message);
    await expect(this.messageField).toHaveValue(message);
    await expect(this.sendButton).toBeEnabled();
    await this.sendButton.click();
    await this.page.waitForTimeout(timeout);
  }

  async waitForResponse(timeout = 5_000): Promise<void> {
    await this.page.waitForTimeout(timeout);
  }

  async clickNewChat(): Promise<void> {
    const isSidebarOpen = await this.sidebarNewChatButton.isVisible();
    if (isSidebarOpen) {
      await this.sidebarNewChatButton.click();
    } else {
      await this.newChatButton.click();
    }
    await expect(this.suggestedMessagesGrid).toBeVisible();
  }

  async getChatHistoryCount(): Promise<number> {
    return await this.chatHistoryItems.count();
  }

  async clickChatHistoryItemByIndex(index: number): Promise<void> {
    await this.chatHistoryItems.nth(index).locator(this.chatHistoryItem).click();
  }

  async deleteChatHistoryItemByIndex(index: number): Promise<void> {
    const item = this.chatHistoryItems.nth(index);
    await item.locator(this.chatHistoryItemMenuAction).click();
    await this.chatHistoryItemDeleteButton.click();
    await handleDialogIfPresent(this.page);
  }

  async deleteAllChatHistoryItems(): Promise<void> {
    await this.deleteAllChatsButton.click();
    await handleDialogIfPresent(this.page);
  }

  async waitForChatHistoryCount(expectedCount: number, timeout = 10_000): Promise<void> {
    await expect(this.chatHistoryItems).toHaveCount(expectedCount, { timeout });
  }

  async verifyChatHistoryEmpty(): Promise<void> {
    await expect(this.chatHistoryEmptyMessage).toBeVisible();
  }

  async verifyConversationMessage(message: string): Promise<void> {
    await expect(this.conversationMessages.locator('p').getByText(message, { exact: true })).toBeVisible();
  }

  async ensureNotificationsAreNotVisible(): Promise<void> {
    await clearAllToasts(this.page, this.toasts);
  }

  async getAvailableModelsCount(): Promise<number> {
    return await dropdownAction(this.page, this.modelDropdownSelector, async () => {
      return await this.modelMenuItems.count();
    });
  }

  async selectModelByIndex(index: number): Promise<void> {
    await this.modelDropdownSelector.click();
    const modelItem = this.modelMenuItems.nth(index);
    await expect(modelItem).toBeVisible();
    await modelItem.click();
  }

  async getSelectedModelName(): Promise<string> {
    return await dropdownAction(this.page, this.modelDropdownSelector, async () => {
      const text = await this.activeModelMenuItem.textContent();
      return text?.trim() ?? '';
    });
  }
}
