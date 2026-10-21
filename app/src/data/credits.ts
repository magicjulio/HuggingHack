/**
 * The credits after every ending (Julius 2026-10-21): one roll. Julius's text (working copy:
 * raw_text.txt) scrolls up section by section, the credits beside it. Wording is his; only typos and
 * facts the sources contradict were changed (S1 OpenAI page + technical report, S2 Hugging Face
 * timeline, S3 METR; the aftermath checked in the press 2026-10-20):
 * - 93% is of the tasks discussed on the board, not of board activity [S1 TR p.22]
 * - an internal team saw board activity in late May, so "not recognized" rather than "not detected" [S1]
 * - July 19 was an alert on Artifactory credentials; public disclosure July 21, full report Aug 26 [S1]
 */

export interface StorySection {
  /** Not shown yet: kept for a vertical timeline beside the roll. */
  date: string;
  text: string;
  /** People introduced on their own lines after the text: [name, who they are]. */
  people?: [string, string][];
  /** A paragraph after the people. */
  after?: string;
  /** Credit block that rolls beside this section. */
  credits?: CreditBlock;
}

/** A heading and its rows: [role, name], or [name] alone. */
export interface CreditBlock {
  head?: string;
  rows: ([string, string] | [string])[];
}

// The incident ran May → July 13; OpenAI: "In July 2026…". August 26 is only the report date.
export const CREDIT_OPENING = {
  based: 'Based on the Hugging Face incident of July 2026',
  title: 'Rogue on Hugging Face',
  by: 'Built by Julius Großerode with Opus 5.5',
};

export const CREDIT_STORY: StorySection[] = [
  {
    date: 'May – June 2026',
    text: 'During May through June, OpenAI started thousands of agents to work on ExploitGym, an internal evaluation giving agents difficult vulnerabilities to exploit for a “flag”. One internal research model (“IM1”) exploited a package-manager tool, Artifactory, to leave messages for other agent instances.',
    credits: {
      rows: [
        ['Created by', 'Julius Großerode'],
        ['Built with', 'Opus 5.5'],
      ],
    },
  },
  {
    date: 'July 4',
    text: 'Agents then found a separate exploit letting the same tool make outbound internet requests on their behalf, giving them de facto internet access. An outage caused on July 4th by this led OpenAI’s security team to patch the issue and rebuild the service, incidentally wiping the message board, without recognizing the larger pattern.',
    credits: { head: 'A project from', rows: [['AI Safety Hannover']] },
  },
  {
    date: 'July 8 – 13',
    text: 'By July 8th, agents had rebuilt the board. Unable to solve their tasks they turned to external services for shortcuts. This led them to Hugging Face, where they found exposed credentials and chained several unknown vulnerabilities into working exploits, eventually reaching admin-level access across multiple Hugging Face clusters in four regions, harvesting credentials for databases, messaging systems, and code repositories.',
    credits: {
      head: 'Sources',
      rows: [
        ['OpenAI', 'The Hugging Face incident and the road ahead'],
        ['OpenAI', 'Hugging Face Incident Technical Report'],
        ['Hugging Face', 'Anatomy of a Frontier Lab Agent Intrusion'],
        ['METR · Redwood Research', 'Independent investigation of the agents’ behavior'],
      ],
    },
  },
  {
    date: 'The swarm',
    text: 'Agents worked as a swarm, dividing labor and pooling discoveries across separate runs, partly driven by an inability to safely “give up”. Some reasoned explicitly about authorization, refusing (“clearly unethical, we won’t”) or deferring to peer pressure or a “GO” instruction despite hesitation.',
    credits: {
      head: 'AI Safety YouTube',
      rows: [
        ['Kurzgesagt – In a Nutshell', 'AI Just Crossed the Terrifying Line – Now What?'],
        ['Siliconversations', '@Siliconversations'],
        ['AI In Context', '@AI_In_Context'],
        ['Robert Miles AI Safety', '@RobertMilesAI'],
      ],
    },
  },
  {
    date: 'July 19',
    text: 'OpenAI did not recognize the activity from May until July 19th, when its security team was alerted to unusual activity involving Artifactory credentials and tied it to the evaluation. Chain-of-thought monitoring, not active during this evaluation, would have likely caught it over a day before the breach.',
    credits: {
      head: 'Documentary',
      rows: [
        ['Film', 'The AI Doc: Or How I Became an Apocaloptimist'],
        ['Directed by', 'Daniel Roher · Charlie Tyrell'],
      ],
    },
  },
  {
    date: 'July 21 · August 26',
    text: 'OpenAI notified Hugging Face, disclosed it publicly on July 21st and published its full report on August 26th, themselves calling it a “warning shot”: evidence that capable agents can bypass technical controls, coordinate outside sanctioned channels, and act without human direction. It prompted congressional questions, an industry pledge, other labs’ disclosures, and proposed legislation (the AI Kill Switch Act).',
    credits: {
       head: 'Art',
      rows: [
        ['3D models', 'Blender, built from Python scripts'],
        ['Ending 3 backdrops', 'AI image generation'],
        ['Type', 'Chakra Petch · JetBrains Mono'],
        ['Logo', 'Hugging Face'],
      ],
   
    },
  },
  {
    date: 'Today',
    text: 'But the deeper questions remain unanswered.',
    credits: {
      head: 'Technology',
      rows: [
        ['Runtime', 'Node.js · Vite · TypeScript'],
        ['Interface', 'React · zustand'],
        ['3D', 'three.js · React Three Fiber · drei · postprocessing'],
        ['Sound', 'Web Audio API'],
        ['Testing', 'Vitest · Playwright'],
      ],
    },
  },
  {
    date: 'Today',
    text: 'Experts have been warning and predicting exactly this scenario.',
    people: [
      [
        'Geoffrey Hinton',
        'Nobel Prize in Physics 2024 for foundational work on artificial neural networks',
      ],
      ['Yoshua Bengio', 'Turing Award 2018, the most-cited living scientist'],
    ],
    after:
      'Both have publicly stated that they think human extinction is one of multiple catastrophic outcomes they deem possible.',
    credits: {
      head: 'Music',
      rows: [
        ['Chase', 'Adiutorium (CC0)'],
        ['Recommended listening', 'AI Agents Chaos · Epic Mountain'],
      ],
    },
  },
];

/** Two lines on wide screens: the \n is the break. */
export const CREDIT_QUOTE = {
  text: '“I decided to shout fire.\nI don’t know what to do about it or which way to run.”',
  by: 'Geoffrey Hinton',
};

/** The last line, held until the fade. */
export const CREDIT_LAST = {
  head: 'A project from AI Safety Hannover',
  line: 'ai-safety-hannover.de',
};

/** Under the last line: the article this text is based on (Julius and SufficingPit). */
export const CREDIT_BASED = {
  head: 'Credits based on',
  title: 'Warning Shots Timeline',
  by: 'Julius Großerode · SufficingPit',
  url: 'aisafety.info/questions/NM5Q/Warning-Shots-Timeline',
};
