<script lang="ts">
import type { SecretVaultInfo } from '/@api/secret-vault/secret-vault-info';

interface Props {
  object: SecretVaultInfo;
}

let { object }: Props = $props();

const isExpired = $derived(object.status === 'expired');
</script>

<div
  class="overflow-hidden text-ellipsis whitespace-nowrap max-w-full {isExpired ? 'text-[var(--pd-status-terminated)]' : 'text-[var(--pd-table-body-text)]'}"
  title={object.expiration?.toLocaleDateString() ?? '—'}>
  {object.expiration?.toLocaleDateString() ?? '—'}
</div>
