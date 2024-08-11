"use client";

import { useEffect, useState } from "react";
import { Alert, Card} from "@stellar/design-system";
import { MemoValue } from "@stellar/stellar-sdk";
import { get, omit, set } from "lodash";

import { Box } from "@/components/layout/Box";
import { PositiveIntPicker } from "@/components/FormElements/PositiveIntPicker";
import {
  MemoPickerValue,
} from "@/components/FormElements/MemoPicker";
import { ValidationResponseCard } from "@/components/ValidationResponseCard";

import { sanitizeObject } from "@/helpers/sanitizeObject";
import { isEmptyObject } from "@/helpers/isEmptyObject";

import { TransactionBuildParams } from "@/store/createStore";
import { useStore } from "@/store/useStore";
import { useAccountSequenceNumber } from "@/query/useAccountSequenceNumber";
import { validate } from "@/validate";
import { EmptyObj, KeysOfUnion } from "@/types/types";

import * as StellarSDK from '@stellar/stellar-sdk';
import { NextLink } from "@/components/NextLink";
// const server = new StellarSDK.SorobanRpc.Server('https://soroban-testnet.stellar.org:443');

interface FloatingFeeDisplayProps {
  fee: number;
}

const FloatingFeeDisplay: React.FC<FloatingFeeDisplayProps> = ({ fee }) => (
  <div style={{
    position: 'fixed',
    top: '50%',
    right: '0',
    transform: 'translateY(-50%)',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    padding: '15px',
    borderRadius: '5px 0 0 5px', // Rounded corners only on the left side
    zIndex: 1000,
    width: '150px', // Fixed width
    height: '150px', // Equal height to make it square
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    boxShadow: '0 0 10px rgba(0,0,0,0.3)' // Optional: adds a subtle shadow
  }}>
    <div style={{ marginBottom: '10px', fontSize: '14px' }}>Estimated Fee</div>
    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{fee.toFixed(7)} XLM</div>
  </div>
);

const maxConfigAndCost = {
  networkSettings: {
    maxCpuInstructionsPerTxn: 100_000_000,
    maxMemoryLimitPerTxn: 40 * 1024 * 1024, // 40 MB in bytes
    maxLedgerKeySize: 250,
    maxLedgerEntrySizePerTxn: 64 * 1024, // 64 KB in bytes
    maxReadLedgerEntriesPerTxn: 40,
    maxWriteLedgerEntriesPerTxn: 25,
    maxReadBytesPerTxn: 200 * 1024, // 200 KB in bytes
    maxWriteBytesPerTxn: 65 * 1024, // 65 KB in bytes
    maxTxnSize: 70 * 1024, // 70 KB in bytes
    maxEventsReturnValueSize: 8 * 1024, // 8 KB in bytes
  },
  costs: {
    cpuInstructionPer10k: 25,
    readLedgerEntry: 6250,
    writeLedgerEntry: 10000,
    read1KBFromLedger: 1786,
    txnSizePer1KB: 1624,
    txnHistoryPer1KB: 16235,
    eventsReturnValuePer1KB: 10000,
    write1KBToLedger: 11800,
  }
};

function calculateResourceFee(actualUsage: any, config: any) {
  const { costs } = config;
  const cpuFee = (actualUsage.cpuInstructionsPerTxn || 0) / 10_000 * costs.cpuInstructionPer10k;
  const readLedgerEntryFee = (actualUsage.readLedgerEntriesPerTxn || 0) * costs.readLedgerEntry;
  const writeLedgerEntryFee = (actualUsage.writeLedgerEntriesPerTxn || 0) * costs.writeLedgerEntry;
  const readBytesFee = (actualUsage.readBytesPerTxn || 0) / 1024 * costs.read1KBFromLedger;
  const writeBytesFee = (actualUsage.writeBytesPerTxn || 0) / 1024 * costs.write1KBToLedger;
  const txnSizeFee = (actualUsage.txnSize || 0) / 1024 * costs.txnSizePer1KB;
  const txnHistoryFee = (actualUsage.txnSize || 0) / 1024 * costs.txnHistoryPer1KB;
  const eventsReturnValueFee = (actualUsage.eventsReturnValueSize || 0) / 1024 * costs.eventsReturnValuePer1KB;
  const totalFee = cpuFee + readLedgerEntryFee + writeLedgerEntryFee + readBytesFee + writeBytesFee + txnSizeFee + txnHistoryFee + eventsReturnValueFee;
  return totalFee;
}

