import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Carrot,
  Check,
  ChevronRight,
  Clock3,
  Cloud,
  Coins,
  Copy,
  Droplets,
  Flower2,
  Heart,
  Leaf,
  LogOut,
  Moon,
  Music2,
  Package,
  Plus,
  Scissors,
  Shirt,
  ShoppingBasket,
  Sparkles,
  Sprout,
  Sun,
  Users,
  Volume2,
  VolumeX,
  Wheat,
  X,
} from "lucide-react";
import type {
  Breed,
  FarmState,
  GameAction,
  Player,
  Rarity,
  Room,
  Sheep,
  User,
  Vec2,
} from "../game/types";
import catalog from "../game/catalog.json";
import "./panels.css";
import { ItemArt, NeighborPortrait } from "./ItemArt";
import JourneyMap from "./JourneyMap";
import { cropUnlock, journey } from "../game/progression";

export type PanelId =
  | "flock"
  | "garden"
  | "shop"
  | "journal"
  | "orders"
  | "room"
  | "help"
  | "settings"
  | "map";
export interface PanelsProps {
  panel: PanelId | null;
  onClose: () => void;
  state: FarmState;
  serverNow?: number;
  room: Room;
  user: User;
  players: Player[];
  onAction: (action: GameAction) => Promise<void>;
  onSelectSheep: (id: string) => void;
  selectedSheepId?: string;
  onLeave: () => void;
  onEditAvatar: () => void;
  position: Vec2;
  onTravel: (position: Vec2) => void;
  quality: "high" | "low";
  onQuality: (value: "high" | "low") => void;
  music: boolean;
  onMusic: (value: boolean) => void;
  sound: boolean;
  onSound: (value: boolean) => void;
}

const breeds = catalog.breeds as Breed[];
const cropById = Object.fromEntries(
  catalog.crops.map((crop) => [crop.id, crop]),
);
const breedById = Object.fromEntries(breeds.map((breed) => [breed.id, breed]));
const titles: Record<PanelId, { name: string; description: string }> = {
  map: {
    name: "沿着风，去远方",
    description: "每一片新的风景，都有值得一起发现的小事。",
  },
  flock: {
    name: "我的小羊",
    description: "每一团小小的绒毛，都值得被好好照顾。",
  },
  garden: { name: "田间手记", description: "种下一点期待，收获一整个好心情。" },
  shop: {
    name: "松果杂货铺",
    description: "带上今日的收获，换一些明日的美好。",
  },
  journal: {
    name: "羊羊图鉴",
    description: "把那些特别的相遇，一页一页收藏。",
  },
  orders: {
    name: "邻里的心愿",
    description: "你的日常收获，也是别人期待的小礼物。",
  },
  room: {
    name: "一起住在牧场",
    description: "分享这片风景，也分享每一天的收获。",
  },
  help: {
    name: "牧场生活指南",
    description: "不必着急，从摸摸第一只小羊开始。",
  },
  settings: { name: "让自己舒服一点", description: "找到适合你的声音和画面。" },
};

function duration(seconds: number) {
  const safe = Math.max(0, Math.ceil(seconds));
  return safe < 60
    ? `${safe} 秒`
    : `${Math.floor(safe / 60)} 分${safe % 60 ? ` ${safe % 60} 秒` : ""}`;
}

function itemName(id: string) {
  if (id === "feed") return "牧草饲料";
  if (id === "mushroom") return "林间蘑菇";
  if (id === "herb") return "野生香草";
  if (id.startsWith("wool_"))
    return `${breedById[id.slice(5)]?.name ?? "小羊"}绒毛`;
  const crop = catalog.crops.find(
    (item) => item.id === id || item.seedId === id,
  );
  return crop ? `${crop.name}${id === crop.seedId ? "种子" : ""}` : id;
}

function sellValue(id: string) {
  if (id === "mushroom") return 12;
  if (id === "herb") return 16;
  if (id.startsWith("wool_")) return breedById[id.slice(5)]?.woolValue ?? 0;
  return cropById[id]?.sellPrice ?? 0;
}

function SheepPortrait({
  breed,
  sleeping = false,
  hidden = false,
}: {
  breed: Breed;
  sleeping?: boolean;
  hidden?: boolean;
}) {
  const wool = hidden ? "#d9ddcd" : breed.color;
  const face = hidden ? "#9ea792" : breed.faceColor;
  const accent = hidden ? "#c0c8b4" : breed.accent;
  return (
    <svg
      className={`lf-sheep-portrait ${hidden ? "lf-undiscovered" : ""}`}
      viewBox="0 0 160 130"
      aria-hidden="true"
    >
      <ellipse cx="80" cy="117" rx="44" ry="6" fill="#243d28" opacity=".07" />
      <path
        d="M52 91v19q0 5 6 5h3q5 0 5-5V91M95 91v19q0 5 6 5h3q5 0 5-5V91"
        fill={face}
      />
      <path
        d="M112 63q26-10 21 9q-2 8-17 6"
        fill={wool}
        stroke={face}
        strokeOpacity=".12"
        strokeWidth="2"
      />
      <path
        d="M47 56C30 40 44 25 58 33C62 16 80 14 91 26C105 16 124 27 121 42C140 42 142 64 131 73C144 90 130 104 115 101C102 116 83 108 77 103C57 115 39 102 43 87C23 82 29 62 47 56Z"
        fill={wool}
        stroke={face}
        strokeOpacity=".12"
        strokeWidth="2"
      />
      <ellipse
        cx="40"
        cy="63"
        rx="15"
        ry="8"
        fill={face}
        transform="rotate(28 40 63)"
      />
      <ellipse
        cx="87"
        cy="60"
        rx="14"
        ry="8"
        fill={face}
        transform="rotate(-27 87 60)"
      />
      <path d="M41 60q2-15 22-15t23 15l-4 30q-5 18-21 18t-19-18Z" fill={face} />
      <path
        d="M43 56c-8-13 5-20 13-15c0-11 18-14 21-3c12-3 18 11 8 17c-13-6-28-6-42 1"
        fill={wool}
      />
      {sleeping ? (
        <path
          d="m49 77 7 2 5-3m8 0 5 3 6-2"
          fill="none"
          stroke="#fff8e8"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ) : (
        <>
          <ellipse cx="54" cy="78" rx="3.4" ry="4.5" fill="#fff8e8" />
          <ellipse cx="74" cy="78" rx="3.4" ry="4.5" fill="#fff8e8" />
          <circle cx="55" cy="79" r="1.6" fill="#302d2a" />
          <circle cx="75" cy="79" r="1.6" fill="#302d2a" />
        </>
      )}
      <ellipse cx="46" cy="87" rx="5" ry="3" fill={accent} opacity=".7" />
      <ellipse cx="81" cy="87" rx="5" ry="3" fill={accent} opacity=".7" />
      <path
        d="m60 91 4 3 4-3m-4 3v3"
        fill="none"
        stroke="#302d2a"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {breed.id === "mint" && (
        <path d="M72 33q-8-22 14-20q7 18-14 20Z" fill={accent} />
      )}
      {["peach", "sakura", "honey"].includes(breed.id) && (
        <g fill={accent}>
          <circle cx="88" cy="37" r="6" />
          <circle cx="96" cy="31" r="6" />
          <circle cx="103" cy="39" r="6" />
          <circle cx="97" cy="47" r="6" />
          <circle cx="95" cy="39" r="4" fill="#fff0a6" />
        </g>
      )}
      {breed.id === "mushroom" && (
        <>
          <path d="M58 33q15-29 33 0Z" fill={accent} />
          <circle cx="74" cy="24" r="3" fill="#fff4dd" />
          <circle cx="83" cy="30" r="2" fill="#fff4dd" />
        </>
      )}
      {["moon", "stardust", "aurora"].includes(breed.id) && (
        <path d="m113 43 3 8 9 1-7 5 2 9-7-5-7 5 2-9-7-5 9-1Z" fill={accent} />
      )}
      {breed.id === "biscuit" && (
        <>
          <ellipse cx="118" cy="75" rx="10" ry="13" fill={accent} />
          <ellipse cx="98" cy="94" rx="8" ry="6" fill={accent} />
        </>
      )}
      {breed.id === "rain" && (
        <path d="M94 33q-12 14 0 15q11-1 0-15" fill={accent} />
      )}
    </svg>
  );
}

