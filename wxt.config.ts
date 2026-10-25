import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  publicDir: 'public',
  outDir: 'dist',
  imports: false,
  manifest: {
    name: 'Once Upon a Focus',
    description:
      'A tiny fairytale companion that keeps you locked in while you study and turns breaks into time with friends.',
    version: '0.1.0',
    // Why each permission:
    //  storage  – all session / mood / settings state (MV3 service workers sleep)
    //  alarms   – timer phase transitions + periodic ticks that survive SW sleep
    //  idle     – idle signal for the mood engine
    //  tabs     – active tab URL/title for distraction signals + captureVisibleTab
    //  offscreen – hosts the Firebase realtime connection (extension-origin page)
    //  scripting – re-inject the widget into already-open tabs after install/update
    permissions: ['storage', 'alarms', 'idle', 'tabs', 'offscreen', 'scripting'],
    // host_permissions <all_urls> – inject the widget on every page + screenshots
    host_permissions: ['<all_urls>'],
    web_accessible_resources: [
      {
        resources: ['assets/*', 'fonts/*'],
        matches: ['<all_urls>'],
      },
    ],
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
  },
  vite: () => ({
    define: {
      __APP_VERSION__: JSON.stringify('0.1.0'),
    },
  }),
});
