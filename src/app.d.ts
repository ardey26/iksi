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
      username: string | null;
      showPreview: boolean;
    } | null;
    profileUsername: string | null;
    profileUser: {
      id: string;
      username: string;
      name: string | null;
      avatarUrl: string | null;
    } | null;
  }
}

export {};
