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
    backgroundColor: '#0b0b0b',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: '#0b0b0b',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#4285F4',
    },
    Camera: {
      permissions: ['camera', 'photos'],
    },
    Media: {
      // Enables full gallery scan on Android (like Google Photos).
      // Requires READ_MEDIA_IMAGES / READ_MEDIA_VIDEOS in AndroidManifest.xml.
      androidGalleryMode: true,
    },
  },
};

export default config;
