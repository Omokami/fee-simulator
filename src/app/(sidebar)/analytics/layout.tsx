"use client";

import React from "react";

import { LayoutSidebarContent } from "@/components/layout/LayoutSidebarContent";

export default function TransactionTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LayoutSidebarContent
      sidebar={[
        {
          navItems: [
            // {
            //   route: Routes.SAVED_TRANSACTIONS,
            //   label: "Saved Transactions",
            //   icon: <Icon.Save03 />,
            // },
          ],
          hasBottomDivider: true,
        },{
        
        navItems: [],
      }]}
    >
      {children}
    </LayoutSidebarContent>
  );
}
