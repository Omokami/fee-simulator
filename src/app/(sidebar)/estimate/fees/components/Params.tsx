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
import { sanitizeObject } from "@/helpers/sanitizeObject";
import { isEmptyObject } from "@/helpers/isEmptyObject";
import { TransactionBuildParams } from "@/store/createStore";
import { useStore } from "@/store/useStore";
import { useAccountSequenceNumber } from "@/query/useAccountSequenceNumber";
import { validate } from "@/validate";
import { EmptyObj, KeysOfUnion } from "@/types/types";
import * as StellarSDK from '@stellar/stellar-sdk';
import { NextLink } from "@/components/NextLink";

const INSTRUCTIONS_INCREMENT = BigInt(10000);
const DATA_SIZE_1KB_INCREMENT = BigInt(1024);
const MINIMUM_WRITE_FEE_PER_1KB = BigInt(1000);
const TX_BASE_RESULT_SIZE = BigInt(300);

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

const FeeConfiguration = {
  feePerInstructionIncrement: BigInt(25),
  feePerReadEntry: BigInt(6250),
  feePerWriteEntry: BigInt(10000),
  feePerRead1kb: BigInt(1786),
  feePerWrite1kb: BigInt(11800),
  feePerHistorical1kb: BigInt(16235),
  feePerContractEvent1kb: BigInt(10000),
  feePerTransactionSize1kb: BigInt(1624),
};

const RentFeeConfiguration = {
  feePerWrite1kb: BigInt(11800),
  feePerWriteEntry: BigInt(10000),
  persistentRentRateDenominator: BigInt(10000),
  temporaryRentRateDenominator: BigInt(100000),
};

function computeFeePerIncrement(resourceValue: bigint, feeRate: bigint, increment: bigint): bigint {
  const computedFee = (resourceValue * feeRate + increment - BigInt(1)) / increment;
  
  // If this is a write operation (i.e., feeRate is feePerWrite1kb), apply the minimum fee
  if (feeRate === FeeConfiguration.feePerWrite1kb) {
    const minimumFee = (resourceValue * MINIMUM_WRITE_FEE_PER_1KB + DATA_SIZE_1KB_INCREMENT - BigInt(1)) / DATA_SIZE_1KB_INCREMENT;
    return computedFee > minimumFee ? computedFee : minimumFee;
  }
  
  return computedFee;
}

function calculateResourceFee(actualUsage: any): bigint {
  const computeFee = computeFeePerIncrement(BigInt(actualUsage.cpuInstructionsPerTxn || 0), FeeConfiguration.feePerInstructionIncrement, INSTRUCTIONS_INCREMENT);
  const ledgerReadEntryFee = BigInt(actualUsage.readLedgerEntriesPerTxn || 0) * FeeConfiguration.feePerReadEntry;
  const ledgerWriteEntryFee = BigInt(actualUsage.writeLedgerEntriesPerTxn || 0) * FeeConfiguration.feePerWriteEntry;
  const ledgerReadBytesFee = computeFeePerIncrement(BigInt(actualUsage.readBytesPerTxn || 0), FeeConfiguration.feePerRead1kb, DATA_SIZE_1KB_INCREMENT);
  const ledgerWriteBytesFee = computeFeePerIncrement(BigInt(actualUsage.writeBytesPerTxn || 0), FeeConfiguration.feePerWrite1kb, DATA_SIZE_1KB_INCREMENT);
  const historicalFee = computeFeePerIncrement(BigInt(actualUsage.txnSize || 0) + TX_BASE_RESULT_SIZE, FeeConfiguration.feePerHistorical1kb, DATA_SIZE_1KB_INCREMENT);
  const eventsFee = computeFeePerIncrement(BigInt(actualUsage.eventsReturnValueSize || 0), FeeConfiguration.feePerContractEvent1kb, DATA_SIZE_1KB_INCREMENT);
  const bandwidthFee = computeFeePerIncrement(BigInt(actualUsage.txnSize || 0), FeeConfiguration.feePerTransactionSize1kb, DATA_SIZE_1KB_INCREMENT);
  return computeFee + ledgerReadEntryFee + ledgerWriteEntryFee + ledgerReadBytesFee + ledgerWriteBytesFee + historicalFee + bandwidthFee + eventsFee;
}

