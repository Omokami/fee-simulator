/// @ts-nocheck
import React, { useState, useEffect, useCallback } from "react";
import {
  Badge,
  Button,
  Card,
  Icon,
  Input,
  Checkbox,
} from "@stellar/design-system";
import { Box } from "@/components/layout/Box";
import { TabbedButtons } from "@/components/TabbedButtons";

interface LedgerEntryRentChange {
  isPersistent: boolean;
  oldSizeBytes: number;
  newSizeBytes: number;
  oldLiveUntilLedger: number;
  newLiveUntilLedger: number;
}

const TTL_ENTRY_SIZE = 48;

function rentFeeForSizeAndLedgers(isPersistent: boolean, entrySize: number, rentLedgers: number): bigint {
  const num = BigInt(entrySize) * BigInt(9836) * BigInt(rentLedgers);
  const storageCoef = isPersistent ? BigInt(2103) : BigInt(4206);
  const DIVISOR_TEMP = BigInt(1024) * storageCoef;
  const DIVISOR = DIVISOR_TEMP > BigInt(1) ? DIVISOR_TEMP : BigInt(1);
  return num / DIVISOR;
}

function exclusiveLedgerDiff(lo: number, hi: number): number | null {
  const diff = hi - lo;
  return diff > 0 ? diff : null;
}

function inclusiveLedgerDiff(lo: number, hi: number): number | null {
  const diff = exclusiveLedgerDiff(lo, hi);
  return diff !== null ? diff + 1 : null;
}

function rentFeePerEntryChange(entryChange: LedgerEntryRentChange, currentLedger: number): bigint {
  let fee = BigInt(0);

  // Calculate extension ledgers
  const extensionLedgers = (() => {
    if (entryChange.oldSizeBytes === 0 && entryChange.oldLiveUntilLedger === 0) {
      // New entry
      return entryChange.newLiveUntilLedger - currentLedger;
    
    } else {
      // Existing entry 

      if (entryChange.oldLiveUntilLedger === 0) {
         return entryChange.newLiveUntilLedger - currentLedger;
      } else {
        return entryChange.newLiveUntilLedger - entryChange.oldLiveUntilLedger;
      }
      
      // return Math.max(0, entryChange.newLiveUntilLedger - entryChange.oldLiveUntilLedger);
    }
  })();

  if (extensionLedgers > 0) {
    fee += rentFeeForSizeAndLedgers(
      entryChange.isPersistent,
      entryChange.newSizeBytes,
      extensionLedgers
    );
  }

  // Calculate prepaid ledgers and size increase
  const prepaidLedgers = entryChange.oldSizeBytes === 0 && entryChange.oldLiveUntilLedger === 0
    ? 0
    : Math.max(0, entryChange.oldLiveUntilLedger - currentLedger);

  const sizeIncrease = Math.max(0, entryChange.newSizeBytes - entryChange.oldSizeBytes);

  console.log("Prepaid Ledger===", prepaidLedgers)
  console.log("Increase in size(in bytes)", sizeIncrease)

  if (prepaidLedgers > 0 && sizeIncrease > 0) {
    fee += rentFeeForSizeAndLedgers(
      entryChange.isPersistent,
      sizeIncrease,
      prepaidLedgers
    );
  }

  return fee;
}

export function computeRentFee(changedEntries: LedgerEntryRentChange[], currentLedgerSeq: number): bigint {
  let fee = BigInt(0);
  let extendedEntries = BigInt(0);
  let extendedEntryKeySizeBytes = 0;

  for (const e of changedEntries) {
    fee += rentFeePerEntryChange(e, currentLedgerSeq);
    if (e.oldLiveUntilLedger < e.newLiveUntilLedger) {
      extendedEntries += BigInt(1);
      extendedEntryKeySizeBytes += TTL_ENTRY_SIZE;
    }
  }

  console.log("Extended Entres==", extendedEntries)
  fee += BigInt(10000) * extendedEntries;
  fee += (BigInt(extendedEntryKeySizeBytes) * BigInt(9836) + BigInt(1024)) / BigInt(1024);
  return fee;
}


interface RentCalculatorState {
  rentChanges: LedgerEntryRentChange[];
  currentLedgerSeq: number;
}


interface RentFeeCalculatorProps {
  onRentFeeUpdate: (fee: bigint, state: RentCalculatorState) => void;
  initialState: RentCalculatorState | null;
}

