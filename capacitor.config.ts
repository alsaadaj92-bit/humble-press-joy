import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.c24377afd98c4f369655506b4b645da8',
  appName: 'LocalGallery Pro',
  webDir: 'dist',
  // NOTE: `server.url` is intentionally omitted so the APK loads the bundled
  // web assets from `dist/` instead of the Lovable preview URL.
  // For live hot-reload during development, temporarily add:
  //   server: { url: 'https://<your-preview>.lovableproject.com', cleartext: true }
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0b0b0b',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: '#000000',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      // Immersive edge-to-edge — WebView draws behind status bar.
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#00000000',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#8ab4f8',
    },
    Camera: {
      permissions: ['camera', 'photos'],
    },
    Media: {
      androidGalleryMode: true,
    },
  },
};

export default config;
