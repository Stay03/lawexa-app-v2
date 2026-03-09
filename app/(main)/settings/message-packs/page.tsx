'use client';

import { Separator } from '@/components/ui/separator';
import PaygBalanceCard from '@/components/payg/PaygBalanceCard';
import MessagePackTable from '@/components/payg/MessagePackTable';

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Message packs settings page with balance, purchase history, and info.
 */
function MessagePacksPage() {
  return (
    <div>
      {/* PAYG balance + buy button */}
      <PaygBalanceCard />

      <Separator className="my-8" />

      {/* Purchase history */}
      <div className="space-y-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
          Purchase History
        </h3>
        <MessagePackTable />
      </div>

      <Separator className="my-8" />

      {/* How it works */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
          How It Works
        </h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Pricing:</span> Each message
            pack contains 10 AI messages for ₦2,000.
          </p>
          <p>
            <span className="font-medium text-foreground">No expiry:</span> PAYG
            messages never expire and persist across billing periods.
          </p>
          <p>
            <span className="font-medium text-foreground">Plan first:</span> Your plan
            messages are always used before PAYG messages.
          </p>
          <p>
            <span className="font-medium text-foreground">FIFO:</span> Oldest packs
            are consumed first.
          </p>
        </div>
      </div>
    </div>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default MessagePacksPage;
