"use client";

import React, { useState, useEffect } from 'react';
import { TabView } from "@/components/TabView";
import { Box } from "@/components/layout/Box";
import { useStore } from "@/store/useStore";

import Params from "./components/Params";
import { RentFeeCalculator } from "./components/Operations";
import { TransactionXdr } from "./components/TransactionXdr";
import { FloatingFeeDisplay } from "./components/FloatingFeeDisplay";

interface LedgerEntryRentChange {
  isPersistent: boolean;
  oldSizeBytes: number;
  newSizeBytes: number;
  oldLiveUntilLedger: number;
  newLiveUntilLedger: number;
}

interface ParamsState {
  cpuInstructionsPerTxn: string;
  readLedgerEntriesPerTxn: string;
  writeLedgerEntriesPerTxn: string;
  readBytesPerTxn: string;
  writeBytesPerTxn: string;
  txnSize: string;
  eventsReturnValueSize: string;
}

interface RentCalculatorState {
  rentChanges: LedgerEntryRentChange[];
  currentLedgerSeq: number;
}

const BuildTransaction: React.FC = () => {
  const { transaction } = useStore();
  const { activeTab } = transaction.build;
  const { updateBuildActiveTab } = transaction;

  const [resourceFee, setResourceFee] = useState<number>(0);
  const [rentFee, setRentFee] = useState<bigint>(BigInt(0));
  const [totalFee, setTotalFee] = useState<number>(0);
  // const [rentCalculatorState, setRentCalculatorState] = useState<any>(null);
  const [rentCalculatorState, setRentCalculatorState] = useState<RentCalculatorState | null>(null);
  const [paramsState, setParamsState] = useState<ParamsState | null>(null);



  const handleResourceFeeUpdate = (fee: number, state: ParamsState) => {
    setResourceFee(fee);
    setParamsState(state);
  };

  const handleRentFeeUpdate = (fee: bigint, state: any) => {
    setRentFee(fee);
    setRentCalculatorState(state);
  };

  useEffect(() => {
    // Convert rentFee from STROOP to XLM and add to resourceFee
    const rentFeeXLM = Number(rentFee) / 10000000;
    setTotalFee(resourceFee + rentFeeXLM);
  }, [resourceFee, rentFee]);

  return (
    <Box gap="md">
      <TabView
        heading={{ title: "Estimate transaction fees using resource usage and network rates" }}
        tab1={{
          id: "params",
          label: "Resource Usage",
          content: activeTab === "params" ? (
            <Params onFeeUpdate={handleResourceFeeUpdate} initialState={paramsState} />
          ) : null,
        }}
        tab2={{
          id: "operations",
          label: "Rent calculation data",
          content: activeTab === "operations" ? <RentFeeCalculator onRentFeeUpdate={handleRentFeeUpdate} initialState={rentCalculatorState} /> : null,
        }}
        activeTabId={activeTab}
        onTabChange={(id) => {
          updateBuildActiveTab(id);
        }}
      />
      <>{activeTab === "operations" ? <TransactionXdr /> : null}</>
      <FloatingFeeDisplay totalFee={totalFee} />
    </Box>
  );
};

export default BuildTransaction;
