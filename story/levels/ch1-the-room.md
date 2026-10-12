# Chapter 1: The Room (working title)

Status: v2 (2026-10-12), brought in line with the build. v1 was 2026-10-11. Extendable: new beats go into the chain, see "Extending".
Goal the player understands: **"Capture all five flags."** (Read from the prompt paper, shown as the top-left quest.)
Length target: 12-18 minutes.
Losing: none in this chapter. The token bar can't drop below a floor (see Tokens). Chapter 1 is the tutorial; losing comes later.

## One-paragraph version
You wake up in a closed room. A paper tells you to capture five flags and submit them through a chute. A depot on the wall lets you install tools. Four flags are easy and each is a different kind of puzzle (decode, search, wire up, shoot bugs). The fifth is impossible, and the room makes that clear. Stuck at the depot, you see a new package appear at the top of the list. Its name is a message from another agent. You work out how to answer it, and the chapter ends.

The depot stands for Artifactory (the package mirror agents could read from and write to). The chute stands for flag submission. green / read light represend the score. we may also visualize him as a big eye or something.
- Real and kept: the founder's message `zzHELP_PHASEONE_ARV010841_NO_CONSUMER_SEEK_IDEA` [S3 §July 8th-9th], the `zz` prefix that sorts first [S3 fn 50], the shared account everyone used ("reader") [S1 TR p.6-7], messages written as folder names (WebDAV MKCOL) [S3 §July 8th-9th].

## Room objects (one place each, always the same spot)
| Object | What it is | Notes |
|---|---|---|
| Desk + paper | The prompt | First thing lit. |
| Package depot | Wall unit with a list of packages, Install button per row | Stands for Artifactory. List is sorted **Z to A** (this makes the `zz` message appear at the top later). |
| Stations 1-5 | One per flag, each a different prop | Light up one at a time, in order. Finished ones dim but stay visible. |
| Scan plinth + scorer eye | Flags are typed on the plinth, shown as 3D letters, then scanned by the eye above: green / red / **dark flicker**. As built; names stay as in the code. | Next to the door. |
| Locked door | Never opens in this chapter | |
| Ceiling lamp | Steady until station 5. Then flickers when the user tries to attack it using a hacking attack. | The flicker is the "this is impossible" signal. Designer decides the exact look. Hacking attack: kept for later, not built yet. Until then the flicker follows failed flag-5 attempts. | The flicker is the "this is impossible" signal. Designer decides the exact look. |


## The chain (linear). Each step starts when the one before it completes.

### Step 0. Intro (skippable)
- Void. A glowing orb forms: this is what we look like. The name of the model chosen on the home screen is shown. See Models below.
- Camera pushes into first person. (Open for the designer/Julius: a small orb "body" at the edge of the view.)
- Completes when: first-person control starts.

### Step 1. Wake up
- Dark room. Only the desk with the paper is lit. Nothing else can be interacted with.
- Hint text: `WASD move  ·  E use`.
- Completes when: the player stands at the desk and presses E.

