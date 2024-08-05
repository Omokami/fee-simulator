import { useEffect, useState } from "react";
import { Icon, Input } from "@stellar/design-system";
import { ALL_XDR_TYPES } from "@/constants/xdr";
import { useStore } from "@/store/useStore";
import "./styles.scss";

export interface XdrTypeSelectProps {
  error?: string | React.ReactNode;
}

export const XdrTypeSelect = ({ error }: XdrTypeSelectProps) => {
  const { xdr } = useStore();

  const [searchValue, setSearchValue] = useState("");
  const [isOptionsVisible, setIsOptionsVisible] = useState(false);
  const [displayOptions, setDisplayOptions] = useState<string[]>([]);

  useEffect(() => {
    if (searchValue) {
      const res = ALL_XDR_TYPES.filter((t) =>
        t.toLowerCase().includes(searchValue.toLowerCase()),
      );
      setDisplayOptions(res);
    } else {
      setDisplayOptions([]);
    }
  }, [searchValue]);

  useEffect(() => {
    xdr.updateXdrType("TransactionEnvelope");
  }, []);

  const OptionItem = ({
    option,
    sectionTitle,
  }: {
    option?: string;
    sectionTitle?: string;
  }) => {
    if (sectionTitle) {
      return (
        <div className="XdrTypeSelect__item XdrTypeSelect__item--section">
          {sectionTitle}
        </div>
      );
    }

    if (option) {
      return (
        <div
          className="XdrTypeSelect__item"
          key={option}
          onClick={() => {
            xdr.updateXdrType(option);
            setIsOptionsVisible(false);
          }}
          data-is-current={xdr.type === option}
        >
          {option}
        </div>
      );
    }

    return null;
  };

  const renderOptions = () => {
    // Default
    if (!searchValue) {
      return (
        <>
          <OptionItem sectionTitle="Popular" />

          {["TransactionEnvelope", "TransactionResult", "TransactionMeta"].map(
            (p) => (
              <OptionItem key={`popular-${p}`} option={p} />
            ),
          )}

          <OptionItem sectionTitle="All" />

          {ALL_XDR_TYPES.map((o) => (
            <OptionItem key={`all-${o}`} option={o} />
          ))}
        </>
      );
    }

    // No search results
    if (searchValue && displayOptions.length === 0) {
      return <OptionItem sectionTitle="No matching XDR type found" />;
    }

    // Search results
    return displayOptions.map((o) => (
      <OptionItem key={`search-${o}`} option={o} />
    ));
  };

  return (
    <>
      <div className="XdrTypeSelect">
      <Input
        id="xdr-type-select"
        fieldSize="md"
        label="XDR type"
        error={error}
        spellCheck="false"
        value="TransactionEnvelope"
        readOnly
      />
    </div>
    </>
  );
};
