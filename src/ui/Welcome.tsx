import { useEffect, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  Cloud,
  Flower2,
  Leaf,
  LoaderCircle,
  LogOut,
  Plus,
  Sprout,
  Shirt,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { api } from "../game/api";
import { playSound } from "../game/audio";
import type { Room, RoomDetail, User } from "../game/types";
import AvatarEditor from "./AvatarEditor";
import "./profile.css";

export default function Welcome({
  user,
  setUser,
  enter,
}: {
  user: User | null;
  setUser: (u: User | null) => void;
  enter: (r: RoomDetail) => void;
}) {
  const [screen, setScreen] = useState<
    "title" | "login" | "register" | "rooms"
  >(user ? "rooms" : "title");
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState("云朵牧场"),
    [code, setCode] = useState("");
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [deletingRoom, setDeletingRoom] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]),
    [roomsLoading, setRoomsLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [join, setJoin] = useState(false);
  useEffect(() => {
    let active = true;
    setRooms([]);
    if (user) {
      setScreen("rooms");
      setRoomsLoading(true);
      setError("");
      api
        .rooms()
        .then((r) => {
          if (active) setRooms(r.rooms);
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setRoomsLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [user?.id]);
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    playSound();
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接牧场失败");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="welcome">
      {editingAvatar && user && (
        <AvatarEditor
          user={user}
          onSave={setUser}
          onClose={() => setEditingAvatar(false)}
        />
      )}
      <img
        className="welcome-art"
        src="/art/pasture-concept.webp"
        alt="春日的溪边牧场，柔软的小羊和盛开的花田"
      />
      <div className="welcome-shade" />
      <div className="welcome-brand">
        <img src="/favicon.svg" alt="" /> Little Flock{" "}
        <span>一小片自己的春天</span>
      </div>
      {screen === "title" ? (
        <div className="title-content">
          <div className="title-flower">
            <Flower2 size={24} />
            <span>把日子过得，像云朵一样软。</span>
          </div>
          <h1>
            小羊<span>慢慢</span>
            <i>
              <Leaf size={40} />
            </i>
          </h1>
          <p>
            种下一点期待，照顾一群小可爱。
            <br />
            和朋友一起，把平凡的日子养成喜欢的模样。
          </p>
          <button
            className="start-button"
            onClick={() => {
              playSound();
              setScreen(user ? "rooms" : "register");
            }}
          >
            {user ? "回到我的牧场" : "开启牧场生活"} <ArrowRight size={22} />
          </button>
          <button
            className="welcome-login"
            onClick={() => setScreen(user ? "rooms" : "login")}
          >
            {user ? `以 ${user.username} 的身份回家` : "已经有牧场了？回家看看"}{" "}
            <span>↗</span>
          </button>
          <div className="title-pills">
            <span>
              <Cloud size={16} />
              12 种软乎乎的小羊
            </span>
            <span>
              <Sprout size={16} />
              四时耕种
            </span>
            <span>
              <Users size={16} />
              好友同住
            </span>
          </div>
        </div>
      ) : (
        <section
          className="entry-card"
          aria-label={screen === "rooms" ? "选择牧场" : "登录牧场"}
          aria-busy={busy || roomsLoading}
        >
          <button
            className="entry-back icon-button"
            aria-label="返回"
            disabled={busy}
            onClick={() => {
              setScreen("title");
              setError("");
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <div className="entry-emblem">
            <img src="/favicon.svg" alt="" />
          </div>
          <h2>
            {screen === "rooms"
              ? `你好，${user?.username}`
              : screen === "register"
                ? "你的牧场故事，从这里开始"
                : "欢迎回家，牧羊人"}
          </h2>
          <p>
            {screen === "rooms"
              ? "有小羊在等你，也有朋友在等你。"
              : "为自己留一小片春天。进度会自动保存。"}
          </p>
          {screen === "rooms" ? (
            <>
              {roomsLoading && (
                <div className="entry-note" role="status">
                  <LoaderCircle className="spin" size={15} />
                  正在看看你的小世界…
                </div>
              )}
              {rooms.length > 0 && (
                <div className="room-list">
                  {rooms.map((room) => (
                    <div className="room-list-item" key={room.id}>
                      <button
                        className="room-enter"
                        disabled={busy}
                        onClick={() =>
                          run(async () => enter(await api.room(room.id)))
                        }
                      >
                        <span className="room-icon">
                          <Sprout />
                        </span>
                        <span>
                          <strong>{room.name}</strong>
                          <small>
                            {room.memberCount} 位牧羊人 · {room.onlineCount}{" "}
                            人在线
                          </small>
                        </span>
                        <ArrowRight size={18} />
                      </button>
                      {room.ownerId === user?.id && (
                        <button
                          className="room-delete"
                          aria-label={`删除牧场 ${room.name}`}
                          disabled={busy}
                          onClick={() =>
                            setDeletingRoom(
                              deletingRoom === room.id ? null : room.id,
                            )
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      {deletingRoom === room.id && (
                        <div className="room-delete-confirm">
                          <p>
                            确定删除「{room.name}
                            」吗？这里的小羊、田地和所有伙伴的共同进度都会永久删除。
                          </p>
                          <div>
                            <button
                              disabled={busy}
                              onClick={() => setDeletingRoom(null)}
                            >
                              留着它
                            </button>
                            <button
                              className="confirm-delete"
                              disabled={busy}
                              onClick={() =>
                                run(async () => {
                                  const result = await api.deleteRoom(room.id);
                                  setRooms(result.rooms);
                                  setDeletingRoom(null);
                                  if (
                                    localStorage.getItem("flock-room") ===
                                    room.id
                                  )
                                    localStorage.removeItem("flock-room");
                                })
                              }
                            >
                              确定删除牧场
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="entry-tabs">
                <button
                  className={!join ? "active" : ""}
                  disabled={busy}
                  aria-pressed={!join}
                  onClick={() => {
                    setJoin(false);
                    setError("");
                  }}
                >
                  <Plus size={16} />
                  新建牧场
                </button>
                <button
                  className={join ? "active" : ""}
                  disabled={busy}
                  aria-pressed={join}
                  onClick={() => {
                    setJoin(true);
                    setError("");
                  }}
                >
                  <Users size={16} />
                  加入好友
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () =>
                    enter(
                      join
                        ? await api.join(code.trim().toUpperCase())
                        : await api.create(name.trim()),
                    ),
                  );
                }}
              >
                <label>
                  {join ? "朋友的邀请码" : "给牧场起个名字"}
                  <input
                    value={join ? code : name}
                    onChange={(e) =>
                      join
                        ? setCode(e.target.value.trim().toUpperCase())
                        : setName(e.target.value)
                    }
                    placeholder={join ? "输入 6 位邀请码" : "例如：云朵牧场"}
                    required
                    disabled={busy}
                    minLength={join ? 6 : 1}
                    maxLength={join ? 6 : 32}
                    autoComplete="off"
                    spellCheck={false}
                    aria-describedby={error ? "entry-error" : undefined}
                  />
                </label>
                <button className="primary-button" disabled={busy}>
                  {busy ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : join ? (
                    <Users size={18} />
                  ) : (
                    <Sprout size={18} />
                  )}{" "}
                  {join ? "一起去放羊" : "种下我的小世界"}
                </button>
              </form>
              <button
                className="profile-link"
                disabled={busy}
                onClick={() => setEditingAvatar(true)}
              >
                <Shirt size={16} /> 我的牧羊人形象
              </button>
              <button
                className="text-button logout-link"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api.logout();
                    localStorage.removeItem("flock-room");
                    setUser(null);
                    setRooms([]);
                    setPassword("");
                    setScreen("login");
                  })
                }
              >
                <LogOut size={14} />
                退出账号
              </button>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const r = await api.auth(
                    screen === "login" ? "login" : "register",
                    username.trim(),
                    password,
                  );
                  setUser(r.user);
                  if (screen === "register") setEditingAvatar(true);
                });
              }}
            >
              <label>
                牧羊人的名字
                <input
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="中文、字母、数字都可以"
                  required
                  disabled={busy}
                  minLength={2}
                  maxLength={24}
                  spellCheck={false}
                  aria-describedby={error ? "entry-error" : undefined}
                />
              </label>
              <label>
                密码
                <input
                  type="password"
                  autoComplete={
                    screen === "login" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 位，长一点更安心"
                  required
                  disabled={busy}
                  maxLength={72}
                  aria-describedby={error ? "entry-error" : undefined}
                />
              </label>
              <button className="primary-button" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <ArrowRight size={18} />
                )}{" "}
                {screen === "login" ? "回到我的牧场" : "创建牧羊人"}
              </button>
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setScreen(screen === "login" ? "register" : "login");
                  setError("");
                }}
              >
                {screen === "login"
                  ? "第一次来？创建一个牧羊人"
                  : "已经有账号？登录回家"}
              </button>
            </form>
          )}
          {error && (
            <div className="entry-error" id="entry-error" role="alert">
              <X size={16} />
              {error}
            </div>
          )}
          <div className="entry-note">
            <Leaf size={13} />
            不用赶路，慢慢来就很好。
          </div>
        </section>
      )}
      <div className="welcome-footer">
        <span>一款关于照顾、相遇和慢生活的游戏</span>
        <span>
          戴上耳机，听见春天 <span aria-hidden="true">♫</span>
        </span>
      </div>
    </main>
  );
}
