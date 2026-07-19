import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.c24377afd98c4f369655506b4b645da8',
  appName: 'LocalGallery Pro',
  webDir: 'dist',
  server: {
    url: 'https://c24377af-d98c-4f36-9655-506b4b645da8.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
