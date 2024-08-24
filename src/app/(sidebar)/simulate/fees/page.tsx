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


interface ContractCosts {
  cpu_insns: number;
  mem_bytes: number;
  entry_reads: number;
  entry_writes: number;
  read_bytes: number;
  write_bytes: number;
  events_and_return_bytes: number;
  txn_size: number;
  ledger_changes: LedgerEntryRentChange[]
  resource_fee_in_xlm: number;
}

class LedgerEntryRentChange {
  isPersistent: boolean;
  oldSizeBytes: number;
  newSizeBytes: number;
  oldLiveUntilLedger: number;
  newLiveUntilLedger: number;

  constructor(
    isPersistent: boolean,
    oldSizeBytes: number,
    newSizeBytes: number,
    oldLiveUntilLedger: number,
    newLiveUntilLedger: number
  ) {
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


  const events_and_return_bytes = (
      events.reduce(
          (accumulator: any, currentValue: any) => accumulator + currentValue, 0 // Initialize accumulator with 0
      ) + (sim.result.results[0] ? sim.result.results[0].xdr.length : 0) // Return value size
  );


  const sorobanTransactionData = StellarSDK.xdr.SorobanTransactionData.fromXDR(sim.result.transactionData, 'base64');
  const resources = sorobanTransactionData.resources();

  const stroopValue = sorobanTransactionData.resourceFee().toString()
  const xlmValue = Number(stroopValue) * 10**(-7);

  const rwro = [
      sorobanTransactionData.resources().footprint().readWrite()
      .flatMap((rw) => rw.toXDR().length),
      sorobanTransactionData.resources().footprint().readOnly()
      .flatMap((ro) => ro.toXDR().length)
  ].flat();

  const metrics = {
      mem_byte: Number(sim.result.cost.memBytes),
      cpu_insn: Number(sim.result.cost.cpuInsns)
  };

  let arr: LedgerEntryRentChange[] = [];

  //@ts-ignore
  sim.result.stateChanges.forEach(entry => {
    let val = StellarSDK.xdr.LedgerEntry.fromXDR(entry.after, 'base64');   
    let entry_type = val.data().contractData().durability().name;
    let beforeSize = 0;
    let afterSize = 0;

    if (entry.before) {
      beforeSize = entry.before.length;
    } else {
      beforeSize = 0;
    }

    if (entry.after) {
      afterSize = entry.after.length;
    } else {
      afterSize = 0;
    }
    // let afterSize = entry.after.length;

    let isPersistent = false;

    if (entry_type == "temporary") {
        isPersistent = false;
    } else {
        isPersistent = true;
    }

    arr.push(new LedgerEntryRentChange(
        isPersistent,  // isPersistent (temporary)
        beforeSize,    // oldSizeBytes
        afterSize,    // newSizeBytes (no change)
        800,    // oldLiveUntilLedger
        1200    // newLiveUntilLedger
    ))
    
  });
  

  const stats: ContractCosts = {
    cpu_insns: metrics.cpu_insn,
    mem_bytes: metrics.mem_byte,
    entry_reads: resources.footprint().readOnly().length + resources.footprint().readWrite().length,
    entry_writes: resources.footprint().readWrite().length,
    read_bytes: resources.readBytes(),
    write_bytes: resources.writeBytes(),
    events_and_return_bytes,
    txn_size: tx_xdr.length,
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
          "instructionLeeway": 3000000
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
      let inclusionFeeMax = inclusionFee.sorobanInclusionFee.max;
      let totalFee = (sorocosts.resource_fee_in_xlm + inclusionFeeMax).toString();
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
        "Events/return value size (bytes)": contractCostInside.events_and_return_bytes,
        "Transaction size (bytes)": contractCostInside.txn_size,
        "Ledger entry changes": contractCostInside.ledger_changes,
        "Resource fee (XLM)": contractCostInside.resource_fee_in_xlm,
      },
      "Total Estimated Fee (XLM)": totalEstimatedFee !== null ? totalEstimatedFee : "Not available"
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