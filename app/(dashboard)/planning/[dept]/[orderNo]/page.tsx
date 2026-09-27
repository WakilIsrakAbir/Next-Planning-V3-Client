'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Calendar,
  Sparkles,
  Info,
} from 'lucide-react';
import ExpLoadingSpinner from '@/components/common/ExpLoadingSpinner';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const DEPARTMENTS: Record<string, { name: string; label: string }> = {
  knitting: { name: 'Knitting Plan', label: 'Knitting' },
  dyeing: { name: 'Dyeing Plan', label: 'Dyeing' },
  finishing: { name: 'Finishing Plan', label: 'Finishing' },
  delivery: { name: 'Delivery Plan', label: 'Delivery' },
  yd: { name: 'YD Plan', label: 'YD' },
};

function formatDateDisplay(d: any): string {
  if (!d || d === '-' || d === 'N/A') return '—';
  try {
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return String(d);
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = parsed.toLocaleString('en-US', { month: 'short' });
    const year = parsed.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return String(d);
  }
}

export default function OrderPlanningDetailPage() {
  const params = useParams();
  const router = useRouter();

  const dept = (params.dept as string)?.toLowerCase() || 'knitting';
  const orderNo = params.orderNo as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [planData, setPlanData] = useState<any>(null);
  const [planItems, setPlanItems] = useState<any[]>([]);
  const [orderStatus, setOrderStatus] = useState<string>('On Process');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Dynamic dropdown options for Dyeing / Finishing
  const [unitOptions, setUnitOptions] = useState<string[]>(['EFL', 'EKL', 'Ext', 'Outside']);
  const [processOptions, setProcessOptions] = useState<string[]>([
    'Solid',
    'Dyeing Wash',
    'HTR',
    'Pluvia',
    'SB',
    'WH',
    'DF',
  ]);

  const deptMeta = DEPARTMENTS[dept] || { name: dept.toUpperCase(), label: dept };

  // 1. Resolve Admin / Approver Role accurately from localStorage user object
  useEffect(() => {
    let role = '';
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        role = u.role || '';
      }
    } catch {}
    if (!role) {
      role = localStorage.getItem('role') || localStorage.getItem('userRole') || '';
    }
    const isUserAdmin = role.toLowerCase() === 'admin' || role.toLowerCase() === 'approver';
    setIsAdmin(isUserAdmin);
  }, []);

  const showToast = (message: string, type: 'error' | 'success' = 'error') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3800);
  };

  useEffect(() => {
    fetchOrderAndDropdowns();
  }, [dept, orderNo]);

  const fetchOrderAndDropdowns = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch dropdown options
      try {
        const ddRes = await fetch(`${API_BASE}/api/dropdowns`, { headers });
        if (ddRes.ok) {
          const ddData = await ddRes.json();
          if (ddData.units && ddData.units.length > 0) {
            setUnitOptions(ddData.units.map((u: any) => u.name));
          }
          if (ddData.processes && ddData.processes.length > 0) {
            setProcessOptions(ddData.processes.map((p: any) => p.name));
          }
        }
      } catch (e) {
        console.error('Failed to load dropdowns:', e);
      }

      // 2. Fetch Order Details
      const res = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(orderNo)}?dept=${dept}`, {
        headers,
      });

      if (!res.ok) {
        throw new Error(`Failed to load order #${orderNo}`);
      }

      const data = await res.json();
      const currentOrder = data.order || {};
      const currentPlan = data.planData || {};

      setOrder(currentOrder);
      setPlanData(currentPlan);

      if (currentPlan[`${dept}Status`]) {
        setOrderStatus(currentPlan[`${dept}Status`]);
      } else {
        setOrderStatus('On Process');
      }

      // Merge raw items with saved plan data
      const excelItems = currentOrder[`${dept}Items`] || [];
      const savedItems = (currentPlan && currentPlan[dept]) || [];
      const planMap = new Map();
      savedItems.forEach((it: any) => {
        if (it.itemId) planMap.set(it.itemId, it);
      });

      const merged = excelItems.map((ex: any, idx: number) => {
        const itemId = ex.itemId || `row-${idx}`;
        const saved = planMap.get(itemId) || {};

        return {
          ...ex,
          itemId,
          // Editable planning fields
          planType: saved.planType || ex.planType || '',
          startDate: saved.startDate || saved.planStart || ex.startDate || '',
          endDate: saved.endDate || saved.planEnd || ex.endDate || '',
          unit: saved.unit || ex.Unit || '',
          processName: saved.processName || ex.ProcessName || ex['Process Name'] || '',
          limitation: saved.limitation || ex.limitation || '',
          remarks: saved.remarks || ex.remarks || '',
          // Knitting yarn date
          yarnDate: saved.yarnDate || ex.yarnDate || '',
          // Delivery & YD Floor Planning
          yarnOkDate: saved.yarnOkDate || ex.yarnOkDate || '',
          matchingOptionDate: saved.matchingOptionDate || ex.matchingOptionDate || '',
          floorStartDate: saved.floorStartDate || ex.floorStartDate || '',
          floorEndDate: saved.floorEndDate || ex.floorEndDate || '',
          floorPlanType: saved.floorPlanType || ex.floorPlanType || '',
        };
      });

      // Parity with Exp detailed-view.js lines 361-380: Delivery Floor default dates from Dyeing plan
      if (dept === 'delivery') {
        merged.forEach((item: any) => {
          const myColor = String(item.Color || item['Color'] || item['Colour'] || '').trim().toLowerCase();
          const dItem = currentPlan?.dyeing?.find((d: any) => {
            const c = String(d.Color || (d.itemData && d.itemData.Color) || '').trim().toLowerCase();
            return c === myColor;
          });
          const hasDyePlanType = Boolean(
            dItem?.planType && dItem.planType !== 'Select' && dItem.planType !== '-' && dItem.planType !== ''
          );

          if (hasDyePlanType) {
            const dyeStart = dItem?.startDate || dItem?.planStart;
            const dyeEnd = dItem?.endDate || dItem?.planEnd;

            if (!item.floorStartDate && dyeStart) {
              const d = new Date(dyeStart);
              d.setDate(d.getDate() + 7);
              item.floorStartDate = d.toISOString().split('T')[0];
            }
            if (!item.floorEndDate && dyeEnd) {
              const d = new Date(dyeEnd);
              d.setDate(d.getDate() + 7);
              item.floorEndDate = d.toISOString().split('T')[0];
            }
            if (!item.floorPlanType) {
              item.floorPlanType = 'Tentative';
            }
          }
        });
      }

      setPlanItems(merged);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error loading order details.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to extract upstream Knitting and Dyeing plans for cross-department checks
  const getUpstreamPlans = (item: any) => {
    const myColor = String(item.Color || item['Color'] || item['Colour'] || '').trim().toLowerCase();
    const myConst = String(item.FabricConstruction || item['Fabric Construction'] || item['Construction'] || '').trim().toLowerCase();

    let knitItem: any = null;
    let dyeItem: any = null;

    if (planData?.knitting && Array.isArray(planData.knitting)) {
      knitItem = planData.knitting.find((k: any) => {
        const c = String(k.Color || (k.itemData && k.itemData.Color) || '').trim().toLowerCase();
        const fc = String(k.FabricConstruction || (k.itemData && k.itemData.FabricConstruction) || '').trim().toLowerCase();
        if (myConst && fc) {
          return c === myColor && fc === myConst;
        }
        return c === myColor;
      });
      if (!knitItem) {
        knitItem = planData.knitting.find((k: any) => {
          const c = String(k.Color || (k.itemData && k.itemData.Color) || '').trim().toLowerCase();
          return c === myColor;
        });
      }
    }

    if (planData?.dyeing && Array.isArray(planData.dyeing)) {
      dyeItem = planData.dyeing.find((d: any) => {
        const c = String(d.Color || (d.itemData && d.itemData.Color) || '').trim().toLowerCase();
        return c === myColor;
      });
    }

    const isKnitTypeSelected = Boolean(
      knitItem?.planType && knitItem.planType !== 'Select' && knitItem.planType !== '-' && knitItem.planType !== ''
    );
    const isDyeTypeSelected = Boolean(
      dyeItem?.planType && dyeItem.planType !== 'Select' && dyeItem.planType !== '-' && dyeItem.planType !== ''
    );

    return { knitItem, dyeItem, isKnitTypeSelected, isDyeTypeSelected };
  };

  // ==========================================================
  // EXACT EXP CONDITIONS (from detailed-view.js & table-headers.js)
  // ==========================================================

  // 1. isValidStartDate (Exp detailed-view.js lines 640-662)
  const isValidStartDate = (item: any, newStart: string): boolean => {
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
  const isValidEndDate = (item: any, newEnd: string): boolean => {
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
  const isValidPlanType = (item: any, startVal: string, endVal: string, planTypeVal: string): boolean => {
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
        // Cascades to all rows
        return next.map((it) => {
          const updated = { ...it, yarnDate: val };
          // If yarn date removed and planType was Confirm, reset it
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

  // 2. Start Date Change - Exp detailed-view.js lines 730-755
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
        // Row 1 changes: auto-fill all items if valid
        return next.map((it, idx) => {
          if (idx === 0) {
            const updated = { ...it, startDate: newStart };
            if (updated.endDate && updated.endDate < newStart) {
              updated.endDate = newStart;
            }
            if (!isValidPlanType(updated, newStart, updated.endDate, updated.planType)) {
              updated.planType = '';
            }
            return updated;
          }

          if (isValidStartDate(it, newStart)) {
            const updated = { ...it, startDate: newStart };
            if (updated.endDate && updated.endDate < newStart) {
              updated.endDate = newStart;
            }
            if (!isValidPlanType(updated, newStart, updated.endDate, updated.planType)) {
              updated.planType = '';
            }
            return updated;
          } else {
            return { ...it, startDate: '' };
          }
        });
      } else {
        const updated = { ...next[index], startDate: newStart };
        if (updated.endDate && updated.endDate < newStart) {
          updated.endDate = newStart;
        }
        if (!isValidPlanType(updated, newStart, updated.endDate, updated.planType)) {
          updated.planType = '';
        }
        next[index] = updated;
        return next;
      }
    });
  };

  // 3. End Date Change - Exp detailed-view.js lines 757-782
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
        return next.map((it, idx) => {
          if (idx === 0) {
            const updated = { ...it, endDate: newEnd };
            if (!isValidPlanType(updated, updated.startDate, newEnd, updated.planType)) {
              updated.planType = '';
            }
            return updated;
          }

          if (isValidEndDate(it, newEnd)) {
            const updated = { ...it, endDate: newEnd };
            if (!isValidPlanType(updated, updated.startDate, newEnd, updated.planType)) {
              updated.planType = '';
            }
            return updated;
          } else {
            return { ...it, endDate: '' };
          }
        });
      } else {
        const updated = { ...next[index], endDate: newEnd };
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

  // 5. Unit / Process Cascading (Dyeing) - Exp detailed-view.js lines 603-631
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

  // 6. Floor Planning Cascading (Delivery) - Exp detailed-view.js lines 820-857
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

  // Generic limitation / remarks update
  const handleTextChange = (index: number, field: 'limitation' | 'remarks', value: string) => {
    setPlanItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // ==========================================================
  // COMPREHENSIVE SAVE PLANNING VALIDATION (Exp save-planning.js)
  // ==========================================================
  const handleSavePlanning = async () => {
    if (planItems.length === 0) {
      showToast('No fabric items to save! Please upload department data first.');
      return;
    }

    let validationFailed = false;

    // Check downstream department confirmation lock (save-planning.js lines 23-35)
    const checkDownstreamConfirm = (itemId: string) => {
      if (!planData) return false;
      if (dept === 'dyeing' && planData.delivery) {
        const del = planData.delivery.find((d: any) => d.itemId === itemId);
        return del && del.planType === 'Confirm';
      }
      if (dept === 'knitting' && planData.dyeing) {
        const dye = planData.dyeing.find((d: any) => d.itemId === itemId);
        return dye && dye.planType === 'Confirm';
      }
      return false;
    };

    const savedMap = new Map();
    ((planData && planData[dept]) || []).forEach((it: any) => {
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

    if (validationFailed) return;

    // Confirm when marking order as Completed (save-planning.js line 171)
    const prevStatus = planData?.[`${dept}Status`] || 'On Process';
    let finalStatus = orderStatus;
    if (finalStatus === 'Completed' && prevStatus !== 'Completed') {
      if (!confirm(`Are you sure you want to mark order '${orderNo}' as Completed? It will be moved to the Completed List.`)) {
        setOrderStatus(prevStatus);
        return;
      }
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/orders/planning-dates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderNo,
          department: dept,
          fabricItems: planItems,
          orderStatus: finalStatus,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to save planning schedule.');
      }

      showToast(`Planning schedule successfully saved for Order #${orderNo}!`, 'success');
      // Refresh to update saved states
      fetchOrderAndDropdowns();
    } catch (err: any) {
      showToast(err.message || 'Error saving planning schedule.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center flex-col">
        <ExpLoadingSpinner
          message={`Loading detailed planning schedule for Order #${orderNo}...`}
          subMessage="Fetching synchronized item milestones and master dropdown options"
          overlay={false}
        />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto">
        <AlertCircle className="h-12 w-12 text-error mx-auto mb-3" />
        <h2 className="text-xl font-bold">Order Not Found</h2>
        <p className="text-xs text-base-content/60 mt-1 mb-4">
          The requested Order #{orderNo} was not found in the {deptMeta.name} registry.
        </p>
        <Link href={`/planning/${dept}`} className="btn btn-primary btn-sm">
          <ArrowLeft className="h-4 w-4 mr-1" /> Return to Planning
        </Link>
      </div>
    );
  }

  // Calculate order quantity fallback
  const totalItemQty = planItems.reduce((acc, it) => {
    const q = Number(it.RequiredQtyKgs || it.requiredQtyKgs || it['Req Qty'] || it.Qty || 0);
    return acc + (isNaN(q) ? 0 : q);
  }, 0);
  const displayQty = order.requiredQtyKgs || (totalItemQty > 0 ? totalItemQty : '—');

  return (
    <div className="space-y-4 pb-20 max-w-[1850px] mx-auto animate-fade-in text-[11px]">
      {/* Toast alert notification matching Exp */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-bounce">
          <div
            className={`alert ${
              toast.type === 'success' ? 'alert-success' : 'alert-error'
            } shadow-lg text-xs font-bold py-2.5 px-4 rounded border`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Top Header Bar matching Exp index.html lines 1381-1398 */}
      <div className="bg-gray-100 dark:bg-[#1f2637] border-b border-gray-200 dark:border-[#2a3346] flex flex-col sm:flex-row items-start sm:items-center px-4 py-2 shrink-0 justify-between w-full gap-2 rounded-sm shadow-sm">
        <div className="flex items-center w-full sm:w-auto">
          <Link
            href={`/planning/${dept}`}
            className="mr-3 text-gray-700 dark:text-gray-300 hover:text-blue-600 transition"
            title="Back to Planning List"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate">
            Order Planning: <span className="text-blue-600 dark:text-blue-400 font-mono">{orderNo}</span>
            <span className="ml-2 px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-[10px] uppercase font-bold">
              {deptMeta.name}
            </span>
          </h3>
        </div>

        <div className="flex gap-2 w-full sm:w-auto justify-end items-center">
          <Link
            href={`/planning/${dept}`}
            className="px-3 md:px-4 py-1.5 border border-gray-300 dark:border-[#2a3346] text-xs font-bold rounded hover:bg-gray-200 dark:hover:bg-[#283347] text-gray-700 dark:text-gray-300 transition"
          >
            Back
          </Link>

          <button
            onClick={handleSavePlanning}
            disabled={saving}
            className="px-4 md:px-6 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save Planning
          </button>
        </div>
      </div>

      {/* ==========================================================
          GENERAL INFORMATION & PLANNING CARD
          Exact Replica of Exp index.html lines 1403-1478 & detailed-view.js lines 193-219
         ========================================================== */}
      <div className="bg-white dark:bg-[#151921] border border-gray-200 dark:border-[#2a3346] p-3 md:p-4 rounded-sm shadow-sm shrink-0 w-full max-w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-2.5">
          {/* Column 1 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                EWO No.
              </span>
              <input
                type="text"
                readOnly
                value={order.orderNo || ''}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none font-mono"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Booking No.
              </span>
              <input
                type="text"
                readOnly
                value={order.orderNo || ''}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none font-mono"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Booking Date
              </span>
              <input
                type="text"
                readOnly
                value={formatDateDisplay(order.bookingDate)}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Gmt Unit
              </span>
              <input
                type="text"
                readOnly
                value={order.gmtUnit || order.bookingUnit || ''}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none font-semibold"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Floor
              </span>
              <input
                type="text"
                readOnly
                value={order.floor || ''}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Final Confirmation
              </span>
              <input
                type="text"
                readOnly
                value={order.finalConfirmation || ''}
                className={`flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] font-bold outline-none ${
                  String(order.finalConfirmation).trim().toLowerCase() === 'no'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-green-600 dark:text-green-400'
                }`}
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                BP Status
              </span>
              <input
                type="text"
                readOnly
                value={order.bpStatus || ''}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                PMC
              </span>
              <input
                type="text"
                readOnly
                value={order.pmc || ''}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none font-medium"
              />
            </div>

            {/* Order Status matching Exp index.html lines 1426-1432 */}
            <div className="flex items-center mt-1 border border-blue-200 dark:border-blue-800 rounded p-1 bg-blue-50 dark:bg-blue-900/20">
              <span className="w-[115px] text-[11px] font-semibold text-blue-700 dark:text-blue-400 shrink-0">
                Order Status
              </span>
              <select
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1 border border-blue-300 dark:border-blue-700 rounded-sm bg-white dark:bg-[#151921] text-[11px] font-bold text-blue-700 dark:text-blue-400 cursor-pointer outline-none"
              >
                <option value="On Process">On Process</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Column 2 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Buyer Name(s)
              </span>
              <input
                type="text"
                readOnly
                value={order.buyer || 'N/A'}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] font-bold text-blue-700 dark:text-blue-400 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Buyer Team
              </span>
              <input
                type="text"
                readOnly
                value={order.buyerTeam || ''}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Booked By
              </span>
              <input
                type="text"
                readOnly
                value={order.bookedBy || order.bookingBy || ''}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Style
              </span>
              <input
                type="text"
                readOnly
                value={order.style || ''}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Order Qty. (Kg)
              </span>
              <input
                type="text"
                readOnly
                value={displayQty !== '—' ? Number(displayQty).toLocaleString() : '—'}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none font-mono font-bold"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Event Day
              </span>
              <input
                type="text"
                readOnly
                value={order.eventDay || ''}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                1st Shipment Date
              </span>
              <input
                type="text"
                readOnly
                value={formatDateDisplay(order.ship1)}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                Last Shipment Date
              </span>
              <input
                type="text"
                readOnly
                value={formatDateDisplay(order.shipLast)}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                T&A Yarn date
              </span>
              <input
                type="text"
                readOnly
                value={formatDateDisplay(order.yarnDate)}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none font-medium"
              />
            </div>
          </div>

          {/* Column 3 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                T&A Deli. Start
              </span>
              <input
                type="text"
                readOnly
                value={formatDateDisplay(order.deliStart)}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                T&A Deli. End
              </span>
              <input
                type="text"
                readOnly
                value={formatDateDisplay(order.deliEnd)}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                T&A Knitting Start
              </span>
              <input
                type="text"
                readOnly
                value={formatDateDisplay(order.knitStart)}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                T&A Knitting End
              </span>
              <input
                type="text"
                readOnly
                value={formatDateDisplay(order.knitEnd)}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                T&A Dyeing Start
              </span>
              <input
                type="text"
                readOnly
                value={formatDateDisplay(order.dyeStart)}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="w-[115px] text-[11px] font-semibold text-gray-600 dark:text-gray-400 shrink-0 truncate">
                T&A Dyeing End
              </span>
              <input
                type="text"
                readOnly
                value={formatDateDisplay(order.dyeEnd)}
                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[11px] text-gray-700 dark:text-gray-200 outline-none"
              />
            </div>

            {/* Fabric Notes matching Exp index.html lines 1471-1475 */}
            <div className="p-1 bg-gray-100 dark:bg-[#1f2637] text-center font-bold text-xs mt-1 border border-gray-200 dark:border-[#2a3346] text-gray-700 dark:text-gray-300">
              Fabric Notes
            </div>
            <textarea
              readOnly
              value={order.fabricNotes || ''}
              className="w-full h-11 p-1 border border-gray-300 dark:border-[#2a3346] rounded-sm bg-gray-50 dark:bg-[#181f2c] text-[10px] text-gray-700 dark:text-gray-200 outline-none resize-none"
            />
          </div>
        </div>
      </div>

      {/* ==========================================================
          DEPARTMENT FABRIC ITEMS TABLE (2-TIER EXP DESIGN)
         ========================================================== */}
      <div className="bg-white dark:bg-[#151921] border border-gray-200 dark:border-[#2a3346] rounded-sm shadow-sm overflow-hidden flex flex-col">
        <div className="bg-gray-100 dark:bg-[#1f2637] p-2 font-bold text-gray-800 dark:text-gray-200 text-xs flex items-center justify-between border-b border-gray-200 dark:border-[#2a3346]">
          <div className="flex items-center">
            <Layers className="h-4 w-4 text-blue-500 mr-2" />
            <span>Department Fabric Items</span>
            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
              {planItems.length}
            </span>
          </div>
          <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400 italic">
            Row 1 changes auto-fill all items below
          </span>
        </div>

        <div className="overflow-x-auto custom-scrollbar w-full">
          <table className="w-full text-left whitespace-nowrap border-collapse min-w-[1600px]">
            {/* 2-Tier Header Structure matching Exp table-headers.js */}
            <thead className="bg-white dark:bg-[#151921] shadow-sm select-none">
              {/* Main Top Header Row */}
              <tr className="text-[10px] font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-[#1f2637] border-b border-gray-300 dark:border-[#2a3346]">
                <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center w-8">
                  #
                </th>
                <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                  Color
                </th>

                {dept !== 'yd' && (
                  <>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[100px]">
                      FabricConstruction
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[60px]">
                      GSM
                    </th>
                  </>
                )}

                {/* YD Extra left cols */}
                {dept === 'yd' && (
                  <>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                      Booking Type
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      YDB#
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                      YD Booking Date
                    </th>
                  </>
                )}

                {/* Dyeing / Finishing: Unit & Process Name */}
                {(dept === 'dyeing' || dept === 'finishing') && (
                  <>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[100px]">
                      Unit
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[110px]">
                      Process Name
                    </th>
                  </>
                )}

                {/* Dyeing: Upstream Knitting Plan Columns (detailed-view.js line 307) */}
                {dept === 'dyeing' && (
                  <>
                    <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                      Knitting Planning
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Knit Plan Type
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[100px]">
                      Knit Limitation
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[100px]">
                      Knit Remarks
                    </th>
                  </>
                )}

                {/* Knitting: Yarn Date Column */}
                {dept === 'knitting' && (
                  <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-200 min-w-[95px]">
                    Yarn Date
                  </th>
                )}

                {/* Delivery: Floor Planning Columns (detailed-view.js lines 383-391) */}
                {dept === 'delivery' && (
                  <>
                    <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200">
                      Floor Planning
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                      Floor Plan Type
                    </th>
                  </>
                )}

                {/* Current Department Planning Block */}
                <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                  {dept === 'knitting'
                    ? 'Knitting Planning'
                    : dept === 'dyeing'
                    ? 'Dyeing Planning'
                    : dept === 'delivery'
                    ? 'Delivery Planning'
                    : dept === 'yd'
                    ? 'YD Planning'
                    : 'Finishing Planning'}
                </th>
                <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                  Plan Type
                </th>
                <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[120px]">
                  {dept === 'knitting'
                    ? 'Knitting Limitation'
                    : dept === 'dyeing'
                    ? 'Dyeing Limitation'
                    : dept === 'delivery'
                    ? 'Delivery Limitation'
                    : dept === 'yd'
                    ? 'YD Remarks'
                    : 'Finishing Limitation'}
                </th>
                <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[120px]">
                  Remarks
                </th>

                {/* Delivery: Upstream Dyeing & Knitting Planning columns */}
                {dept === 'delivery' && (
                  <>
                    <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                      Dyeing Planning
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                      Dyeing Plan Type
                    </th>
                    <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                      Knitting Planning
                    </th>
                  </>
                )}

                {/* Right Production & Balance Columns (Exp Parity) */}
                {dept === 'knitting' && (
                  <>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Grey Req.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Knit Prod.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px] text-orange-600 font-bold">
                      Knit. Bala.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Yarn req.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Allocated Qty
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Yarn bala.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Allowance %
                    </th>
                  </>
                )}

                {(dept === 'dyeing' || dept === 'finishing') && (
                  <>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      BP Qty
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Dyeing Prod.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px] text-orange-600 font-bold">
                      Dyeing Bala.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Knit Prod.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Knit. Bala.
                    </th>
                  </>
                )}

                {dept === 'delivery' && (
                  <>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      RequiredQtyKgs
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      NetReceivedQtyKgs
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      NetDeliveryQtyKgs
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px] text-orange-600 font-bold">
                      Deli. Bal.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      RFD
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Slowmoving
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      FF Stock
                    </th>
                  </>
                )}

                {dept === 'yd' && (
                  <>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Barrier Qty.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      Workable Qty.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      YD REQ.
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      DYED
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      YD BALANCE
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      YD Delivered
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px] text-red-600 font-bold">
                      YD DELIVERY BALANCE
                    </th>
                  </>
                )}
              </tr>

              {/* Sub-Header Row with Start Date / End Date labels */}
              <tr className="text-[9px] bg-gray-50 dark:bg-[#181f2c] border-b border-gray-300 dark:border-[#2a3346]">
                {dept === 'dyeing' && (
                  <>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      Start Date
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      End Date
                    </th>
                  </>
                )}

                {dept === 'delivery' && (
                  <>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      Floor Start
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      Floor End
                    </th>
                  </>
                )}

                <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                  Start Date
                </th>
                <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                  End Date
                </th>

                {dept === 'delivery' && (
                  <>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      Start Date
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      End Date
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      Start Date
                    </th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-600 dark:text-gray-400">
                      End Date
                    </th>
                  </>
                )}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="text-[10px] bg-white dark:bg-[#151921] text-gray-700 dark:text-gray-300 divide-y divide-gray-200 dark:divide-[#2a3346]">
              {planItems.map((item, idx) => {
                const { knitItem, dyeItem, isKnitTypeSelected, isDyeTypeSelected } = getUpstreamPlans(item);

                // Gating checks matching Exp detailed-view.js:
                // Dyeing: requires Unit & Process to be selected (lines 579-586)
                const isUnitProcessReady =
                  dept !== 'dyeing' ||
                  (Boolean(item.unit) && item.unit !== 'Select' && Boolean(item.processName) && item.processName !== 'Select');

                // Dyeing: disabled if Knitting Plan Type is not selected (line 302)
                const isDyeKnitLocked = dept === 'dyeing' && !isKnitTypeSelected;

                // Delivery: disabled if Dyeing Plan Type is not selected (line 357)
                const isDeliDyeLocked = dept === 'delivery' && !isDyeTypeSelected;

                // Non-Admin lock: ONLY lock if item was already Confirmed and user is NOT admin
                const isSavedConfirmed = item.planType === 'Confirm';
                const isNonAdminLocked = isSavedConfirmed && !isAdmin;

                // Dyeing input disabled
                const isDyeInputsDisabled = !isUnitProcessReady || isDyeKnitLocked || isNonAdminLocked;

                // Delivery input disabled
                const isDeliInputsDisabled = isDeliDyeLocked || isNonAdminLocked;

                // General input disabled state
                const isInputsDisabled =
                  dept === 'dyeing'
                    ? isDyeInputsDisabled
                    : dept === 'delivery'
                    ? isDeliInputsDisabled
                    : isNonAdminLocked;

                const inputDisabledClass = isInputsDisabled
                  ? 'bg-gray-100 dark:bg-gray-800/60 opacity-60 cursor-not-allowed text-gray-400'
                  : 'bg-white dark:bg-[#151921]';

                const disabledTitle =
                  dept === 'dyeing' && isDyeKnitLocked
                    ? 'Knitting Plan type selection is mandatory to input Dyeing plan'
                    : dept === 'dyeing' && !isUnitProcessReady
                    ? 'Unit & Process Name must be selected before planning'
                    : dept === 'delivery' && isDeliDyeLocked
                    ? 'Dyeing Plan type selection is mandatory to input Delivery plan'
                    : isNonAdminLocked
                    ? 'Only Admin can modify Confirmed plan'
                    : undefined;

                return (
                  <tr
                    key={item.itemId || idx}
                    className="hover:bg-blue-50/50 dark:hover:bg-blue-900/20 border-b border-gray-200 dark:border-[#2a3346] transition-colors"
                  >
                    <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-bold text-gray-500">
                      {idx + 1}
                    </td>

                    {/* Color */}
                    <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-bold text-gray-800 dark:text-gray-100">
                      {item.Color || item['Color'] || item['Colour'] || '—'}
                    </td>

                    {/* Construction & GSM */}
                    {dept !== 'yd' && (
                      <>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[100px]">
                          {item.FabricConstruction || item['Fabric Construction'] || item['Construction'] || '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[60px] font-mono">
                          {item.GSM || item['GSM'] || '—'}
                        </td>
                      </>
                    )}

                    {/* YD Left columns */}
                    {dept === 'yd' && (
                      <>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px] font-semibold">
                          {item['Booking Type'] || item.BookingType || '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px] font-mono">
                          {item.YDB || item['YDB'] || '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                          {formatDateDisplay(item['YD Booking Date'])}
                        </td>
                      </>
                    )}

                    {/* Dyeing / Finishing Unit & Process dropdowns */}
                    {(dept === 'dyeing' || dept === 'finishing') && (
                      <>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[100px]">
                          <select
                            value={item.unit || ''}
                            onChange={(e) => handleUnitProcessChange(idx, 'unit', e.target.value)}
                            className="row-unit p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-full focus:border-blue-500 outline-none cursor-pointer bg-white dark:bg-[#151921]"
                          >
                            <option value="">Select</option>
                            {unitOptions.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[110px]">
                          <select
                            value={item.processName || ''}
                            onChange={(e) => handleUnitProcessChange(idx, 'processName', e.target.value)}
                            className="row-process p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-full focus:border-blue-500 outline-none cursor-pointer bg-white dark:bg-[#151921]"
                          >
                            <option value="">Select</option>
                            {processOptions.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </td>
                      </>
                    )}

                    {/* Upstream Knitting Plan for Dyeing (detailed-view.js lines 307-312) */}
                    {dept === 'dyeing' && (
                      <>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
                          {formatDateDisplay(knitItem?.startDate || knitItem?.planStart)}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
                          {formatDateDisplay(knitItem?.endDate || knitItem?.planEnd)}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px] font-semibold">
                          <span
                            className={`badge badge-xs font-bold ${
                              knitItem?.planType === 'Confirm'
                                ? 'badge-success text-success-content'
                                : knitItem?.planType === 'Tentative'
                                ? 'badge-warning text-warning-content'
                                : 'badge-ghost text-gray-400'
                            }`}
                          >
                            {knitItem?.planType || '-'}
                          </span>
                        </td>
                        <td
                          className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[100px] truncate max-w-[130px]"
                          title={knitItem?.limitation}
                        >
                          {knitItem?.limitation || ''}
                        </td>
                        <td
                          className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[100px] truncate max-w-[130px]"
                          title={knitItem?.remarks}
                        >
                          {knitItem?.remarks || ''}
                        </td>
                      </>
                    )}

                    {/* Knitting Yarn Date (detailed-view.js line 241) */}
                    {dept === 'knitting' && (
                      <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-yellow-50 dark:bg-yellow-900/10">
                        <input
                          type="date"
                          value={item.yarnDate || ''}
                          onChange={(e) => handleYarnDateChange(idx, e.target.value)}
                          title={idx === 0 ? '⚡ Changing Row 1 Yarn Date auto-fills all items' : undefined}
                          className="row-yarn-date p-1 border border-yellow-300 dark:border-yellow-700/50 rounded text-[10px] w-[95px] focus:border-blue-500 outline-none bg-yellow-50/70 dark:bg-[#151921] text-yellow-950 dark:text-yellow-100 font-semibold"
                        />
                      </td>
                    )}

                    {/* Delivery Floor Schedule (detailed-view.js lines 383-391) */}
                    {dept === 'delivery' && (
                      <>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-blue-50/40">
                          <input
                            type="date"
                            value={item.floorStartDate || ''}
                            disabled={isDeliInputsDisabled}
                            title={disabledTitle}
                            onChange={(e) => handleFloorChange(idx, 'floorStartDate', e.target.value)}
                            className={`row-floor-start p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[95px] focus:border-blue-500 outline-none bg-blue-50 dark:bg-blue-950/20 ${inputDisabledClass}`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-blue-50/40">
                          <input
                            type="date"
                            value={item.floorEndDate || ''}
                            min={item.floorStartDate || undefined}
                            disabled={isDeliInputsDisabled}
                            title={disabledTitle}
                            onChange={(e) => handleFloorChange(idx, 'floorEndDate', e.target.value)}
                            className={`row-floor-end p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[95px] focus:border-blue-500 outline-none bg-blue-50 dark:bg-blue-950/20 ${inputDisabledClass}`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <select
                            value={item.floorPlanType || ''}
                            disabled={isDeliInputsDisabled}
                            title={disabledTitle}
                            onChange={(e) => handleFloorChange(idx, 'floorPlanType', e.target.value)}
                            className={`row-floor-plan p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none cursor-pointer ${inputDisabledClass}`}
                          >
                            <option value="">Select</option>
                            <option value="Confirm">Confirm</option>
                            <option value="Tentative">Tentative</option>
                          </select>
                        </td>
                      </>
                    )}

                    {/* Standard Planning Start Date */}
                    <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                      <input
                        type="date"
                        value={item.startDate || ''}
                        min={dept === 'knitting' ? item.yarnDate || undefined : undefined}
                        disabled={isInputsDisabled}
                        title={disabledTitle}
                        onChange={(e) => handleStartDateChange(idx, e.target.value)}
                        className={`row-start-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[95px] focus:border-blue-500 outline-none ${inputDisabledClass}`}
                      />
                    </td>

                    {/* Standard Planning End Date */}
                    <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                      <input
                        type="date"
                        value={item.endDate || ''}
                        min={item.startDate || (dept === 'knitting' ? item.yarnDate || undefined : undefined)}
                        disabled={isInputsDisabled}
                        title={disabledTitle}
                        onChange={(e) => handleEndDateChange(idx, e.target.value)}
                        className={`row-end-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[95px] focus:border-blue-500 outline-none ${inputDisabledClass}`}
                      />
                    </td>

                    {/* Standard Plan Type */}
                    <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                      <select
                        value={item.planType || ''}
                        disabled={isInputsDisabled}
                        title={disabledTitle}
                        onChange={(e) => handlePlanTypeChange(idx, e.target.value)}
                        className={`row-plan-type p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none cursor-pointer font-bold ${inputDisabledClass} ${
                          item.planType === 'Confirm'
                            ? 'text-green-700 bg-green-50 dark:bg-green-950/30 border-green-300'
                            : item.planType === 'Tentative'
                            ? 'text-yellow-700 bg-yellow-50 dark:bg-yellow-950/30 border-yellow-300'
                            : ''
                        }`}
                      >
                        <option value="">Select</option>
                        <option value="Confirm">Confirm</option>
                        <option value="Tentative">Tentative</option>
                      </select>
                    </td>

                    {/* Limitation */}
                    <td className="p-2 border-r border-gray-300 dark:border-[#2a3346]">
                      <input
                        type="text"
                        value={item.limitation || ''}
                        disabled={!isUnitProcessReady}
                        onChange={(e) => handleTextChange(idx, 'limitation', e.target.value)}
                        placeholder="Limitation"
                        className={`row-limitation w-full p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none ${
                          !isUnitProcessReady ? 'bg-gray-100 opacity-60 cursor-not-allowed' : 'bg-white dark:bg-[#151921]'
                        }`}
                      />
                    </td>

                    {/* Remarks */}
                    <td className="p-2 border-r border-gray-300 dark:border-[#2a3346]">
                      <input
                        type="text"
                        value={item.remarks || ''}
                        disabled={!isUnitProcessReady}
                        onChange={(e) => handleTextChange(idx, 'remarks', e.target.value)}
                        placeholder="Notes"
                        className={`row-remarks w-full p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none ${
                          !isUnitProcessReady ? 'bg-gray-100 opacity-60 cursor-not-allowed' : 'bg-white dark:bg-[#151921]'
                        }`}
                      />
                    </td>

                    {/* Delivery: Upstream Dyeing & Knitting readouts */}
                    {dept === 'delivery' && (
                      <>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
                          {formatDateDisplay(dyeItem?.startDate || dyeItem?.planStart)}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
                          {formatDateDisplay(dyeItem?.endDate || dyeItem?.planEnd)}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px] font-semibold">
                          <span
                            className={`badge badge-xs font-bold ${
                              dyeItem?.planType === 'Confirm'
                                ? 'badge-success text-success-content'
                                : dyeItem?.planType === 'Tentative'
                                ? 'badge-warning text-warning-content'
                                : 'badge-ghost text-gray-400'
                            }`}
                          >
                            {dyeItem?.planType || '-'}
                          </span>
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
                          {formatDateDisplay(knitItem?.startDate || knitItem?.planStart)}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
                          {formatDateDisplay(knitItem?.endDate || knitItem?.planEnd)}
                        </td>
                      </>
                    )}

                    {/* Knitting Production & Balance columns */}
                    {dept === 'knitting' && (
                      <>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.GreyReq || item.greyReq || '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.KnitProd || item.knitProd || 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono text-orange-600 font-bold">
                          {item.KnitBala || item.knitBala || '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.YarnReq || item.yarnReq || '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.AllocatedQty || item.allocatedQty || '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.YarnBala || item.yarnBala || '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.Allowance || item.allowance || '—'}
                        </td>
                      </>
                    )}

                    {/* Dyeing / Finishing Production columns */}
                    {(dept === 'dyeing' || dept === 'finishing') && (
                      <>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.BPQty || item.bpQty || '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.DyeingProd || item.dyeingProd || 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono text-orange-600 font-bold">
                          {item.DyeingBala || item.dyeingBala || '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.KnitProd || item.knitProd || 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.KnitBala || item.knitBala || '—'}
                        </td>
                      </>
                    )}

                    {/* Delivery Production & Stock columns */}
                    {dept === 'delivery' && (
                      <>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.RequiredQtyKgs || item.requiredQtyKgs || '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.NetReceivedQtyKgs || item.netReceivedQtyKgs || 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.NetDeliveryQtyKgs || item.netDeliveryQtyKgs || 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono text-orange-600 font-bold">
                          {item.DeliBal || item.deliBal || '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.RFD || item.rfd || 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.Slowmoving || item.slowmoving || 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.FFStock || item.ffStock || 0}
                        </td>
                      </>
                    )}

                    {/* YD Extra Right columns */}
                    {dept === 'yd' && (
                      <>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <input
                            type="number"
                            value={item['Barrier Qty.'] || item.barrierQty || ''}
                            onChange={(e) => handleTextChange(idx, 'limitation', e.target.value)}
                            className="w-full p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] outline-none text-center bg-white dark:bg-[#151921]"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <input
                            type="number"
                            value={item['Workable Qty.'] || item.workableQty || ''}
                            onChange={(e) => handleTextChange(idx, 'remarks', e.target.value)}
                            className="w-full p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] outline-none text-center bg-white dark:bg-[#151921]"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item['YD REQ.'] || item.ydReq || '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item.DYED || item.dyed || 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item['YD BALANCE'] || item.ydBalance || '—'}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono">
                          {item['YD Delivered'] || item.ydDelivered || 0}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center font-mono text-red-600 font-bold">
                          {item['YD DELIVERY BALANCE'] || item.ydDeliveryBalance || '—'}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer info & Save trigger */}
        <div className="p-3 bg-gray-50 dark:bg-[#181f2c] border-t border-gray-200 dark:border-[#2a3346] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-gray-500 dark:text-gray-400">
            Total <strong className="text-gray-800 dark:text-gray-200">{planItems.length}</strong> fabric items ready for schedule synchronization.
          </span>
          <div className="flex items-center gap-2">
            <Link
              href={`/planning/${dept}`}
              className="btn btn-ghost btn-xs font-semibold"
            >
              Cancel
            </Link>
            <button
              onClick={handleSavePlanning}
              disabled={saving}
              className="btn btn-primary btn-xs font-bold gap-1.5 shadow-sm"
            >
              {saving ? <span className="loading loading-spinner loading-xs" /> : <Save className="h-3 w-3" />}
              Save Planning Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
