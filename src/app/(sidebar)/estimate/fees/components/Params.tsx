import React, { useState, useEffect } from 'react';
import { Alert, Button, Card } from "@stellar/design-system";
import { PositiveIntPicker } from "@/components/FormElements/PositiveIntPicker";
import { Box } from "@/components/layout/Box";
import { NextLink } from "@/components/NextLink";
import * as StellarSDK from '@stellar/stellar-sdk';


export function computeInstructionFee(instructions: string): number {
  const FEE_RATE = 25;
  const DIVISOR = 10000;
  const instructionsNum = Number(instructions);
  const fee = (instructionsNum * FEE_RATE) / DIVISOR;
  return Math.ceil(fee);
}

export function computeReadEntriesFee(numberOfReadsandWriteEntries: string): number {
  const FEE_RATE = 6250;
  const numberOfReadsandWriteEntriesNum = Number(numberOfReadsandWriteEntries);
  const fee = (numberOfReadsandWriteEntriesNum * FEE_RATE);
  return fee;
}

export function computeWriteEntriesFee(numberOfWriteEntries: string): number {
  const FEE_RATE = 10000;
  const numberOfWriteEntriesNum = Number(numberOfWriteEntries);
  const fee = numberOfWriteEntriesNum * FEE_RATE;
  return fee;
}

export function computeReadBytesFee(bytesRead: string): number {
  const FEE_RATE = 1786;
  const DIVISOR = 1024;
  const bytesReadNum = Number(bytesRead);
  const fee = (bytesReadNum * FEE_RATE) / DIVISOR;
  return Math.ceil(fee);
}

export function computeWriteBytesFee(bytesWritten: string): number {
  const FEE_RATE = 11800;
  const DIVISOR = 1024;
  const bytesWrittenNum = Number(bytesWritten);
  const fee = (bytesWrittenNum * FEE_RATE) / DIVISOR;
  return Math.ceil(fee);
}

export function computeHistoricalFee(sizeOfTheTxEnvelopeInBytes: string): number {
  const FEE_RATE = 16235;
  const DIVISOR = 1024;
  const baseSizeOfTheTxnResultInBytes = 300;
  const effectiveTxnSize = Number(sizeOfTheTxEnvelopeInBytes) + Number(baseSizeOfTheTxnResultInBytes);
  const fee = (effectiveTxnSize * FEE_RATE) / DIVISOR;
  return Math.ceil(fee);
}

export function computeBandwidthFee(sizeOfTheTxEnvelopeInBytes: string): number {
  const FEE_RATE = 1624;
  const DIVISOR = 1024;
  const effectiveTxnSize = Number(sizeOfTheTxEnvelopeInBytes);
  const fee = (effectiveTxnSize * FEE_RATE) / DIVISOR;
  return Math.ceil(fee);
}