async function fetchFeeStats(server: any) {
  try {
    const feeStats = await server.getFeeStats();
    return feeStats.sorobanInclusionFee.max;
  } catch (error) {
    console.error('Error fetching fee stats:', error);
  }
}

export const Params = () => {
  const requiredParams = ["source_account", "seq_num", "fee"] as const;

  const { transaction, network } = useStore();
  var server = new StellarSDK.SorobanRpc.Server(network.rpcUrl, {
    allowHttp: true,
  });
  console.log("Current Network RPC URL", network.rpcUrl);

  const { params: txnParams } = transaction.build;
  const {
    updateBuildActiveTab,
    updateBuildParams,
    updateBuildIsValid,
    resetBuildParams,
  } = transaction;

  const [paramsError, setParamsError] = useState<ParamsError>({});

  // Types
  type RequiredParamsField = (typeof requiredParams)[number];

  type ParamsField = KeysOfUnion<typeof txnParams>;

  type ParamsError = {
    [K in keyof TransactionBuildParams]?: any;
  };

  const {
    data: sequenceNumberData,
    error: sequenceNumberError,
    dataUpdatedAt: sequenceNumberDataUpdatedAt,
    errorUpdatedAt: sequenceNumberErrorUpdatedAt,
    refetch: fetchSequenceNumber,
    isFetching: isFetchingSequenceNumber,
    isLoading: isLoadingSequenceNumber,
  } = useAccountSequenceNumber({
    publicKey: txnParams.source_account,
    horizonUrl: network.horizonUrl,
  });

  const [actualUsage, setActualUsage] = useState({
    cpuInstructionsPerTxn: "0",
    readLedgerEntriesPerTxn: "0",
    writeLedgerEntriesPerTxn: "0",
    readBytesPerTxn: "0",
    writeBytesPerTxn: "0",
    txnSize: "0",
    eventsReturnValueSize: "0",
  });

  const [calculatedFee, setCalculatedFee] = useState(0);

  useEffect(() => {
    const calculateFee = async () => {
      const usage = {
        cpuInstructionsPerTxn: parseInt(actualUsage.cpuInstructionsPerTxn, 10),
        readLedgerEntriesPerTxn: parseInt(actualUsage.readLedgerEntriesPerTxn, 10),
        writeLedgerEntriesPerTxn: parseInt(actualUsage.writeLedgerEntriesPerTxn, 10),
        readBytesPerTxn: parseInt(actualUsage.readBytesPerTxn, 10),
        writeBytesPerTxn: parseInt(actualUsage.writeBytesPerTxn, 10),
        txnSize: parseInt(actualUsage.txnSize, 10),
        eventsReturnValueSize: parseInt(actualUsage.eventsReturnValueSize, 10),
      };

      const resourceFee = calculateResourceFee(usage, maxConfigAndCost);
      const sorobanInclusionFee = await fetchFeeStats(server);
      const totalFee = resourceFee + sorobanInclusionFee;
      const totalFeeInXLM = totalFee * 10 ** -7;
      setCalculatedFee(totalFeeInXLM);
    };

    calculateFee();
  }, [actualUsage]);

  // Preserve values and validate inputs when components mounts
  useEffect(() => {
    Object.entries(txnParams).forEach(([key, val]) => {
      if (val) {
        validateParam(key as ParamsField, val);
      }
    });

    const validationError = Object.entries(txnParams).reduce((res, param) => {
      const key = param[0] as ParamsField;
      const val = param[1];

      if (val) {
        const error = validateParam(key, val);

        if (error) {
          res[key] = key === "cond" ? { time: error } : error;
        }
      }

      return res;
    }, {} as ParamsError);

    if (!isEmptyObject(validationError)) {
      setParamsError(validationError);
    }
    // Run this only when page loads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle fetch sequence number response
  useEffect(() => {
    if (sequenceNumberData || sequenceNumberError) {
      const id = "seq_num";

      handleParamChange(id, sequenceNumberData);
      handleParamsError(id, sequenceNumberError);
    }
    // Not inlcuding handleParamChange and handleParamsError
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sequenceNumberData,
    sequenceNumberError,
    sequenceNumberDataUpdatedAt,
    sequenceNumberErrorUpdatedAt,
  ]);

  const handleParamChange = <T,>(paramPath: string, value: T) => {
    updateBuildParams(set({}, `${paramPath}`, value));
  };

  const handleParamsError = <T,>(id: string, error: T) => {
    if (error) {
      setParamsError(set({ ...paramsError }, id, error));
    } else if (get(paramsError, id)) {
      setParamsError(sanitizeObject(omit({ ...paramsError }, id), true));
    }
  };

  const validateParam = (param: ParamsField, value: any) => {
    switch (param) {
      case "cond":
        return validate.getTimeBoundsError(value?.time || value);
      case "fee":
        return validate.getPositiveIntError(value);
      case "memo":
        if (!value || isEmptyObject(value)) {
          return false;
        }

        // Memo in store is in transaction format { memoType: memoValue }
        if (value.type) {
          return validate.getMemoError(value);
        } else {
          // Changing it to { type, value } format if needed
          const [type, val] = Object.entries(value)[0];
          return validate.getMemoError({ type, value: val as MemoValue });
        }

      case "seq_num":
        return validate.getPositiveIntError(value);
      case "source_account":
        return validate.getPublicKeyError(value);
      default:
        return false;
    }
  };

  const getMemoPickerValue = () => {
    return typeof txnParams.memo === "string"
      ? { type: txnParams.memo, value: "" }
      : {
          type: Object.keys(txnParams.memo)[0],
          value: Object.values(txnParams.memo)[0],
        };
  };

  const getMemoValue = (memo?: MemoPickerValue) => {
    if (!memo?.type) {
      return {} as EmptyObj;
    }

    if (memo.type === "none") {
      return "none";
    }

    return { [memo.type]: memo.value };
  };

  const missingRequiredParams = () => {
    return requiredParams.reduce((res, req) => {
      if (!txnParams[req]) {
        return [...res, req];
      }

      return res;
    }, [] as RequiredParamsField[]);
  };

  const getFieldLabel = (field: ParamsField) => {
    switch (field) {
      case "fee":
        return "Base Fee";
      case "seq_num":
        return "Transaction Sequence Number";
      case "source_account":
        return "Source Account";
      case "cond":
        return "Time Bounds";
      case "memo":
        return "Memo";
      default:
        return "";
    }
  };

  const getParamsError = () => {
    const allErrorMessages: string[] = [];
    const errors = Object.keys(paramsError);

    // Make sure we don't show multiple errors for the same field
    const missingParams = missingRequiredParams().filter(
      (m) => !errors.includes(m),
    );

    // Missing params
    if (missingParams.length > 0) {
      const missingParamsMsg = missingParams.reduce((res, cur) => {
        return [...res, `${getFieldLabel(cur)} is a required field`];
      }, [] as string[]);

      allErrorMessages.push(...missingParamsMsg);
    }

    // Memo value
    const memoValue = txnParams.memo;

    if (
      typeof memoValue === "object" &&
      !isEmptyObject(memoValue) &&
      !Object.values(memoValue)[0]
    ) {
      allErrorMessages.push(
        "Memo value is required when memo type is selected",
      );
    }

    // Fields with errors
    if (!isEmptyObject(paramsError)) {
      const fieldErrors = errors.reduce((res, cur) => {
        return [
          ...res,
          `${getFieldLabel(cur as ParamsField)} field has an error`,
        ];
      }, [] as string[]);

      allErrorMessages.push(...fieldErrors);
    }

    // Callback to the parent component
    updateBuildIsValid({ params: allErrorMessages.length === 0 });

    return allErrorMessages;
  };

  const formErrors = getParamsError();

  // const FloatingFeeDisplay = ({ fee }) => (
  //   <div style={{
  //     position: 'fixed',
  //     bottom: '20px',
  //     right: '20px',
  //     backgroundColor: 'rgba(0, 0, 0, 0.7)',
  //     color: 'white',
  //     padding: '10px',
  //     borderRadius: '5px',
  //     zIndex: 1000
  //   }}>
  //     Estimated Fee: {fee.toFixed(7)} XLM
  //   </div>
  // );

  return (
    <Box gap="md">
      <Card>
        <Box gap="lg">

        <PositiveIntPicker
            id="cpuInstructions"
            label="CPU Instructions"
            value={actualUsage.cpuInstructionsPerTxn}
            onChange={(e) => {
              setActualUsage(prev => ({ ...prev, cpuInstructionsPerTxn: e.target.value }));
            } }
            note="Number of CPU instructions the transaction uses" error={undefined} />

          <PositiveIntPicker
            id="readLedgerEntries"
            label="Read Ledger Entries"
            value={actualUsage.readLedgerEntriesPerTxn}
            onChange={(e) => {
              setActualUsage(prev => ({ ...prev, readLedgerEntriesPerTxn: e.target.value }));
            } }
            note="Number of ledger entries read by the transaction" error={undefined} />

          <PositiveIntPicker
            id="writeLedgerEntries"
            label="Write Ledger Entries"
            value={actualUsage.writeLedgerEntriesPerTxn}
            onChange={(e) => {
              setActualUsage(prev => ({ ...prev, writeLedgerEntriesPerTxn: e.target.value }));
            } }
            note="Number of ledger entries written by the transaction" error={undefined} />

          <PositiveIntPicker
            id="readBytes"
            label="Read Bytes"
            value={actualUsage.readBytesPerTxn}
            onChange={(e) => {
              setActualUsage(prev => ({ ...prev, readBytesPerTxn: e.target.value }));
            } }
            note="Number of bytes read by the transaction" error={undefined} />

          <PositiveIntPicker
            id="writeBytes"
            label="Write Bytes"
            value={actualUsage.writeBytesPerTxn}
            onChange={(e) => {
              setActualUsage(prev => ({ ...prev, writeBytesPerTxn: e.target.value }));
            } }
            note="Number of bytes written by the transaction" error={undefined} />

          <PositiveIntPicker
            id="txnSize"
            label="Transaction Size"
            value={actualUsage.txnSize}
            onChange={(e) => {
              setActualUsage(prev => ({ ...prev, txnSize: e.target.value }));
            } }
            note="Size of the transaction in bytes" error={undefined} />

          <PositiveIntPicker
            id="eventsReturnValueSize"
            label="Events Return Value Size"
            value={actualUsage.eventsReturnValueSize}
            onChange={(e) => {
              setActualUsage(prev => ({ ...prev, eventsReturnValueSize: e.target.value }));
            } }
            note="Size of the events return value in bytes" error={undefined} />

          
          {/* <Box gap="md" direction="row" align="center" justify="space-between">
            <Button
              size="md"
              variant="secondary"
              onClick={() => {
                updateBuildActiveTab("operations");
              }}
            >
              Add Operations
            </Button>

            <Button
              size="md"
              variant="error"
              onClick={() => {
                resetBuildParams();
                setParamsError({});
              }}
              icon={<Icon.RefreshCw01 />}
            >
              Clear Params
            </Button>
          </Box> */}
        </Box>
      </Card>

      <Alert variant="primary" placement="inline">
        The basic formula for calculating the fees of a transaction,
        <b> transaction fee = resource fees + inclusion fees </b>
        The inclusion fees are pulled from the getFeeStats() method from the Javascript SDk, selecting the 'max' inclusion value of the fee, since it has the best chance of inclusion in the ledger,
        and you can know more about the resource fees and limits <NextLink href={"https://developers.stellar.org/docs/networks/resource-limits-fees#resource-limits"} sds-variant="primary">
        here</NextLink>
      </Alert>

      <Alert variant="primary" placement="inline">
        The inclusion fees are pulled from the getFeeStats() method from the Javascript SDk, selecting the 'max' inclusion value of the fee, since it has the best chance of inclusion in the ledger,
        and you can know more about the resource fees and limits <NextLink href={"https://developers.stellar.org/docs/networks/resource-limits-fees#resource-limits"} sds-variant="primary">
        here</NextLink>
      </Alert>

      {/* <>
        {formErrors.length > 0 ? (
          <ValidationResponseCard
            variant="primary"
            title="Transaction building errors:"
            response={
              <ul>
                {formErrors.map((e, i) => (
                  <li key={`e-${i}`}>{e}</li>
                ))}
              </ul>
            }
          />
        ) : null}
      </> */}

    <FloatingFeeDisplay fee={calculatedFee} />
    </Box>
  );
};
