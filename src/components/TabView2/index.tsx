import React from "react";
import { Text } from "@stellar/design-system";

import { WithInfoText } from "@/components/WithInfoText";
import { Box } from "@/components/layout/Box";

import "./styles.scss";

type Tab = {
  id: string;
  label: string;
  content: React.ReactNode;
};

type TabViewProps = {
  heading: TabViewHeadingProps;
  tab: Tab;
};

export const TabView = ({ heading, tab }: TabViewProps) => {
  return (
    <Box gap="md" addlClassName="TabView">
      <div className="TabView__heading">
        <TabViewHeading {...heading} />

        <div className="TabView__tabContainer">
          <Text size="md" as="h1" weight="medium">
            {tab.label}
          </Text>
        </div>
      </div>

      <Box gap="md">
        <div className="TabView__content">
          <div>{tab.content}</div>
        </div>
      </Box>
    </Box>
  );
};

type TabViewHeadingProps = (
  | {
      infoText: React.ReactNode | string;
      href?: undefined;
    }
  | {
      infoText?: undefined;
      href: string;
    }
  | { infoText?: undefined; href?: undefined }
) & {
  title: string;
  infoHoverText?: string;
};

const TabViewHeading = ({
  title,
  infoHoverText,
  infoText,
  href,
}: TabViewHeadingProps) => {
  const renderTitle = () => (
    <Text size="md" as="h1" weight="medium">
      {title}
    </Text>
  );

  if (href || infoText) {
    if (href) {
      return (
        <WithInfoText href={href} infoHoverText={infoHoverText}>
          {renderTitle()}
        </WithInfoText>
      );
    }

    return (
      <WithInfoText infoText={infoText} infoHoverText={infoHoverText}>
        {renderTitle()}
      </WithInfoText>
    );
  }

  return renderTitle();
};