export function computeEventsOrReturnValueFee(sizeOfTheEventsOrReturnValueInBytes: string): number {
  const FEE_RATE = 10000;
  const DIVISOR = 1024;
  const sizeOfTheEventsOrReturnValueInBytesNum = Number(sizeOfTheEventsOrReturnValueInBytes);
  const fee = (sizeOfTheEventsOrReturnValueInBytesNum * FEE_RATE) / DIVISOR;
  return Math.ceil(fee);
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

// interface ParamsProps {
//   onFeeUpdate: (fee: number) => void;
// }

interface ParamsProps {
  onFeeUpdate: (fee: number, state: ParamsState) => void;
  initialState: ParamsState | null;
}

export interface ActualUsage {
  cpuInstructionsPerTxn: string;
  readLedgerEntriesPerTxn: string;
  writeLedgerEntriesPerTxn: string;
  readBytesPerTxn: string;
  writeBytesPerTxn: string;
  txnSize: string;
  eventsReturnValueSize: string;
}

export const Params: React.FC<ParamsProps> = ({ onFeeUpdate, initialState }) => {
  const [actualUsage, setActualUsage] = useState<ParamsState>(
    initialState || {
      cpuInstructionsPerTxn: "0",
      readLedgerEntriesPerTxn: "0",
      writeLedgerEntriesPerTxn: "0",
      readBytesPerTxn: "0",
      writeBytesPerTxn: "0",
      txnSize: "0",
      eventsReturnValueSize: "0",
    }
  );

  const [calculatedFee, setCalculatedFee] = useState<number>(0);
  const [inclusionFee, setInclusionFee] = useState<number>(0);

  useEffect(() => {
    const calculateFee = () => {
      const instructionFee = computeInstructionFee(actualUsage.cpuInstructionsPerTxn);
      const readEntriesFee = computeReadEntriesFee(actualUsage.readLedgerEntriesPerTxn);
      const writeEntriesFee = computeWriteEntriesFee(actualUsage.writeLedgerEntriesPerTxn);
      const readBytesFee = computeReadBytesFee(actualUsage.readBytesPerTxn);
      const writeBytesFee = computeWriteBytesFee(actualUsage.writeBytesPerTxn);
      const historicalFee = computeHistoricalFee(actualUsage.txnSize);
      const bandwidthFee = computeBandwidthFee(actualUsage.txnSize);
      const eventsFee = computeEventsOrReturnValueFee(actualUsage.eventsReturnValueSize);

      const totalFee = instructionFee + readEntriesFee + writeEntriesFee + readBytesFee + 
      writeBytesFee + historicalFee + bandwidthFee + eventsFee;

      const feeInXLM = totalFee / 10000000; // Convert to XLM
      
      setCalculatedFee(feeInXLM);
      onFeeUpdate(feeInXLM + inclusionFee, actualUsage);
    };

    calculateFee();
  }, [actualUsage, inclusionFee, onFeeUpdate]);

  useEffect(() => {
    const fetchInclusionFee = async () => {
      const server = new StellarSDK.SorobanRpc.Server('https://soroban-testnet.stellar.org:443');
      try {
        const feeStats = await server.getFeeStats();
        setInclusionFee(Number(feeStats.sorobanInclusionFee.max) / 10000000); // Convert to XLM
      } catch (error) {
        console.error('Error fetching fee stats:', error);
      }
    };

    fetchInclusionFee();
  }, []);

  const handleInputChange = (field: keyof ActualUsage, value: string) => {
    setActualUsage(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Box gap="md">
      <Card>
        <Box gap="lg">
          <PositiveIntPicker
            id="cpuInstructions"
            label="CPU Instructions"
            value={actualUsage.cpuInstructionsPerTxn}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('cpuInstructionsPerTxn', e.target.value)}
            note="Number of CPU instructions the transaction uses" error={undefined}          />

          <PositiveIntPicker
            id="readLedgerEntries"
            label="Read Ledger Entries"
            value={actualUsage.readLedgerEntriesPerTxn}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('readLedgerEntriesPerTxn', e.target.value)}
            note="Number of ledger entries read by the transaction" error={undefined}          />

          <PositiveIntPicker
            id="writeLedgerEntries"
            label="Write Ledger Entries"
            value={actualUsage.writeLedgerEntriesPerTxn}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('writeLedgerEntriesPerTxn', e.target.value)}
            note="Number of ledger entries written by the transaction" error={undefined}          />

          <PositiveIntPicker
            id="readBytes"
            label="Read Bytes"
            value={actualUsage.readBytesPerTxn}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('readBytesPerTxn', e.target.value)}
            note="Number of bytes read by the transaction" error={undefined}          />

          <PositiveIntPicker
            id="writeBytes"
            label="Write Bytes"
            value={actualUsage.writeBytesPerTxn}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('writeBytesPerTxn', e.target.value)}
            note="Number of bytes written by the transaction" error={undefined}          />

          <PositiveIntPicker
            id="txnSize"
            label="Transaction Size"
            value={actualUsage.txnSize}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('txnSize', e.target.value)}
            note="Size of the transaction in bytes" error={undefined}          />

          <PositiveIntPicker
            id="eventsReturnValueSize"
            label="Events Return Value Size"
            value={actualUsage.eventsReturnValueSize}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('eventsReturnValueSize', e.target.value)}
            note="Size of the events return value in bytes" error={undefined}          />
  
        </Box>
      </Card>

      <Alert variant="primary" placement="inline">
        The basic formula for calculating the fees of a transaction,
        <b> transaction fee = resource fees + inclusion fees </b>
        The inclusion fees are pulled from the getFeeStats() method from the Javascript SDK, selecting the 'max' inclusion value of the fee, since it has the best chance of inclusion in the ledger,
        and you can know more about the resource fees and limits <NextLink href="https://developers.stellar.org/docs/networks/resource-limits-fees#resource-limits" sds-variant="primary">
        here</NextLink>
      </Alert>

    </Box>
  );
};

export default Params;