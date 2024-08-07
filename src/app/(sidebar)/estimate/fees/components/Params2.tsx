"use client";

import React, { useState } from "react";
import { Box2 } from "@/components/layout/Box2";
import { Card } from "@stellar/design-system";
import { PositiveIntPicker } from "@/components/FormElements/PositiveIntPicker";
import { set } from "lodash";

type TxnParams = {
  cpu_instructions: string;
  memory_usage: string;
  txn_size: string;
  ledger_entries: { read: string; write: string };
  read_write_bytes: { read: string; write: string };
};

type ParamsError = {
  [K in keyof TxnParams]?: string;
};

export const Params: React.FC = () => {
  const [txnParams, setTxnParams] = useState<TxnParams>({
    cpu_instructions: "",
    memory_usage: "",
    txn_size: "",
    ledger_entries: { read: "", write: "" },
    read_write_bytes: { read: "", write: "" },
  });

  const [paramsError, setParamsError] = useState<ParamsError>({});

  const handleParamChange = (paramPath: string, value: string) => {
    setTxnParams(prevParams => set({...prevParams}, paramPath, value));
    validateParam(paramPath as keyof TxnParams, value);
  };

  const validateParam = (param: keyof TxnParams, value: string) => {
    let error: string | null = null;

    switch (param) {
      case "cpu_instructions":
        error = Number(value) > 100000000 ? "Exceeds max 100 million instructions" : null;
        break;
      case "memory_usage":
        error = Number(value) > 40 ? "Exceeds max 40 MB" : null;
        break;
      case "txn_size":
        error = Number(value) > 70 ? "Exceeds max 70 KB" : null;
        break;
      case "ledger_entries":
        const ledgerEntries = value as unknown as { read: string; write: string };
        error = Number(ledgerEntries.read) > 40 || Number(ledgerEntries.write) > 25 ? "Exceeds max read/write entries" : null;
        break;
      case "read_write_bytes":
        const readWriteBytes = value as unknown as { read: string; write: string };
        error = Number(readWriteBytes.read) > 200 || Number(readWriteBytes.write) > 65 ? "Exceeds max read/write bytes" : null;
        break;
    }

    setParamsError(prevErrors => ({...prevErrors, [param]: error}));
  };

  const calculateFee = (): number => {
    let fee = 0;
    fee += Math.ceil(Number(txnParams.cpu_instructions) / 10000) * 25;
    fee += Number(txnParams.ledger_entries.read) * 6250;
    fee += Number(txnParams.ledger_entries.write) * 10000;
    fee += Math.ceil(Number(txnParams.read_write_bytes.read) / 1024) * 1786;
    fee += Math.ceil(Number(txnParams.read_write_bytes.write) / 1024) * 11800;
    return fee;
  };

  return (
    <Box2>
      <Card>
        <Box2>
          <PositiveIntPicker
            id="cpu_instructions"
            label="CPU Instructions"
            value={txnParams.cpu_instructions}
            error={paramsError.cpu_instructions}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleParamChange("cpu_instructions", e.target.value)}
            note="Max 100 million instructions"
          />
          
          <PositiveIntPicker
            id="memory_usage"
            label="Memory Usage (MB)"
            value={txnParams.memory_usage}
            error={paramsError.memory_usage}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleParamChange("memory_usage", e.target.value)}
            note="Max 40 MB"
          />
          
          <PositiveIntPicker
            id="txn_size"
            label="Transaction Size (KB)"
            value={txnParams.txn_size}
            error={paramsError.txn_size}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleParamChange("txn_size", e.target.value)}
            note="Max 70 KB"
          />
          
          <Box2>
            <label>Ledger Entries</label>
            <PositiveIntPicker
              id="ledger_entries_read"
              label="Read"
              value={txnParams.ledger_entries.read}
              error={paramsError.ledger_entries}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleParamChange("ledger_entries.read", e.target.value)}
              note="Max 40 read entries"
            />
            <PositiveIntPicker
              id="ledger_entries_write"
              label="Write"
              value={txnParams.ledger_entries.write}
              error={paramsError.ledger_entries}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleParamChange("ledger_entries.write", e.target.value)}
              note="Max 25 write entries"
            />
          </Box2>
          
          <Box2 >
            <label>Read/Write Bytes</label>
            <PositiveIntPicker
              id="read_write_bytes_read"
              label="Read (KB)"
              value={txnParams.read_write_bytes.read}
              error={paramsError.read_write_bytes}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleParamChange("read_write_bytes.read", e.target.value)}
              note="Max 200 KB read"
            />
            <PositiveIntPicker
              id="read_write_bytes_write"
              label="Write (KB)"
              value={txnParams.read_write_bytes.write}
              error={paramsError.read_write_bytes}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleParamChange("read_write_bytes.write", e.target.value)}
              note="Max 65 KB write"
            />
          </Box2>

          <Box2>
            <label>Estimated Fee (stroops)</label>
            <div>{calculateFee()}</div>
          </Box2>
        </Box2>
      </Card>
    </Box2>
  );
};