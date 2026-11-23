'use client';

interface TrackingBuyerPillsProps {
  availableBuyers: string[];
  selectedBuyer: string;
  setSelectedBuyer: (buyer: string) => void;
  setPage: (page: number) => void;
}

/** "ALL BUYERS" plus one pill per buyer; picking one goes back to page 1. */
export default function TrackingBuyerPills({
  availableBuyers,
  selectedBuyer,
  setSelectedBuyer,
  setPage,
}: TrackingBuyerPillsProps) {
  return (
    <div className="flex-none flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
      <button
        onClick={() => {
          setSelectedBuyer('');
          setPage(1);
        }}
        className={`btn btn-xs font-bold shrink-0 ${
          selectedBuyer === '' ? 'btn-primary' : 'btn-ghost bg-base-200/60'
        }`}
      >
        ALL BUYERS
      </button>
      {availableBuyers.map((b) => (
        <button
          key={b}
          onClick={() => {
            setSelectedBuyer(b);
            setPage(1);
          }}
          className={`btn btn-xs font-bold shrink-0 ${
            selectedBuyer === b ? 'btn-primary' : 'btn-ghost bg-base-200/60'
          }`}
        >
          {b}
        </button>
      ))}
    </div>
  );
}
