'use client';

interface UserStatCardsProps {
  statTotal: number;
  statAdmins: number;
  statCustom: number;
  statBuyerRestricted: number;
}

export default function UserStatCards({ statTotal, statAdmins, statCustom, statBuyerRestricted }: UserStatCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="card bg-base-100 border border-base-300 p-4 shadow-sm">
        <span className="text-xs text-base-content/60 font-semibold">Total Users</span>
        <span className="text-2xl font-black mt-1">{statTotal}</span>
      </div>
      <div className="card bg-base-100 border border-base-300 p-4 shadow-sm">
        <span className="text-xs text-base-content/60 font-semibold">Admins</span>
        <span className="text-2xl font-black text-error mt-1">{statAdmins}</span>
      </div>
      <div className="card bg-base-100 border border-base-300 p-4 shadow-sm">
        <span className="text-xs text-base-content/60 font-semibold">Custom Access</span>
        <span className="text-2xl font-black text-primary mt-1">{statCustom}</span>
      </div>
      <div className="card bg-base-100 border border-base-300 p-4 shadow-sm">
        <span className="text-xs text-base-content/60 font-semibold">Restricted Buyers</span>
        <span className="text-2xl font-black text-warning mt-1">{statBuyerRestricted}</span>
      </div>
    </div>
  );
}
