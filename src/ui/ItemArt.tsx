import type { CSSProperties } from "react";

const cells: Record<string, number> = {
  clover: 0,
  carrot: 1,
  daisy: 2,
  wheat: 3,
  lavender: 4,
  pumpkin: 5,
  moonflower: 6,
  mushroom: 7,
  wool: 8,
  feed: 9,
  seed: 10,
  letter: 11,
  timber: 12,
  stone: 13,
  bell: 14,
  shelter: 15,
  herb: 0,
};

export function ItemArt({
  item,
  size = 48,
  className = "",
}: {
  item: string;
  size?: number;
  className?: string;
}) {
  const cell =
    cells[
      item.startsWith("wool_")
        ? "wool"
        : item.startsWith("seed_")
          ? "seed"
          : item
    ] ?? 10;
  return (
    <span
      aria-hidden="true"
      className={`item-art ${className}`}
      style={
        {
          width: size,
          height: size,
          backgroundPosition: `${((cell % 4) * 100) / 3}% ${(Math.floor(cell / 4) * 100) / 3}%`,
        } as CSSProperties
      }
    />
  );
}

export function NeighborPortrait({
  person = 0,
  size = 72,
}: {
  person?: number;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="neighbor-portrait"
      style={{
        width: size,
        height: size,
        backgroundPosition: `${(person % 2) * 100}% ${Math.floor(person / 2) * 100}%`,
      }}
    />
  );
}
