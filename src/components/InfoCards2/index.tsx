import { Button, Card, Text } from "@stellar/design-system";
import { NextLink } from "@/components/NextLink";
import { InfoCard2 } from "@/types/types";
import "./styles.scss";

export const InfoCards2 = ({ infoCards }: { infoCards: InfoCard2[] }) => {
  return (
    <div className="InfoCards">
      {infoCards.map((c) => (
        <Card key={c.id}>
          <Text size="md" as="h2" weight="medium">
            {c.title}
          </Text>

          <Text size="sm" as="p">
            {c.description}
          </Text>

          <div>
            <NextLink  href={c.buttonAction} style={{ textDecoration: "none" }}>
              <Button
                variant="secondary"
                size="md"
                icon={c.buttonIcon}
              >
                {c.buttonLabel}
              </Button>
            </NextLink>
          </div>
        </Card>
      ))}
    </div>
  );
};
