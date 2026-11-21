import type { Dispatch, SetStateAction } from 'react';
import { findUpstreamPlans, type Loose } from '@/features/planning/lib/order-plan-logic';

export interface DeptPlanLogicContext {
  dept: string;
  orderNo: string;
  order: Loose;
  planData: Loose;
  planItems: Loose[];
  setPlanItems: Dispatch<SetStateAction<Loose[]>>;
  orderStatus: string;
  setOrderStatus: Dispatch<SetStateAction<string>>;
  isAdmin: boolean;
  showToast: (message: string, type?: 'error' | 'success') => void;
}

/**
 * One department's plan rules, moved unchanged from OrderPlanningScreen.tsx.
 * A plain function, not a hook: the screen builds it on every render from that render's state,
 * so every handler reads the current values, exactly as the inline code did.
 */
export function createDeptPlanLogic(ctx: DeptPlanLogicContext) {
  const { dept, orderNo, order, planData, planItems, setPlanItems, orderStatus, setOrderStatus, isAdmin, showToast } = ctx;

  // Helper to extract upstream Knitting and Dyeing plans for cross-department checks
  const getUpstreamPlans = (item: Loose) => findUpstreamPlans(planData, item);

  // ==========================================================
  // EXACT EXP CONDITIONS (from detailed-view.js & table-headers.js)
  // ==========================================================

  // 1. isValidStartDate (Exp detailed-view.js lines 640-662)
  const isValidStartDate = (item: Loose, newStart: string): boolean => {
    if (!newStart) return true;
    const endVal = item.endDate;
    if (newStart && endVal && new Date(newStart) > new Date(endVal)) {
      showToast('Start Date cannot be greater than End Date!');
      return false;
    }

    if (dept === 'dyeing' && newStart) {
      const { knitItem } = getUpstreamPlans(item);
      const knitStart = knitItem?.startDate || knitItem?.planStart;
      const knitEnd = knitItem?.endDate || knitItem?.planEnd;
      const knitType = knitItem?.planType;

      if (!knitStart && !knitEnd && (!knitType || knitType === 'Select' || knitType === '')) {
        showToast('Cannot set Dyeing plan because Knitting plan is blank!');
        return false;
      }

      if (knitStart && knitStart !== '-' && new Date(newStart).setHours(0, 0, 0, 0) < new Date(knitStart).setHours(0, 0, 0, 0)) {
        showToast('Dyeing Start Date cannot be less than Knitting Start Date!');
        return false;
      }
    }

    return true;
  };

  // 2. isValidEndDate (Exp detailed-view.js lines 664-686)
  const isValidEndDate = (item: Loose, newEnd: string): boolean => {
    if (!newEnd) return true;
    const startVal = item.startDate;
    if (startVal && newEnd && new Date(startVal) > new Date(newEnd)) {
      showToast('Start Date cannot be greater than End Date!');
      return false;
    }

    if (dept === 'dyeing' && newEnd) {
      const { knitItem } = getUpstreamPlans(item);
      const knitStart = knitItem?.startDate || knitItem?.planStart;
      const knitEnd = knitItem?.endDate || knitItem?.planEnd;
      const knitType = knitItem?.planType;

      if (!knitStart && !knitEnd && (!knitType || knitType === 'Select' || knitType === '')) {
        showToast('Cannot set Dyeing plan because Knitting plan is blank!');
        return false;
      }

      if (knitEnd && knitEnd !== '-' && new Date(newEnd).setHours(0, 0, 0, 0) < new Date(knitEnd).setHours(0, 0, 0, 0)) {
        showToast('Dyeing End Date cannot be less than Knitting End Date!');
        return false;
      }
    }

    return true;
  };

  // 3. isValidPlanType (Exp detailed-view.js lines 688-728)
  const isValidPlanType = (item: Loose, startVal: string, endVal: string, planTypeVal: string): boolean => {
    if (!planTypeVal || planTypeVal === 'Select') return true;

    // Both Start and End are required
    if ((planTypeVal === 'Confirm' || planTypeVal === 'Tentative') && (!startVal || !endVal)) {
      showToast('Start and End dates are required to set Plan Type.');
      return false;
    }

    // Knitting specific: Confirm requires Yarn Date (table-headers.js line 221)
    if (dept === 'knitting' && planTypeVal === 'Confirm') {
      const yarnVal = item.yarnDate;
      if (!yarnVal || yarnVal === '-' || yarnVal === 'N/A') {
        showToast("Without Yarn Date input, Knitting Plan Type cannot be 'Confirm'!");
        return false;
      }
    }

    // Dyeing specific: checks knitting plan and final confirmation
    if (dept === 'dyeing' && planTypeVal) {
      const { knitItem } = getUpstreamPlans(item);
      const knitStart = knitItem?.startDate || knitItem?.planStart;
      const knitEnd = knitItem?.endDate || knitItem?.planEnd;
      const knitType = String(knitItem?.planType || '').trim();

      if (!knitStart && !knitEnd && (!knitType || knitType === 'Select' || knitType === '')) {
        showToast('Cannot set Dyeing plan because Knitting plan is blank!');
        return false;
      }

      if (planTypeVal === 'Confirm' && knitType === 'Tentative') {
        showToast('Cannot confirm Dyeing when Knitting is Tentative.');
        return false;
      }

      if (planTypeVal === 'Confirm') {
        const finalConf = String(order?.finalConfirmation || '').trim().toLowerCase();
        if (finalConf === 'no') {
          showToast("Cannot confirm Dyeing because Final Confirmation is 'No'.");
          return false;
        }
      }
    }

    // Delivery specific: Confirm requires Dyeing not Tentative or blank
    if (dept === 'delivery' && planTypeVal) {
      const { dyeItem } = getUpstreamPlans(item);
      const dyeType = String(dyeItem?.planType || '').trim();

      if (planTypeVal === 'Confirm' && (dyeType === 'Tentative' || dyeType === '-' || dyeType === '')) {
        showToast('Cannot confirm Delivery when Dyeing is Tentative or blank.');
        return false;
      }
    }

    return true;
  };

  // ==========================================================
  // EVENT HANDLERS WITH EXP CASCADING AUTO-FILL (index === 0)
  // ==========================================================

  // 1. Yarn Date Change (Knitting) - Exp table-headers.js autoFillYarnDate
  const handleYarnDateChange = (index: number, val: string) => {
    setPlanItems((prev) => {
      const next = [...prev];
      if (index === 0) {
        return next.map((it) => {
          const updated = { ...it, yarnDate: val };
          if (!val && updated.planType === 'Confirm') {
            updated.planType = '';
          }
          if (val && updated.startDate && updated.startDate < val) {
            updated.startDate = val;
          }
          if (val && updated.endDate && updated.endDate < (updated.startDate || val)) {
            updated.endDate = updated.startDate || val;
          }
          return updated;
        });
      } else {
        const updated = { ...next[index], yarnDate: val };
        if (!val && updated.planType === 'Confirm') {
          updated.planType = '';
          showToast("Without Yarn Date input, Knitting Plan Type cannot be 'Confirm'!");
        }
        if (val && updated.startDate && updated.startDate < val) {
          updated.startDate = val;
        }
        if (val && updated.endDate && updated.endDate < (updated.startDate || val)) {
          updated.endDate = updated.startDate || val;
        }
        next[index] = updated;
        return next;
      }
    });

    if (index === 0 && !val) {
      showToast("Without Yarn Date input, Knitting Plan Type cannot be 'Confirm'!");
    }
  };

  // 2. Start Date Change - Exp detailed-view.js lines 730-755 & YD syncFloorDates
  const handleStartDateChange = (index: number, newStart: string) => {
    const currentItem = planItems[index];

    if (!isValidStartDate(currentItem, newStart)) {
      setPlanItems((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], startDate: '' };
        return next;
      });
      return;
    }

    setPlanItems((prev) => {
      const next = [...prev];
      if (index === 0) {
        return next.map((it) => {
          const updated = { ...it, startDate: newStart };
          if (updated.endDate && updated.endDate < newStart) {
            updated.endDate = newStart;
          }
          // YD Floor Sync (table-headers.js lines 263-288: floorStart = startDate - 4 days)
          if (dept === 'yd') {
            if (newStart) {
              const d = new Date(newStart);
              d.setDate(d.getDate() - 4);
              updated.floorStartDate = d.toISOString().split('T')[0];
            } else {
              updated.floorStartDate = '';
            }
          }
          if (!isValidPlanType(updated, newStart, updated.endDate, updated.planType)) {
            updated.planType = '';
          }
          return updated;
        });
      } else {
        const updated = { ...next[index], startDate: newStart };
        if (updated.endDate && updated.endDate < newStart) {
          updated.endDate = newStart;
        }
        if (dept === 'yd') {
          if (newStart) {
            const d = new Date(newStart);
            d.setDate(d.getDate() - 4);
            updated.floorStartDate = d.toISOString().split('T')[0];
          } else {
            updated.floorStartDate = '';
          }
        }
        if (!isValidPlanType(updated, newStart, updated.endDate, updated.planType)) {
          updated.planType = '';
        }
        next[index] = updated;
        return next;
      }
    });
  };

  // 3. End Date Change - Exp detailed-view.js lines 757-782 & YD syncFloorDates
  const handleEndDateChange = (index: number, newEnd: string) => {
    const currentItem = planItems[index];

    if (!isValidEndDate(currentItem, newEnd)) {
      setPlanItems((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], endDate: '' };
        return next;
      });
      return;
    }

    setPlanItems((prev) => {
      const next = [...prev];
      if (index === 0) {
        return next.map((it) => {
          const updated = { ...it, endDate: newEnd };
          if (dept === 'yd') {
            if (newEnd) {
              const d = new Date(newEnd);
              d.setDate(d.getDate() - 4);
              updated.floorEndDate = d.toISOString().split('T')[0];
            } else {
              updated.floorEndDate = '';
            }
          }
          if (!isValidPlanType(updated, updated.startDate, newEnd, updated.planType)) {
            updated.planType = '';
          }
          return updated;
        });
      } else {
        const updated = { ...next[index], endDate: newEnd };
        if (dept === 'yd') {
          if (newEnd) {
            const d = new Date(newEnd);
            d.setDate(d.getDate() - 4);
            updated.floorEndDate = d.toISOString().split('T')[0];
          } else {
            updated.floorEndDate = '';
          }
        }
        if (!isValidPlanType(updated, updated.startDate, newEnd, updated.planType)) {
          updated.planType = '';
        }
        next[index] = updated;
        return next;
      }
    });
  };

  // 4. Plan Type Change - Exp detailed-view.js lines 784-818
  const handlePlanTypeChange = (index: number, newPlan: string) => {
    const currentItem = planItems[index];

    if (!isValidPlanType(currentItem, currentItem.startDate, currentItem.endDate, newPlan)) {
      setPlanItems((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], planType: '' };
        return next;
      });
      return;
    }

    setPlanItems((prev) => {
      const next = [...prev];
      if (index === 0) {
        return next.map((it, idx) => {
          if (idx === 0) {
            return { ...it, planType: newPlan };
          }
          if (!newPlan) {
            return { ...it, planType: '' };
          }
          if (isValidPlanType(it, it.startDate, it.endDate, newPlan)) {
            return { ...it, planType: newPlan };
          } else {
            return { ...it, planType: '' };
          }
        });
      } else {
        next[index] = { ...next[index], planType: newPlan };
        return next;
      }
    });
  };

  // 5. Unit / Process Cascading (Dyeing / Finishing) - Exp detailed-view.js lines 603-631
  const handleUnitProcessChange = (index: number, field: 'unit' | 'processName', value: string) => {
    setPlanItems((prev) => {
      const next = [...prev];
      if (index === 0) {
        return next.map((it) => ({ ...it, [field]: value }));
      } else {
        next[index] = { ...next[index], [field]: value };
        return next;
      }
    });
  };

  // 6. Floor Planning Cascading (Delivery & YD) - Exp detailed-view.js lines 820-857
  const handleFloorChange = (index: number, field: 'floorStartDate' | 'floorEndDate' | 'floorPlanType', value: string) => {
    setPlanItems((prev) => {
      const next = [...prev];
      if (index === 0) {
        return next.map((it) => ({ ...it, [field]: value }));
      } else {
        next[index] = { ...next[index], [field]: value };
        return next;
      }
    });
  };

  // 7. YD Yarn Ok Date & Matching Option Date Cascading
  const handleYarnOkDateChange = (index: number, val: string) => {
    setPlanItems((prev) => {
      const next = [...prev];
      if (index === 0) {
        return next.map((it) => ({ ...it, yarnOkDate: val }));
      } else {
        next[index] = { ...next[index], yarnOkDate: val };
        return next;
      }
    });
  };

  const handleMatchingOptionDateChange = (index: number, val: string) => {
    setPlanItems((prev) => {
      const next = [...prev];
      if (index === 0) {
        return next.map((it) => ({ ...it, matchingOptionDate: val }));
      } else {
        next[index] = { ...next[index], matchingOptionDate: val };
        return next;
      }
    });
  };

  // 8. Custom Qty change for YD (Barrier Qty, Workable Qty)
  const handleCustomQtyChange = (index: number, field: 'barrierQty' | 'workableQty', val: string) => {
    setPlanItems((prev) => {
      const next = [...prev];
      const itemDataKey = field === 'barrierQty' ? 'Barrier Qty.' : 'Workable Qty.';
      const updatedItemData = { ...(next[index].itemData || {}), [itemDataKey]: val };
      next[index] = { ...next[index], [field]: val, itemData: updatedItemData };
      return next;
    });
  };

  // Generic limitation / remarks update
  const handleTextChange = (index: number, field: 'limitation' | 'remarks', value: string) => {
    setPlanItems((prev) => {
      const next = [...prev];
      if (index === 0) {
        return next.map((it) => ({ ...it, [field]: value }));
      } else {
        next[index] = { ...next[index], [field]: value };
        return next;
      }
    });
  };

  // ==========================================================
  // COMPREHENSIVE SAVE PLANNING VALIDATION (Exp save-planning.js)
  // ==========================================================
  const validateForSave = (): boolean => {
    if (planItems.length === 0) {
      showToast('No fabric items to save! Please upload department data first.');
      return false;
    }

    let validationFailed = false;

    // Check downstream department confirmation lock (save-planning.js lines 23-35)
    const checkDownstreamConfirm = (itemId: string) => {
      if (!planData) return false;
      if (dept === 'dyeing' && planData.delivery) {
        const del = planData.delivery.find((d: Loose) => d.itemId === itemId);
        return del && del.planType === 'Confirm';
      }
      if (dept === 'knitting' && planData.dyeing) {
        const dye = planData.dyeing.find((d: Loose) => d.itemId === itemId);
        return dye && dye.planType === 'Confirm';
      }
      return false;
    };

    const savedMap = new Map();
    ((planData && planData[dept]) || []).forEach((it: Loose) => {
      if (it.itemId) savedMap.set(it.itemId, it);
    });

    for (const item of planItems) {
      const itemId = item.itemId;
      const existing = savedMap.get(itemId);
      const wasConfirmed = existing && existing.planType === 'Confirm';

      // 1. Only admin can revert or modify a Confirmed plan
      if (wasConfirmed && !isAdmin && item.planType !== 'Confirm') {
        showToast('Save failed: Only Admin can change a Confirmed plan!');
        validationFailed = true;
        break;
      }

      // 2. Downstream confirmation lock for non-admin
      if (!isAdmin && checkDownstreamConfirm(itemId)) {
        const wasStart = existing ? existing.startDate : '';
        const wasEnd = existing ? existing.endDate : '';
        const wasType = existing ? existing.planType : '';

        if (item.startDate !== wasStart || item.endDate !== wasEnd || item.planType !== wasType) {
          showToast(`Save failed: Cannot change ${dept} because the next department is already Confirmed!`);
          validationFailed = true;
          break;
        }
      }

      // 3. Start > End date
      if (item.startDate && item.endDate && new Date(item.startDate) > new Date(item.endDate)) {
        showToast('Save failed: End date cant be less than start date.');
        validationFailed = true;
        break;
      }

      // 4. Floor start > Floor end
      if (item.floorStartDate && item.floorEndDate && new Date(item.floorStartDate) > new Date(item.floorEndDate)) {
        showToast('Save failed: End date cant be less than start date.');
        validationFailed = true;
        break;
      }

      // 5. Plan type selected without start or end date
      if ((item.planType === 'Confirm' || item.planType === 'Tentative') && (!item.startDate || !item.endDate)) {
        showToast('Save failed: Plan Type selected without Start and End dates.');
        validationFailed = true;
        break;
      }

      // 6. Knitting specific checks
      if (dept === 'knitting') {
        if (item.planType === 'Confirm' && (!item.yarnDate || item.yarnDate === '-' || item.yarnDate === 'N/A')) {
          showToast("Save failed: Without Yarn Date input, Knitting Plan Type cannot be 'Confirm'!");
          validationFailed = true;
          break;
        }
        if (item.startDate && item.yarnDate && item.yarnDate !== '-' && item.yarnDate !== 'N/A') {
          if (new Date(item.startDate).setHours(0, 0, 0, 0) < new Date(item.yarnDate).setHours(0, 0, 0, 0)) {
            showToast('Save failed: Knitting Planning Start Date cannot be less than Yarn Date!');
            validationFailed = true;
            break;
          }
        }
      }

      // 7. Dyeing specific checks
      if (dept === 'dyeing') {
        const { knitItem } = getUpstreamPlans(item);
        const knitType = knitItem?.planType;
        const knitStart = knitItem?.startDate || knitItem?.planStart;
        const knitEnd = knitItem?.endDate || knitItem?.planEnd;

        const hasDyePlanInput = Boolean(item.startDate || item.endDate || (item.planType && item.planType !== 'Select'));

        if (hasDyePlanInput && (!knitType || knitType === 'Select' || knitType === '-' || knitType === '')) {
          showToast('Save failed: Knitting Plan type selection is mandatory before inputting Dyeing plan!');
          validationFailed = true;
          break;
        }

        if (item.startDate && knitStart && knitStart !== '-' && new Date(item.startDate).setHours(0, 0, 0, 0) < new Date(knitStart).setHours(0, 0, 0, 0)) {
          showToast('Save failed: Dyeing Start Date cannot be before Knitting Start Date!');
          validationFailed = true;
          break;
        }

        if (item.endDate && knitEnd && knitEnd !== '-' && new Date(item.endDate).setHours(0, 0, 0, 0) < new Date(knitEnd).setHours(0, 0, 0, 0)) {
          showToast('Save failed: Dyeing End Date cannot be before Knitting End Date!');
          validationFailed = true;
          break;
        }
      }

      // 8. Delivery specific checks
      if (dept === 'delivery') {
        const { dyeItem } = getUpstreamPlans(item);
        const dyeType = dyeItem?.planType;
        const dyeStart = dyeItem?.startDate || dyeItem?.planStart;
        const dyeEnd = dyeItem?.endDate || dyeItem?.planEnd;

        const hasDeliPlanInput = Boolean(
          item.startDate || item.endDate || (item.planType && item.planType !== 'Select') || item.floorStartDate || item.floorEndDate
        );

        if (hasDeliPlanInput && (!dyeType || dyeType === 'Select' || dyeType === '-' || dyeType === '')) {
          showToast('Save failed: Dyeing Plan type selection is mandatory before inputting Delivery plan!');
          validationFailed = true;
          break;
        }

        const isDyeingBlank = !dyeStart || dyeStart === '-' || dyeStart === '';
        if (hasDeliPlanInput && isDyeingBlank) {
          showToast('Save failed: Cannot input Delivery. Dyeing plan is missing!');
          validationFailed = true;
          break;
        }

        if (item.startDate && dyeStart && dyeStart !== '-' && new Date(item.startDate).setHours(0, 0, 0, 0) < new Date(dyeStart).setHours(0, 0, 0, 0)) {
          showToast('Save failed: Delivery Start Date cannot be before Dyeing Start Date!');
          validationFailed = true;
          break;
        }

        if (item.endDate && dyeEnd && dyeEnd !== '-' && new Date(item.endDate).setHours(0, 0, 0, 0) < new Date(dyeEnd).setHours(0, 0, 0, 0)) {
          showToast('Save failed: Delivery End Date cannot be before Dyeing End Date!');
          validationFailed = true;
          break;
        }
      }
    }

    return !validationFailed;
  };

  const confirmCompletion = (): boolean => {
    // Confirm when marking order as Completed (save-planning.js line 171)
    const prevStatus = planData?.[`${dept}Status`] || 'On Process';
    const finalStatus = orderStatus;
    if (finalStatus === 'Completed' && prevStatus !== 'Completed') {
      if (!confirm(`Are you sure you want to mark order '${orderNo}' as Completed? It will be moved to the Completed List.`)) {
        setOrderStatus(prevStatus);
        return false;
      }
    }
    return true;
  };

  return {
    getUpstreamPlans,
    handleYarnDateChange,
    handleStartDateChange,
    handleEndDateChange,
    handlePlanTypeChange,
    handleUnitProcessChange,
    handleFloorChange,
    handleYarnOkDateChange,
    handleMatchingOptionDateChange,
    handleCustomQtyChange,
    handleTextChange,
    validateForSave,
    confirmCompletion,
  };
}

export type DeptPlanLogic = ReturnType<typeof createDeptPlanLogic>;
