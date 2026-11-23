'use client';

import Link, { useLinkStatus } from 'next/link';
import { guardedLinkHandlers } from '@/lib/unsaved-changes';
import type { MenuItemDef } from './sidebar-menu';

/* Right-hand marker of a menu link: a small spinner from the click until the page opens (only when the page
   was not prefetched yet, so the click is confirmed at once), and the pulsing dot on the page that is open. */
function LinkMarker({ active }: { active: boolean }) {
  const { pending } = useLinkStatus();
  if (pending) {
    return (
      <span
        className="ml-1.5 h-2.5 w-2.5 shrink-0 animate-spin rounded-full border-[1.5px] border-emerald-500 border-t-transparent"
        aria-hidden="true"
      />
    );
  }
  return active ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 ml-1.5 animate-pulse" /> : null;
}

interface SidebarLinkProps {
  item: MenuItemDef;
  href: string;
  active: boolean;
  onItemClick: (item: MenuItemDef) => void;
}

/** One menu link of a group or sub-group. */
export default function SidebarLink({ item, href, active, onItemClick }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      {...guardedLinkHandlers(() => onItemClick(item))}
      className={`flex items-center justify-between px-3 py-1.5 rounded-md text-[11px] transition-all truncate border-l-[3px] ${
        active
          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black border-emerald-500 shadow-xs'
          : 'border-transparent text-base-content/70 hover:text-base-content hover:bg-base-200 font-medium'
      }`}
    >
      <span className="truncate">{item.label}</span>
      <LinkMarker active={active} />
    </Link>
  );
}
