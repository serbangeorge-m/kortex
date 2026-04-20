<script lang="ts">
import Badge from '/@/lib/ui/Badge.svelte';
import type { SecretVaultInfo } from '/@api/secret-vault/secret-vault-info';

interface Props {
  object: SecretVaultInfo;
}

let { object }: Props = $props();

const badgeColor = $derived(object.category === 'api' ? 'bg-[var(--pd-badge-sky)]' : 'bg-[var(--pd-badge-fuschia)]');
</script>

<div class="flex items-center gap-2 overflow-hidden max-w-full">
  <span
  class="text-[var(--pd-table-body-text-highlight)] text-[14px] font-semibold leading-normal overflow-hidden text-ellipsis whitespace-nowrap"
    title={object.name}>
    {object.name}
  </span>
  {#if object.type}
    <Badge class="text-[6px] text-white" color={badgeColor} label={object.type} />
  {/if}
</div>
