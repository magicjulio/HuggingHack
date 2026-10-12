import { Fragment, type ReactNode } from 'react';
import { Window } from '../../../ui/Window';
import { TEXT } from '../config';

/** Inline Markdown: `code` and **bold**. */
function inline(text: string): ReactNode[] {
  return text
    .split(/(`[^`]+`|\*\*[^*]+\*\*)/)
    .map((part, i) =>
      part.startsWith('`') ? (
        <code key={i}>{part.slice(1, -1)}</code>
      ) : part.startsWith('**') ? (
        <b key={i}>{part.slice(2, -2)}</b>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );
}

/**
 * The small Markdown subset the prompt uses: # / ## headings, - lists, paragraphs (one per line).
 * Heading marks stay visible (dim), so the paper reads like the raw .md file an agent receives.
 */
function renderPrompt(md: string): ReactNode[] {
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length)
      out.push(
        <ul key={out.length}>
          {list.map((li, i) => (
            <li key={i}>{inline(li)}</li>
          ))}
        </ul>,
      );
    list = [];
  };
  for (const line of md.split('\n')) {
    const h = /^(#{1,2}) (.*)$/.exec(line);
    if (line.startsWith('- ')) {
      list.push(line.slice(2));
      continue;
    }
    flush();
    if (h) {
      const Tag = h[1].length === 1 ? 'h3' : 'h4';
      out.push(
        <Tag key={out.length}>
          <span className="ch1-md-mark" aria-hidden>
            {h[1]}{' '}
          </span>
          {h[2]}
        </Tag>,
      );
    } else if (line.trim()) out.push(<p key={out.length}>{inline(line)}</p>);
  }
  flush();
  return out;
}

/** §Step 2: the prompt, fully readable. */
export function PaperWindow({ onClose }: { onClose: () => void }) {
  return (
    <Window title="PROMPT" onClose={onClose}>
      <article className="ch1-paper">{renderPrompt(TEXT.prompt)}</article>
    </Window>
  );
}
