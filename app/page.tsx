import Link from "next/link";

export default function Home() {
  const links = [
    {
      href: "/screen",
      title: "Màn hình LED",
      description: "Đại bàng phân mảnh + QR Code, cập nhật realtime.",
    },
    {
      href: "/capture",
      title: "Trang chụp ảnh (mobile)",
      description: "Quét QR để mở, chụp và gửi ảnh ghép.",
    },
    {
      href: "/admin",
      title: "Admin",
      description: "Theo dõi tiến độ, reset và test-fill puzzle.",
    },
  ];

  return (
    <main className="screen-root flex items-center justify-center p-6">
      <div className="screen-grid" />
      <div className="relative z-10 w-full max-w-3xl">
        <p className="text-[0.65rem] tracking-[0.4em] text-[var(--gold)] uppercase">
          Eagle Wings
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">
          Ghép ảnh đại bàng
        </h1>
        <p className="mt-3 max-w-xl text-sm text-[var(--muted)]">
          Trò chơi tương tác trên màn hình LED: khán giả quét QR, chụp ảnh và
          từng mảnh đại bàng được lấp đầy theo thời gian thực.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="admin-card group rounded-2xl p-5 transition-colors hover:border-[var(--gold)]/60"
            >
              <h2 className="text-lg font-bold text-[var(--gold-2)]">
                {link.title}
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {link.description}
              </p>
              <span className="mt-4 inline-block text-sm text-[var(--gold)] opacity-0 transition-opacity group-hover:opacity-100">
                Mở →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
