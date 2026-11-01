<script context="module">
  // One icon set (Lucide), one stroke: 1.5px at every size. No arrow icons:
  // reordering is drag-only (SortableList), never up/down buttons.
  import Check from 'lucide-svelte/icons/check';
  import ChevronDown from 'lucide-svelte/icons/chevron-down';
  import ChevronLeft from 'lucide-svelte/icons/chevron-left';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import CircleAlert from 'lucide-svelte/icons/circle-alert';
  import CircleCheck from 'lucide-svelte/icons/circle-check';
  import Clock from 'lucide-svelte/icons/clock';
  import Copy from 'lucide-svelte/icons/copy';
  import Ellipsis from 'lucide-svelte/icons/ellipsis';
  import ExternalLink from 'lucide-svelte/icons/external-link';
  import Eye from 'lucide-svelte/icons/eye';
  import EyeOff from 'lucide-svelte/icons/eye-off';
  import GripVertical from 'lucide-svelte/icons/grip-vertical';
  import Inbox from 'lucide-svelte/icons/inbox';
  import Info from 'lucide-svelte/icons/info';
  import Link from 'lucide-svelte/icons/link';
  import Lock from 'lucide-svelte/icons/lock';
  import Moon from 'lucide-svelte/icons/moon';
  import Pencil from 'lucide-svelte/icons/pencil';
  import Plus from 'lucide-svelte/icons/plus';
  import QrCode from 'lucide-svelte/icons/qr-code';
  import Search from 'lucide-svelte/icons/search';
  import Settings from 'lucide-svelte/icons/settings';
  import Sun from 'lucide-svelte/icons/sun';
  import Trash from 'lucide-svelte/icons/trash-2';
  import Type from 'lucide-svelte/icons/type';
  import Wallet from 'lucide-svelte/icons/wallet';
  import X from 'lucide-svelte/icons/x';

  export const ICONS = {
    'alert': CircleAlert,
    'check': Check,
    'check-circle': CircleCheck,
    'chevron-down': ChevronDown,
    'chevron-left': ChevronLeft,
    'chevron-right': ChevronRight,
    'clock': Clock,
    'copy': Copy,
    'edit': Pencil,
    'external': ExternalLink,
    'eye': Eye,
    'eye-off': EyeOff,
    'grip': GripVertical,
    'inbox': Inbox,
    'info': Info,
    'link': Link,
    'lock': Lock,
    'moon': Moon,
    'more': Ellipsis,
    'plus': Plus,
    'qr': QrCode,
    'search': Search,
    'settings': Settings,
    'sun': Sun,
    'trash': Trash,
    'type': Type,
    'wallet': Wallet,
    'x': X
  };
</script>

<script>
  /** @type {keyof typeof ICONS} */
  export let name;
  /** 16 inline with text, 20 standalone. */
  export let size = 16;
  /** Accessible name. Without one the icon is decorative and hidden. */
  export let label = '';
</script>

<svelte:component
  this={ICONS[name]}
  {size}
  strokeWidth={1.5}
  absoluteStrokeWidth
  class="ui-icon"
  aria-hidden={label ? undefined : 'true'}
  aria-label={label || undefined}
  role={label ? 'img' : undefined}
  focusable="false"
/>
