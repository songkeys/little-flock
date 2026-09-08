import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  CloudSun,
  Coins,
  Droplets,
  Flower2,
  Hand,
  Heart,
  HelpCircle,
  Leaf,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Moon,
  PackageOpen,
  Scissors,
  Send,
  Settings,
  ShoppingBasket,
  Sprout,
  Sun,
  Users,
  Volume2,
  VolumeX,
  Wheat,
  Wind,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  Breed,
  FarmState,
  GameAction,
  Player,
  RoomDetail,
  ServerMessage,
  User,
  Vec2,
} from "./game/types";
import catalog from "./game/catalog.json";
import { api } from "./game/api";
import {
  getMusic,
  setMusic,
  getSound,
  playSound,
  setSound,
  unlockAudio,
} from "./game/audio";
import Welcome from "./ui/Welcome";
import AvatarEditor from "./ui/AvatarEditor";
import Panels, { type PanelId } from "./ui/Panels";
import StoryGuide from "./ui/StoryGuide";
import ValleyMiniMap from "./ui/ValleyMiniMap";
import { ItemArt } from "./ui/ItemArt";
import {
  cropUnlock,
  toolUnlock,
  panelUnlock,
  journey,
} from "./game/progression";
import regions from "./game/regions.json";
import "./ui/progression.css";
import { getWalkPath, walkablePosition } from "./world/geometry";
import type { InteractionTarget, WorldPlayer } from "./world/World";
const World = lazy(() => import("./world/World"));

type LiveRoom = RoomDetail & { receivedAt: number };

function mergeSnapshot(
  current: LiveRoom | null,
  roomId: string,
  state: FarmState,
  serverTime: number,
  receivedAt: number,
) {
  if (!current || current.room.id !== roomId) return current;
  if (
    state.version < current.state.version ||
    (state.version === current.state.version &&
      state.updatedAt < current.state.updatedAt)
  )
    return current;
  return { ...current, state, serverTime, receivedAt };
}

