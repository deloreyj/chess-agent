import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";

import { RouteNav } from "./RouteNav";

const metaphor = [
  {
    label: "Models",
    title: "Useful intelligence",
    summary:
      "General-purpose models made reasoning, writing, coding, and planning feel native to software.",
  },
  {
    label: "Tools",
    title: "Safe action",
    summary:
      "Tool calling, structured outputs, connectors, and MCP gave models constrained ways to act.",
  },
  {
    label: "Harnesses",
    title: "Durable operation",
    summary:
      "Loops, context, state, recovery, hooks, and safety turned tool use into running agents.",
  },
  {
    label: "Dynamic runtime",
    title: "Capability composition",
    summary:
      "Code Mode and Dynamic Workers let agents compose new workflows inside bounded execution.",
  },
  {
    label: "Agentic systems",
    title: "Coordinated work",
    summary:
      "Subagents let products delegate, supervise, review, and coordinate across specialized actors.",
  },
] as const;

const acts = [
  {
    act: "Act 1",
    name: "Models",
    headline: "Models made intelligence feel native to software.",
    summary:
      "The first wave was thrilling because the model could reason, write, summarize, code, plan, and converse. But it mostly lived inside an open-loop chat box.",
    details: [
      "prompt -> completion",
      "intelligence without durable action",
      "answers without feedback from the world",
    ],
  },
  {
    act: "Act 2",
    name: "Tools",
    headline: "Tools turned answers into safe action.",
    summary:
      "Function calling, structured outputs, retrieval, plugins, browser use, connectors, MCP, workflows, and event triggers gave models narrow ways to touch real systems.",
    details: ["tool calling", "MCP", "deterministic validators"],
  },
  {
    act: "Act 3",
    name: "Harnesses",
    headline: "Harnesses made agents durable and observable.",
    summary:
      "Teams kept rebuilding the same primitives: outer loops, context management, tool lifecycle, persistence, recovery, permissions, hooks, and observability.",
    details: [
      "outer iteration loop",
      "context and state",
      "permission and safety layer",
    ],
  },
  {
    act: "Act 4",
    name: "Dynamic runtime",
    headline: "Dynamic runtimes let agents compose capabilities.",
    summary:
      "Once the harness is in place, the next step is a safe execution surface where agents can compose actions into programs, create runtime tools, and adapt their operating environment.",
    details: ["Code Mode", "Dynamic Workers", "runtime-generated tools"],
  },
  {
    act: "Act 5",
    name: "Agentic systems",
    headline: "Agentic systems organize work.",
    summary:
      "The next step is not one smarter agent. It is agents that can recruit, delegate, supervise, coordinate, remember, and adapt.",
    details: ["subagents", "delegation", "supervision and review"],
  },
] as const;

const stages = [
  {
    href: "/agent",
    eyebrow: "Stage 1",
    title: "Agent",
    summary:
      "A single tool-using chess agent. The app owns prompt assembly, the model call, retries, validation, and state updates.",
    boundary: "The app owns orchestration.",
  },
  {
    href: "/harness",
    eyebrow: "Stage 2",
    title: "Harness",
    summary:
      "The same chess behavior, but Think owns the loop, streaming, tool lifecycle, message persistence, and recovery.",
    boundary: "The harness owns the loop.",
  },
  {
    href: "/system",
    eyebrow: "Stage 3",
    title: "System",
    summary:
      "A director coordinates a player agent, strategy memory, safe persona changes, UI updates, and capability composition.",
    boundary: "Agents coordinate capabilities.",
  },
] as const;

const capabilities = [
  ["Workers AI", "Model access at the edge."],
  ["Durable Objects", "Stateful, addressable agent instances."],
  ["D1 / R2 / KV", "Product data, durable memory, and artifacts."],
  ["Vectorize", "Retrieval and semantic memory."],
  ["Workflows", "Durable background processes."],
  ["Queues", "Async work and fanout."],
  ["Browser tools", "UI inspection and verification."],
  ["Code Mode", "Sandboxed orchestration through code."],
  ["Dynamic Workers", "Runtime capability mutation."],
  ["AI Gateway", "Observability, policy, and control."],
] as const;

