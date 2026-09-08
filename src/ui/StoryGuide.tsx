import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, MapPin } from "lucide-react";
import type { FarmState } from "../game/types";
import { grazingTask, journey } from "../game/progression";
import { ItemArt, NeighborPortrait } from "./ItemArt";

export default function StoryGuide({
  state,
  onAction,
}: {
  state: FarmState;
  onAction: () => void;
}) {
  const step = state.progression.step;
  const page = journey[Math.min(step, journey.length - 1)];
  const [expanded, setExpanded] = useState(() => window.innerWidth >= 700 || step === 0);
  useEffect(() => {
    const compact = window.matchMedia("(max-width: 699px)");
    const adjust = () => setExpanded(!compact.matches || step === 0);
    adjust();
    compact.addEventListener("change", adjust);
    return () => compact.removeEventListener("change", adjust);
  }, [step]);
  return (
    <section
      className={`story-guide ${expanded ? "is-expanded" : ""}`}
      aria-label="当前牧场目标"
    >
      <button
        className="story-heading"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span>牧场小日记</span>
        <span>{page.chapter}</span>
        <ChevronDown size={14} />
      </button>
      {expanded && (
        <div className="story-letter" key={step}>
          <div className="story-person">
            <NeighborPortrait person={page.person} size={74} />
            <span>
              {page.name}
              <small>给你的一点小建议</small>
            </span>
          </div>
          <h2>{page.title}</h2>
          <p>{page.text}</p>
        </div>
      )}
      <div className="story-task">
        <ItemArt item={page.art} size={37} />
        <span>
          {step === 11
            ? grazingTask(state)
            : step === 13
              ? `${page.task} · ${state.progression.forestFinds} / 3`
              : page.task}
        </span>
      </div>
      <button className="story-action" onClick={onAction}>
        <MapPin size={14} />
        {page.action}
        <ArrowRight size={16} />
      </button>
    </section>
  );
}