function CropIcon({ id, size = 24 }: { id: string; size?: number }) {
  return <ItemArt item={id} size={Math.max(28, size * 1.45)} />;
}

function RarityBadge({ rarity }: { rarity: Rarity }) {
  return (
    <span className={`lf-rarity lf-rarity-${rarity}`}>
      <span />
      {catalog.rarities[rarity].name}
    </span>
  );
}

function Meter({
  name,
  value,
  icon,
  tone = "green",
}: {
  name: string;
  value: number;
  icon: ReactNode;
  tone?: string;
}) {
  const amount = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`lf-meter lf-meter-${tone}`}>
      <div className="lf-meter-label">
        <span>
          {icon}
          {name}
        </span>
        <strong>
          {amount}
          <small>/100</small>
        </strong>
      </div>
      <div
        className="lf-meter-track"
        role="progressbar"
        aria-label={name}
        aria-valuenow={amount}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${amount}%` }} />
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="lf-empty">
      {icon}
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export default function Panels({
  panel,
  onClose,
  state,
  serverNow,
  room,
  user,
  players,
  onAction,
  onSelectSheep,
  selectedSheepId,
  onLeave,
  onEditAvatar,
  position,
  onTravel,
  quality,
  onQuality,
  music,
  onMusic,
  sound,
  onSound,
}: PanelsProps) {
  const [selectedId, setSelectedId] = useState(
    selectedSheepId ?? state.sheep[0]?.id ?? "",
  );
  const [name, setName] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [seedId, setSeedId] = useState("clover");
  const [shopTab, setShopTab] = useState<"supplies" | "sell" | "upgrades">(
    "supplies",
  );
  const [rarityFilter, setRarityFilter] = useState<"all" | Rarity>("all");
  const [pending, setPending] = useState(false);
  const [rehomeId, setRehomeId] = useState<string | null>(null);
  const step = state.progression.step;
  const [copyMessage, setCopyMessage] = useState("");
  const [newborn, setNewborn] = useState<Sheep | null>(null);
  const previousBirths = useRef(state.stats.births);
  const [localNow, setLocalNow] = useState(Date.now());
  const now = serverNow ?? localNow;
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheep =
    state.sheep.find((item) => item.id === selectedId) ?? state.sheep[0];
  const breed = sheep ? breedById[sheep.breedId] : null;
  const capacity = catalog.config.pastureCapacities[state.upgrades.pasture];
  const pasturePrice = catalog.config.pasturePrices[state.upgrades.pasture];
  const wateringPrice = catalog.config.wateringPrices[state.upgrades.watering];
  const stock = (itemId: string) => state.inventory[itemId] ?? 0;
  const foodCount = stock("feed") + stock("clover") + stock("carrot");
  const discovered = new Set(state.discoveries);
  const selectedSeed = cropById[seedId];
  const mature = sheep ? now >= sheep.adultAt : false;
  const breedCooldown = (item: Sheep) =>
    Math.max(
      0,
      (item.lastBredAt + catalog.config.breedingCooldown * 1000 - now) / 1000,
    );
  const eligible = (item: Sheep) =>
    now >= item.adultAt &&
    item.hunger >= catalog.config.breedMinHunger &&
    item.happiness >= catalog.config.breedMinHappiness &&
    breedCooldown(item) === 0;
  const partners = sheep
    ? state.sheep.filter(
        (item) => item.id !== sheep.id && item.sex !== sheep.sex,
      )
    : [];
  const partner = partners.find((item) => item.id === partnerId);
  const breedReason = !sheep
    ? ""
    : !mature
      ? `再过 ${duration((sheep.adultAt - now) / 1000)} 就长大了`
      : sheep.hunger < 55
        ? "先喂饱它：饱腹感需要达到 55"
        : sheep.happiness < 65
          ? "先摸摸它：心情需要达到 65"
          : breedCooldown(sheep) > 0
            ? `还需要休息 ${duration(breedCooldown(sheep))}`
            : state.sheep.length >= capacity
              ? "牧场住满了，去集市扩建草场吧"
              : !partner
                ? "选择一位异性小羊伙伴"
                : !eligible(partner)
                  ? "伙伴也需要成年、吃饱、开心并休息好"
                  : state.coins < catalog.config.breedingPrice
                    ? "金币还不够，再收获一些绒毛吧"
                    : "";

  useEffect(() => {
    if (!panel) return;
    setLocalNow(Date.now());
    const timer =
      serverNow === undefined
        ? window.setInterval(() => setLocalNow(Date.now()), 1000)
        : undefined;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      window.clearInterval(timer);
      previous?.focus();
    };
  }, [panel]);

  useEffect(() => {
    if (panel === "flock" && selectedSheepId) setSelectedId(selectedSheepId);
  }, [panel, selectedSheepId]);

  useEffect(() => {
    setName(sheep?.name ?? "");
    setPartnerId("");
  }, [sheep?.id]);

  useEffect(() => {
    if (!partnerId && partners.length)
      setPartnerId((partners.find(eligible) ?? partners[0]).id);
  }, [sheep?.id, state.sheep.length, partnerId]);

  useEffect(() => {
    // Action buttons can be replaced after harvest or disabled while saving.
    // Keep keyboard focus inside the open handbook when that happens.
    if (
      panel &&
      !pending &&
      !dialogRef.current?.contains(document.activeElement)
    ) {
      closeRef.current?.focus();
    }
  }, [panel, pending, state.version]);

  useEffect(() => {
    if (state.stats.births > previousBirths.current && panel === "flock") {
      const baby = state.sheep.at(-1);
      if (baby) {
        setNewborn(baby);
        setSelectedId(baby.id);
        dialogRef.current
          ?.querySelector(".lf-panel-body")
          ?.scrollTo({ top: 0 });
      }
    }
    previousBirths.current = state.stats.births;
  }, [state.stats.births, state.sheep, panel]);

  useEffect(() => {
    if (panel !== "flock") setNewborn(null);
  }, [panel]);

  const run = async (action: GameAction) => {
    if (pending) return;
    setPending(true);
    try {
      await onAction(action);
    } catch {
      /* The shared action handler displays the server's message. */
    } finally {
      setPending(false);
    }
  };

  const actionButton = (
    action: GameAction,
    children: ReactNode,
    disabled = false,
    className = "lf-button",
  ) => (
    <button
      className={className}
      disabled={pending || disabled}
      onClick={() => void run(action)}
    >
      {children}
    </button>
  );

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopyMessage("邀请码已复制，发给朋友就好");
    } catch {
      setCopyMessage("长按或选中上方邀请码，即可手动复制");
    }
  };

  if (!panel) return null;
  const title = titles[panel];

  return (
    <div
      className="lf-panel-backdrop"
      onPointerDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
      onWheel={(event) => event.stopPropagation()}
    >
      <section
        ref={dialogRef}
        className={`lf-panel lf-panel-${panel}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lf-panel-title"
        aria-describedby="lf-panel-description"
        aria-busy={pending}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
          if (event.key === "Tab") {
            const items = Array.from(
              dialogRef.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
              ) ?? [],
            ).filter((item) => item.getClientRects().length > 0);
            if (!items?.length) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <header className="lf-panel-header">
          <div>
            <h2 id="lf-panel-title">{title.name}</h2>
            <p id="lf-panel-description">{title.description}</p>
          </div>
          <button
            ref={closeRef}
            className="lf-close"
            onClick={onClose}
            aria-label="收起手册"
          >
            <X size={21} />
          </button>
        </header>
        <div className="lf-panel-body">
          {panel === "flock" && newborn && (
            <div
              className="lf-birth-note"
              role="status"
              style={
                {
                  "--baby-color": breedById[newborn.breedId].color,
                } as CSSProperties
              }
            >
              <div className="lf-birth-portrait">
                <SheepPortrait breed={breedById[newborn.breedId]} />
                <Sparkles size={19} />
              </div>
              <div>
                <span className="lf-birth-eyebrow">
                  牧场又多了一份小小的温柔
                </span>
                <h3>你好，{newborn.name}！</h3>
                <p>
                  <RarityBadge rarity={breedById[newborn.breedId].rarity} />{" "}
                  {breedById[newborn.breedId].name} · {newborn.trait}
                </p>
                <small>它会慢慢长大，也会记得你的每一次照顾。</small>
              </div>
              <button
                className="lf-close"
                aria-label="收起出生纪念"
                onClick={() => setNewborn(null)}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {panel === "map" && (
            <JourneyMap
              state={state}
              position={position}
              onTravel={onTravel}
              onAction={(action) => void run(action)}
              pending={pending}
            />
          )}
          {panel === "flock" && (
            <>
              {(step === 1 ||
                (step >= 12 && state.sheep.length < capacity)) && (
                <div className="lf-adoption-note">
                  <ItemArt item="bell" size={50} />
                  <div>
                    <h3>
                      {state.sheep.length === 0
                        ? "第一只小羊，在等你"
                        : state.sheep.length === 1
                          ? "给它找一位小羊伙伴"
                          : "再认识一位新朋友"}
                    </h3>
                    <p>
                      {state.sheep.length < 2
                        ? "一位适合这个小家的成年朋友，带着蓬松的绒毛来见你。"
                        : "每一次领养，都有一点软乎乎的惊喜。"}
                    </p>
                  </div>
                  {actionButton(
                    { type: "adopt" },
                    <>
                      领养 <Coins size={13} />
                      {catalog.config.adoptPrice}
                    </>,
                    state.coins < catalog.config.adoptPrice,
                  )}
                </div>
              )}
              {step >= 2 && step <= 4 && (
                <div className="lf-learning-note">
                  <NeighborPortrait person={0} size={56} />
                  <div>
                    <h3>{journey[step].title}</h3>
                    <p>{journey[step].text}</p>
                  </div>
                </div>
              )}
              <div className="lf-section-line">
                <span>
                  <Cloud size={17} />
                  羊群 <strong>{state.sheep.length}</strong>
                  <span className="lf-muted">/ {capacity} 只</span>
                </span>
                <span className="lf-muted">选一只，认识一下</span>
              </div>
              <div className="lf-flock-layout">
                <div className="lf-flock-list" aria-label="选择小羊">
                  {state.sheep.map((item) => {
                    const entry = breedById[item.breedId];
                    const adult = now >= item.adultAt;
                    return (
                      <button
                        key={item.id}
                        className={`lf-flock-card ${sheep?.id === item.id ? "is-selected" : ""}`}
                        onClick={() => {
                          setSelectedId(item.id);
                          onSelectSheep(item.id);
                        }}
                        aria-pressed={sheep?.id === item.id}
                      >
                        <div
                          className="lf-flock-image"
                          style={
                            { "--sheep-color": entry.color } as CSSProperties
                          }
                        >
                          <SheepPortrait breed={entry} />
                          {item.wool >= 100 && adult && (
                            <span className="lf-ready-dot" title="可以剪毛了">
                              <Scissors size={12} />
                            </span>
                          )}
                        </div>
                        <div>
                          <strong>{item.name}</strong>
                          <span>
                            {entry.name} <small>{adult ? "" : "· 幼崽"}</small>
                          </span>
                        </div>
                        <ChevronRight size={15} />
                      </button>
                    );
                  })}
                </div>
                {sheep && breed ? (
                  <div className="lf-sheep-detail">
                    <div
                      className="lf-sheep-hero"
                      style={{ "--sheep-color": breed.color } as CSSProperties}
                    >
                      <span className="lf-sheep-sex">
                        {sheep.sex === "female" ? "女孩 ♀" : "男孩 ♂"}
                      </span>
                      <SheepPortrait breed={breed} />
                      <RarityBadge rarity={breed.rarity} />
                    </div>
                    <div className="lf-detail-heading">
                      <div>
                        <h3>{sheep.name}</h3>
                        <span>
                          {breed.name} <span className="lf-small-dot">·</span>{" "}
                          {sheep.trait}
                        </span>
                      </div>
                      <span className="lf-tag">
                        {mature ? "成年羊" : "小羊羔"}
                      </span>
                    </div>
                    {!mature && (
                      <p className="lf-growth-note">
                        <Sprout size={15} />
                        正在长大，再过 {duration(
                          (sheep.adultAt - now) / 1000,
                        )}{" "}
                        就成年
                      </p>
                    )}
                    <div className="lf-meters">
                      {step >= 3 && (
                        <Meter
                          name="饱腹感"
                          value={sheep.hunger}
                          icon={<Leaf size={15} />}
                        />
                      )}
                      <Meter
                        name="好心情"
                        value={sheep.happiness}
                        tone="rose"
                        icon={<Heart size={15} />}
                      />
                      {step >= 4 && (
                        <Meter
                          name="蓬松绒毛"
                          value={sheep.wool}
                          tone="gold"
                          icon={<Cloud size={15} />}
                        />
                      )}
                    </div>
                    <div className="lf-care-actions">
                      {actionButton(
                        { type: "pet", sheepId: sheep.id },
                        <>
                          <Heart size={17} />
                          摸摸
                        </>,
                        now - sheep.petAt < catalog.config.petCooldown * 1000,
                        "lf-button lf-button-soft",
                      )}
                      {step >= 3 &&
                        actionButton(
                          { type: "feed", sheepId: sheep.id },
                          <>
                            <Leaf size={17} />
                            {sheep.hunger > 95 ? "吃饱啦" : "喂食"}{" "}
                            <small>{foodCount}</small>
                          </>,
                          foodCount < 1 || sheep.hunger > 95,
                          "lf-button lf-button-soft",
                        )}
                      {step >= 4 &&
                        actionButton(
                          { type: "shear", sheepId: sheep.id },
                          <>
                            <Scissors size={17} />
                            剪毛
                          </>,
                          !mature || sheep.wool < 100,
                        )}
                    </div>
                    <p className="lf-inline-hint">
                      {step < 4
                        ? "先陪它熟悉新家，更多照顾方法会慢慢学会。"
                        : foodCount === 0
                          ? "没有食物啦，集市可以买饲料，也可以种些三叶草。"
                          : sheep.wool >= 100 && mature
                            ? "绒毛已经蓬松满格，可以剪下来收藏或出售。"
                            : "饲料、三叶草和胡萝卜都能填饱小肚子。"}
                    </p>
                    <details className="lf-detail-fold">
                      <summary>
                        给它起个名字 <ChevronRight size={15} />
                      </summary>
                      <form
                        className="lf-name-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (name.trim() && name.trim() !== sheep.name)
                            void run({
                              type: "rename",
                              sheepId: sheep.id,
                              name: name.trim(),
                            });
                        }}
                      >
                        <input
                          aria-label="小羊的名字"
                          maxLength={16}
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          placeholder="一个只属于它的名字"
                        />
                        <button
                          className="lf-button"
                          disabled={
                            pending ||
                            !name.trim() ||
                            name.trim() === sheep.name
                          }
                        >
                          保存
                        </button>
                      </form>
                    </details>
                    {step >= 12 && (
                      <details
                        className="lf-detail-fold"
                        open={step === 12 ? true : undefined}
                      >
                        <summary>
                          <span>
                            <Heart size={16} />
                            迎接一只小羊羔
                          </span>
                          <ChevronRight size={15} />
                        </summary>
                        <p className="lf-inline-hint">
                          两只成年异性小羊，饱腹感 ≥55、心情
                          ≥65，休息好后就能拥有宝宝。宝宝可能继承父母，也可能带来新惊喜。
                        </p>
                        {partners.length ? (
                          <label className="lf-field-label">
                            选择伙伴
                            <select
                              value={partnerId}
                              onChange={(event) =>
                                setPartnerId(event.target.value)
                              }
                            >
                              {partners.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name} · {breedById[item.breedId].name}
                                  {eligible(item)
                                    ? " · 已准备好"
                                    : " · 需要照料"}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <p className="lf-inline-hint">
                            还没有合适的异性伙伴。可以去集市领养一只新朋友。
                          </p>
                        )}
                        {actionButton(
                          { type: "breed", sheepId: sheep.id, partnerId },
                          <>
                            <Heart size={17} />
                            迎接新生命{" "}
                            <span className="lf-button-price">
                              <Coins size={13} />
                              {catalog.config.breedingPrice}
                            </span>
                          </>,
                          Boolean(breedReason),
                          "lf-button lf-button-full",
                        )}
                        <p
                          className={`lf-inline-hint ${breedReason ? "" : "lf-positive"}`}
                        >
                          {breedReason ||
                            "都准备好了。新生的小羊会立刻来到牧场。"}
                        </p>
                      </details>
                    )}
                    {step >= 12 && state.sheep.length > 1 && (
                      <details className="lf-detail-fold lf-rehome-fold">
                        <summary>
                          让它去邻居的牧场 <ChevronRight size={15} />
                        </summary>
                        <p className="lf-inline-hint">
                          有时，新的家也在等它。送养后，图鉴里的相遇记录会一直保留。
                        </p>
                        {rehomeId === sheep.id ? (
                          <div className="lf-rehome-confirm">
                            <p>
                              要把 {sheep.name} 送去邻居家吗？它会离开这座牧场。
                            </p>
                            <button
                              className="lf-button lf-button-soft"
                              onClick={() => setRehomeId(null)}
                            >
                              再陪它一会儿
                            </button>
                            <button
                              className="lf-button"
                              disabled={pending}
                              onClick={() => {
                                void run({ type: "rehome", sheepId: sheep.id });
                                setRehomeId(null);
                              }}
                            >
                              送它去新家
                            </button>
                          </div>
                        ) : (
                          <button
                            className="lf-button lf-button-soft"
                            onClick={() => setRehomeId(sheep.id)}
                          >
                            了解送养
                          </button>
                        )}
                      </details>
                    )}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Cloud size={36} />}
                    title="草场正在等新朋友"
                  >
                    点一下上方的领养按钮，迎接属于这里的第一位小朋友。
                  </EmptyState>
                )}
              </div>
            </>
          )}

          {panel === "garden" && (
            <>
              <div className="lf-section-line">
                <span>
                  <Sprout size={18} />
                  {state.plots.filter((plot) => plot.cropId).length}{" "}
                  块田已种植
                </span>
                <span className="lf-muted">共 {state.plots.length} 块田</span>
              </div>
              <div
                className="lf-seed-picker"
                role="group"
                aria-label="选择要种的种子"
              >
                {catalog.crops
                  .filter((crop) => step >= cropUnlock[crop.id])
                  .map((crop) => (
                    <button
                      key={crop.id}
                      className={`lf-seed ${seedId === crop.id ? "is-selected" : ""}`}
                      aria-pressed={seedId === crop.id}
                      onClick={() => setSeedId(crop.id)}
                    >
                      <span style={{ color: crop.color }}>
                        <CropIcon id={crop.id} />
                      </span>
                      <strong>{crop.name}</strong>
                      <small>{stock(crop.seedId)} 包</small>
                    </button>
                  ))}
              </div>
              <div className="lf-garden-note">
                <Leaf size={18} />
                <p>
                  已选 <strong>{selectedSeed.name}</strong>，浇水后约{" "}
                  {duration(
                    selectedSeed.growSeconds *
                      (1 -
                        catalog.config.wateringGrowthBonus[
                          state.upgrades.watering
                        ]),
                  )}{" "}
                  成熟，可以收获 {selectedSeed.yield} 份。
                </p>
              </div>
              <div className="lf-plot-grid">
                {state.plots.map((plot, index) => {
                  const crop = plot.cropId ? cropById[plot.cropId] : null;
                  const ready = Boolean(
                    crop &&
                    plot.wateredAt > 0 &&
                    plot.readyAt > 0 &&
                    now >= plot.readyAt,
                  );
                  const progress =
                    crop && plot.wateredAt > 0
                      ? Math.max(
                          0,
                          Math.min(
                            100,
                            ((now - plot.wateredAt) /
                              Math.max(1, plot.readyAt - plot.wateredAt)) *
                              100,
                          ),
                        )
                      : 0;
                  return (
                    <div
                      key={plot.id}
                      className={`lf-plot ${crop ? "" : "lf-plot-empty"} ${ready ? "is-ready" : ""}`}
                    >
                      <div className="lf-plot-top">
                        <span>田地 {String(index + 1).padStart(2, "0")}</span>
                        {crop &&
                          (ready ? (
                            <span className="lf-ready-label">
                              <Check size={12} />
                              可收获
                            </span>
                          ) : plot.wateredAt > 0 ? (
                            <Droplets size={14} aria-label="已浇水" />
                          ) : (
                            <span className="lf-muted">待浇水</span>
                          ))}
                      </div>
                      <div
                        className="lf-plot-crop"
                        style={{ color: crop?.color ?? "#b2bea0" }}
                      >
                        {crop ? (
                          <CropIcon id={crop.id} size={39} />
                        ) : (
                          <Plus size={30} strokeWidth={1} />
                        )}
                        <strong>{crop?.name ?? "一小块期待"}</strong>
                      </div>
                      {crop ? (
                        <>
                          <div className="lf-plot-progress">
                            <span style={{ width: `${progress}%` }} />
                          </div>
                          <small className="lf-plot-time">
                            {ready
                              ? `可以收获 ${crop.yield} 份啦`
                              : plot.wateredAt === 0
                                ? "浇水后就开始生长"
                                : `还有 ${duration((plot.readyAt - now) / 1000)}`}
                          </small>
                          {ready && state.progression.step !== 7
                            ? actionButton(
                                { type: "harvest", plotId: plot.id },
                                <>
                                  <ShoppingBasket size={15} />
                                  收获
                                </>,
                                false,
                                "lf-button lf-button-full",
                              )
                            : actionButton(
                                { type: "water", plotId: plot.id },
                                <>
                                  <Droplets size={15} />
                                  {state.progression.step === 7 &&
                                  plot.wateredAt > 0
                                    ? "确认土壤喝饱了水"
                                    : plot.wateredAt > 0
                                      ? "已经浇过水"
                                      : "浇点水"}
                                </>,
                                plot.wateredAt > 0 &&
                                  state.progression.step !== 7,
                                "lf-button lf-button-soft lf-button-full",
                              )}
                        </>
                      ) : (
                        <>
                          <p className="lf-plot-time">
                            种下一包{selectedSeed.name}
                          </p>
                          {actionButton(
                            { type: "plant", plotId: plot.id, cropId: seedId },
                            <>
                              <Sprout size={15} />
                              {stock(selectedSeed.seedId) > 0
                                ? "播种"
                                : "种子用完了"}
                            </>,
                            stock(selectedSeed.seedId) < 1,
                            "lf-button lf-button-soft lf-button-full",
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="lf-inline-hint">
                <Sun size={14} />
                收获之后可以继续播种。种子用完时，到松果杂货铺补充一些。
              </p>
            </>
          )}

          {panel === "shop" && (
            <>
              <div className="lf-shop-top">
                <div className="lf-tabs" aria-label="集市区域">
                  {(
                    [
                      ["supplies", "买点东西"],
                      ["sell", "出售收获"],
                      ["upgrades", "打理牧场"],
                    ] as const
                  )
                    .filter(([id]) => id !== "upgrades" || step >= 12)
                    .map(([id, label]) => (
                      <button
                        key={id}
                        className={shopTab === id ? "is-active" : ""}
                        onClick={() => setShopTab(id)}
                        aria-pressed={shopTab === id}
                      >
                        {label}
                      </button>
                    ))}
                </div>
                <span className="lf-coins">
                  <Coins size={17} />
                  {state.coins.toLocaleString()}
                </span>
              </div>
              {shopTab === "supplies" && (
                <>
                  {step >= 12 && (
                    <div className="lf-shop-feature">
                      <div className="lf-shop-feature-art">
                        <SheepPortrait breed={breeds[0]} />
                      </div>
                      <div>
                        <h3>多一个毛茸茸的朋友</h3>
                        <p>
                          领养一只成年小羊，品种会有小惊喜。
                          <br />
                          草场还可以住{" "}
                          {Math.max(0, capacity - state.sheep.length)} 只。
                        </p>
                        {actionButton(
                          { type: "adopt" },
                          <>
                            <Plus size={15} />
                            领养小羊{" "}
                            <span className="lf-button-price">
                              <Coins size={13} />
                              {catalog.config.adoptPrice}
                            </span>
                          </>,
                          state.coins < catalog.config.adoptPrice ||
                            state.sheep.length >= capacity,
                        )}
                      </div>
                    </div>
                  )}
                  <div className="lf-shop-rows">
                    <div className="lf-shop-row">
                      <span className="lf-item-art lf-feed-art">
                        <ItemArt item="feed" size={51} />
                      </span>
                      <div className="lf-shop-item-name">
                        <h4>牧草饲料</h4>
                        <p>装满小羊肚子的日常口粮。</p>
                        <small>背包 {stock("feed")} 份</small>
                      </div>
                      <div className="lf-buy-buttons">
                        {actionButton(
                          { type: "buy", itemId: "feed", quantity: 1 },
                          <>
                            1 份 <Coins size={12} />
                            {catalog.config.feedPrice}
                          </>,
                          state.coins < catalog.config.feedPrice,
                          "lf-button lf-button-soft",
                        )}
                        {actionButton(
                          { type: "buy", itemId: "feed", quantity: 5 },
                          <>
                            5 份 <Coins size={12} />
                            {catalog.config.feedPrice * 5}
                          </>,
                          state.coins < catalog.config.feedPrice * 5,
                        )}
                      </div>
                    </div>
                    {catalog.crops
                      .filter((crop) => step >= cropUnlock[crop.id])
                      .map((crop) => (
                        <div key={crop.id} className="lf-shop-row">
                          <span
                            className="lf-item-art"
                            style={
                              { "--item-color": crop.color } as CSSProperties
                            }
                          >
                            <CropIcon id={crop.id} size={29} />
                          </span>
                          <div className="lf-shop-item-name">
                            <h4>{crop.name}种子</h4>
                            <p>
                              {duration(crop.growSeconds)} 成熟 · 每株收获{" "}
                              {crop.yield} 份
                            </p>
                            <small>背包 {stock(crop.seedId)} 包</small>
                          </div>
                          <div className="lf-buy-buttons">
                            {actionButton(
                              { type: "buy", itemId: crop.seedId, quantity: 1 },
                              <>
                                1 包 <Coins size={12} />
                                {crop.seedPrice}
                              </>,
                              state.coins < crop.seedPrice,
                              "lf-button lf-button-soft",
                            )}
                            {actionButton(
                              { type: "buy", itemId: crop.seedId, quantity: 5 },
                              <>
                                5 包 <Coins size={12} />
                                {crop.seedPrice * 5}
                              </>,
                              state.coins < crop.seedPrice * 5,
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}
              {shopTab === "sell" && (
                <>
                  <div className="lf-note">
                    <ShoppingBasket size={19} />
                    <p>
                      留一点给小羊和邻里心愿，剩下的就交给集市吧。这里显示的是可以出售的收获。
                    </p>
                  </div>
                  {Object.entries(state.inventory).some(
                    ([id, amount]) => amount > 0 && sellValue(id) > 0,
                  ) ? (
                    <div className="lf-shop-rows">
                      {Object.entries(state.inventory)
                        .filter(
                          ([id, amount]) => amount > 0 && sellValue(id) > 0,
                        )
                        .map(([id, amount]) => (
                          <div key={id} className="lf-shop-row">
                            <span
                              className="lf-item-art"
                              style={
                                {
                                  "--item-color": id.startsWith("wool_")
                                    ? breedById[id.slice(5)]?.color
                                    : cropById[id]?.color,
                                } as CSSProperties
                              }
                            >
                              <CropIcon id={id} size={29} />
                            </span>
                            <div className="lf-shop-item-name">
                              <h4>{itemName(id)}</h4>
                              <p>每份 {sellValue(id)} 金币</p>
                              <small>背包 {amount} 份</small>
                            </div>
                            <div className="lf-buy-buttons">
                              {actionButton(
                                { type: "sell", itemId: id, quantity: 1 },
                                <>
                                  卖 1 份 <Coins size={12} />
                                  {sellValue(id)}
                                </>,
                                false,
                                "lf-button lf-button-soft",
                              )}
                              {actionButton(
                                {
                                  type: "sell",
                                  itemId: id,
                                  quantity: Math.min(amount, 99),
                                },
                                <>
                                  {amount > 99 ? "卖 99 份" : "全卖"}{" "}
                                  <Coins size={12} />
                                  {Math.min(amount, 99) * sellValue(id)}
                                </>,
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<ShoppingBasket size={38} />}
                      title="篮子还是空空的"
                    >
                      给小羊剪些绒毛，或去田里收获成熟作物，再来逛逛吧。
                    </EmptyState>
                  )}
                </>
              )}
              {shopTab === "upgrades" && (
                <div className="lf-upgrades">
                  <article className="lf-upgrade">
                    <div className="lf-upgrade-art">
                      <ItemArt item="shelter" size={106} />
                    </div>
                    <div>
                      <span className="lf-tag">
                        草场 · {state.upgrades.pasture + 1} 级
                      </span>
                      <h3>
                        {state.upgrades.pasture >= 2
                          ? "大家庭的草场"
                          : "给小羊更大的家"}
                      </h3>
                      <p>
                        {state.upgrades.pasture >= 2
                          ? "这片草场可以容纳 24 只小羊，已经是最温暖的大家庭。"
                          : `扩建后，羊群容量从 ${capacity} 只增加到 ${state.upgrades.pasture === 0 ? 14 : 24} 只。`}
                      </p>
                      {actionButton(
                        { type: "upgrade", upgradeId: "pasture" },
                        state.upgrades.pasture >= 2 ? (
                          <>
                            <Check size={15} />
                            已全部扩建
                          </>
                        ) : (
                          <>
                            扩建草场{" "}
                            <span className="lf-button-price">
                              <Coins size={13} />
                              {pasturePrice}
                            </span>
                          </>
                        ),
                        state.upgrades.pasture >= 2 ||
                          state.coins < pasturePrice,
                      )}
                    </div>
                  </article>
                  <article className="lf-upgrade">
                    <div className="lf-upgrade-art lf-water-art">
                      <ItemArt item="seed" size={95} />
                    </div>
                    <div>
                      <span className="lf-tag">
                        园艺 · {state.upgrades.watering + 1} 级
                      </span>
                      <h3>
                        {state.upgrades.watering >= 2
                          ? "会照顾花草的小水壶"
                          : "让花草喝得更开心"}
                      </h3>
                      <p>
                        {state.upgrades.watering >= 2
                          ? "作物生长加快 20%，浇水时会照顾所有已播种的田地。"
                          : state.upgrades.watering === 0
                            ? "升级园艺工具，让作物生长加快 10%。"
                            : "作物生长加快至 20%，一次浇水照顾所有已播种田地。"}
                      </p>
                      {actionButton(
                        { type: "upgrade", upgradeId: "watering" },
                        state.upgrades.watering >= 2 ? (
                          <>
                            <Check size={15} />
                            已经升级完成
                          </>
                        ) : (
                          <>
                            升级园艺{" "}
                            <span className="lf-button-price">
                              <Coins size={13} />
                              {wateringPrice}
                            </span>
                          </>
                        ),
                        state.upgrades.watering >= 2 ||
                          state.coins < wateringPrice,
                      )}
                    </div>
                  </article>
                </div>
              )}
            </>
          )}

          {panel === "journal" && (
            <>
              <div className="lf-journal-progress">
                <div>
                  <BookOpen size={24} />
                  <span>
                    已经相遇 <strong>{discovered.size}</strong> /{" "}
                    {breeds.length}
                  </span>
                </div>
                <div className="lf-meter-track">
                  <span
                    style={{
                      width: `${(discovered.size / breeds.length) * 100}%`,
                    }}
                  />
                </div>
                <p>领养和繁育，都可能带来一位从未见过的新朋友。</p>
              </div>
              <div className="lf-rarity-filters" aria-label="按稀有度筛选">
                <button
                  className={rarityFilter === "all" ? "is-active" : ""}
                  onClick={() => setRarityFilter("all")}
                  aria-pressed={rarityFilter === "all"}
                >
                  全部小羊
                </button>
                {Object.entries(catalog.rarities).map(([id, value]) => (
                  <button
                    key={id}
                    className={rarityFilter === id ? "is-active" : ""}
                    onClick={() => setRarityFilter(id as Rarity)}
                    aria-pressed={rarityFilter === id}
                  >
                    <span style={{ background: value.color }} />
                    {value.name}
                  </button>
                ))}
              </div>
              <div className="lf-journal-grid">
                {breeds
                  .filter(
                    (item) =>
                      rarityFilter === "all" || item.rarity === rarityFilter,
                  )
                  .map((item) => {
                    const known = discovered.has(item.id);
                    return (
                      <article
                        key={item.id}
                        className={`lf-journal-card ${known ? "is-discovered" : ""}`}
                      >
                        <div
                          className="lf-journal-art"
                          style={
                            { "--sheep-color": item.color } as CSSProperties
                          }
                        >
                          <SheepPortrait breed={item} hidden={!known} />
                          {known ? (
                            <BadgeCheck
                              size={19}
                              className="lf-discovery-mark"
                              aria-label="已发现"
                            />
                          ) : (
                            <span className="lf-discovery-unknown">?</span>
                          )}
                        </div>
                        <div className="lf-journal-card-body">
                          <RarityBadge rarity={item.rarity} />
                          <h3>{item.name}</h3>
                          <p>
                            {known
                              ? item.description
                              : "还没有相遇，未来的某一天，它会来到你的牧场。"}
                          </p>
                          <div className="lf-journal-foot">
                            {known ? (
                              <>
                                <Heart size={13} />
                                {item.personality}
                              </>
                            ) : (
                              <>
                                <Sparkles size={13} />
                                等待一次特别的相遇
                              </>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
              </div>
            </>
          )}

          {panel === "orders" && (
            <>
              <div className="lf-section-line">
                <span>
                  <Heart size={17} />
                  已完成 {state.stats.ordersCompleted} 份心愿
                </span>
                <span className="lf-muted">共享背包 · 一起完成</span>
              </div>
              <div className="lf-orders">
                {state.orders.map((order, index) => {
                  const held = stock(order.itemId);
                  const enough = held >= order.quantity;
                  return (
                    <article
                      className={`lf-order ${order.completed ? "is-complete" : ""}`}
                      key={order.id}
                    >
                      <span className="lf-order-stamp">
                        <ItemArt item="letter" size={58} />
                      </span>
                      <div className="lf-order-content">
                        <span className="lf-order-sender">
                          <NeighborPortrait
                            person={
                              order.itemId.startsWith("wool_")
                                ? 2
                                : index % 2
                                  ? 0
                                  : 1
                            }
                            size={43}
                          />
                          {order.itemId.startsWith("wool_")
                            ? "织匠阿棕"
                            : index % 2
                              ? "青苔奶奶"
                              : "花匠小葵"}
                          的心愿
                        </span>
                        <h3>{order.title}</h3>
                        <p className="lf-order-request">
                          <ItemArt item={order.itemId} size={48} /> 想要{" "}
                          <strong>
                            {order.quantity} 份{itemName(order.itemId)}
                          </strong>
                        </p>
                        <div className="lf-order-stock">
                          <span
                            className={
                              enough || order.completed ? "lf-positive" : ""
                            }
                          >
                            {order.completed
                              ? "已经送达，谢谢你的心意"
                              : `背包里有 ${held} / ${order.quantity} 份`}
                          </span>
                          {!order.completed && (
                            <div className="lf-meter-track">
                              <span
                                style={{
                                  width: `${Math.min(100, (held / order.quantity) * 100)}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                        <div className="lf-order-bottom">
                          <div className="lf-order-rewards">
                            <span>
                              <Coins size={15} />
                              {order.reward}
                            </span>
                            <span>
                              <Sparkles size={15} />
                              {order.xp} 成长值
                            </span>
                          </div>
                          {actionButton(
                            { type: "order", orderId: order.id },
                            order.completed ? (
                              <>
                                <Check size={16} />
                                已完成
                              </>
                            ) : (
                              <>
                                {enough ? "完成心愿" : "还需要收集"}
                                {enough && <ArrowRight size={15} />}
                              </>
                            ),
                            order.completed || !enough,
                            `lf-button ${order.completed || !enough ? "lf-button-soft" : ""}`,
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              {state.orders.length === 0 && (
                <EmptyState
                  icon={<Heart size={38} />}
                  title="此刻没有待完成的心愿"
                >
                  先照顾羊群和田地，新的心愿会到来的。
                </EmptyState>
              )}
            </>
          )}

          {panel === "room" && (
            <>
              <div className="lf-room-cover">
                <div className="lf-room-icon">
                  <Users size={33} />
                </div>
                <h3>{room.name}</h3>
                <p>在同一片草地上，过各自喜欢的慢生活。</p>
              </div>
              <div className="lf-invite">
                <label htmlFor="lf-room-code">把邀请码分享给朋友</label>
                <div>
                  <input
                    id="lf-room-code"
                    value={room.code}
                    readOnly
                    onFocus={(event) => event.target.select()}
                  />
                  <button className="lf-button" onClick={() => void copyCode()}>
                    <Copy size={16} />
                    复制
                  </button>
                </div>
                <p aria-live="polite">
                  {copyMessage || "朋友登录后，在「加入牧场」填写这个邀请码。"}
                </p>
              </div>
              <div className="lf-section-line">
                <span>
                  此刻在牧场 <strong>{players.length}</strong> 人
                </span>
                <span className="lf-online-dot">一起在线</span>
              </div>
              <div className="lf-player-list">
                {players.map((player) => (
                  <div key={player.id} className="lf-player">
                    <span
                      className="lf-player-avatar"
                      style={
                        { "--avatar-color": player.color } as CSSProperties
                      }
                    >
                      {player.username.slice(0, 1).toLocaleUpperCase()}
                    </span>
                    <strong>{player.username}</strong>
                    {player.id === user.id && (
                      <span className="lf-tag">你</span>
                    )}
                    {player.id === room.ownerId && (
                      <span className="lf-muted">牧场主人</span>
                    )}
                    <span className="lf-player-online" />
                  </div>
                ))}
              </div>
              <div className="lf-note">
                <Heart size={19} />
                <p>
                  羊群、田地、背包、金币和心愿由大家共享。收获一起分，农活一起做；离开后，再次进入就能继续照顾这座牧场。
                </p>
              </div>
              <button
                className="lf-button lf-button-soft lf-leave"
                onClick={onLeave}
              >
                <LogOut size={16} />
                返回牧场列表
              </button>
            </>
          )}

          {panel === "help" && (
            <>
              <div className="lf-help-welcome">
                <SheepPortrait breed={breeds[0]} />
                <div>
                  <h3>今天，也慢慢来。</h3>
                  <p>
                    走近一只羊，给它摸摸、喂点食物。绒毛长满后剪下来，换成种子，再为牧场添一个新朋友。
                  </p>
                </div>
              </div>
              <div className="lf-help-controls">
                <h3>在牧场里走走</h3>
                <div>
                  <span>移动牧羊人</span>
                  <span className="lf-key-group">
                    <kbd>W</kbd>
                    <kbd>A</kbd>
                    <kbd>S</kbd>
                    <kbd>D</kbd>
                    <small>或方向键</small>
                  </span>
                </div>
                <div>
                  <span>走到一个地方</span>
                  <span>点击 / 轻触地面，自动绕路</span>
                </div>
                <div>
                  <span>轻轻跳一下 / 跑快一点</span>
                  <span className="lf-key-group">
                    <kbd>Space</kbd>
                    <span>/</span>
                    <kbd>Shift</kbd>
                  </span>
                </div>
                <div>
                  <span>使用当前工具</span>
                  <span className="lf-key-group">
                    <kbd>E</kbd>
                    <small>或点击目标</small>
                  </span>
                </div>
                <div>
                  <span>切换工具</span>
                  <span className="lf-key-group">
                    <kbd>1</kbd>
                    <span>—</span>
                    <kbd>6</kbd>
                  </span>
                </div>
                <div>
                  <span>转动 / 拉近视角</span>
                  <span>右键拖动 / 滚轮缩放</span>
                </div>
                <div>
                  <span>收起手册</span>
                  <kbd>Esc</kbd>
                </div>
              </div>
              <div className="lf-help-tips">
                <article>
                  <Heart size={20} />
                  <h4>照顾小羊</h4>
                  <p>
                    摸摸提升心情，食物恢复饱腹感。成年羊绒毛满格就能剪毛；幼崽会慢慢长大。
                  </p>
                </article>
                {step >= 6 && (
                  <article>
                    <Sprout size={20} />
                    <h4>种点好东西</h4>
                    <p>
                      选择种子，在空田播种，再浇点水。成熟后收获，留给羊吃、完成心愿，或拿去出售。
                    </p>
                  </article>
                )}
                {step >= 12 && (
                  <article>
                    <Sparkles size={20} />
                    <h4>期待新生命</h4>
                    <p>
                      两只开心、吃饱的异性成年羊可以繁育。打开小羊详情，选好伙伴，迎接一团新绒毛。
                    </p>
                  </article>
                )}
                <article>
                  <Users size={20} />
                  <h4>邀请朋友</h4>
                  <p>
                    分享牧场邀请码，就能一起养羊种花。所有人使用同一个背包和金币。
                  </p>
                </article>
              </div>
              <div className="lf-note">
                <Sun size={19} />
                <p>
                  这里的一天约 12
                  分钟。看看夕阳，听听风声，晚上还有另一种好风景。
                </p>
              </div>
            </>
          )}

          {panel === "settings" && (
            <>
              <div className="lf-setting-row">
                <div className="lf-setting-icon">
                  <Shirt size={25} />
                </div>
                <div>
                  <h3>我的牧羊人</h3>
                  <p>换一个发型，穿上今天喜欢的颜色。</p>
                </div>
                <button
                  className="lf-button lf-button-soft"
                  onClick={onEditAvatar}
                >
                  换个模样
                </button>
              </div>
              <div className="lf-setting-row">
                <div className="lf-setting-icon">
                  {sound ? <Volume2 size={25} /> : <VolumeX size={25} />}
                </div>
                <div>
                  <h3>牧场的声音</h3>
                  <p>听见风、小羊和每一次小小的收获。</p>
                </div>
                <button
                  className={`lf-switch ${sound ? "is-on" : ""}`}
                  role="switch"
                  aria-checked={sound}
                  aria-label="牧场声音"
                  onClick={() => onSound(!sound)}
                >
                  <span />
                </button>
              </div>
              <div className="lf-setting-row">
                <div className="lf-setting-icon">
                  <Music2 size={25} />
                </div>
                <div>
                  <h3>慢慢的旋律</h3>
                  <p>一首轻轻流淌的牧场音乐，也可以只听鸟鸣。</p>
                </div>
                <button
                  className={`lf-switch ${music ? "is-on" : ""}`}
                  role="switch"
                  aria-checked={music}
                  aria-label="背景音乐"
                  disabled={!sound}
                  onClick={() => onMusic(!music)}
                >
                  <span />
                </button>
              </div>
              <div className="lf-setting-quality">
                <h3>画面细节</h3>
                <p>根据设备选择，让在牧场的每一步都轻松流畅。</p>
                <div
                  className="lf-quality-options"
                  role="radiogroup"
                  aria-label="画面质量"
                >
                  <button
                    className={quality === "high" ? "is-selected" : ""}
                    onClick={() => onQuality("high")}
                    role="radio"
                    aria-checked={quality === "high"}
                  >
                    <Sun size={25} />
                    <strong>细腻画面</strong>
                    <span>柔和光影，更多自然细节</span>
                    {quality === "high" && <Check size={17} />}
                  </button>
                  <button
                    className={quality === "low" ? "is-selected" : ""}
                    onClick={() => onQuality("low")}
                    role="radio"
                    aria-checked={quality === "low"}
                  >
                    <Leaf size={25} />
                    <strong>轻盈流畅</strong>
                    <span>减少特效，适合手机和节电</span>
                    {quality === "low" && <Check size={17} />}
                  </button>
                </div>
              </div>
              <div className="lf-settings-end">
                <Flower2 size={30} />
                <p>小羊会等你，生活可以慢一点。</p>
                <span>小羊慢慢 · Little Flock</span>
              </div>
            </>
          )}
        </div>
        <footer className="lf-panel-footer">
          <span>
            <Leaf size={13} />
            {room.name}
          </span>
          <span>
            {pending ? (
              "正在照顾牧场…"
            ) : panel === "flock" || panel === "garden" || panel === "shop" ? (
              <>
                <Coins size={13} />
                {state.coins.toLocaleString()} 金币
              </>
            ) : (
              "一片属于我们的好风景"
            )}
          </span>
        </footer>
      </section>
    </div>
  );
}
