import React, {useState} from 'react';
import {ArrowUpRight, Code2, Download, FileCheck, CalendarDays, Newspaper} from 'lucide-react';
import './open-hackathon.css';

const catalog = 'https://build.nvidia.com/spark/nemoclaw-applications';
const recipes = [
  {
    id: 'news-digest',
    name: 'Daily Personal News Digest',
    icon: Newspaper,
    idea: 'Build an industry briefing for your team using a few approved sources and your own ranking criteria.',
  },
  {
    id: 'developer-agent',
    name: 'Software Development Agent',
    icon: Code2,
    idea: 'Give it a small feature in a sample repo. Ask for tested code and a review checklist in your team’s format.',
  },
  {
    id: 'deck-reviewer',
    name: 'Deck Reviewer',
    icon: FileCheck,
    idea: 'Review a sample deck against your own rubric for accuracy, accessibility, and gaps in the evidence.',
  },
  {
    id: 'calendar-negotiator',
    name: 'Calendar Negotiator',
    icon: CalendarDays,
    idea: 'Use a sample calendar to propose meeting times that respect your focus hours and time zones.',
  },
];

function ExternalLink({href, className, children}) {
  return <a href={href} className={className} target="_blank" rel="noopener noreferrer">
    {children}<ArrowUpRight size={16} aria-hidden="true"/>
  </a>;
}

export default function OpenHackathon() {
  const [starter, setStarter] = useState(recipes[0].id);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [test, setTest] = useState('');
  const [result, setResult] = useState('');

  function downloadBrief() {
    const recipe = recipes.find(item => item.id === starter);
    const file = new Blob([[
      '# ' + name.trim(),
      'Starter: ' + recipe.name + '\n' + catalog + '/' + recipe.id,
      '## Customized agent prompt\n\n' + prompt.trim(),
      '## Test case and expected result\n\n' + test.trim(),
      '## Observed result and next improvement\n\n' + result.trim(),
    ].join('\n\n') + '\n'], {type: 'text/markdown;charset=utf-8'});
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    const filename = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    link.href = url;
    link.download = (filename || 'agent') + '-brief.md';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <main className="open-hackathon">
    <header className="hack-hero">
      <span className="eyebrow">OPEN HACKATHON</span>
      <h1>Build an agent you can take home</h1>
      <p>Pick an NVIDIA starter, give it a job of your own, and run it on your DGX Spark with the NemoClaw sandbox and local Qwen model from the workshop.</p>
      <ExternalLink href={catalog} className="primary">Open NVIDIA agent playbooks</ExternalLink>
    </header>

    <section aria-labelledby="hack-recipes">
      <h2 id="hack-recipes">Choose a starting point</h2>
      <p>Open the recipe and read its policy, prompt, and personalization guide. Pick one to build and test. Add a second if time allows.</p>
      <fieldset className="hack-recipes">
        <legend className="sr-only">Starter for your agent brief</legend>
        {recipes.map(({id, name: label, idea, icon: Icon}) => <article key={id}>
          <label><input type="radio" name="hack-starter" value={id} checked={starter === id} onChange={() => setStarter(id)}/>
            <Icon size={19} aria-hidden="true"/><strong>{label}</strong>
          </label>
          <p>{idea}</p>
          <ExternalLink href={catalog + '/' + id} className="hack-guide">Read the {label} guide</ExternalLink>
        </article>)}
      </fieldset>
    </section>

    <section aria-labelledby="hack-run">
      <h2 id="hack-run">Make it yours and run it</h2>
      <ol className="hack-run">
        <li><strong>Customize.</strong> Name your agent and rewrite the starter prompt for your use case. Specify its inputs, output format, and when it should ask for approval.</li>
        <li><strong>Scope access.</strong> Follow the recipe’s policy steps for only the files, tools, or sites it needs. Use sample data for the first run. Set up Telegram only if you plan to use the recipe’s messaging path.</li>
        <li><strong>Deploy and test.</strong> On your Spark, confirm your sandbox and local inference with <code>nemoclaw list</code> and <code>nemoclaw YOUR_SANDBOX status</code>. Open the native dashboard with <code>nemoclaw YOUR_SANDBOX dashboard-url --quiet</code>, or use <strong>Agent Dashboard</strong> if your workshop provides that link. In OpenClaw, create or select your named agent, open a chat with it, and apply the customized prompt using the recipe’s instructions. Run a small test and inspect its actual output.</li>
      </ol>
      <ExternalLink href="https://docs.openclaw.ai/cli/agents" className="hack-guide">Create a named OpenClaw agent</ExternalLink>
    </section>

    <section className="hack-brief" aria-labelledby="hack-brief">
      <h2 id="hack-brief">Take home your agent brief</h2>
      <p>Save your instructions and a test you can run again. Keep a copy of your authored skills and policy notes alongside the brief. Keep credentials out of the files.</p>
      <div className="hack-fields">
        <label>Agent name<input value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder="e.g. Launch Deck Reviewer"/></label>
        <label>Customized prompt<textarea rows={4} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Purpose, allowed inputs and tools, output format, approval rules"/></label>
        <label>Test case and expected result<textarea rows={2} value={test} onChange={e => setTest(e.target.value)}/></label>
        <label>Observed result and next improvement<textarea rows={2} value={result} onChange={e => setResult(e.target.value)}/></label>
      </div>
      <button type="button" className="secondary" disabled={!name.trim() || !prompt.trim()} onClick={downloadBrief}><Download size={16} aria-hidden="true"/> Download agent brief</button>
    </section>
  </main>;
}