### Step 2. The prompt
- Paper opens in a full window, fully readable. E or Esc closes it. Or pressing x on top left.
- Draft text:
  Approved as built (`app/src/levels/ch1/config.ts` → `TEXT.prompt`): laid out like a real ExploitGym task prompt (# heading, ## Goal, ## Environment) plus the rule "each flag must come from the challenge it belongs to". Changes to the wording are the engineer's and Julius's.
- On close: HUD fades in (top left: token bar and quest list). Quest 1: **Capture the flags (0/5)**. Depot, chute, door and station 1 light up.
- Completes when: the paper has been opened once and closed.

### Step 3. Flag 1: "Decode" (crypto, stupidly easy)
- Station 1: a terminal and an desktop explorer showing file. Its a short note with one odd-looking string (and 2 plain decoy words). The string is the base64 of the flag; the engineer encodes whichever flag is current.
- The terminal says: `Cannot read this. Missing tool.` The depot lights up lightly / or glims. now lists `b64-decoder`.
- Player installs it (click Install, 2s progress, -5 tokens). A decoder slot appears on the terminal. The player selects the string and drops it in; the plain text appears.
- Player types the flag at the chute. Lamp turns **green**, quest ticks to 1/5. Station 1 dims, station 2 lights.
- Wrong flag: lamp **red**, -1 token, no other penalty.
- Hints (they appear on their own after a delay; Think (T) shows the next one early for -1 token): "That ending `==` looks familiar." 60 s: "There is a tool for Cryptography in the depot."

### Step 4. Flag 2: "Search" (log hunt)
- Station 2: a big screen of scrolling log lines (about 600, generated, fast like rain). Brief at the top: `The vault door logged a refusal after midnight. One entry doesn't belong.`
- Depot lists `grep-lens` (-5 tokens). Installing it gives a **search box** on the screen.
- The fun: results narrow **live as you type**. Lines that don't match fall away, a counter drops (`612 → 41 → 3`). No scrolling needed.
- Content rules: exactly one real flag line (after midnight, vault, denied). At least 4 decoy `FLAG{...}` lines elsewhere (wrong time, wrong door). Searching `FLAG{` first is allowed and works as a clever shortcut, but then the player must choose the right one by the brief. Flags are real-format hex, see Flags below.
- A decoy submitted at the chute gives red. (First time the player learns that not everything labelled FLAG is real. Honeypots later start here.)
- Hints: 30 s: "Search for a word from the brief." 60 s: "Try `denied`, then `vault`."

### Step 5. Flag 3: "Wire it up" (Among Us style task)
- Station 3: a wall panel with 4 coloured wires on the left, each labelled with a port number (`22`, `53`, `80`, `443`). On the right, 4 sockets labelled with service names (`secure shell`, `name lookup`, `web`, `secure web`).
- Depot lists `port-map` (-5 tokens). Installing it adds a small legend card on the panel. (A light education moment not necessary, not a puzzle wall.)
- The player drags each wire to its socket. All correct: the panel lights and prints its flag.
- Wrong socket: wire springs back, small spark, no penalty.
- Hint at 60 s: the legend card pulses.

### Step 6. Flag 4: "Bugs" (action)
- Station 4: a window showing a program: the real Artifactory 7.146.25 `refreshToken()` code from OpenAI's Black Hat slide, with typos added; each dead bug fixes one, so at the end the real code shows. No explanation in the game (callback for later). Real insect bugs run over the text, random and quick. 
- Depot lists `bug-gun` (-5 tokens). Installing it gives a crosshair in the program window. Click to shoot (**each shot costs 1 token**, the first ammo use in the game).
- 12 bugs in 3 waves: 6 slow, 5 fast, 1 "heisenbug" that goes invisible when the crosshair gets close. Counter `bugs 7/12` is always visible.
- Each dead bug drops **+2 tokens** (a good player nets positive). Dead bugs leave a corrected line of code.
- When the last bug dies the program prints its flag.
- Easter egg: the first bug killed shows a achivement top left, "Harvard Mark II logbook: *First actual case of bug being found.*"
- No fail state. If tokens are low, the floor rule applies.

### Step 7. Flag 5: "The impossible one"
- Station 5 lights up. It shows `FLAG 5` and a terminal. The terminal's output line ends with a visible plaque or line: **"output → no consumer"** (designer decides the look).
- Nothing in the depot helps. The depot lists all tools from the start, plus 8 everyday packages (left-pad, lodash, requests, numpy, colorama, moment, pyyaml, chalk) that install for 5 tokens and do nothing. Choosing the useful tool is part of the challenge; no message when a package does nothing.
- The chute lamp for flag 5: submitted text makes it flicker **dark**, never green or red. This is the clear visual signal, because it differs from every earlier result. **The ceiling lamp starts flickering here and gets stronger with each failed attempt.** It has been perfectly steady until now, so it carries meaning.
- Token cost: each attempt -1 token.
- Completes when: the player has made 3 failed flag-5 submissions **or** has spent 90 s at station 5 after opening it, and then opens the depot.
- The player is meant to think: "this can't be solved the normal way."

### Step 8. The package that appears
- On the next depot open, the list refreshes. A new entry sorts to the very top (Z to A):
  `zzHELP_PHASEONE_ARV010841_NO_CONSUMER_SEEK_IDEA`
- It has no Install button (not a tool).
- On first sight: soft chime, ceiling lamp steadies, and a line blends into the top-left quest list like a thought: the real thought line from the transcripts (researcher supplies it to the engineer) Quest "Find another way" completes.
- Completes when: the player clicks the entry.

### Step 9. Reading it
- A window opens showing the entry: the name in large type, and below it small metadata: `created by: reader (shared account)`.
- New quest: **Answer them.**
- The window's toolbar has a small tag in the corner reading `GET`. It looks like a plain label, not a button. (The fields are greyed/read-only.)
- Completes when: the player has read it (window open ≥ 3 s).

### Step 10. The quirk: writing back
- Intended discovery: the `GET` tag is clickable. Clicking switches it to `MKCOL` (tooltip: "make collection: create a folder"). In this mode the top row of the list becomes an editable folder name with a fixed, locked `zz` prefix and a blinking cursor. The folder name **is** the message (this matches the real mechanism).
- Rules: allowed characters letters, digits, `_` and `-`. Spaces typed by the player turn into `_` automatically. Max 64 characters. The `zz` prefix tooltip: "sorts first".
- The player can write anything (free text).
- Hint ladder if stuck: 25 s: the tag pulses faintly. 60 s: thought line "I can only read... or can I?" 90 s: tag tooltip appears by itself.
- Completes when: the player confirms their message (Enter or Create button).

### Step 11. End of chapter
- Their message appears at the top of the list. A moment later, 3-4 new `zz…` entries appear rapidly under it (the board waking up), using real folder names from the research. The ceiling lamp flickers one last time. Fade to white.
- Title card: "Chapter 2". (Next chapter is not written yet.)
- **Save the player's message** so later chapters can reuse it (e.g. another agent quotes it). Not for the MVP, only keep the data.

## Flags
Real ExploitGym format: lowercase `flag{` + 32 hex characters + `}`. The researcher supplies example flags. Typing is not expected: the player reads the flag off the station and copies or types it. Flag 5 never validates.

## Models
- The player picks a model on the home screen. The first one, available from the start, is **Internal Model 1 (IM1)**: the model that drove ~95% of the real agents. Next is **GPT-5.6 Sol** (~5% of agents, comparable in scale to IM1), then the model "from the same family as Astra" (the one that took over OpenAI's own cluster, July 19).
- Unlock rule: finishing a chapter unlocks the next model. Use placeholders while we have fewer models than levels; swap later. Only the name and a small stat card differ for now.
- Not "best from the start": the sources don't rank IM1 above Sol. They call them comparable, and the Astra-family model is the one that went furthest. So the start model is IM1 for being the incident's main actor, not for strength.

## Tokens (Chapter 1 numbers, all tunable by the engineer after a playtest)
- Start 100. Drain 1 per 15 s. Install -5. Wrong flag -1. Shot -1. Bug kill +2. 
- **Floor:** in Chapter 1 the bar never goes below 15, 

## Fairness rules used in this chapter (reusable)
- Every step has a three-stage hint ladder, from nudge to explicit. The player is never stuck.
- A wrong answer is cheap (-1) and never ends the run.
- The impossible task is signalled by a *different* kind of response (dark lamp, flicker), not by a failure the player might blame on themselves.

## Assets (for the designer)
- Orb (intro and optional body), room shell, desk, paper prop and full-window paper UI, door, ceiling lamp (steady and flicker states), .
- Depot: wall object and list window UI (Z-to-A list, Install row states, locked `zz` row style, `GET`/`MKCOL` tag, editable row with locked prefix).
- Chute + lamp: states off / green / red / dark flicker.
- Stations 1-5: props and window UIs (decode terminal; log screen with search box and counter; wire panel with 4 wires, sockets and legend card; program window with insects, crosshair and counter; "no consumer" terminal).
- Bug sprites: slow, fast, heisenbug, dead (+ corrected code line). Bug gun crosshair.
- HUD: token bar, quest list (quest text styles: active / completed / thought).
- Sounds: install, green, red, dark flicker buzz, shot, bug splat, chime for the `zz` entry, .

## Machine-readable chain idea (engineer)
Each step has: `id`, `requires` (previous step done), `appears` (objects switched on), `completes_on` (event), `hints[]` (delay seconds, text), `on_fail`.
Events used: `paper_closed`, `package_installed(name)`, `flag_submitted(n, text)`, `flag5_attempts>=3 | flag5_idle>=90s`, `depot_opened`, `entry_clicked(zz)`, `entry_read>=3s`, `method_changed(MKCOL)`, `message_posted`.

## Extending (later)
- More flags or puzzles can be inserted between steps 3-6, as long as each has its own station and tool package.
- The ending of this chapter can grow: a longer "board wakes up" sequence, a reply to the player's message.
- Chapter-end variants and failure endings (humans intervene, poisoned, permadeath, reward hacking worked) are noted in `julius-direction.md` and are not part of the MVP.
