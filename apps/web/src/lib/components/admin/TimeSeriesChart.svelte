<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  export let labels: string[];
  export let urls: number[];
  export let clicks: number[];

  let canvas: HTMLCanvasElement;
  let chart: any = null;

  function readTokens() {
    const root = getComputedStyle(document.documentElement);
    return {
      c1: root.getPropertyValue('--chart-1').trim() || '#3B82F6',
      c2: root.getPropertyValue('--chart-2').trim() || '#A78BFA',
      grid: root.getPropertyValue('--chart-grid').trim() || '#27272A',
      axis: root.getPropertyValue('--chart-axis').trim() || '#A1A1AA'
    };
  }

  onMount(async () => {
    const { Chart, registerables } = await import('chart.js');
    Chart.register(...registerables);
    const t = readTokens();

    chart = new Chart(canvas.getContext('2d')!, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'URLs',
            data: urls,
            borderColor: t.c1,
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 0
          },
          {
            label: 'Clicks',
            data: clicks,
            borderColor: t.c2,
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: t.axis, boxWidth: 10, boxHeight: 2 } },
          tooltip: { intersect: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: t.axis, precision: 0 },
            grid: { color: t.grid }
          },
          x: {
            ticks: { color: t.axis, maxTicksLimit: 8 },
            grid: { color: t.grid }
          }
        }
      }
    });
  });

  onDestroy(() => {
    if (chart) chart.destroy();
  });
</script>

<div class="relative h-64 w-full">
  <canvas bind:this={canvas}></canvas>
</div>
