// src/scripts/alpine-setup.js
import collapse from '@alpinejs/collapse';
import intersect from '@alpinejs/intersect';
// This event listener registers plugins once Alpine.js core is initialized.
// This is the primary mechanism for adding plugins.
document.addEventListener('alpine:init', () => {
  // window.Alpine is guaranteed to be available here by the time 'alpine:init' fires.
  window.Alpine.plugin(collapse);
  window.Alpine.plugin(intersect);
  // console.log("Alpine plugins (collapse, intersect) registered.");
});
// The @astrojs/alpinejs integration's entrypoint option expects a default export.
// This function can be empty if all setup is handled via 'alpine:init'.
// It's here to satisfy the integration's requirement.
export default function alpineSetup() {
  // console.log("Alpine entrypoint function called by @astrojs/alpinejs integration.");
  // You could put direct Alpine setup logic here if it didn't depend on 'alpine:init',
  // but for plugins, 'alpine:init' is the correct place.
}