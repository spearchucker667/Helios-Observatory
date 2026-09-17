export type WorkerMessage = 
  | { type: "init"; dt: number }
  | { type: "command"; command: any }
  | { type: "snapshotReq" };

export type MainMessage =
  | { type: "snapshot"; data: any }
  | { type: "event"; event: any }
  | { type: "error"; error: string };
