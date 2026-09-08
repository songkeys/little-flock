import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Shuffle, X } from "lucide-react";
import type { AvatarAppearance, User } from "../game/types";
import {
  avatarSkins,
  avatarHair,
  avatarOutfits,
  avatarHats,
  defaultAvatar,
} from "../game/appearance";
import { api } from "../game/api";
import "./profile.css";
const AvatarPreview = lazy(() => import("../world/AvatarPreview"));

export default function AvatarEditor({
  user,
  onSave,
  onClose,
}: {
  user: User;
  onSave: (user: User) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [avatar, setAvatar] = useState<AvatarAppearance>(
    user.avatar ?? defaultAvatar,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const groups = [
    { key: "skin" as const, title: "肤色", options: avatarSkins },
    { key: "hair" as const, title: "发型", options: avatarHair },
    { key: "outfit" as const, title: "衣服", options: avatarOutfits },
    { key: "hat" as const, title: "帽子", options: avatarHats },
  ];
  return (
    <dialog
      ref={dialog}
      className="avatar-dialog"
      aria-labelledby="avatar-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <button
        className="avatar-close icon-button"
        aria-label="关闭换装"
        disabled={busy}
        onClick={onClose}
      >
        <X size={22} />
      </button>
      <div className="avatar-heading">
        <span>你好，牧羊人</span>
        <h2 id="avatar-title">今天，做喜欢的自己。</h2>
        <p>选一个属于你的模样，和小羊一起出门吧。</p>
      </div>
      <div className="avatar-layout">
        <div className="avatar-preview-wrap">
          <div className="avatar-canvas">
            <Suspense
              fallback={
                <div className="avatar-loading">
                  <LoaderCircle className="spin" /> 正在照镜子…
                </div>
              }
            >
              <AvatarPreview avatar={avatar} />
            </Suspense>
          </div>
          <span className="avatar-name">{user.username}</span>
          <button
            className="avatar-random"
            disabled={busy}
            onClick={() =>
              setAvatar({
                skin: Math.floor(Math.random() * avatarSkins.length),
                hair: Math.floor(Math.random() * avatarHair.length),
                outfit: Math.floor(Math.random() * avatarOutfits.length),
                hat: Math.floor(Math.random() * avatarHats.length),
              })
            }
          >
            <Shuffle size={16} /> 给我一个惊喜
          </button>
        </div>
        <div className="avatar-choices">
          {groups.map((group) => (
            <fieldset key={group.key} disabled={busy}>
              <legend>
                {group.title}
                <span>{group.options[avatar[group.key]]?.name}</span>
              </legend>
              <div
                className={`avatar-options avatar-options-${group.key}`}
                role="radiogroup"
                aria-label={group.title}
              >
                {group.options.map((option, index) => (
                  <button
                    key={option.name}
                    type="button"
                    role="radio"
                    aria-label={option.name}
                    aria-checked={avatar[group.key] === index}
                    className={avatar[group.key] === index ? "is-selected" : ""}
                    style={{ "--swatch": option.color } as React.CSSProperties}
                    onClick={() => setAvatar({ ...avatar, [group.key]: index })}
                  >
                    <i />
                    {group.key === "skin" || group.key === "outfit" ? (
                      <span className="sr-only">{option.name}</span>
                    ) : (
                      <span>{option.name}</span>
                    )}
                    {avatar[group.key] === index && <Check size={14} />}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </div>
      <footer className="avatar-footer">
        <p role={error ? "alert" : undefined}>
          {error || "随时可以在设置里换个新模样。"}
        </p>
        <button
          className="primary-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const result = await api.updateProfile(avatar);
              onSave(result.user);
              onClose();
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "暂时没能保存，请再试一次。",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <Check size={18} />
          )}{" "}
          就这样，出门吧
        </button>
      </footer>
    </dialog>
  );
}
