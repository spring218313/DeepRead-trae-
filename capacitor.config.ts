import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.deepread.app',
  appName: 'DeepRead',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  backgroundColor: '#ffffff'
};

export default config;
