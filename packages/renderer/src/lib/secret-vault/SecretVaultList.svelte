<script lang="ts">
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { Button, FilteredEmptyScreen, NavPage, Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';

import NoLogIcon from '/@/lib/ui/NoLogIcon.svelte';
import { handleNavigation } from '/@/navigation';
import { filteredSecretVaultInfos, secretVaultCategoryFilter, secretVaultSearchPattern } from '/@/stores/secret-vault';
import { NavigationPage } from '/@api/navigation-page';
import type { SecretVaultInfo } from '/@api/secret-vault/secret-vault-info';

import { SecretVaultDescriptionColumn } from './columns/secret-vault-columns';
import SecretVaultCategoryIcon from './columns/SecretVaultCategoryIcon.svelte';
import SecretVaultExpiry from './columns/SecretVaultExpiry.svelte';
import SecretVaultName from './columns/SecretVaultName.svelte';
import SecretVaultStatus from './columns/SecretVaultStatus.svelte';
import SecretVaultEmptyScreen from './SecretVaultEmptyScreen.svelte';

type SecretVaultSelectable = SecretVaultInfo & { selected: boolean };

type CategoryScreen = 'all' | 'api' | 'infra';
let screen: CategoryScreen = $state('all');

let searchTerm = $state('');

$effect(() => {
  secretVaultSearchPattern.set(searchTerm);
});

$effect(() => {
  secretVaultCategoryFilter.set(screen);
});

function changeScreen(newScreen: CategoryScreen): void {
  if (screen === newScreen) {
    return;
  }
  screen = newScreen;
}

const row = new TableRow<SecretVaultSelectable>({});

const iconColumn = new TableColumn<SecretVaultSelectable>('', {
  width: '60px',
  renderer: SecretVaultCategoryIcon,
});

const nameColumn = new TableColumn<SecretVaultSelectable>('Name', {
  width: '2fr',
  renderer: SecretVaultName,
  comparator: (a, b): number => a.name.localeCompare(b.name),
});

const expirationColumn = new TableColumn<SecretVaultSelectable>('Expiration', {
  width: '120px',
  renderer: SecretVaultExpiry,
  comparator: (a, b): number =>
    (a.expiration?.getTime() ?? Number.POSITIVE_INFINITY) - (b.expiration?.getTime() ?? Number.POSITIVE_INFINITY),
});

const statusColumn = new TableColumn<SecretVaultSelectable>('Status', {
  width: '100px',
  align: 'center',
  renderer: SecretVaultStatus,
  comparator: (a, b): number => a.status.localeCompare(b.status),
});

const columns = [iconColumn, nameColumn, new SecretVaultDescriptionColumn(), expirationColumn, statusColumn];

const secrets: SecretVaultSelectable[] = $derived(
  $filteredSecretVaultInfos.map(secret => ({ ...secret, selected: false })),
);

function addSecret(): void {
  handleNavigation({ page: NavigationPage.SECRET_VAULT_CREATE });
}
</script>

<NavPage bind:searchTerm={searchTerm} title="Secret Vault">
  {#snippet additionalActions()}
    <Button icon={faPlus} onclick={addSecret}>
      Add Secret
    </Button>
  {/snippet}

  {#snippet tabs()}
    <Button type="tab" onclick={(): void => { changeScreen('all'); }} selected={screen === 'all'}>
      All secrets
    </Button>
    <Button type="tab" onclick={(): void => { changeScreen('api'); }} selected={screen === 'api'}>
      API tokens
    </Button>
    <Button type="tab" onclick={(): void => { changeScreen('infra'); }} selected={screen === 'infra'}>
      Infrastructure
    </Button>
  {/snippet}

  {#snippet content()}
    <div class="flex min-w-full h-full">
      {#if secrets.length === 0}
        {#if searchTerm}
          <FilteredEmptyScreen icon={NoLogIcon} kind="secrets" bind:searchTerm={searchTerm} />
        {:else}
          <SecretVaultEmptyScreen onclick={addSecret} />
        {/if}
      {:else}
        <Table
          kind="secret-vault"
          data={secrets}
          columns={columns}
          row={row}
          defaultSortColumn="Name"
        />
      {/if}
    </div>
  {/snippet}
</NavPage>
