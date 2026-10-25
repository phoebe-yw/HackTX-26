import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { defineContentScript } from 'wxt/utils/define-content-script';
import '@/ui/theme.css';
import '@/ui/widget/widget.css';
import '@/ui/lockdown/lockdown.css';
import { App } from './App';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  runAt: 'document_idle',
  allFrames: false,

  async main(ctx) {
    // @font-face must live in the document (Chrome ignores it inside shadow roots)
    injectFonts();

    const ui = await createShadowRootUi(ctx, {
      name: 'once-upon-a-focus',
      position: 'inline',
      anchor: 'body',
      onMount(container) {
        const host = document.createElement('div');
        container.append(host);
        const root = ReactDOM.createRoot(host);
        // Hiding is driven by settings (so re-enabling from the options page works live)
        root.render(<App onHidden={() => {}} />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });
    ui.mount();
  },
});

function injectFonts() {
  if (document.getElementById('ouaf-fonts')) return;
  const style = document.createElement('style');
  style.id = 'ouaf-fonts';
  const pirata = browser.runtime.getURL('/fonts/PirataOne-Regular.ttf');
  const nunito = browser.runtime.getURL('/fonts/Nunito-Variable.ttf');
  style.textContent = `
@font-face { font-family: 'Pirata One'; src: url('${pirata}') format('truetype'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Nunito'; src: url('${nunito}') format('truetype'); font-weight: 200 1000; font-display: swap; }
`;
  (document.head || document.documentElement).appendChild(style);
}
