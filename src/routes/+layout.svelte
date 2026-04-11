<script>
  import '../app.css';
  import { ThemeToggle, SEO } from '../lib/components';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { theme } from '$lib/stores/theme.js';

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
    if (isAdminHost || pathname.startsWith('/admin')) {
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

  onMount(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') || 'dark';
      document.documentElement.setAttribute('data-theme', savedTheme);
      theme.set(savedTheme);
    }
  });
</script>

<SEO
  title={seo.title}
  description={seo.description}
  canonical={seo.canonical}
  ogImage={seo.ogImage}
  structuredData={seo.structuredData}
  noindex={seo.noindex}
/>

<div class="min-h-screen flex flex-col relative" style="background: var(--bg);">
  <!-- Brand mark: top-left, small, confident -->
  <div class="fixed top-6 left-6 z-50 flex items-center gap-2">
    <!-- Custom iksi mark: two chain links almost touching (Creation of Adam) -->
    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" style="color: var(--text-muted);">
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <g transform="rotate(-45 12 12)" stroke="var(--bg)" stroke-width="1.5" fill="none">
        <!-- Left chain link -->
        <rect x="4" y="10" width="7" height="4" rx="2" />
        <!-- Right chain link -->
        <rect x="13" y="10" width="7" height="4" rx="2" />
      </g>
    </svg>
    <span class="text-sm font-medium tracking-tight" style="color: var(--text-muted);">iksi</span>
  </div>

  <!-- Theme toggle: bottom-right -->
  <div class="fixed bottom-6 right-6 z-50">
    <ThemeToggle />
  </div>

  <!-- Main content: centered -->
  <main class="flex-1 flex items-center justify-center px-4">
    <slot />
  </main>
</div>
