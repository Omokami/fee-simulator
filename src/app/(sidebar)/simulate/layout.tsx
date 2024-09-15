"use client";

import React from "react";

import { LayoutSidebarContent } from "@/components/layout/LayoutSidebarContent";
import { Routes } from "@/constants/routes";

export default function XdrTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LayoutSidebarContent
      sidebar={[
        {
          navItems: [
          ],
          hasBottomDivider: true,
        },
        {
        navItems: [
          {
            route: Routes.SIM_FEES,
            label: "Fee Simulation using XDR",
          },
         
        ],
      }]}
    >
      {children}
    </LayoutSidebarContent>
  );
}
