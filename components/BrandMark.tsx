import Image from "next/image";

export function BrandMark({
  size = 36,
  wordmark = true,
}: {
  size?: number;
  wordmark?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Image
        src="/brand/indilingo-logo.webp"
        alt=""
        width={1024}
        height={1024}
        priority
        className="shrink-0"
        style={{ width: size, height: size }}
      />
      {wordmark ? (
        <span className="text-[1.05rem] font-semibold tracking-[-0.02em] text-on">
          Indilingo
        </span>
      ) : null}
    </span>
  );
}
