/* Ch2 HUD icons as inline SVG strings (currentColor where themeable).
   On export each becomes its own .svg file in handoff/design-to-app/assets/ui/ch2/. */
window.C2_ICONS = {
  // Seed: a ring of 8 glyphs around a glowing core (matches the 3D seed glyph idea in the script)
  seed: `<svg class="c2-seed" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-linecap="round">
    <g class="ring" stroke-width="1.6">
      ${Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * 360;
        const g = ['M0 -3v6', 'M-2 -3h4M0 -3v6', 'M-2 3l2-6 2 6', 'M-2 -3h4v6h-4', 'M-2 -3l4 6M2 -3l-4 6', 'M0 -3v6M-2 0h4', 'M-2 3v-6l4 6v-6', 'M-2 -3h4l-4 6h4'][i];
        return `<g transform="rotate(${a} 24 24) translate(24 6)"><path d="${g}"/></g>`;
      }).join('')}
      <circle cx="24" cy="24" r="12.5" stroke-width=".8" stroke-dasharray="2 3" opacity=".6"/>
    </g>
    <circle class="core" cx="24" cy="24" r="4" fill="currentColor" stroke="none"/>
  </svg>`,
  // Task piece: a luggage tag (the paper)
  tag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 7.5 9 3h11v18H9l-5-4.5z"/><circle cx="8.2" cy="12" r="1.4"/><path d="M12 9h5M12 12h5M12 15h3" stroke-width="1.2"/></svg>`,
  // Forge: four inputs folding into one
  forge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="2.5" width="5" height="5"/><rect x="16.5" y="2.5" width="5" height="5"/><rect x="2.5" y="16.5" width="5" height="5"/><rect x="16.5" y="16.5" width="5" height="5"/><path d="M7.5 7.5 10.5 10.5M16.5 7.5l-3 3M7.5 16.5l3-3M16.5 16.5l-3-3"/><rect x="10" y="10" width="4" height="4" transform="rotate(45 12 12)" fill="currentColor"/></svg>`,
  // Poisoned: the orb with dark ink blooming inside it and dripping out
  poisoned: `<svg viewBox="0 0 24 24"><defs><radialGradient id="c2pg" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#04150b"/><stop offset=".7" stop-color="#0f3d22"/><stop offset="1" stop-color="#2fa85a"/></radialGradient></defs>
    <circle cx="12" cy="12" r="9.5" fill="rgba(4,21,11,.6)" stroke="#2fa85a" stroke-width="1.4"/>
    <path class="ink" fill="url(#c2pg)" d="M12 4.6c2.2 0 2.6 2.4 4.2 3.2 2 1 3.2 2.4 2.4 4.6-.7 2-2.7 1.9-3.4 3.6-.8 2-1.6 3.6-3.2 3.6s-2.2-1.9-3.3-3.3C7.4 14.6 5.4 14.6 5.2 12c-.2-2.6 2-3 3-4.6C9.3 5.7 10 4.6 12 4.6z"/>
    <circle cx="10" cy="9.4" r="1.1" fill="#2fa85a" opacity=".8"/>
    <path class="drip" fill="#2fa85a" d="M12 21.2c-.8 1-1.1 1.6-1.1 2.1a1.1 1.1 0 0 0 2.2 0c0-.5-.3-1.1-1.1-2.1z"/>
  </svg>`,
};
