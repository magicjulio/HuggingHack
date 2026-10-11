/**
 * Full-view window for in-world objects (paper, depot, terminals, stations).
 * Close: X (top left), E or Esc (handled by the level's key handler). PLACEHOLDER look.
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
    <div className="win-backdrop">
      <section className={'win' + (wide ? ' wide' : '')} role="dialog" aria-label={title}>
        <header className="win-bar">
          <button className="win-x" onClick={onClose} aria-label="close">
            ✕
          </button>
          <h2>{title}</h2>
          <span className="win-keys">E / Esc close</span>
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