const recipe = [
  "Pick authoritative state.",
  "Expose narrow tools.",
  "Validate every action.",
  "Persist progress.",
  "Make the loop visible.",
  "Add memory only when it changes behavior.",
  "Use Code Mode for bounded composition.",
  "Use Dynamic Workers for bounded capability mutation.",
  "Split into subagents when responsibilities diverge.",
] as const;

const inspiration = [
  {
    title: "Aparna Dhinakaran on the agent shift",
    source: "X / Twitter",
    href: "https://x.com/aparnadhinak/status/2046980769747533830",
    summary:
      "An outside signal for the broader industry movement from chat-shaped AI toward agents that act, persist, and coordinate real work.",
  },
  {
    title: "Project Think: building the next generation of AI agents on Cloudflare",
    source: "Cloudflare Blog",
    href: "https://blog.cloudflare.com/project-think/",
    summary:
      "The Cloudflare primitives behind the talk: durable execution, subagents, persistent sessions, sandboxed code execution, Dynamic Workers, Code Mode, and self-authored extensions.",
  },
] as const;

export function LandingRoute() {
  return (
    <main className="app-shell landing-shell story-shell">
      <header className="app-header landing-header">
        <div>
          <p className="eyebrow">Agents Day</p>
          <h1>Beyond Chat: building with State, Tools, and Strategy</h1>
          <p>
            From model calls to tool-using agents, harnessed agents, dynamic
            capabilities, and coordinated agent systems.
          </p>
        </div>
        <RouteNav active="landing" />
      </header>

      <section
        className="landing-hero story-hero"
        aria-labelledby="landing-title"
      >
        <div className="hero-copy">
          <h1 id="landing-title">
            From Model Calls
            <em>To Agentic Systems.</em>
          </h1>
          <p>
            What we are seeing across the industry, how we are thinking about it
            at Cloudflare, and how one chess app demonstrates the shift from a
            tool-using agent to a harnessed agent to a coordinated system.
          </p>
        </div>
        <div className="story-pills" aria-hidden="true">
          <span>Models</span>
          <span>Tools</span>
          <span>Harnesses</span>
          <span>Dynamic runtime</span>
          <span>Agent systems</span>
        </div>
      </section>

      <LayerCard className="panel narrative-panel story-thesis" id="story">
        <p className="eyebrow">Core thesis</p>
        <Text variant="heading2">Agents are becoming systems.</Text>
        <p>
          A useful agent is not a clever prompt. It is a model inside a loop,
          connected to useful tools, grounded in durable state, able to compose
          bounded capabilities, and constrained by hard safety boundaries.
        </p>
        <div className="big-refrain">
          <span>The model suggests. Deterministic code decides.</span>
          <span>The platform supplies the capability plane.</span>
        </div>
      </LayerCard>

      <section className="story-section" aria-labelledby="metaphor-title">
        <div className="story-section-heading">
          <p className="eyebrow">Mental model</p>
          <h2 id="metaphor-title">The progression</h2>
          <p>
            The story is a responsibility shift: from model output, to safe
            action, to durable execution, to dynamic capability, to coordinated
            work.
          </p>
        </div>
        <div className="metaphor-strip">
          {metaphor.map((item) => (
            <div key={item.label} className="metaphor-item">
              <span>{item.label}</span>
              <strong>{item.title}</strong>
              <p>{item.summary}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="story-section" aria-labelledby="acts-title">
        <div className="story-section-heading">
          <p className="eyebrow">Industry trend</p>
          <h2 id="acts-title">From answering questions to organizing work</h2>
          <p>
            The question changes from "how do I call the model?" to "what
            should this system be allowed to do?"
          </p>
        </div>
        <div className="act-grid">
          {acts.map((act) => (
            <LayerCard key={act.name} className="panel act-card">
              <div className="stage-card-topline">
                <span>{act.act}</span>
                <span>{act.name}</span>
              </div>
              <Text variant="heading2">{act.headline}</Text>
              <p>{act.summary}</p>
              <ul>
                {act.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </LayerCard>
          ))}
        </div>
      </section>

      <LayerCard className="panel narrative-panel safety-panel">
        <p className="eyebrow">Safety boundary</p>
        <Text variant="heading2">Tools are not permission to do anything.</Text>
        <p>
          A useful tool is a narrow, validated interface. The model can request a
          chess move, a refund, a deployment, or a database change. Deterministic
          code decides whether that action is valid before anything mutates.
        </p>
        <div className="safety-flow" aria-label="Safety flow">
          <span>Model proposes</span>
          <span>Tool validates</span>
          <span>State changes</span>
        </div>
      </LayerCard>

      <section className="story-section" aria-labelledby="stages-title">
        <div className="story-section-heading">
          <p className="eyebrow">Chess proof object</p>
          <h2 id="stages-title">One domain. Three responsibility boundaries.</h2>
          <p>
            Chess stays constant while the architecture evolves from a single
            tool-using agent, to a harnessed agent, to a coordinated agentic
            system.
          </p>
        </div>
        <div className="stage-grid" aria-label="Demo stages">
          {stages.map((stage) => (
            <a key={stage.href} className="stage-card-link" href={stage.href}>
              <LayerCard className="panel stage-card">
                <div className="stage-card-topline">
                  <span>{stage.eyebrow}</span>
                  <span>{stage.boundary}</span>
                </div>
                <Text variant="heading2">{stage.title}</Text>
                <Text variant="secondary">{stage.summary}</Text>
              </LayerCard>
            </a>
          ))}
        </div>
      </section>

      <section
        className="story-section capability-section"
        aria-labelledby="capability-title"
      >
        <div className="story-section-heading">
          <p className="eyebrow">Cloudflare view</p>
          <h2 id="capability-title">The platform becomes a capability plane.</h2>
          <p>
            Agents need runtime, state, tools, memory, sandboxed execution,
            background work, browser verification, observability, and policy.
            Cloudflare exposes those as bindings and platform primitives.
          </p>
        </div>
        <div className="capability-grid">
          {capabilities.map(([title, summary]) => (
            <div key={title} className="capability-card">
              <strong>{title}</strong>
              <span>{summary}</span>
            </div>
          ))}
        </div>
      </section>

      <section
        className="story-section inspiration-section"
        aria-labelledby="inspiration-title"
      >
        <div className="story-section-heading">
          <p className="eyebrow">Inspiration</p>
          <h2 id="inspiration-title">The signals behind the framing</h2>
          <p>
            This narrative is grounded in the broader industry conversation and
            in Cloudflare's Project Think work on durable, dynamic, safe agents.
          </p>
        </div>
        <div className="inspiration-grid">
          {inspiration.map((item) => (
            <a
              key={item.href}
              className="inspiration-card"
              href={item.href}
              target="_blank"
              rel="noreferrer"
            >
              <span>{item.source}</span>
              <strong>{item.title}</strong>
              <p>{item.summary}</p>
            </a>
          ))}
        </div>
      </section>

      <LayerCard className="panel narrative-panel recipe-panel">
        <p className="eyebrow">Builder recipe</p>
        <Text variant="heading2">What hackathon builders should copy</Text>
        <ol className="recipe-list">
          {recipe.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </LayerCard>

      <section className="final-cta" aria-labelledby="final-title">
        <p className="eyebrow">Start building</p>
        <h2 id="final-title">Start with Agent. Move to Harness. Open System.</h2>
        <p>
          The lesson from the chess app is responsibility boundaries: Cloudflare
          supplies the runtime and capability plane, the harness owns the loop,
          and your application supplies truth and boundaries.
        </p>
        <div className="hero-actions" aria-label="Final routes">
          <a href="/agent">Agent</a>
          <a href="/harness">Harness</a>
          <a href="/system">System</a>
        </div>
      </section>
    </main>
  );
}
