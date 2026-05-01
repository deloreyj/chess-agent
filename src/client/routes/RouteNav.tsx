type RouteNavProps = {
  active?: "landing" | "agent" | "harness" | "system";
};

const links = [
  { href: "/", label: "Overview", route: "landing" },
  { href: "/agent", label: "Agent", route: "agent" },
  { href: "/harness", label: "Harness", route: "harness" },
  { href: "/system", label: "System", route: "system" },
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
