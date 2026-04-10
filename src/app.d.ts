// src/app.d.ts
declare namespace App {
  interface Locals {
    user: {
      id: string;
      provider: string;
      providerId: string;
      email: string | null;
      name: string | null;
      avatarUrl: string | null;
      showPreview: boolean;
    } | null;
  }
}