type Tool = "pet" | "feed" | "shear" | "plant" | "water" | "harvest";
const tools: { id: Tool; label: string; icon: LucideIcon; hint: string }[] = [
  { id: "pet", label: "摸摸", icon: Hand, hint: "轻轻摸摸小羊，让它开心一点" },
  {
    id: "feed",
    label: "喂食",
    icon: Wheat,
    hint: "点击小羊，喂一份香喷喷的饲料",
  },
  {
    id: "shear",
    label: "剪毛",
    icon: Scissors,
    hint: "点击绒毛长满的成年羊，收获羊毛",
  },
  {
    id: "plant",
    label: "播种",
    icon: Sprout,
    hint: "选好种子，点击空田地播种",
  },
  {
    id: "water",
    label: "浇水",
    icon: Droplets,
    hint: "点击种好的田地，给种子一场小雨",
  },
  {
    id: "harvest",
    label: "收获",
    icon: ShoppingBasket,
    hint: "点击成熟的作物，把丰收装进背包",
  },
];
const emptyPlayers: Player[] = [];
function formatClock(progress: number) {
  const min = Math.floor(progress * 1440) % 1440;
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export default function App() {
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [user, setUser] = useState<User | null>(null),
    [checking, setChecking] = useState(true),
    [detail, setDetail] = useState<LiveRoom | null>(null);
  const [panel, setPanel] = useState<PanelId | null>(null),
    [tool, setTool] = useState<Tool>("pet"),
    [seed, setSeed] = useState("clover"),
    [seedMenu, setSeedMenu] = useState(false);
  const [selected, setSelected] = useState<{
      type: "sheep" | "plot";
      id: string;
    } | null>(null),
    [players, setPlayers] = useState<Player[]>(emptyPlayers),
    [connected, setConnected] = useState(false);
  const [quality, setQuality] = useState<"high" | "low">(() => {
    const saved = localStorage.getItem("flock-quality");
    return saved === "high" || saved === "low"
      ? saved
      : window.innerWidth < 700
        ? "low"
        : "high";
  });
  const [music, setMusicState] = useState(getMusic);
  const [sound, setSoundState] = useState(getSound),
    [toast, setToast] = useState<{
      id: number;
      text: string;
      error?: boolean;
    } | null>(null),
    [effect, setEffect] = useState<
      { id: number; type: string; targetId?: string } | undefined
    >();
  const [target, setTarget] = useState<Vec2 | null>(null),
    [flockWhistle, setFlockWhistle] = useState<{
      at: number;
      position: Vec2;
    }>(),
    [hudPosition, setHudPosition] = useState<Vec2>({ x: 0, z: 6 });
  const [chatOpen, setChatOpen] = useState(false),
    [chatText, setChatText] = useState(""),
    [chatCooldownUntil, setChatCooldownUntil] = useState(0),
    [chat, setChat] = useState<
      { username: string; text: string; at: number }[]
    >([]),
    [now, setNow] = useState(Date.now());
  const player = useRef<WorldPlayer>({
      position: { x: 0, z: 6 },
      facing: Math.PI,
      moving: false,
    }),
    keys = useRef(new Set<string>()),
    joystick = useRef({ x: 0, z: 0 }),
    route = useRef<Vec2[]>([]);
  const socket = useRef<WebSocket | null>(null),
    movementReady = useRef(false),
    gameRef = useRef(detail),
    actionRef = useRef<(t: InteractionTarget) => void>(() => {}),
    nearestRef = useRef<InteractionTarget | null>(null),
    lastAction = useRef(0);
  const [nearest, setNearest] = useState<InteractionTarget | null>(null);
  const sheepPositions = useRef<Record<string, Vec2>>({});
  const cameraForward = useRef<Vec2>({ x: -0.6, z: -0.8 });
  const pendingWalkAction = useRef<{
    target: InteractionTarget;
    position: Vec2;
  } | null>(null);
  const notify = useCallback((text: string, error = false) => {
    setToast({ id: Date.now(), text, error });
    if (error) playSound("error");
  }, []);
  gameRef.current = detail;
  useEffect(() => {
    let active = true;
    api
      .me()
      .then(async (r) => {
        if (!active) return;
        setUser(r.user);
        const last = localStorage.getItem("flock-room");
        if (last) {
          try {
            const room = await api.room(last);
            if (active) setDetail({ ...room, receivedAt: Date.now() });
          } catch {
            if (active)
              notify("暂时没有连上上次的牧场，可以在列表里重新进入。", true);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!detail) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [detail?.room.id]);
  useEffect(() => {
    if (!detail) return;
    let disposed = false,
      retry: ReturnType<typeof setTimeout> | undefined;
    let currentSocket: WebSocket | null = null;
    const id = detail.room.id;
    let attempts = 0;
    const connect = () => {
      if (disposed) return;
      const ws = new WebSocket(
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/rooms/${id}/ws`,
      );
      socket.current = ws;
      currentSocket = ws;
      movementReady.current = false;
      let awaitingSpawn = true;
      ws.onopen = () => {
        if (disposed) {
          ws.close();
          return;
        }
        attempts = 0;
      };
      ws.onmessage = (e) => {
        if (disposed || socket.current !== ws) return;
        const message = JSON.parse(e.data) as ServerMessage;
        if (message.type === "state") {
          const receivedAt = Date.now();
          setDetail((d) =>
            mergeSnapshot(d, id, message.state, message.serverTime, receivedAt),
          );
        } else if (message.type === "presence") {
          setPlayers(message.players);
          if (awaitingSpawn) {
            const ownPlayer = message.players.find((p) => p.id === user?.id);
            if (ownPlayer) {
              player.current.position = { ...ownPlayer.position };
              player.current.facing = ownPlayer.facing;
              player.current.moving = false;
              player.current.jumpAt = 0;
              route.current = [];
              pendingWalkAction.current = null;
              keys.current.clear();
              joystick.current = { x: 0, z: 0 };
              setTarget(null);
              setHudPosition({ ...ownPlayer.position });
              nearestRef.current = null;
              setNearest(null);
              awaitingSpawn = false;
              movementReady.current = true;
              setConnected(true);
            }
          }
        } else if (message.type === "whistle") {
          setFlockWhistle({ at: message.at, position: message.position });
          playSound("whistle");
          notify("咻——小羊们，来这边！");
        } else if (message.type === "chat") {
          setChat((c) => [...c.slice(-49), message]);
        } else if (
          message.type === "event" &&
          !message.text.startsWith(`${user?.username} · `)
        ) {
          notify(message.text);
        } else if (message.type === "roomDeleted") {
          if (message.roomId === id) {
            disposed = true;
            leave();
            notify(
              "牧场主人已删除这个世界。你可以创建新的牧场，或加入另一位朋友。 ",
            );
          }
        } else if (message.type === "error") {
          notify(message.message, true);
        }
      };
      ws.onclose = () => {
        if (disposed || socket.current !== ws) return;
        movementReady.current = false;
        setConnected(false);
        retry = setTimeout(connect, Math.min(5000, 1000 * ++attempts));
      };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => {
      disposed = true;
      clearTimeout(retry);
      currentSocket?.close();
      if (socket.current === currentSocket) socket.current = null;
      movementReady.current = false;
      setConnected(false);
      setPlayers([]);
    };
  }, [detail?.room.id, notify, user?.id, user?.username]);
  const enter = (r: RoomDetail) => {
    unlockAudio();
    const live = { ...r, receivedAt: Date.now() };
    gameRef.current = live;
    setDetail(live);
    localStorage.setItem("flock-room", r.room.id);
    player.current.position = { x: 0, z: 6 };
    player.current.moving = false;
    player.current.jumpAt = 0;
    route.current = [];
    setFlockWhistle(undefined);
    sheepPositions.current = {};
    setTarget(null);
    setPanel(null);
    setSelected(null);
    setSeedMenu(false);
    setChatOpen(false);
    setChatText("");
    setChat([]);
    notify(`欢迎来到${r.room.name}，慢慢来就好。`);
  };
  const leave = () => {
    gameRef.current = null;
    setDetail(null);
    setPanel(null);
    localStorage.removeItem("flock-room");
    route.current = [];
    keys.current.clear();
    joystick.current = { x: 0, z: 0 };
    player.current.moving = false;
    player.current.jumpAt = 0;
    setFlockWhistle(undefined);
    setTarget(null);
    setSelected(null);
    setNearest(null);
    nearestRef.current = null;
    setChatOpen(false);
    setChatText("");
    setChat([]);
  };
  const doAction = useCallback(
    async (action: GameAction) => {
      const d = gameRef.current;
      if (!d) return;
      try {
        const result = await api.action(d.room.id, action);
        if (gameRef.current?.room.id !== d.room.id) return;
        const receivedAt = Date.now();
        setDetail((current) =>
          mergeSnapshot(
            current,
            d.room.id,
            result.state,
            result.serverTime,
            receivedAt,
          ),
        );
        setEffect({
          id: Date.now(),
          type: action.type,
          targetId:
            "sheepId" in action
              ? action.sheepId
              : "plotId" in action
                ? action.plotId
                : undefined,
        });
        playSound(action.type);
        notify(result.message);
      } catch (e) {
        if (gameRef.current?.room.id === d.room.id)
          notify(e instanceof Error ? e.message : "操作没有完成", true);
        throw e;
      }
    },
    [notify],
  );
  const grazingNeedsLeader = (state: FarmState) =>
    state.grazing.active &&
    !players.some((p) => p.id === state.grazing.leaderId);
  const targetPosition = (target: InteractionTarget): Vec2 | undefined => {
    const d = gameRef.current;
    if (!d) return;
    if (target.type === "build")
      return target.id === "garden" ? { x: 2, z: 1 } : { x: -6, z: 3 };
    if (target.type === "forage")
      return d.state.forageNodes.find((n) => n.id === target.id)?.position;
    if (target.type === "water") return regions.meadow.waterPoint;
    if (target.type === "graze")
      return d.state.grazing.active && !grazingNeedsLeader(d.state)
        ? regions.meadow.grazePoint
        : regions.home.returnPoint;
    if (target.type === "home" && d.state.grazing.active)
      return regions.home.returnPoint;
    if (target.type === "viewpoint") return regions.highland.viewPoint;
    return undefined;
  };
  const worldAction = (target: InteractionTarget) => {
    if (Date.now() - lastAction.current < 240) return;
    lastAction.current = Date.now();
    unlockAudio();
    const d = gameRef.current;
    if (!d || panel || chatOpen || editingAvatar) return;
    const serverNow = Date.now() + d.serverTime - d.receivedAt;
    const step = d.state.progression.step;
    const approach = targetPosition(target);
    if (
      approach &&
      Math.hypot(
        player.current.position.x - approach.x,
        player.current.position.z - approach.z,
      ) > 1.45
    ) {
      route.current = getWalkPath(player.current.position, approach, step);
      setTarget(route.current.at(-1) ?? null);
      pendingWalkAction.current = { target, position: approach };
      return;
    }
    const perform = (action: GameAction) => {
      void doAction(action).catch(() => {});
    };
    if (target.type === "build") {
      perform({
        type: "build",
        facility: target.id === "garden" ? "garden" : "shelter",
      });
      return;
    }
    if (target.type === "forage" && target.id) {
      perform({ type: "forage", nodeId: target.id });
      return;
    }
    if (target.type === "water") {
      perform({ type: "waterFlock" });
      return;
    }
    if (target.type === "graze") {
      if (
        step >= 10 &&
        (!d.state.grazing.active || grazingNeedsLeader(d.state))
      )
        perform({ type: "startGraze" });
      else
        notify(
          "就在这片嫩草地上陪小羊待一会儿吧。它们吃饱后，记得去溪边喝水。 ",
        );
      return;
    }
    if (target.type === "viewpoint") {
      perform({ type: "stargaze" });
      return;
    }
    if (target.type === "region") {
      if (target.id === "highland" && step === 14) setPanel("map");
      else if (
        step >= (target.id === "meadow" ? 10 : target.id === "forest" ? 13 : 15)
      )
        setPanel("map");
      else
        notify(
          target.id === "meadow"
            ? "先完成第一份邻里委托，花坡的小门就会打开。"
            : target.id === "forest"
              ? "等家里迎来第一只羊羔，我们再一起探索树林。"
              : "找到林里的三簇蘑菇，就能了解高地的修缮计划。",
        );
      return;
    }
    if (target.type === "shop" && step < 9) {
      notify("先照顾好小羊、种出第一批牧草，邻居的小铺就会开张。 ");
      return;
    }
    if (target.type === "board" && step < 9) return;
    if (target.type === "shop") {
      setPanel("shop");
      return;
    }
    if (target.type === "home") {
      if (d.state.grazing.active) {
        perform({
          type: grazingNeedsLeader(d.state) ? "startGraze" : "finishGraze",
        });
        return;
      }
      setPanel("room");
      return;
    }
    if (target.type === "board") {
      setPanel("orders");
      return;
    }
    if (!target.id || (target.type !== "sheep" && target.type !== "plot"))
      return;
    if (step < (toolUnlock[tool] ?? 0)) return;
    setSelected({ type: target.type, id: target.id });
    if (target.type === "sheep") {
      const sheep = d.state.sheep.find((s) => s.id === target.id);
      if (!sheep) return;
      if (tool === "pet" || tool === "feed" || tool === "shear") {
        void doAction({ type: tool, sheepId: sheep.id }).catch(() => {});
        return;
      }
      setPanel("flock");
      return;
    }
    const plot = d.state.plots.find((p) => p.id === target.id);
    if (!plot) return;
    if (tool === "plant") {
      if (plot.cropId) {
        notify("这里已经种上作物了。换一块空田，或切换浇水、收获工具。");
        return;
      }
      void doAction({ type: "plant", plotId: plot.id, cropId: seed }).catch(
        () => {},
      );
      return;
    }
    if (tool === "water" || tool === "harvest") {
      if (!plot.cropId) {
        setTool("plant");
        setSeedMenu(true);
        notify("这是一块空田，先选一包种子播种吧。");
        return;
      }
      void doAction({ type: tool, plotId: plot.id }).catch(() => {});
      return;
    }
    if (!plot.cropId) {
      setTool("plant");
      setSeedMenu(true);
      notify("选一包种子，再点击这块田地。");
    } else if (step === 7) {
      void doAction({ type: "water", plotId: plot.id }).catch(() => {});
    } else if (
      plot.wateredAt > 0 &&
      plot.readyAt > 0 &&
      plot.readyAt <= serverNow
    ) {
      void doAction({ type: "harvest", plotId: plot.id }).catch(() => {});
    } else if (!plot.wateredAt) {
      void doAction({ type: "water", plotId: plot.id }).catch(() => {});
    } else {
      notify(
        `${catalog.crops.find((c) => c.id === plot.cropId)?.name}正在长大，还有 ${Math.max(1, Math.ceil((plot.readyAt - serverNow) / 1000))} 秒。`,
      );
    }
  };
  actionRef.current = worldAction;
  const whistle = () => {
    unlockAudio();
    if (socket.current?.readyState !== WebSocket.OPEN) {
      notify("牧场正在重新连接，稍后再集合小羊吧。", true);
      return;
    }
    socket.current.send(JSON.stringify({ type: "whistle" }));
  };
  const jump = useCallback(() => {
    if (!gameRef.current || panel || chatOpen || document.hidden) return;
    const at = Date.now();
    if (at - (player.current.jumpAt ?? 0) < 650) return;
    player.current.jumpAt = at;
    playSound("jump");
  }, [panel, chatOpen, editingAvatar]);
  useEffect(() => {
    if (!detail) return;
    const onDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        setPanel(null);
        setChatOpen(false);
        setSeedMenu(false);
        return;
      }
      if (
        (e.target as HTMLElement)?.closest(
          'input,textarea,select,[contenteditable="true"]',
        )
      )
        return;
      if (panel || editingAvatar) return;
      if (
        e.code === "Enter" &&
        !e.repeat &&
        !(e.target as HTMLElement)?.closest("button,a")
      ) {
        e.preventDefault();
        setChatOpen(true);
        return;
      }
      if (chatOpen) return;
      if (e.code === "Space" && (e.target as HTMLElement)?.closest("button,a"))
        return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) jump();
        return;
      }
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        keys.current.add(e.code);
        return;
      }
      if (
        [
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(e.code)
      ) {
        e.preventDefault();
        keys.current.add(e.code);
        route.current = [];
        pendingWalkAction.current = null;
        setTarget(null);
      }
      if (!e.repeat && /^Digit[1-6]$/.test(e.code)) {
        const t = tools[Number(e.code.slice(-1)) - 1];
        if ((gameRef.current?.state.progression.step ?? 0) < toolUnlock[t.id])
          return;
        setTool(t.id);
        setSeedMenu(t.id === "plant");
        playSound();
      }
      if (e.code === "KeyE" && !e.repeat && nearestRef.current)
        actionRef.current(nearestRef.current);
      if (
        e.code === "KeyF" &&
        !e.repeat &&
        (gameRef.current?.state.progression.step ?? 0) >= 10
      )
        whistle();
      if (
        e.code === "KeyB" &&
        !e.repeat &&
        (gameRef.current?.state.progression.step ?? 0) >= 9
      )
        setPanel("shop");
      if (
        e.code === "KeyJ" &&
        !e.repeat &&
        (gameRef.current?.state.progression.step ?? 0) >= 12
      )
        setPanel("journal");
      if (
        e.code === "KeyM" &&
        !e.repeat &&
        (gameRef.current?.state.progression.step ?? 0) >= 10
      )
        setPanel("map");
    };
    const onUp = (e: KeyboardEvent) => keys.current.delete(e.code),
      onBlur = () => {
        keys.current.clear();
        joystick.current = { x: 0, z: 0 };
        route.current = [];
        pendingWalkAction.current = null;
        setTarget(null);
      };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
      keys.current.clear();
    };
  }, [detail?.room.id, panel, chatOpen, editingAvatar, jump]);
  useEffect(() => {
    if (panel || chatOpen || editingAvatar) {
      keys.current.clear();
      joystick.current = { x: 0, z: 0 };
      route.current = [];
      pendingWalkAction.current = null;
      setTarget(null);
    }
  }, [panel, chatOpen, editingAvatar]);
  useEffect(() => {
    if (!detail) return;
    let frame = 0,
      previous = performance.now(),
      lastSend = 0,
      lastHud = 0;
    let lastPosition = { ...player.current.position },
      lastFacing = player.current.facing,
      lastJumpAt = player.current.jumpAt ?? 0;
    const loop = (t: number) => {
      const dt = Math.min((t - previous) / 1000, 0.05);
      previous = t;
      const p = player.current;
      let dx = 0,
        dz = 0,
        followingRoute = false;
      if (
        !panel &&
        !chatOpen &&
        !editingAvatar &&
        !document.hidden &&
        movementReady.current
      ) {
        const k = keys.current;
        dx =
          Number(k.has("KeyD") || k.has("ArrowRight")) -
          Number(k.has("KeyA") || k.has("ArrowLeft")) +
          joystick.current.x;
        dz =
          Number(k.has("KeyS") || k.has("ArrowDown")) -
          Number(k.has("KeyW") || k.has("ArrowUp")) +
          joystick.current.z;
        if (dx === 0 && dz === 0 && route.current.length) {
          while (route.current.length) {
            const waypoint = route.current[0];
            dx = waypoint.x - p.position.x;
            dz = waypoint.z - p.position.z;
            if (Math.hypot(dx, dz) >= 0.12) {
              followingRoute = true;
              break;
            }
            route.current.shift();
          }
          if (!route.current.length) {
            setTarget(null);
            dx = dz = 0;
          }
        }
      }
      if (!followingRoute && (dx !== 0 || dz !== 0)) {
        const forward = cameraForward.current;
        const horizontal = dx,
          vertical = dz;
        dx = -forward.z * horizontal - forward.x * vertical;
        dz = forward.x * horizontal - forward.z * vertical;
      }
      const length = Math.hypot(dx, dz);
      p.moving = length > 0.02;
      if (p.moving) {
        const sprinting =
          keys.current.has("ShiftLeft") || keys.current.has("ShiftRight");
        const distance = followingRoute
          ? Math.min(length, dt * (sprinting ? 6 : 4.2))
          : dt * (sprinting ? 6 : 4.2);
        const next = walkablePosition(
          {
            x: p.position.x + (dx / length) * distance,
            z: p.position.z + (dz / length) * distance,
          },
          p.position,
          gameRef.current?.state.progression.step ?? 0,
        );
        p.position.x = next.x;
        p.position.z = next.z;
        p.facing = Math.atan2(dx, dz);
      }
      const jumpStarted = Boolean(
        p.jumpAt && p.jumpAt !== lastJumpAt && Date.now() - p.jumpAt < 650,
      );
      if (
        t - lastSend > 100 &&
        movementReady.current &&
        socket.current?.readyState === WebSocket.OPEN &&
        (Math.hypot(
          p.position.x - lastPosition.x,
          p.position.z - lastPosition.z,
        ) > 0.01 ||
          Math.abs(p.facing - lastFacing) > 0.01 ||
          jumpStarted)
      ) {
        socket.current.send(
          JSON.stringify({
            type: "move",
            position: p.position,
            facing: p.facing,
            jump: jumpStarted,
          }),
        );
        lastPosition = { ...p.position };
        lastFacing = p.facing;
        lastJumpAt = p.jumpAt ?? 0;
        lastSend = t;
      }
      if (t - lastHud > 180) {
        setHudPosition((current) =>
          Math.hypot(current.x - p.position.x, current.z - p.position.z) > 0.02
            ? { ...p.position }
            : current,
        );
        lastHud = t;
        const state = gameRef.current?.state;
        let candidate: InteractionTarget | null = null,
          best = 3.6;
        if (state) {
          for (const sheep of state.sheep) {
            const position = sheepPositions.current[sheep.id] ?? sheep.position;
            const dist = Math.hypot(
              position.x - p.position.x,
              position.z - p.position.z,
            );
            if (dist < best) {
              best = dist;
              candidate = { type: "sheep", id: sheep.id };
            }
          }
          for (const plot of state.plots) {
            const dist = Math.hypot(
              plot.position.x - p.position.x,
              plot.position.z - p.position.z,
            );
            if (dist < best) {
              best = dist;
              candidate = { type: "plot", id: plot.id };
            }
          }
        }
        if (state) {
          const landmarks: {
            target: InteractionTarget;
            position: Vec2;
            enabled: boolean;
          }[] = [
            {
              target: { type: "build", id: "shelter" },
              position: { x: -6, z: 3 },
              enabled: !state.buildings.shelter,
            },
            {
              target: { type: "build", id: "garden" },
              position: { x: 2, z: 1 },
              enabled: state.progression.step === 5,
            },
            {
              target: { type: state.grazing.active ? "home" : "graze" },
              position: regions.home.returnPoint,
              enabled: state.progression.step >= 10,
            },
            {
              target: { type: "water" },
              position: regions.meadow.waterPoint,
              enabled: state.grazing.active,
            },
            {
              target: { type: "viewpoint" },
              position: regions.highland.viewPoint,
              enabled: state.regions.includes("highland"),
            },
            ...state.forageNodes.map((node) => ({
              target: { type: "forage", id: node.id } as InteractionTarget,
              position: node.position,
              enabled: state.regions.includes("forest"),
            })),
          ];
          let landmarkDistance = 2.3;
          for (const item of landmarks)
            if (item.enabled) {
              const distance = Math.hypot(
                item.position.x - p.position.x,
                item.position.z - p.position.z,
              );
              if (distance < landmarkDistance) {
                landmarkDistance = distance;
                candidate = item.target;
              }
            }
        }
        const waiting = pendingWalkAction.current;
        if (
          waiting &&
          Math.hypot(
            waiting.position.x - p.position.x,
            waiting.position.z - p.position.z,
          ) <= 1.45
        ) {
          pendingWalkAction.current = null;
          route.current = [];
          setTarget(null);
          actionRef.current(waiting.target);
        }
        nearestRef.current = candidate;
        setNearest((n) =>
          n?.type === candidate?.type && n?.id === candidate?.id
            ? n
            : candidate,
        );
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [detail?.room.id, panel, chatOpen, editingAvatar]);
  const moveTo = (position: Vec2) => {
    if (panel || chatOpen || editingAvatar) return;
    pendingWalkAction.current = null;
    route.current = getWalkPath(
      player.current.position,
      position,
      gameRef.current?.state.progression.step ?? 0,
    );
    setTarget(route.current.at(-1) ?? null);
    unlockAudio();
  };
  const followObjective = () => {
    const d = gameRef.current;
    if (!d) return;
    const step = d.state.progression.step;
    if (step === 0 || step === 5) {
      worldAction({ type: "build", id: step === 0 ? "shelter" : "garden" });
      return;
    }
    if (step === 1) {
      void doAction({ type: "adopt" }).catch(() => {});
      return;
    }
    if (step >= 2 && step <= 4) {
      setTool(step === 2 ? "pet" : step === 3 ? "feed" : "shear");
      const first = d.state.sheep[0];
      if (first) {
        setSelected({ type: "sheep", id: first.id });
        moveTo(sheepPositions.current[first.id] ?? first.position);
      }
      return;
    }
    if (step >= 6 && step <= 8) {
      setTool(step === 6 ? "plant" : step === 7 ? "water" : "harvest");
      setSeed("clover");
      setSeedMenu(step === 6);
      const plot = d.state.plots.find((p) =>
        step === 6 ? !p.cropId : Boolean(p.cropId),
      );
      if (plot) {
        setSelected({ type: "plot", id: plot.id });
        moveTo(plot.position);
      }
      return;
    }
    if (step === 9) {
      setPanel("orders");
      return;
    }
    if (step === 10) {
      worldAction({ type: "graze" });
      return;
    }
    if (step === 11) {
      if (!d.state.grazing.active || grazingNeedsLeader(d.state)) {
        worldAction({ type: "graze" });
        return;
      }
      if (d.state.grazing.grazeSeconds < 20) moveTo(regions.meadow.grazePoint);
      else worldAction({ type: d.state.grazing.watered ? "home" : "water" });
      return;
    }
    if (step === 12) {
      setPanel("flock");
      return;
    }
    if (step === 13) {
      const node = d.state.forageNodes.find(
        (n) =>
          n.itemId === "mushroom" &&
          n.readyAt <= Date.now() + d.serverTime - d.receivedAt,
      );
      if (node) worldAction({ type: "forage", id: node.id });
      return;
    }
    setPanel("map");
  };
  const chooseTool = (t: Tool) => {
    setTool(t);
    setSeedMenu(t === "plant" ? !seedMenu : false);
    playSound();
  };
  if (checking)
    return (
      <div className="loading-screen">
        <img src="/favicon.svg" alt="" />
        <h2>小羊正在醒来</h2>
        <p>把阳光和好心情装进牧场…</p>
        <LoaderCircle className="spin" />
      </div>
    );
  if (!detail || !user)
    return <Welcome user={user} setUser={setUser} enter={enter} />;
  const state = detail.state,
    step = state.progression.step;
  const serverTimeOffset = detail.serverTime - detail.receivedAt,
    serverNow = Math.max(now, detail.receivedAt) + serverTimeOffset;
  const gameMinutes =
      (state.dayProgress +
        Math.min(5000, Math.max(0, now - detail.receivedAt)) /
          (catalog.config.daySeconds * 1000)) %
      1,
    night = gameMinutes < 0.25 || gameMinutes > 0.8;
  const thresholds = catalog.config.xpThresholds,
    levelBase = thresholds[state.level - 1] ?? thresholds.at(-1)!,
    nextLevel = thresholds[state.level] ?? levelBase + 1000;
  const readyCrops = state.plots.filter(
    (p) =>
      p.cropId && p.wateredAt > 0 && p.readyAt > 0 && p.readyAt <= serverNow,
  ).length;
  const readyWool = state.sheep.filter(
    (s) => s.wool >= 100 && s.adultAt <= serverNow,
  ).length;
  const activeTool = tools.find((t) => t.id === tool)!,
    ActiveIcon = activeTool.icon;
  const selectedSheep =
    selected?.type === "sheep"
      ? state.sheep.find((s) => s.id === selected.id)
      : undefined;
  const nearestSheep =
    nearest?.type === "sheep"
      ? state.sheep.find((s) => s.id === nearest.id)
      : undefined;
  const nearestPlot =
    nearest?.type === "plot"
      ? state.plots.find((p) => p.id === nearest.id)
      : undefined;
  const contextLabel =
    nearest?.type === "build"
      ? "搭建 · 给牧场一个新开始"
      : nearest?.type === "forage"
        ? "采集 · 林间的小礼物"
        : nearest?.type === "water"
          ? "饮水 · 让羊群喝口清泉"
          : nearest?.type === "graze"
            ? "集合 · 开始放牧"
            : nearest?.type === "home" && state.grazing.active
              ? "归圈 · 带羊群回家"
              : nearest?.type === "viewpoint"
                ? "观星 · 等一颗星星落下"
                : nearestSheep
                  ? `${["pet", "feed", "shear"].includes(tool) ? activeTool.label : "看看"} · ${nearestSheep.name}`
                  : nearestPlot
                    ? ["plant", "water", "harvest"].includes(tool)
                      ? `${activeTool.label} · 田地`
                      : !nearestPlot.cropId
                        ? "选择种子 · 空田地"
                        : !nearestPlot.wateredAt
                          ? "浇水 · 小苗渴了"
                          : nearestPlot.readyAt <= serverNow
                            ? "收获 · 作物成熟了"
                            : "查看 · 作物正在生长"
                    : "互动";
  return (
    <div className="game" onPointerDown={unlockAudio}>
      {editingAvatar && (
        <AvatarEditor
          user={user}
          onSave={setUser}
          onClose={() => setEditingAvatar(false)}
        />
      )}
      <Suspense
        fallback={
          <div className="loading-screen">
            <img src="/favicon.svg" alt="" />
            <h2>正在铺好你的春天</h2>
            <LoaderCircle className="spin" />
          </div>
        }
      >
        <World
          sheep={state.sheep}
          plots={state.plots}
          breeds={catalog.breeds as Breed[]}
          crops={catalog.crops}
          player={player.current}
          playerId={user.id}
          avatar={user.avatar}
          cameraForward={cameraForward.current}
          progressionStep={step}
          buildings={state.buildings}
          grazing={state.grazing}
          forageNodes={state.forageNodes}
          remotePlayers={players.filter((p) => p.id !== user.id)}
          dayProgress={gameMinutes}
          season={state.season}
          weather={state.weather}
          selected={selected}
          quality={quality}
          onMove={moveTo}
          onInteract={worldAction}
          target={target}
          actionEffect={effect}
          whistle={flockWhistle}
          serverTimeOffset={serverTimeOffset}
          sheepPositions={sheepPositions.current}
          upgrades={state.upgrades}
        />
      </Suspense>
      <div className="game-vignette" />
      <header className="hud-top">
        <div className="farm-info">
          <button className="farm-brand" onClick={() => setPanel("room")}>
            <img src="/favicon.svg" alt="" />
            <span>
              <strong>{detail.room.name}</strong>
              <small>
                <span
                  className={`connection-dot ${connected ? "online" : ""}`}
                />
                {connected ? "云端牧场 · 自动保存" : "正在重新连接牧场…"}
              </small>
            </span>
            <ChevronDown size={15} />
          </button>
          <div className="clock-line">
            {night ? (
              <Moon size={18} />
            ) : state.weather === "rain" ? (
              <CloudSun size={19} />
            ) : (
              <Sun size={19} />
            )}
            <strong>
              {state.season} · 第 {state.day} 天
            </strong>
            <span className="clock-separator" />
            <span>{formatClock(gameMinutes)}</span>
            <span className="weather-word">
              {state.weather === "rain"
                ? "绵绵细雨"
                : night
                  ? "星光温柔"
                  : "晴，适合发呆"}
            </span>
          </div>
        </div>
        <div className="top-right">
          <div className="money-pill">
            <span>
              <Coins size={22} />
            </span>
            <strong>{state.coins.toLocaleString()}</strong>
            <small>金币</small>
          </div>
          <button className="friends-button" onClick={() => setPanel("room")}>
            <Users size={19} />
            <span>{Math.max(1, players.length)}</span>
            <i />
          </button>
          <button
            className="round-button"
            aria-label="设置"
            onClick={() => setPanel("settings")}
          >
            <Settings size={19} />
          </button>
        </div>
      </header>
      <aside className="left-hud">
        <StoryGuide state={state} onAction={followObjective} />
        <div className="quick-nav">
          {step >= 1 && (
            <button aria-label="我的羊群" onClick={() => setPanel("flock")}>
              <span className="nav-glyph">♧</span>
              <span>
                我的羊群<small>{state.sheep.length} 只软乎乎</small>
              </span>
              {step >= 4 && readyWool > 0 && <b>{readyWool}</b>}
            </button>
          )}
          {step >= 6 && (
            <button aria-label="小小田园" onClick={() => setPanel("garden")}>
              <Sprout size={21} />
              <span>
                小小田园
                <small>
                  {readyCrops ? `${readyCrops} 块可以收获` : "种下一点期待"}
                </small>
              </span>
              {readyCrops > 0 && <b>{readyCrops}</b>}
            </button>
          )}
          {step >= 9 && (
            <button aria-label="邻里的委托" onClick={() => setPanel("orders")}>
              <PackageOpen size={21} />
              <span>
                邻里的委托<small>分享今天的丰收</small>
              </span>
            </button>
          )}
        </div>
      </aside>
      <aside className="right-hud">
        {step >= 12 && (
          <button
            className="journal-button"
            aria-label="小羊图鉴"
            onClick={() => setPanel("journal")}
          >
            <BookOpen size={23} />
            <span>小羊图鉴</span>
            <small>{state.discoveries.length} / 12</small>
          </button>
        )}
        {step >= 9 && (
          <button className="market-button" aria-label="松果杂货铺" onClick={() => setPanel("shop")}>
            <ShoppingBasket size={23} />
            <span>松果杂货铺</span>
          </button>
        )}
        {step >= 10 && (
          <button className="journal-button" aria-label="山谷地图" onClick={() => setPanel("map")}>
            <MapPin size={23} />
            <span>山谷地图</span>
          </button>
        )}
      </aside>
      {selectedSheep && !panel && (
        <div className="sheep-peek">
          <button
            className="peek-close"
            aria-label="关闭小羊信息"
            onClick={() => setSelected(null)}
          >
            <X size={14} />
          </button>
          <span
            className="peek-dot"
            style={{
              background: catalog.breeds.find(
                (b) => b.id === selectedSheep.breedId,
              )?.color,
            }}
          />
          <div>
            <strong>{selectedSheep.name}</strong>
            <small>
              {selectedSheep.trait} ·{" "}
              {selectedSheep.adultAt > serverNow ? "正在长大" : "成年羊"}
            </small>
          </div>
          <button onClick={() => setPanel("flock")}>
            看看它 <ArrowUp size={14} />
          </button>
        </div>
      )}
      <div
        className="toasts"
        aria-live={toast?.error ? "assertive" : "polite"}
        aria-atomic="true"
      >
        {toast && (
          <div key={toast.id} className={`toast ${toast.error ? "error" : ""}`}>
            {toast.error ? <X size={18} /> : <Check size={18} />}
            <span>{toast.text}</span>
          </div>
        )}
      </div>
      <div className="bottom-left">
        {step >= 9 && (
          <button
            className="level-badge"
            onClick={() => setPanel(step >= 12 ? "journal" : "map")}
          >
            <span className="level-icon">
              <Leaf size={21} />
            </span>
            <div>
              <strong>
                Lv. {state.level}{" "}
                <span>
                  {state.level < 3
                    ? "见习牧羊人"
                    : state.level < 5
                      ? "田园好伙伴"
                      : "云朵守护者"}
                </span>
              </strong>
              <div className="xp-track">
                <i
                  style={{
                    width: `${Math.min(100, ((state.xp - levelBase) / (nextLevel - levelBase)) * 100)}%`,
                  }}
                />
              </div>
              <small>
                {state.xp} / {nextLevel} 牧场经验
              </small>
            </div>
          </button>
        )}
        <button
          className="chat-trigger"
          aria-label="牧场聊天"
          onClick={() => setChatOpen(!chatOpen)}
        >
          <MessageCircle size={18} />
          <span>和伙伴说句话</span>
          <kbd>↵</kbd>
        </button>
      </div>
      {chatOpen && (
        <section className="chat-window">
          <div>
            <strong>牧场里的悄悄话</strong>
            <button aria-label="关闭聊天" onClick={() => setChatOpen(false)}>
              <X size={16} />
            </button>
          </div>
          <ol>
            {chat.length ? (
              chat.slice(-15).map((m, i) => (
                <li key={`${m.at}-${i}`}>
                  <b>{m.username}</b>
                  <span>{m.text}</span>
                </li>
              ))
            ) : (
              <li className="chat-empty">
                和来到牧场的朋友打声招呼吧。
                <br />
                同一牧场的伙伴都能看到这里的消息。
              </li>
            )}
          </ol>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (
                chatText.trim() &&
                Date.now() >= chatCooldownUntil &&
                socket.current?.readyState === WebSocket.OPEN
              ) {
                socket.current.send(
                  JSON.stringify({ type: "chat", text: chatText.trim() }),
                );
                setChatText("");
                setChatCooldownUntil(Date.now() + 1050);
              }
            }}
          >
            <input
              aria-label="聊天消息"
              autoFocus
              value={chatText}
              maxLength={180}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="今天的小羊好可爱…"
            />
            <button
              aria-label="发送"
              disabled={
                !connected || !chatText.trim() || now < chatCooldownUntil
              }
            >
              <Send size={17} />
            </button>
          </form>
        </section>
      )}
      <div className="bottom-center">
        {seedMenu && step >= 6 && (
          <div className="seed-picker">
            <span>今天想种点什么？</span>
            <div>
              {catalog.crops
                .filter((c) => step >= cropUnlock[c.id])
                .map((c) => (
                  <button
                    key={c.id}
                    className={seed === c.id ? "selected" : ""}
                    onClick={() => {
                      setSeed(c.id);
                      setTool("plant");
                      playSound();
                    }}
                  >
                    <ItemArt item={c.id} size={34} />
                    <strong>{c.name}</strong>
                    <small>×{state.inventory[c.seedId] || 0}</small>
                  </button>
                ))}
            </div>
          </div>
        )}
        {step >= 2 && (
          <div className="tool-caption">
            <ActiveIcon size={15} />
            <span>
              {tool === "plant"
                ? `${catalog.crops.find((c) => c.id === seed)?.name}种子 · ${activeTool.hint}`
                : activeTool.hint}
            </span>
          </div>
        )}
        {step >= 2 && (
          <nav className="toolbelt" aria-label="农场工具">
            {tools
              .filter((t) => step >= toolUnlock[t.id])
              .map((t, i) => (
                <button
                  key={t.id}
                  className={`tool-slot ${tool === t.id ? "active" : ""}`}
                  aria-label={t.label}
                  aria-pressed={tool === t.id}
                  onClick={() => chooseTool(t.id)}
                >
                  <kbd>{i + 1}</kbd>
                  <t.icon size={26} strokeWidth={1.8} />
                  <span>{t.label}</span>
                  {t.id === "feed" && (
                    <small>
                      {(state.inventory.feed || 0) +
                        (state.inventory.clover || 0) +
                        (state.inventory.carrot || 0)}
                    </small>
                  )}
                  {t.id === "plant" && (
                    <small>
                      {state.inventory[
                        catalog.crops.find((c) => c.id === seed)?.seedId ?? ""
                      ] || 0}
                    </small>
                  )}
                </button>
              ))}
            {step >= 10 && (
              <>
                <span className="belt-divider" />
                <button
                  className="whistle-button"
                  onClick={whistle}
                  aria-label="吹口哨召集羊群"
                >
                  <Wind size={24} />
                  <span>集合</span>
                  <kbd>F</kbd>
                </button>
              </>
            )}
          </nav>
        )}
        <div className="controls-hint">
          <span>
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> 走一走
          </span>
          <span>点击地面 · 慢慢走过去</span>
          <span>
            <kbd>E</kbd> 互动
          </span>
          <span>
            <kbd>Space</kbd> 跳跃 · <kbd>Shift</kbd> 奔跑
          </span>
          <span>右键拖动 · 环顾四周</span>
        </div>
      </div>
      <div className="bottom-right">
        {step >= 10 && (
          <ValleyMiniMap
            position={hudPosition}
            progressionStep={step}
            sheep={state.sheep.map((s) => sheepPositions.current[s.id] ?? s.position)}
          />
        )}
        <div className="map-caption">
          <MapPin size={12} />
          溪边牧场
        </div>
        <div className="minor-buttons">
          <button
            aria-label={sound ? "关闭声音" : "开启声音"}
            onClick={() => {
              setSound(!sound);
              setSoundState(!sound);
              if (!sound) playSound();
            }}
          >
            {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <button aria-label="画面与声音" onClick={() => setPanel("settings")}>
            <Settings size={17} />
          </button>
          <button aria-label="玩法帮助" onClick={() => setPanel("help")}>
            <HelpCircle size={17} />
          </button>
        </div>
      </div>
      <div className="touch-controls">
        <Joystick
          onChange={(v) => {
            joystick.current = v;
            route.current = [];
            pendingWalkAction.current = null;
            setTarget(null);
          }}
        />
        <button
          className="touch-jump"
          aria-label="跳一下"
          disabled={Boolean(panel || chatOpen)}
          onClick={jump}
        >
          <ArrowUp size={23} />
          <small>跳一下</small>
        </button>
        <button
          className="touch-action"
          disabled={!nearest}
          aria-label={nearest ? contextLabel : "附近没有可以互动的东西"}
          onClick={() => nearest && worldAction(nearest)}
        >
          <ActiveIcon size={26} />
          <small>{nearest ? contextLabel.split(" · ")[0] : activeTool.label}</small>
        </button>
      </div>
      {nearest && !panel && (
        <button className="context-prompt" onClick={() => worldAction(nearest)}>
          <kbd>E</kbd>
          <span>{contextLabel}</span>
        </button>
      )}
      <Panels
        panel={panel}
        onClose={() => setPanel(null)}
        state={state}
        serverNow={serverNow}
        room={detail.room}
        user={user}
        players={players}
        onAction={doAction}
        selectedSheepId={selected?.type === "sheep" ? selected.id : undefined}
        onSelectSheep={(id) => setSelected({ type: "sheep", id })}
        onLeave={leave}
        onEditAvatar={() => {
          setPanel(null);
          setEditingAvatar(true);
        }}
        position={hudPosition}
        onTravel={(position) => {
          setPanel(null);
          route.current = getWalkPath(player.current.position, position, step);
          setTarget(route.current.at(-1) ?? null);
          pendingWalkAction.current = null;
        }}
        quality={quality}
        onQuality={(v) => {
          setQuality(v);
          localStorage.setItem("flock-quality", v);
        }}
        music={music}
        onMusic={(v) => {
          setMusic(v);
          setMusicState(v);
        }}
        sound={sound}
        onSound={(v) => {
          setSound(v);
          setSoundState(v);
          if (v) playSound();
        }}
      />
    </div>
  );
}

function Joystick({ onChange }: { onChange: (v: Vec2) => void }) {
  const ref = useRef<HTMLDivElement>(null),
    [knob, setKnob] = useState({ x: 0, y: 0 }),
    pointer = useRef<number | null>(null);
  const move = (e: React.PointerEvent) => {
    if (pointer.current !== e.pointerId) return;
    const rect = ref.current!.getBoundingClientRect();
    let x = e.clientX - rect.left - rect.width / 2,
      y = e.clientY - rect.top - rect.height / 2;
    const len = Math.hypot(x, y);
    if (len > 34) {
      x = (x / len) * 34;
      y = (y / len) * 34;
    }
    setKnob({ x, y });
    onChange({ x: x / 34, z: y / 34 });
  };
  const end = () => {
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    onChange({ x: 0, z: 0 });
  };
  return (
    <div
      ref={ref}
      className="joystick"
      role="application"
      aria-label="移动摇杆"
      onPointerDown={(e) => {
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <span style={{ transform: `translate(${knob.x}px,${knob.y}px)` }}>
        <ArrowUp size={19} />
      </span>
    </div>
  );
}
