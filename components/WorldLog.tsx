"use client";

import { useEffect, useState } from "react";
import { onWorldLog } from "@/lib/worldLog";

export function WorldLog() {
  const [rows, setRows] = useState<{ id: number; t: number; msg: string }[]>([]);

  useEffect(() => onWorldLog(setRows), []);

  if (!rows.length) return null;

  return (
    <ol className="world-log" aria-label="World logs">
      {rows.slice(-8).map((row) => (
        <li key={row.id}>
          <span>{new Date(row.t).toLocaleTimeString()}</span>
          {row.msg}
        </li>
      ))}
    </ol>
  );
}
