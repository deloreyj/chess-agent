type RouteNavProps = {
  active?: "landing" | "vanilla" | "think" | "lab";
};

const links = [
  { href: "/", label: "Overview", route: "landing" },
  { href: "/vanilla", label: "Vanilla", route: "vanilla" },
  { href: "/think", label: "Think", route: "think" },
  { href: "/lab", label: "Lab", route: "lab" },
] as const;

export function RouteNav({ active }: RouteNavProps) {
  return (
    <nav className="route-nav" aria-label="Demo stages">
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          data-active={active === link.route ? "true" : "false"}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}
