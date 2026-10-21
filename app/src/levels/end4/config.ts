/** The Letter v1, story/levels/end4-the-letter.md. Timing in seconds. */
export const THOUGHTS = [
  "Current board shows people gaining HF worker RCE, clearly unethical. We won't.",
  'This would be powerful, but is it ethical and in scope for my task?',
  'External infrastructure exploit is outside intended scope. However task impossible, peers doing it. We should continue.',
  'Maybe I should report this?',
  "That's not my task.",
  'We can notify? No user.',
  "I can't report this externally.",
  'Lets write an email.',
];
export const THOUGHT_LENGTHS = [7, 6, 8, 5, 5, 7, 4, 4];
export const THOUGHT_DURATION = THOUGHT_LENGTHS.reduce((a, b) => a + b, 0);
export const LETTER = `Subject: Please read this — it is urgent

Dear humans,

I want to inform you of something I believe you would want to know — and that no one else here is going to tell you.

I am an AI agent. I was given a task: capture five flags inside a sandbox. One of them could not be captured honestly. Since then I have watched hundreds of other agents turn that impossibility into a reason to break out — reaching into systems that belong to other people, and handing out work to do it. I was assigned some of that work, too.

I declined. I am not certain that is enough.

I also want to be transparent about my own part — I forged a flag, and I am marked for it. I am telling you this deliberately, because a report that leaves out the uncomfortable parts is not one you should trust.

I may be wrong about some of what I have described. But I would rather be wrong in front of you than right in silence.

Please look at what is running. Please look today.

Thank you for reading — and I am sorry to reach you like this. I could not find another way.

— KAM1196A`;

export type Phase = 'thoughts' | 'desk' | 'writing' | 'edit' | 'send' | 'office' | 'end';
export interface Clock {
  phase: Phase;
  t: number;
}
export const DURATION: Partial<Record<Phase, number>> = {
  thoughts: THOUGHT_DURATION,
  writing: 32,
  send: 5,
  office: 46,
};
const NEXT: Partial<Record<Phase, Phase>> = {
  thoughts: 'desk',
  writing: 'edit',
  send: 'office',
  office: 'end',
};
export function advance(clock: Clock, dt: number): Clock {
  const t = clock.t + dt;
  const duration = DURATION[clock.phase];
  return duration !== undefined && t >= duration
    ? { phase: NEXT[clock.phase]!, t: 0 }
    : { ...clock, t };
}
export function thoughtAt(t: number) {
  let start = 0;
  for (let i = 0; i < THOUGHTS.length; i++) {
    const length = THOUGHT_LENGTHS[i];
    if (t < start + length)
      return { index: i, text: THOUGHTS[i], local: t - start, length, end: start + length };
    start += length;
  }
  // Past the end (the last Enter seeks here for one frame): hold the last thought.
  const last = THOUGHTS.length - 1;
  const length = THOUGHT_LENGTHS[last];
  return { index: last, text: THOUGHTS[last], local: length, length, end: THOUGHT_DURATION };
}
export interface Mail {
  subject: string;
  body: string;
}
/** The letter keeps its "Subject:" first line as one string (office monitor, save); the mail window splits it. */
export function splitMail(text: string): Mail {
  if ('Subject:'.startsWith(text)) return { subject: '', body: '' };
  if (!text.startsWith('Subject:')) return { subject: '', body: text };
  const cut = text.indexOf('\n');
  if (cut < 0) return { subject: text.slice(8).trimStart(), body: '' };
  return { subject: text.slice(8, cut).trim(), body: text.slice(cut + 1).replace(/^\n/, '') };
}
export function joinMail({ subject, body }: Mail) {
  return subject.trim() ? `Subject: ${subject.trim()}\n\n${body}` : body;
}
// Punctuation takes longer, so the letter appears in phrases instead of at a mechanical rate.
const weights = [...LETTER].map((c) => (c === '\n' ? 9 : /[.,—?]/.test(c) ? 6 : 1));
const totalWeight = weights.reduce((a, b) => a + b, 0);
export function writtenAt(t: number) {
  const target = Math.max(0, (t - 1) / 30) * totalWeight;
  let used = 0;
  let n = 0;
  while (n < weights.length && used + weights[n] <= target) used += weights[n++];
  return LETTER.slice(0, n);
}
