"use client";

import { useEffect, useState, useCallback  } from "react";
import {
  Text,
  Card,
  Alert,
  Button,
  Icon,
  CopyText,
} from "@stellar/design-system";
import { useLatestTxn } from "@/query/useLatestTxn";
import * as StellarXdr from "@/helpers/StellarXdr";
import { Box } from "@/components/layout/Box";
import { XdrPicker } from "@/components/FormElements/XdrPicker";
import { PrettyJson } from "@/components/PrettyJson";
import { XdrTypeSelect } from "@/components/XdrTypeSelect2";
import { useIsXdrInit } from "@/hooks/useIsXdrInit";
import { useStore } from "@/store/useStore";
import * as StellarSDK from '@stellar/stellar-sdk';
import { StringNullableChain } from "lodash";


const MIN_TEMP_TTL = 17280
const MIN_PERSIST_TTL = 2073600

interface ContractCosts {
  cpu_insns: number;
  mem_bytes: number;
  entry_reads: number;
  entry_writes: number;
  read_bytes: number;
  write_bytes: number;
  events_and_return_bytes: number;
  txn_size: number;
  current_ledger: number;
  ledger_changes: LedgerEntryRentChange[];
  resource_fee_in_xlm: number;
}

class LedgerEntryRentChange {
  entryType: string;
  isPersistent: boolean;
  oldSizeBytes: number;
  newSizeBytes: number;
  oldLiveUntilLedger: number;
  newLiveUntilLedger: number;

  constructor(
    entryType: string,
    isPersistent: boolean,
    oldSizeBytes: number,
    newSizeBytes: number,
    oldLiveUntilLedger: number,
    newLiveUntilLedger: number
  ) {

    this.entryType = entryType;

    // Whether this is persistent or temporary entry.
    this.isPersistent = isPersistent;

    // Size of the entry in bytes before it has been modified, including the key.
    // 0 for newly-created entries.
    this.oldSizeBytes = oldSizeBytes;

    // Size of the entry in bytes after it has been modified, including the key.
    this.newSizeBytes = newSizeBytes;

    // Live until ledger of the entry before it has been modified.
    // Should be less than the current ledger for newly-created entries.
    this.oldLiveUntilLedger = oldLiveUntilLedger;

    // Live until ledger of the entry after it has been modified.
    this.newLiveUntilLedger = newLiveUntilLedger;
  }
}


