'use client';

/* Setup route page (/batch/setup/dyeing | flat | unit): the old #setupView with its three panels
   (Dyeing MC, Flat Allowance, Unit Setup) and the Not Possible Fabric dialog. The route gives the panel;
   selectSetupPanel(panel) keeps S.activeSetupPanel in step and builds the panel's draft (old renderSetupPanels). */
import React, { useEffect } from 'react';
import BatchHeader from '@/features/batch/components/shell/BatchHeader';
import { S, closeFabricPicker, selectSetupPanel, useBatchVersion } from '@/features/batch/lib';
import type { SetupPanel } from '@/features/batch/lib';
import MachineSetupPanel from './MachineSetupPanel';
import FlatAllowancePanel from './FlatAllowancePanel';
import UnitSetupPanel from './UnitSetupPanel';
import FabricPickerDialog from './FabricPickerDialog';

export default function BatchSetupPage({ panel }: { panel: SetupPanel }) {
  useBatchVersion();
  // A data reload (initializeStorage) drops a draft without unsaved edits; it is built again from the new data,
  // as the old initializeStorage did with renderMachineSetup().
  const draftMissing = panel === 'dyeing' ? S.setupDraft === null : panel === 'flat' ? S.flatAllowanceDraft === null : false;

  useEffect(() => {
    selectSetupPanel(panel);
  }, [panel, draftMissing]);

  // Leaving the Setup page closes an open Not Possible Fabric dialog (its OK only changes the draft).
  useEffect(
    () => () => {
      if (S.fabricPickerState) closeFabricPicker();
    },
    []
  );

  return (
    <>
      <BatchHeader eyebrow="Data Management" title="Setup" badge="Storage Active" />
      <div id="setupView">
        {panel === 'dyeing' && <MachineSetupPanel />}
        {panel === 'unit' && <UnitSetupPanel />}
        {panel === 'flat' && <FlatAllowancePanel />}
      </div>
      <FabricPickerDialog />
    </>
  );
}
