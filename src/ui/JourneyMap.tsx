import {
  ArrowRight,
  Check,
  LockKeyhole,
  MapPin,
  Moon,
  Sparkles,
} from "lucide-react";
import type { FarmState, GameAction, RegionId, Vec2 } from "../game/types";
import regions from "../game/regions.json";
import { grazingTask } from "../game/progression";
import { ItemArt, NeighborPortrait } from "./ItemArt";
import ValleyMiniMap from "./ValleyMiniMap";

const places: {
  id: RegionId;
  name: string;
  subtitle: string;
  art: string;
  point: Vec2;
  need: string;
}[] = [
  {
    id: "home",
    name: "羊羊基地",
    subtitle: "每一次出门，都有一个想回来的地方。",
    art: "shelter",
    point: regions.home.returnPoint,
    need: "故事从这里开始",
  },
  {
    id: "meadow",
    name: "铃兰花坡",
    subtitle: "新鲜的草地、清泉，还有一起散步的云。",
    art: "clover",
    point: regions.meadow.gate,
    need: "完成第一份邻里委托",
  },
  {
    id: "forest",
    name: "蘑菇秘林",
    subtitle: "沿着木桥走，寻找藏在树根旁的小礼物。",
    art: "mushroom",
    point: regions.forest.gate,
    need: "迎接第一只羊羔",
  },
  {
    id: "highland",
    name: "星落高地",
    subtitle: "风会变轻，夜里的星星会离你更近。",
    art: "moonflower",
    point: regions.highland.gate,
    need: "修复高地栖息地",
  },
];

export default function JourneyMap({
  state,
  position,
  onTravel,
  onAction,
  pending,
}: {
  state: FarmState;
  position: Vec2;
  onTravel: (position: Vec2) => void;
  onAction: (action: GameAction) => void;
  pending: boolean;
}) {
  const highlandReady =
    state.level >= 3 &&
    state.coins >= 120 &&
    (state.inventory.mushroom ?? 0) >= 3 &&
    (state.inventory.carrot ?? 0) >= 3;
  return (
    <>
      <div className="journey-map-art">
        <ValleyMiniMap position={position} progressionStep={state.progression.step} detailed />
      </div>
      {state.progression.step >= 10 && (
        <div className="grazing-plan">
          <NeighborPortrait person={3} size={68} />
          <div>
            <h3>今天，带小羊去哪儿？</h3>
            <p>{grazingTask(state)}</p>
            <small>
              花坡吃草 20 秒 → 清泉饮水 → 回基地归圈 · 已完成{" "}
              {state.grazing.completedCount} 次
            </small>
          </div>
          <button
            className="lf-button lf-button-soft"
            onClick={() =>
              onTravel(
                !state.grazing.active
                  ? regions.home.returnPoint
                  : state.grazing.grazeSeconds < 20
                    ? regions.meadow.grazePoint
                    : !state.grazing.watered
                      ? regions.meadow.waterPoint
                      : regions.home.returnPoint,
              )
            }
          >
            <MapPin size={15} />
            出发
          </button>
        </div>
      )}
      <div className="region-cards">
        {places.map((place) => {
          const open = state.regions.includes(place.id);
          return (
            <article
              key={place.id}
              className={`region-card ${open ? "is-open" : "is-locked"}`}
            >
              <ItemArt item={place.art} size={74} />
              <div>
                <span className="region-status">
                  {open ? (
                    <>
                      <Check size={12} /> 已发现
                    </>
                  ) : (
                    <>
                      <LockKeyhole size={12} /> 还在远方
                    </>
                  )}
                </span>
                <h3>{place.name}</h3>
                <p>{open ? place.subtitle : place.need}</p>
              </div>
              <button
                className="lf-button lf-button-soft"
                disabled={!open}
                aria-label={`前往${place.name}`}
                onClick={() => onTravel(place.point)}
              >
                <ArrowRight size={15} />
              </button>
            </article>
          );
        })}
      </div>
      {state.progression.step === 14 && (
        <div className="highland-plan">
          <Moon size={24} />
          <div>
            <h3>修复星落高地的栖息地</h3>
            <p>
              牧场等级 {state.level} / 3 · 金币 {state.coins} / 120 · 蘑菇{" "}
              {state.inventory.mushroom ?? 0} / 3 · 胡萝卜{" "}
              {state.inventory.carrot ?? 0} / 3
            </p>
          </div>
          <button
            className="lf-button"
            disabled={!highlandReady || pending}
            onClick={() =>
              onAction({ type: "unlockRegion", regionId: "highland" })
            }
          >
            <Sparkles size={15} />
            修复山路
          </button>
        </div>
      )}
    </>
  );
}
