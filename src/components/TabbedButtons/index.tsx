import React from "react";
import { Button } from "@stellar/design-system";

import "./styles.scss";

type TabbedButton = {
  id: string;
  hoverTitle: string;
  icon?: React.ReactNode;
  label?: string;
  isError?: boolean;
  isDisabled?: boolean;
  onClick: () => void;
};

type TabbedButtonsProps = {
  size: "sm" | "md" | "lg";
  buttons: TabbedButton[];
};

export const TabbedButtons: React.FC<TabbedButtonsProps> = ({ size, buttons }) => {
  return (
    <div className="TabbedButtons">
      {buttons.map((b) => (
        <Button
          key={`tabbedButton-${b.id}`}
          variant="tertiary"
          size={size}
          icon={b.icon}
          title={b.hoverTitle}
          onClick={b.onClick}
          disabled={b.isDisabled}
          data-variant={b.isError ? "error" : undefined}
        >
          {b.label}
        </Button>
      ))}
    </div>
  );
};