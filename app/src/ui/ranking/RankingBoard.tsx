/**
 * The online best-players board for a ranked level (data/ranking.ts), shown in a level card's
 * `extra` slot. Without `run` it only shows the board (intro card). With `run` (finish card) it posts
 * the run under the saved player name (submitRun, usually already sent by the level's onFinish); with no name yet it offers Join ranking: a name field that
 * claims the name, posts the run and saves the name for every later run.
 * The player's own best row is highlighted, and appended under the top 10 when it is lower.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { RANKED, fmtTime } from '../../data/ranking';
import { useGame } from '../../state/store';
import {
  NAME_RULE,
  PROBLEM_TEXT,
  fetchBoard,
  isProblem,
  postRun,
  setPlayerName,
  submitRun,
  type Board,
  type Problem,
  type RankedRun,
  type Row,
} from './ranking';
import './ranking.css';

export function RankingBoard({ level, run }: { level: string; run?: RankedRun | null }) {
  const cfg = RANKED[level];
  const name = useGame((s) => s.save.playerName);
  const [board, setBoard] = useState<Board | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  // Join ranking: closed → the button, open → the name field
  const [joining, setJoining] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // load the board; a finished run with a saved name is posted first (the answer is the board)
  useEffect(() => {
    let live = true;
    const req = (run && submitRun(level, run)) || fetchBoard(level);
    void req.then((r) => {
      if (!live) return;
      if (isProblem(r)) setProblem(r);
      else setBoard(r);
    });
    return () => {
      live = false;
    };
  }, [level, run]);

  async function join(e: FormEvent) {
    e.preventDefault();
    const n = draft.trim();
    if (!NAME_RULE.test(n)) return setError(PROBLEM_TEXT.bad_name);
    if (!run) return;
    setBusy(true);
    setError(null);
    const r = await postRun(level, run.score, run.stats, n);
    setBusy(false);
    if (isProblem(r)) return setError(PROBLEM_TEXT[r]);
    setPlayerName(n);
    setBoard(r);
    setProblem(null);
    setJoining(false);
  }

  if (!cfg) return null;
  const rows = board?.top ?? [];
  const below = board?.me && !rows.some((r) => r.mine) ? board.me : null;
  const canJoin = !!run && !name && !board?.me;

  return (
    // keys typed here must not reach the game (E1: R restarts, Space jumps)
    <section
      className="rk"
      aria-label="Ranking"
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
    >
      <header className="rk-head">
        <b>●</b> Best players
      </header>
      <table className="rk-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th className="rk-num">{cfg.scoreLabel}</th>
            {cfg.stats.map((s) => (
              <th key={s.key} className="rk-num">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <BoardRow key={r.rank} row={r} level={level} />
          ))}
          {below && (
            <>
              <tr className="rk-gap" aria-hidden="true">
                <td colSpan={3 + cfg.stats.length}>⋯</td>
              </tr>
              <BoardRow row={below} level={level} />
            </>
          )}
        </tbody>
      </table>
      {!board && <p className="rk-note">{problem ? PROBLEM_TEXT[problem] : 'Loading…'}</p>}
      {board && rows.length === 0 && <p className="rk-note">No runs yet. Be the first.</p>}
      {canJoin &&
        (joining ? (
          <form className="rk-join" onSubmit={join}>
            <input
              autoFocus
              value={draft}
              maxLength={20}
              placeholder="Your name"
              aria-label="Your name"
              spellCheck={false}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" disabled={busy}>
              {busy ? '…' : 'OK'}
            </button>
            {error && <p className="rk-error">{error}</p>}
          </form>
        ) : (
          <button className="rk-btn" onClick={() => setJoining(true)}>
            Join ranking
          </button>
        ))}
      {name && run && board && <p className="rk-note">Playing as {name}</p>}
    </section>
  );
}

function BoardRow({ row, level }: { row: Row; level: string }) {
  const cfg = RANKED[level];
  return (
    <tr className={row.mine ? 'mine' : undefined}>
      <td>{row.rank}</td>
      <td className="rk-name">{row.name}</td>
      <td className="rk-num">{(cfg.format ?? fmtTime)(row.score)}</td>
      {cfg.stats.map((s) => (
        <td key={s.key} className="rk-num">
          {row.stats[s.key] ?? '–'}
        </td>
      ))}
    </tr>
  );
}