export const RentFeeCalculator: React.FC<RentFeeCalculatorProps> = ({ onRentFeeUpdate, initialState  }) => {
  const [rentChanges, setRentChanges] = useState<LedgerEntryRentChange[]>(
    initialState?.rentChanges || [
      {
        isPersistent: true,
        oldSizeBytes: 0,
        newSizeBytes: 0,
        oldLiveUntilLedger: 0,
        newLiveUntilLedger: 0,
      }
    ]
  );
  const [currentLedgerSeq, setCurrentLedgerSeq] = useState<number>(initialState?.currentLedgerSeq || 400);
  const [totalRentFee, setTotalRentFee] = useState<bigint>(BigInt(0));

  useEffect(() => {
    const newTotalRentFee = computeRentFee(rentChanges, currentLedgerSeq);
    setTotalRentFee(newTotalRentFee);
    onRentFeeUpdate(newTotalRentFee, { rentChanges, currentLedgerSeq });
  }, [rentChanges, currentLedgerSeq, onRentFeeUpdate]);

  const updateRentChange = useCallback((index: number, field: keyof LedgerEntryRentChange, value: any) => {
    setRentChanges(prevChanges => 
      prevChanges.map((change, i) => 
        i === index ? { ...change, [field]: value } : change
      )
    );
  }, []);

  const addRentChange = useCallback(() => {
    setRentChanges(prevChanges => [
      ...prevChanges,
      {
        isPersistent: true,
        oldSizeBytes: 0,
        newSizeBytes: 0,
        oldLiveUntilLedger: 0,
        newLiveUntilLedger: 0,
      }
    ]);
  }, []);

  const removeRentChange = useCallback((index: number) => {
    setRentChanges(prevChanges => {
      if (prevChanges.length > 1) {
        return prevChanges.filter((_, i) => i !== index);
      }
      return prevChanges;
    });
  }, []);


  const RentChangeTabbedButtons: React.FC<{ index: number }> = ({ index }) => {
    return (
      <TabbedButtons
        size="md"
        buttons={[
          {
            id: "delete",
            hoverTitle: "Delete",
            icon: <Icon.Trash01 />,
            isError: true,
            isDisabled: false,
            onClick: () => removeRentChange(index),
          },
        ]}
      />
    );
  };

  return (
    <div className="rent-fee-calculator">
      <Box gap="md">
        <Input
          id="currentLedgerSeq"
          fieldSize="md"
          label="Current Ledger Sequence"
          type="number"
          value={currentLedgerSeq.toString()}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentLedgerSeq(parseInt(e.target.value))}
        />
        <Card>
          <Box gap="lg">
            {rentChanges.map((rentChange, idx) => (
              <Box key={`rent-change-${idx}`} gap="lg" addlClassName="PageBody__content">
                <Box gap="lg" direction="row" align="center" justify="space-between">
                  <Badge size="md" variant="secondary">{`Ledger Entry ${idx + 1}`}</Badge>
                  <TabbedButtons
                    size="md"
                    buttons={[
                      {
                        id: "delete",
                        hoverTitle: "Delete",
                        icon: <Icon.Trash01 />,
                        isError: true,
                        isDisabled: rentChanges.length === 1,
                        onClick: () => removeRentChange(idx),
                      },
                    ]}
                  />
                </Box>

                <Checkbox
                  id={`isPersistent-${idx}`}
                  label="Is Persistent"
                  checked={rentChange.isPersistent}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateRentChange(idx, "isPersistent", e.target.checked)}
                  fieldSize="sm"
                />

                <Input
                  id={`oldSizeBytes-${idx}`}
                  fieldSize="md"
                  label="Old Size (bytes)"
                  type="number"
                  value={rentChange.oldSizeBytes.toString()}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateRentChange(idx, "oldSizeBytes", parseInt(e.target.value))}
                />

                <Input
                  id={`newSizeBytes-${idx}`}
                  fieldSize="md"
                  label="New Size (bytes)"
                  type="number"
                  value={rentChange.newSizeBytes.toString()}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateRentChange(idx, "newSizeBytes", parseInt(e.target.value))}
                />

                <Input
                  id={`oldLiveUntilLedger-${idx}`}
                  fieldSize="md"
                  label="Old Live Until Ledger"
                  type="number"
                  value={rentChange.oldLiveUntilLedger.toString()}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateRentChange(idx, "oldLiveUntilLedger", parseInt(e.target.value))}
                />

                <Input
                  id={`newLiveUntilLedger-${idx}`}
                  fieldSize="md"
                  label="New Live Until Ledger"
                  type="number"
                  value={rentChange.newLiveUntilLedger.toString()}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateRentChange(idx, "newLiveUntilLedger", parseInt(e.target.value))}
                />
              </Box>
            ))}

            <Box gap="lg" direction="row" align="center" justify="space-between">
              <Button
                size="md"
                variant="secondary"
                icon={<Icon.PlusCircle />}
                onClick={addRentChange}
              >
                Add Ledger Entry
              </Button>
            </Box>
          </Box>
        </Card>

        {/*<Card>
          <Box gap="md">
            <h3>Total Rent Fee</h3>
            <p>{totalRentFee.toString()} STROOPs</p>
          </Box>
        </Card>*/}
      </Box>
    </div>
  );
};

export default RentFeeCalculator;