/**
 * Full-view window for in-world objects (paper, depot, terminals, stations).
 * Close: X (top left), a click beside the window, or E / WASD (the level's key handler). Esc is
 * not a close key: it belongs to the browser (pause, fullscreen). PLACEHOLDER look.
 */
import type { ReactNode } from 'react';
import './ui.css';

export function Window({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="win-backdrop"
      // pointerdown, not click: a text selection that ends outside the window must not close it
      onPointerDown={(e) => {
        if (e.button === 0 && e.target === e.currentTarget) onClose();
      }}
    >
      <section className={'win' + (wide ? ' wide' : '')} role="dialog" aria-label={title}>
        <header className="win-bar">
          <button className="win-x" onClick={onClose} aria-label="close">
            ✕
          </button>
          <h2>{title}</h2>
          <span className="win-keys">E · ✕ · click beside to close</span>
        </header>
        <div className="win-body">{children}</div>
      </section>
    </div>
  );
}

/** Renders `code` spans for text in backticks, e.g. "Try `denied`". */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text
        .split('`')
        .map((part, i) => (i % 2 ? <code key={i}>{part}</code> : <span key={i}>{part}</span>))}
    </>
  );
}
