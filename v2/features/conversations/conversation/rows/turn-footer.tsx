'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * A line under an answer that the page around the transcript supplies. The
 * admin conversation view (thread 085a980c) puts each turn's tokens, cost,
 * model and funding there; the chat page provides none, so its answers are
 * unchanged.
 */
export type TurnFooterRender = (rowId: string) => ReactNode;

const TurnFooterContext = createContext<TurnFooterRender | null>(null);

export function TurnFooterProvider({ render, children }: { render: TurnFooterRender; children: ReactNode }) {
  return <TurnFooterContext.Provider value={render}>{children}</TurnFooterContext.Provider>;
}

/** The supplied line for this answer row, or nothing. */
export function TurnFooter({ rowId }: { rowId: string }) {
  const render = useContext(TurnFooterContext);
  return render ? render(rowId) : null;
}
