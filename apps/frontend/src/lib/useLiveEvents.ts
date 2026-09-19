import type { WsEvent } from "@iot/shared";
import { useEffect, useRef } from "react";
import { wsUrl } from "./api";

export function useLiveEvents(onEvent: (event: WsEvent) => void): void {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let closed = false;
    let retry = 0;
    let timer: number | undefined;

    const connect = (): void => {
      socket = new WebSocket(wsUrl());

      socket.onopen = () => {
        retry = 0;
      };

      socket.onmessage = (message) => {
        try {
          handlerRef.current(JSON.parse(message.data as string) as WsEvent);
        } catch {
          // ignora mensajes malformados
        }
      };

      socket.onclose = () => {
        if (closed) return;
        retry = Math.min(retry + 1, 10);
        timer = window.setTimeout(connect, 1000 * retry);
      };

      socket.onerror = () => socket?.close();
    };

    connect();

    return () => {
      closed = true;
      if (timer) window.clearTimeout(timer);
      socket?.close();
    };
  }, []);
}
