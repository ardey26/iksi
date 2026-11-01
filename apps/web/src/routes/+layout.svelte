<script>
  import '../app.css';
  import { ThemeToggle, SEO } from '../lib/components';
  import { Button } from '#lib/ui/index.js';
  import UserMenu from '#lib/components/UserMenu.svelte';
  import { page, navigating } from '$app/state';
  import { isDashboardPath, isProfilePath } from '#lib/utils/route-kind.js';
  import { appHref, subdomainHandleOf } from '#lib/subdomains.js';

  let { data, children } = $props();

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
    // On andre.iksi.app the page lives at that host, not at www.
    const origin = subdomainHandleOf(host, import.meta.env.DEV) ? `https://${host}` : 'https://www.iksi.app';
    return {
      title: 'iksi — free URL shortener',
      description: 'iksi turns long URLs into clean, shareable short links in seconds.',
      canonical: `${origin}${pathname}`,
      ogImage: 'https://www.iksi.app/og-image.png',
      structuredData: null,
      noindex: true
    };
  }

  const seo = $derived(seoForRoute(page.url.pathname, page.url.host));
  const isAdminSurface = $derived(page.url.host === 'admin.iksi.app' || page.url.host === 'admin.localhost' || page.url.host.startsWith('admin.localhost:') || page.url.pathname.startsWith('/admin'));
  const onLoginPage = $derived(page.url.pathname === '/login');
  // Only /@handle itself: /@handle/name is a short link and keeps the site chrome.
  // By route too: on andre.iksi.app the profile is at `/`.
  const isProfilePage = $derived(page.route?.id === '/@[handle]' || isProfilePath(page.url.pathname));
  // App links leave a profile subdomain for www, where the session cookie is.
  const home = $derived(appHref('/', page.url.host, import.meta.env.DEV));
  const signIn = $derived(appHref('/login', page.url.host, import.meta.env.DEV));
  const isDashboard = $derived(isDashboardPath(page.url.pathname));

  // Theme is resolved by the inline script in app.html before first paint and
  // kept in sync by $lib/stores/theme.js. Nothing to do on mount.
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
{#if navigating.to}
  <div class="nav-progress" aria-hidden="true"></div>
{/if}

{#if isAdminSurface}
  {@render children()}
{:else if isProfilePage}
  <!-- Profile pages render their own themed background + no site chrome -->
  {@render children()}
{:else}
  <div class="site">
    <!-- In the page flow, so nothing scrolls under it at any width. -->
    <header class="site-header">
      <a href={home} class="brand" data-ui aria-label="iksi home">
        <svg class="brand-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="11" fill="currentColor"></circle>
          <g transform="rotate(-45 12 12)" stroke="var(--bg)" stroke-width="1.5" fill="none">
            <rect x="4" y="10" width="7" height="4" rx="2"></rect>
            <rect x="13" y="10" width="7" height="4" rx="2"></rect>
          </g>
        </svg>
        <span class="brand-name">iksi</span>
      </a>

      <div class="controls">
        <ThemeToggle />
        {#if !onLoginPage}
          {#if data?.user}
            <UserMenu user={data.user} />
          {:else}
            <Button size="sm" variant="secondary" href={signIn}>Sign in</Button>
          {/if}
        {/if}
      </div>
    </header>

    {#if onLoginPage}
      <main class="flex-1 flex items-center justify-center px-4 pb-16">{@render children()}</main>
    {:else if isDashboard}
      <main class="flex-1 flex flex-col pt-8 pb-24 px-4 dash-main">{@render children()}</main>
    {:else}
      <main class="site-main">{@render children()}</main>
    {/if}
  </div>
{/if}

<style>
  .site {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    min-height: 100dvh;
    background-color: var(--bg);
  }
  .site-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    height: 64px;
    padding: 0 var(--gutter);
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    margin-left: -4px;
    padding: 0 4px;
    color: var(--text-muted);
    text-decoration: none;
    border-radius: var(--radius-control);
    transition: color var(--duration-normal) var(--ease-out);
  }
  .brand:hover { color: var(--text-primary); }
  .brand:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 0;
  }
  .brand-mark {
    width: 20px;
    height: 20px;
    color: var(--text-muted);
  }
  .brand-name {
    font-size: 14px;
    line-height: 20px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--text-primary);
  }
  .controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  /* Phones: 44px targets need their 6px of air on either side. */
  @media (max-width: 639px) {
    .controls { gap: 12px; }
  }
  .site-main {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }
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
    0% {
      left: -30%;
      width: 30%;
    }
    50% {
      left: 40%;
      width: 30%;
    }
    100% {
      left: 100%;
      width: 30%;
    }
  }
</style>
