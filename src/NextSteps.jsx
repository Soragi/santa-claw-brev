import React from'react';
import{Sparkles,Music,Home,Library,ArrowUpRight}from'lucide-react';
const resources=[
 {title:'Build a Claw',description:'Explore guides, projects and ways to keep learning.',url:'https://www.nvidia.com/en-us/ai/build-a-claw/',Icon:Sparkles},
 {title:'Build your music & visual app',description:'Start a creative project with a ready-to-build example.',url:'https://github.com/raymondlo84/music-app',Icon:Music},
 {title:'Smart Home Guide',description:'Connect an agent to home devices with MCP.',url:'https://hackmd.io/fSuWCysCR6GX2O5SdKtDuQ',Icon:Home},
 {title:'Skills Library · ClawHub',description:'Discover custom skills for your OpenClaw environment.',url:'https://clawhub.ai/',Icon:Library}
];
export default function NextSteps(){return <section className="finale-next-steps" aria-labelledby="next-steps-title"><h2 id="next-steps-title">What’s next</h2><p>Take your Claws home, try a new project, and grow your agent’s skills.</p><nav className="next-step-links" aria-label="Continue building resources">{resources.map(({title,description,url,Icon})=><a key={url} href={url} target="_blank" rel="noopener noreferrer"><Icon className="next-step-icon" size={21} aria-hidden="true"/><span><strong>{title}</strong><small>{description}</small></span><ArrowUpRight size={16} aria-hidden="true"/></a>)}</nav></section>;}
