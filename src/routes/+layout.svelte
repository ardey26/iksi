<script>
  import '../app.css';
  import { ThemeToggle, SEO } from '../lib/components';
  import UserMenu from '$lib/components/UserMenu.svelte';
  import { onMount } from 'svelte';
  import { page, navigating } from '$app/stores';
  import { theme } from '$lib/stores/theme.js';

  export let data;

  const HOMEPAGE_STRUCTURED_DATA = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': 'https://www.iksi.app/#website',
        url: 'https://www.iksi.app/',
        name: 'iksi',
        description: 'Free URL shortener. Transform long links into clean, shareable short URLs.',
        inLanguage: 'en'
      },
      {
        '@type': 'WebApplication',
        '@id': 'https://www.iksi.app/#app',
        name: 'iksi',
        url: 'https://www.iksi.app/',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript. Requires HTML5.',
        description: 'A fast, free URL shortener with custom aliases and instant redirects. No registration required.',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        author: { '@type': 'Person', name: 'Andre de Jesus' }
      }
    ]
  };

  function seoForRoute(pathname, host) {
    const isAdminHost = host === 'admin.iksi.app' || host === 'admin.localhost';
    if (isAdminHost) {
      return {
        title: 'iksi admin',
        description: 'iksi admin area.',
        canonical: `https://admin.iksi.app${pathname}`,
        ogImage: 'https://www.iksi.app/og-image.png',
        structuredData: null,
        noindex: true
      };
    }
    if (pathname === '/') {
      return {
        title: 'iksi — free URL shortener. Make long links short.',
        description: 'iksi turns long URLs into clean, shareable short links in seconds. Free, no signup, custom aliases, instant redirects.',
        canonical: 'https://www.iksi.app/',
        ogImage: 'https://www.iksi.app/og-image.png',
        structuredData: HOMEPAGE_STRUCTURED_DATA,
        noindex: false
      };
    }
    return {
      title: 'iksi — free URL shortener',
      description: 'iksi turns long URLs into clean, shareable short links in seconds.',
      canonical: `https://www.iksi.app${pathname}`,
      ogImage: 'https://www.iksi.app/og-image.png',
      structuredData: null,
      noindex: true
    };
  }

  $: seo = seoForRoute($page.url.pathname, $page.url.host);
  $: isAdminSurface = ($page.url.host === 'admin.iksi.app' || $page.url.host === 'admin.localhost' || $page.url.host.startsWith('admin.localhost:')) || $page.url.pathname.startsWith('/admin');
  $: onLoginPage = $page.url.pathname === '/login';
  $: isProfilePage = $page.url.pathname.startsWith('/@');
  // Public homepage + login use a full-height centered layout.
  // Everything else (dashboard, /@handle, etc.) uses top-aligned flow.
  $: centerContent = $page.url.pathname === '/' || onLoginPage;

  onMount(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') || 'dark';
      document.documentElement.setAttribute('data-theme', savedTheme);
      theme.set(savedTheme);
    }
  });
</script>

<!--
  Profile pages emit their own full <svelte:head>. Skipping the layout-level
  <SEO> avoids duplicated tags AND avoids the seoForRoute default that marks
  everything-except-homepage as noindex (which would kill profile SEO).
-->
{#if !isProfilePage}
  <SEO
    title={seo.title}
    description={seo.description}
    canonical={seo.canonical}
    ogImage={seo.ogImage}
    structuredData={seo.structuredData}
    noindex={seo.noindex}
  />
{/if}

<!-- Top-of-page navigation progress bar; only visible during a route change -->
{#if $navigating}
  <div class="nav-progress" aria-hidden="true"></div>
{/if}

<style>
  .nav-progress {
    position: fixed;
    top: 0;
    left: 0;
    height: 2px;
    background: var(--accent);
    z-index: 100;
    animation: nav-progress-slide 900ms ease-in-out infinite;
    box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 60%, transparent);
  }
  @keyframes nav-progress-slide {
    0%   { left: -30%; width: 30%; }
    50%  { left: 40%;  width: 30%; }
    100% { left: 100%; width: 30%; }
  }
</style>

{#if isAdminSurface}
  <slot />
{:else if isProfilePage}
  <!-- Profile pages render their own themed background + no site chrome -->
  <slot />
{:else}
  <div class="min-h-screen flex flex-col relative" style="background: var(--bg);">
    <!-- Brand mark: top-left -->
    <a href="/" class="fixed top-6 left-6 z-50 flex items-center gap-2 hover:opacity-70 transition-opacity">
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" style="color: var(--text-muted);">
        <circle cx="12" cy="12" r="11" fill="currentColor" />
        <g transform="rotate(-45 12 12)" stroke="var(--bg)" stroke-width="1.5" fill="none">
          <rect x="4" y="10" width="7" height="4" rx="2" />
          <rect x="13" y="10" width="7" height="4" rx="2" />
        </g>
      </svg>
      <span class="text-sm font-medium tracking-tight" style="color: var(--text-muted);">iksi</span>
    </a>

    <!-- Right: UserMenu when signed in, Sign in link when not -->
    {#if !onLoginPage}
      <div class="fixed top-6 right-6 z-50">
        {#if data?.user}
          <UserMenu user={data.user} />
        {:else}
          <a href="/login" class="text-sm hover:opacity-70 transition-opacity" style="color: var(--text-muted);">Sign in</a>
        {/if}
      </div>
    {/if}

    <!-- Theme toggle: bottom-right -->
    <div class="fixed bottom-6 right-6 z-50">
      <ThemeToggle />
    </div>

    {#if centerContent}
      <main class="flex-1 flex items-center justify-center px-4">
        <slot />
      </main>
    {:else}
      <main class="flex-1 flex flex-col pt-24 pb-24 px-4">
        <slot />
      </main>
    {/if}
  </div>
{/if}