function calculateRentFee(rentChanges: any[]): bigint {
  let fee = BigInt(0);
  let extendedEntries = BigInt(0);
  let extendedEntryKeySizeBytes = BigInt(0);

  for (const change of rentChanges) {
    fee += rentFeePerEntryChange(change);
    if (change.oldLiveUntilLedger < change.newLiveUntilLedger) {
      extendedEntries += BigInt(1);
      extendedEntryKeySizeBytes += BigInt(48); // TTL_ENTRY_SIZE
    }
  }

  fee += RentFeeConfiguration.feePerWriteEntry * extendedEntries;
  fee += computeFeePerIncrement(extendedEntryKeySizeBytes, RentFeeConfiguration.feePerWrite1kb, DATA_SIZE_1KB_INCREMENT);

  return fee;
}

function rentFeePerEntryChange(change: any): bigint {
  const currentLedger = BigInt(change.currentLedger || 0);
  let fee = BigInt(0);

  const extensionLedgers = BigInt(change.newLiveUntilLedger) - (change.entryIsNew ? currentLedger - BigInt(1) : BigInt(change.oldLiveUntilLedger));
  if (extensionLedgers > BigInt(0)) {
    fee += rentFeeForSizeAndLedgers(change.isPersistent, BigInt(change.newSizeBytes), extensionLedgers);
  }

  const prepaidLedgers = change.entryIsNew ? BigInt(0) : (BigInt(change.oldLiveUntilLedger) - currentLedger + BigInt(1));
  const sizeIncrease = change.newSizeBytes > change.oldSizeBytes ? BigInt(change.newSizeBytes - change.oldSizeBytes) : BigInt(0);
  if (prepaidLedgers > BigInt(0) && sizeIncrease > BigInt(0)) {
    fee += rentFeeForSizeAndLedgers(change.isPersistent, sizeIncrease, prepaidLedgers);
  }

  return fee;
}

function rentFeeForSizeAndLedgers(isPersistent: boolean, entrySize: bigint, rentLedgers: bigint): bigint {
  const num = entrySize * RentFeeConfiguration.feePerWrite1kb * rentLedgers;
  const denom = DATA_SIZE_1KB_INCREMENT * (isPersistent ? RentFeeConfiguration.persistentRentRateDenominator : RentFeeConfiguration.temporaryRentRateDenominator);
  const computedFee = (num + denom - BigInt(1)) / denom;
  const minimumFee = (entrySize * MINIMUM_WRITE_FEE_PER_1KB * rentLedgers + denom - BigInt(1)) / denom;
  return computedFee > minimumFee ? computedFee : minimumFee;
}


async function fetchFeeStats(server: any) {
  try {
    const feeStats = await server.getFeeStats();
    console.log("Inclusion Fee Max ", feeStats.sorobanInclusionFee.max);
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

  const [rentChanges, setRentChanges] = useState([{
    isPersistent: true,
    oldSizeBytes: 0,
    newSizeBytes: 0,
    oldLiveUntilLedger: 0,
    newLiveUntilLedger: 0,
    currentLedger: 0,
    entryIsNew: true,
  }]);


  const [calculatedFee, setCalculatedFee] = useState(0);

  useEffect(() => {
    const calculateFee = async () => {
      const resourceFee = calculateResourceFee(actualUsage);
      const rentFee = calculateRentFee(rentChanges);
      const totalFee = resourceFee + rentFee;
      const sorobanInclusionFee = await fetchFeeStats(server);
      const totalFeeInXLM = Number(totalFee + BigInt(sorobanInclusionFee)) / 10000000;
      setCalculatedFee(totalFeeInXLM);
    };

    calculateFee();
  }, [actualUsage, rentChanges]);

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

          {/* Add rent-related inputs */}
          <PositiveIntPicker
            id="rentNewSizeBytes"
            label="Rent New Size (bytes)"
            value={rentChanges[0].newSizeBytes.toString()}
            onChange={(e) => {
              const newRentChanges = [...rentChanges];
              newRentChanges[0].newSizeBytes = parseInt(e.target.value);
              setRentChanges(newRentChanges);
            }}
            note="New size of the entry in bytes" 
            error={undefined}
          />

          <PositiveIntPicker
            id="rentNewLiveUntilLedger"
            label="Rent New Live Until Ledger"
            value={rentChanges[0].newLiveUntilLedger.toString()}
            onChange={(e) => {
              const newRentChanges = [...rentChanges];
              newRentChanges[0].newLiveUntilLedger = parseInt(e.target.value);
              setRentChanges(newRentChanges);
            }}
            note="New expiration ledger for the entry" 
            error={undefined}
          />

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
