<script lang="ts">
import type { SecretVaultInfo } from '/@api/secret-vault/secret-vault-info';

interface Props {
  object: SecretVaultInfo;
}

let { object }: Props = $props();

const statusColor = $derived(
  object.status === 'active'
    ? 'text-[var(--pd-status-running)]'
    : object.status === 'expired'
      ? 'text-[var(--pd-status-terminated)]'
      : 'text-[var(--pd-status-waiting)]',
);
</script>

<div
  class="overflow-hidden text-ellipsis whitespace-nowrap max-w-full capitalize {statusColor}"
  title={object.status.charAt(0).toUpperCase() + object.status.slice(1)}>
  {object.status}
</div>
