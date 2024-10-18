import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@stellar/design-system";

import { Routes } from "@/constants/routes";
import { NextLink } from "@/components/NextLink";

type NavLink = {
  href: Routes | string;
  label: string;
  icon?: ReactNode;
};

const primaryNavLinks: NavLink[] = [
  {
    href: Routes.EST_FEES,
    label: "Estimation",
  },
  {
    href: Routes.SIM_FEES,
    label: "Simulation",
  },
  // {
  //   href: Routes.ANALYTICS_FEES,
  //   label: "Analytics",
  // }
];

export const MainNav = () => {
  const pathname = usePathname();

  const isActiveRoute = (link: string) => {
    if (link.startsWith("http")) {
      return false;
    }

    return pathname.split("/")[1] === link.split("/")[1];
  };

  const NavItem = ({ link }: { link: NavLink }) => (
    <NextLink
      href={link.href}
      className={`NavLink ${isActiveRoute(link.href) ? "NavLink--active" : ""}`}
    >
      {link.label}

      {link.icon ? <span className="NavLink__icon">{link.icon}</span> : null}
    </NextLink>
  );

  return (
    <nav className="LabLayout__header__nav">
      <div className="LabLayout__header__nav--primary">
        {primaryNavLinks.map((l) => (
          <NavItem key={l.href} link={l} />
        ))}
      </div>
    </nav>
  );
};
