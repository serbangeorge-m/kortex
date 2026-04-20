<script lang="ts">
import { faKey } from '@fortawesome/free-solid-svg-icons/faKey';
import { faServer } from '@fortawesome/free-solid-svg-icons/faServer';
import Fa from 'svelte-fa';

import type { SecretVaultInfo } from '/@api/secret-vault/secret-vault-info';

interface Props {
  object: SecretVaultInfo;
}

let { object }: Props = $props();

const icon = $derived(object.category === 'api' ? faKey : faServer);
</script>

<div class="flex items-center justify-center" title={object.category === 'api' ? 'API token' : 'Infrastructure'}>
  <Fa {icon} size="1.1x" />
</div>
