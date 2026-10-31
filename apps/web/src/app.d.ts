declare global {
  namespace App {
    interface Error {
      message: string;
      /** Set by the slug route so +error.svelte can render the expired and flagged pages. */
      view?: 'expired' | 'flagged';
      verdict?: string;
    }
  }
}

export {};
