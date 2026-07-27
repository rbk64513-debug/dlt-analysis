import { pad2 } from "@/lib/stats";

export function Ball({ n, zone, size = "md" }: { n: number; zone: "front" | "back"; size?: "sm" | "md" }) {
  const cls =
    zone === "front"
      ? "bg-red-600 text-white shadow-red-200"
      : "bg-blue-600 text-white shadow-blue-200";
  const sz = size === "sm" ? "w-6 h-6 text-[11px]" : "w-9 h-9 text-sm";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold shadow-md ${cls} ${sz}`}
    >
      {pad2(n)}
    </span>
  );
}

export function DrawBalls({ front, back, size = "md" }: { front: number[]; back: number[]; size?: "sm" | "md" }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {front.map((n, i) => (
        <Ball key={"f" + i} n={n} zone="front" size={size} />
      ))}
      <span className="mx-0.5 text-muted-foreground">|</span>
      {back.map((n, i) => (
        <Ball key={"b" + i} n={n} zone="back" size={size} />
      ))}
    </div>
  );
}
