"use client";

import { Card, Text, Icon } from "@stellar/design-system";
import { LayoutContentContainer } from "@/components/layout/LayoutContentContainer";
import  {InfoCards2} from "@/components/InfoCards2";
import { Routes } from "@/constants/routes";

export default function Introduction() {
  const infoCards = [
    {
      id: "fee-estimation",
      title: "Fee Estimation",
      description:
        "Estimate fees, by playing around with all the resource parameters that directly affect a transaction's overall fee",
      buttonLabel: "Try It",
      buttonIcon: <Icon.ArrowBlockRight />,
      buttonAction: Routes.EST_FEES,
    },
    {
      id: "fee-simulation",
      title: "Fee Simulation",
      description:
        "Simulate transactions to check how much resources they consume, which can help you optimize your contract code for fees",
      buttonLabel: "Try It",
      buttonIcon: <Icon.ArrowBlockRight />,
      buttonAction:Routes.SIM_FEES, 
    },
    // {
    //   id: "fee-history",
    //   title: "Analytics",
    //   description:
    //     "Track historical fee data and trends to make informed decisions.",
    //   buttonLabel: "Explore",
    //   buttonIcon: <Icon.ArrowBlockRight />,
    //   buttonAction: Routes.ANALYTICS_FEES,
    // },
  ];

  return (
    <LayoutContentContainer>
      <Card>
        <div className="CardText">
          <Text size="lg" as="h1" weight="medium">
            StellarFee
          </Text>

          <Text size="sm" as="p">
            The StellarFee Tool is designed to help users understand and optimize transaction fees on the Stellar network. This tool includes features like:
          </Text>

          <ul>
            <li>Fee estimation based on current network conditions</li>
            <li>Fee simulation to find the optimal transaction costs and fees</li>
            {/* <li>Historical fee data tracking and trend analysis</li> */}
          </ul>
        </div>
      </Card>

      <InfoCards2 infoCards={infoCards} />

      
    </LayoutContentContainer>
  );
}