async function sorobill(sim: any, tx_xdr: any) {
  
  const events = sim.result.events.map((e: any) => {
    const buffer = Buffer.from(e, 'base64');
    let parsedEvent = StellarSDK.xdr.DiagnosticEvent.fromXDR(buffer);
    if (parsedEvent.event().type().name !== 'contract')
          return 0;
    return parsedEvent.event().toXDR().length;
  });

  const returnValueSize = sim.result.results[0]?.xdr.length ?? 0;
  console.log("Simulate: Return Value Size", returnValueSize);
  
  /// The return value is also considered as an event in stellar-core terms, confusing huh, but the truth
  /// It seems to be the case, that if the smart contract function returns nothing
  /// It still returns a empty ScVal type I guess, which occupies some 8 bytes
  //? I am not sure if the 8 bytes is stored in the tx on the ledger or no
  
  const events_and_return_bytes = (
      events.reduce(
          (accumulator: any, currentValue: any) => accumulator + currentValue, 0 // Initialize accumulator with 0
      ) + (sim.result.results[0] ? sim.result.results[0].xdr.length : 0) // Return value size
  );


  const sorobanTransactionData = StellarSDK.xdr.SorobanTransactionData.fromXDR(sim.result.transactionData, 'base64');
  const resources = sorobanTransactionData.resources();

  const stroopValue = sorobanTransactionData.resourceFee().toString()
  let xlmValue = Number(stroopValue) * 10**(-7);
  xlmValue = Number(xlmValue.toFixed(7));


  // const rwro = [
  //     sorobanTransactionData.resources().footprint().readWrite()
  //     .flatMap((rw) => rw.toXDR().length),
  //     sorobanTransactionData.resources().footprint().readOnly()
  //     .flatMap((ro) => ro.toXDR().length)
  // ].flat();

  const metrics = {
      mem_byte: Number(sim.result.cost.memBytes),
      cpu_insn: Number(sim.result.cost.cpuInsns)
  };

  let arr: LedgerEntryRentChange[] = [];
  let latestLedger =  sim.result.latestLedger;
  
  //@ts-ignore
  sim.result.stateChanges.forEach(entry => {
    
  // console.log(entry)
    let beforeSize = 0;
    let afterSize = 0;
    let isPersistent = false;
    let lastModifiedLedger = 0;
    let oldLiveUntilLedger = 0;
    let newLiveUntilLedger = 0;
    let entryType = "";

    if (entry.type == "created") { 
      entryType = entry.type;

      let afterEntry = StellarSDK.xdr.LedgerEntry.fromXDR(entry.after, 'base64'); 
      let liveUntilLedgerSeq;

      try {
        liveUntilLedgerSeq = afterEntry.data().ttl().liveUntilLedgerSeq();
      } catch (error) {
          if (error instanceof TypeError) {
              // ttl is not present
              console.log("TTL is not present for this entry");
              // You might want to set a default value or handle this case differently
              liveUntilLedgerSeq = null; // or some default value
          } else {
              // If it's not a TypeError, rethrow the error
              throw error;
          }
      }

    

      if (afterEntry.data().contractData().durability().name == "temporary") {
        isPersistent = false; 
        if (liveUntilLedgerSeq !== null) {
          oldLiveUntilLedger = 0
          newLiveUntilLedger = afterEntry.data().ttl().liveUntilLedgerSeq()
        } else {
          oldLiveUntilLedger = 0
          newLiveUntilLedger = latestLedger + MIN_TEMP_TTL
        }
      } else if (afterEntry.data().contractData().durability().name == "persistent") {
        isPersistent = true
        if (liveUntilLedgerSeq !== null) {
          oldLiveUntilLedger = 0
          newLiveUntilLedger = afterEntry.data().ttl().liveUntilLedgerSeq();
        } else {
          oldLiveUntilLedger = 0
          newLiveUntilLedger = latestLedger + MIN_PERSIST_TTL
        }
      }

      beforeSize = 0;
      afterSize = entry.after.length;
  } else if (entry.type == "updated") { 

    entryType = entry.type;
    let beforeEntry = StellarSDK.xdr.LedgerEntry.fromXDR(entry.before, 'base64');   
    let afterEntry = StellarSDK.xdr.LedgerEntry.fromXDR(entry.after, 'base64'); 

    // if (afterEntry.data().contractData()) {
    //       return;
    // }


    let afterLiveUntilLedgerSeq;

      try {
        afterLiveUntilLedgerSeq = afterEntry.data().ttl().liveUntilLedgerSeq();
      } catch (error) {
          if (error instanceof TypeError) {
              // ttl is not present
              console.log("TTL is not present for this entry");
              // You might want to set a default value or handle this case differently
              afterLiveUntilLedgerSeq = null; // or some default value
          } else {
              // If it's not a TypeError, rethrow the error
              throw error;
          }
      }

      let beforeLiveUntilLedgerSeq;

      try {
        beforeLiveUntilLedgerSeq = beforeEntry.data().ttl().liveUntilLedgerSeq();
      } catch (error) {
          if (error instanceof TypeError) {
              // ttl is not present
              console.log("TTL is not present for this entry");
              // You might want to set a default value or handle this case differently
              beforeLiveUntilLedgerSeq = null; // or some default value
          } else {
              // If it's not a TypeError, rethrow the error
              throw error;
          }
      }

    if (beforeEntry.data().contractData().durability().name == "temporary") {
      isPersistent = false;
    
      if (beforeLiveUntilLedgerSeq !== null) {
          oldLiveUntilLedger = entry.data().ttl().liveUntilLedgerSeq();
      } else {
          if (lastModifiedLedger == 0) {
            oldLiveUntilLedger = 0
          } else {
            oldLiveUntilLedger = lastModifiedLedger + MIN_TEMP_TTL
          }
      }
      
      if (afterLiveUntilLedgerSeq !== null) {
        newLiveUntilLedger = afterEntry.data().ttl().liveUntilLedgerSeq()
      } else {
        newLiveUntilLedger = latestLedger + MIN_TEMP_TTL
      }
    } else if (beforeEntry.data().contractData().durability().name == "persistent") {
      isPersistent = true
      if (beforeLiveUntilLedgerSeq !== null) {
        oldLiveUntilLedger = beforeEntry.data().ttl().liveUntilLedgerSeq()
      } else {
        if (lastModifiedLedger == 0) {
          oldLiveUntilLedger = 0
        } else {
          oldLiveUntilLedger = lastModifiedLedger + MIN_PERSIST_TTL
        }
      }
      
      if (afterLiveUntilLedgerSeq !== null) {
        newLiveUntilLedger = afterEntry.data().ttl().liveUntilLedgerSeq();
      } else {
        newLiveUntilLedger = latestLedger + MIN_PERSIST_TTL
      }
    }
    beforeSize = entry.before.length;
    afterSize = entry.after.length;

  } else if (entry.type == "deleted") {
    // Do nothing I guess
    // TODO: Deleted Entries
    // TODO: Check if deleted entries 
    return;
  }
   
    arr.push(new LedgerEntryRentChange(
      entryType, // Type of Entry
      isPersistent,  // isPersistent (temporary)
      beforeSize,    // oldSizeBytes
      afterSize,    // newSizeBytes (no change)
      oldLiveUntilLedger,    // oldLiveUntilLedger
      newLiveUntilLedger    // newLiveUntilLedger
    ))
    
  });
  

  const stats: ContractCosts = {
    cpu_insns: metrics.cpu_insn,
    mem_bytes: metrics.mem_byte,
    entry_reads: resources.footprint().readOnly().length + resources.footprint().readWrite().length,
    entry_writes: resources.footprint().readWrite().length,
    read_bytes: resources.readBytes(),
    write_bytes: resources.writeBytes(),
    txn_size: tx_xdr.length,
    events_and_return_bytes,
    current_ledger: latestLedger,
    ledger_changes: arr,
    resource_fee_in_xlm: xlmValue,
  };

  return stats;

}
export default function ViewXdr() {
  const { xdr, network } = useStore();
  const { updateXdrBlob, updateXdrType, resetXdr } = xdr;
  const [contractCosts, setContractCosts] = useState<ContractCosts | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [totalEstimatedFee, setTotalEstimatedFee] = useState<string | null>(null);


  
  const isXdrInit = useIsXdrInit();

  const {
    data: latestTxn,
    error: latestTxnError,
    isSuccess: isLatestTxnSuccess,
    isFetching: isLatestTxnFetching,
    isLoading: isLatestTxnLoading,
  } = useLatestTxn(network.horizonUrl);

  useEffect(() => {
    if (isLatestTxnSuccess && latestTxn) {
      updateXdrBlob(latestTxn);
      updateXdrType("TransactionEnvelope");
    }
  }, [isLatestTxnSuccess, latestTxn, updateXdrBlob, updateXdrType]);

  const isFetchingLatestTxn = isLatestTxnFetching || isLatestTxnLoading;

  const xdrDecodeJson = useCallback(() => {
    if (!(isXdrInit && xdr.blob && xdr.type)) {
      return null;
    }

    try {
      const xdrJson = StellarXdr.decode(xdr.type, xdr.blob);
      return {
        jsonString: xdrJson,
        error: "",
      };
    } catch (e) {
      return {
        jsonString: "",
        error: `Unable to decode input as ${xdr.type}: ${e}`,
      };
    }
  }, [isXdrInit, xdr.blob, xdr.type]);

  const simulateTransaction = useCallback(async () => {
    if (!xdr.blob || isSimulating) return;

    setIsSimulating(true);

    let requestBody = {
      "jsonrpc": "2.0",
      "id": 8675309,
      "method": "simulateTransaction",
      "params": {
        "transaction": xdr.blob,
        "resourceConfig": {
          "instructionLeeway": 0 // stellar.expert does the same
        }
      }
    };

    try {
      let res = await fetch(network.rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      let simulateResponse = await res.json();
      // console.log("fool ", simulateResponse)
      let sorocosts = await sorobill(simulateResponse, xdr.blob);
      setContractCosts(sorocosts);
      
      // Uncomment and adjust these lines if you want to calculate total fee
      const server = new StellarSDK.SorobanRpc.Server('https://soroban-testnet.stellar.org:443');

      let inclusionFee = await server.getFeeStats();
      let inclusionFeeMaxNum = Number(inclusionFee.sorobanInclusionFee.max) ;
      let totalFee = (Number(sorocosts.resource_fee_in_xlm + inclusionFeeMaxNum * 10**(-7)).toFixed(7)).toString();
      setTotalEstimatedFee(totalFee);
    } catch (error) {
      console.error("Error simulating transaction:", error);
    } finally {
      setIsSimulating(false);
    }
  }, [xdr.blob]);

  useEffect(() => {
    simulateTransaction();
  }, [simulateTransaction]);

  const xdrJsonDecoded = xdrDecodeJson();

  const prettifyJsonString = (jsonString: string) => {
    try {
      const parsedJson = JSON.parse(jsonString);
      return JSON.stringify(parsedJson, null, 2);
    } catch (e) {
      return jsonString;
    }
  };

  const combinedJson = useCallback(() => {
    
    const contractCostInside: ContractCosts = contractCosts || {
      cpu_insns: 0,
      mem_bytes: 0,
      entry_reads: 0,
      entry_writes: 0,
      read_bytes: 0,
      write_bytes: 0,
      events_and_return_bytes: 0,
      txn_size: 0,
      current_ledger: 0,
      ledger_changes: [],
      resource_fee_in_xlm: 0
    };

    const readableJson = {
      "Contract Costs": {
        "CPU Instructions": contractCostInside.cpu_insns,
        "Number of ledger entries read": contractCostInside.entry_reads,
        "Number of ledger entries written": contractCostInside.entry_writes,
        "Number of bytes read": contractCostInside.read_bytes,
        "Number of bytes written": contractCostInside.write_bytes,
        "Transaction size (bytes)": contractCostInside.txn_size,
        "Events/return value size (bytes)": contractCostInside.events_and_return_bytes,
        "Current Ledger": contractCostInside.current_ledger,
        "Ledger entry changes": contractCostInside.ledger_changes,
      },
      "Fees": {
        "Max Resource fee (XLM)": contractCostInside.resource_fee_in_xlm,
        "Max Estimated Fee (XLM)": totalEstimatedFee !== null ? totalEstimatedFee : "Not available"
      }
    };
    return readableJson;
  }, [contractCosts, totalEstimatedFee]);
  
  return (
    <Box gap="md">
      <div className="PageHeader">
        <Text size="md" as="h1" weight="medium">
          Check resource estimates and fees by simulating transactions
        </Text>
      </div>

      <Card>
        <Box gap="lg">
          <XdrPicker
            id="view-xdr-blob"
            label="Transaction XDR"
            value={xdr.blob}
            hasCopyButton
            note="Input a base-64 encoded unsigned / signed XDR blob of a transaction"
            onChange={(e) => {
              updateXdrBlob(e.target.value);
            }}
            error={latestTxnError?.toString()}
            disabled={isFetchingLatestTxn}
          />

          <XdrTypeSelect error={xdrJsonDecoded?.error} />


          <Box gap="lg" direction="row" align="center" justify="end">
            <Button
              size="md"
              variant="error"
              icon={<Icon.RefreshCw01 />}
              onClick={() => {
                resetXdr();
                setContractCosts(null);
                setTotalEstimatedFee(null);
              }}
              disabled={!xdr.blob}
            >
              Clear XDR
            </Button>
          </Box>

          {combinedJson() && (
            <Box gap="lg">
              <div className="PageBody__content PageBody__scrollable">
                <PrettyJson json={combinedJson()} />
              </div>

              <Box gap="md" direction="row" justify="end">
                <CopyText
                  textToCopy={prettifyJsonString(JSON.stringify(combinedJson()))}
                >
                  <Button
                    size="md"
                    variant="tertiary"
                    icon={<Icon.Copy01 />}
                    iconPosition="left"
                  >
                    Copy JSON
                  </Button>
                </CopyText>
              </Box>
            </Box>
          )}
        </Box>
      </Card>

      <Alert variant="primary" placement="inline">
        The fee simulation shows the estimated resource usage, including CPU instructions, memory usage, ledger entry accesses, ledger I/O operations, transaction size, events, and return value size, which directly affect the transaction fees, while the overall fee is shown by adding the resource fees and current inclusion fees.
      </Alert>

      <Alert variant="primary" placement="inline">
        Note that while simulation provides a good estimate,
        actual execution may vary slightly due to network conditions or changes in the ledger state between simulation and execution.
      </Alert>
    </Box>
  );
}