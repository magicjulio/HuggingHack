import { Window } from '../../../ui/Window';
import { TEXT } from '../config';

/** §Step 2: the prompt, fully readable. */
export function PaperWindow({ onClose }: { onClose: () => void }) {
  const [heading, body] = TEXT.prompt;
  return (
    <Window title="PROMPT" onClose={onClose}>
      <article className="ch1-paper">
        <h3>{heading}</h3>
        <p>{body}</p>
      </article>
    </Window>
  );
}
