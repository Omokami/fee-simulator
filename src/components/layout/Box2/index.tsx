import React from "react";
import "./styles.scss";

type Box2Props = {
  gap?: "xs" | "sm" | "md" | "lg" | "xl" | "xxl" | "custom";
  customValue?: string;
  children: React.ReactElement | React.ReactElement[] | null;
  addlClassName?: string;
  direction?: "column" | "row" | "column-reverse" | "row-reverse";
  justify?: "center" | "space-between" | "space-around" | "end" | "left" | "right" | "baseline";
  align?: "center" | "end" | "start" | "baseline" | "stretch";
};

export const Box2: React.FC<Box2Props> = ({
  gap,
  children,
  customValue,
  addlClassName,
  direction = "column",
  justify = "baseline",
  align = "stretch",
  ...props
}) => {
  const customStyle = {
    "--Box-direction": direction,
    "--Box-justify": justify,
    "--Box-align": align,
  } as React.CSSProperties;

  // if (gap === "custom" && customValue) {
  //   customStyle["--Box-gap"] = customValue;
  // }

  const className = `Box ${gap ? `Box--${gap}` : ""} ${addlClassName || ""}`.trim();

  return (
    <div className={className} style={customStyle} {...props}>
      {children}
    </div>
  );
};