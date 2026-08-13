import Image from "next/image";
import Link from "next/link";

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Digital Macaroni, home">
      <Image
        className="brand-mark"
        src="/brand/macaroni-yellow-header.png"
        alt=""
        width={900}
        height={1200}
        loading="eager"
      />
      <span>Digital Macaroni</span>
    </Link>
  );
}
