'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Info,
  Calendar,
  Layers,
  Sparkles,
  Lock,
} from 'lucide-react';
import { API_BASE, DEPARTMENTS, STATUS_COLORS } from '@/lib/constants';
import { formatDateDisplay } from '@/lib/date-utils';
import ExpLoadingSpinner from '@/components/common/ExpLoadingSpinner';

interface PageProps {
  params: Promise<{
    dept: string;
    orderNo: string;
  }>;
}

export default function OrderPlanningDetailPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const dept = resolvedParams.dept.toLowerCase();
  const orderNo = decodeURIComponent(resolvedParams.orderNo);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [order, setOrder] = useState<any>(null);
  const [planData, setPlanData] = useState<any>(null);
  const [planItems, setPlanItems] = useState<any[]>([]);
  const [orderStatus, setOrderStatus] = useState<string>('On Process');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Master dropdown options (Unit & Process)
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

  const deptMeta = DEPARTMENTS[dept] || { name: dept.toUpperCase() };

  useEffect(() => {
    const role = (localStorage.getItem('role') || '').toLowerCase();
    setIsAdmin(role === 'admin' || role === 'approver');
  }, []);

  const showToast = (message: string, type: 'error' | 'success' = 'error') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
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

      // Parity with Exp: Delivery Floor default dates from Dyeing plan
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
            if (!item.floorStartDate && dItem?.startDate) {
              const d = new Date(dItem.startDate);
              if (!isNaN(d.getTime())) {
                d.setDate(d.getDate() + 7);
                item.floorStartDate = d.toISOString().split('T')[0];
              }
            }
            if (!item.floorEndDate && dItem?.endDate) {
              const d = new Date(dItem.endDate);
              if (!isNaN(d.getTime())) {
                d.setDate(d.getDate() + 7);
                item.floorEndDate = d.toISOString().split('T')[0];
              }
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

  // Check if Dyeing row is ready (Exp detailed-view.js line 579)
  const isDyeRowReady = (item: any) => {
    if (dept !== 'dyeing') return true;
    const u = String(item.unit || '').trim();
    const p = String(item.processName || '').trim();
    return u !== '' && u !== 'Select' && p !== '' && p !== 'Select';
  };

  // Check if Delivery row is ready (Exp detailed-view.js line 563)
  const isDeliRowReady = (item: any) => {
    if (dept !== 'delivery') return true;
    const { dyeItem } = getUpstreamPlans(item);
    const dyeStart = dyeItem?.startDate || dyeItem?.planStart;
    return Boolean(dyeStart && dyeStart !== '-' && dyeStart !== '');
  };

  // Exp validation: isValidStartDate (detailed-view.js lines 640-662)
  const isValidStartDate = (item: any, newStart: string): boolean => {
    if (!newStart) return true;
    const endVal = item.endDate;
    if (newStart && endVal && new Date(newStart) > new Date(endVal)) {
      showToast('Start Date cannot be greater than End Date!');
      return false;
    }

    if (dept === 'knitting') {
      const yarnVal = item.yarnDate;
      if (
        yarnVal &&
        yarnVal !== '-' &&
        yarnVal !== 'N/A' &&
        new Date(newStart).setHours(0, 0, 0, 0) < new Date(yarnVal).setHours(0, 0, 0, 0)
      ) {
        showToast('Knitting Planning Start Date cannot be less than Yarn Date!');
        return false;
      }
    }

    if (dept === 'dyeing') {
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

    if (dept === 'delivery') {
      const { dyeItem } = getUpstreamPlans(item);
      const dyeStart = dyeItem?.startDate || dyeItem?.planStart;
      if (dyeStart && dyeStart !== '-' && new Date(newStart).setHours(0, 0, 0, 0) < new Date(dyeStart).setHours(0, 0, 0, 0)) {
        showToast('Delivery Start Date cannot be before Dyeing Start Date!');
        return false;
      }
    }

    return true;
  };

  // Exp validation: isValidEndDate (detailed-view.js lines 664-686)
  const isValidEndDate = (item: any, newEnd: string): boolean => {
    if (!newEnd) return true;
    const startVal = item.startDate;
    if (startVal && newEnd && new Date(startVal) > new Date(newEnd)) {
      showToast('Start Date cannot be greater than End Date!');
      return false;
    }

    if (dept === 'dyeing') {
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

    if (dept === 'delivery') {
      const { dyeItem } = getUpstreamPlans(item);
      const dyeEnd = dyeItem?.endDate || dyeItem?.planEnd;
      if (dyeEnd && dyeEnd !== '-' && new Date(newEnd).setHours(0, 0, 0, 0) < new Date(dyeEnd).setHours(0, 0, 0, 0)) {
        showToast('Delivery End Date cannot be before Dyeing End Date!');
        return false;
      }
    }

    return true;
  };

  // Exp validation: isValidPlanType (detailed-view.js lines 688-728)
  const isValidPlanType = (item: any, startVal: string, endVal: string, planTypeVal: string): boolean => {
    if (!planTypeVal || planTypeVal === 'Select') return true;

    if ((planTypeVal === 'Confirm' || planTypeVal === 'Tentative') && (!startVal || !endVal)) {
      showToast('Start and End dates are required to set Plan Type.');
      return false;
    }

    if (dept === 'knitting' && planTypeVal === 'Confirm') {
      const yarnVal = item.yarnDate;
      if (!yarnVal || yarnVal === '-' || yarnVal === 'N/A') {
        showToast("Without Yarn Date input, Knitting Plan Type cannot be 'Confirm'!");
        return false;
      }
    }

    if (dept === 'dyeing') {
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
        const finalConf = String(order?.finalConfirmation || order?.generalInfo?.FinalConf || '').trim().toLowerCase();
        if (finalConf === 'no') {
          showToast("Cannot confirm Dyeing because Final Confirmation is 'No'.");
          return false;
        }
      }
    }

    if (dept === 'delivery') {
      const { dyeItem } = getUpstreamPlans(item);
      const dyeType = String(dyeItem?.planType || '').trim();

      if (planTypeVal === 'Confirm' && (dyeType === 'Tentative' || dyeType === '-' || dyeType === '')) {
        showToast('Cannot confirm Delivery when Dyeing is Tentative or blank.');
        return false;
      }
    }

    return true;
  };

  // Comprehensive Change Handler with Row 1 Cascading Auto-Fill (detailed-view.js lines 730-858)
  const handleItemChange = (index: number, field: string, value: any) => {
    // 1. UNIT & PROCESS (Dyeing)
    if (dept === 'dyeing' && (field === 'unit' || field === 'processName')) {
      setPlanItems((prev) => {
        const next = [...prev];
        if (index === 0) {
          // Cascading: Row 1 auto-fills all other rows
          return next.map((it) => ({ ...it, [field]: value }));
        } else {
          next[index] = { ...next[index], [field]: value };
          return next;
        }
      });
      return;
    }

    // 2. YARN DATE (Knitting)
    if (dept === 'knitting' && field === 'yarnDate') {
      setPlanItems((prev) => {
        const next = [...prev];
        if (index === 0) {
          // Cascading auto-fill all rows
          return next.map((it) => {
            const updated = { ...it, yarnDate: value };
            if (!value && updated.planType === 'Confirm') {
              updated.planType = '';
            }
            if (value && updated.startDate && updated.startDate < value) {
              updated.startDate = value;
            }
            if (value && updated.endDate && updated.endDate < (updated.startDate || value)) {
              updated.endDate = updated.startDate || value;
            }
            return updated;
          });
        } else {
          const item = { ...next[index], yarnDate: value };
          if (!value && item.planType === 'Confirm') {
            item.planType = '';
            showToast("Without Yarn Date input, Knitting Plan Type cannot be 'Confirm'!");
          }
          if (value && item.startDate && item.startDate < value) {
            item.startDate = value;
          }
          if (value && item.endDate && item.endDate < (item.startDate || value)) {
            item.endDate = item.startDate || value;
          }
          next[index] = item;
          return next;
        }
      });
      if (index === 0 && !value) {
        showToast("Without Yarn Date input, Knitting Plan Type cannot be 'Confirm'!");
      }
      return;
    }

    // 3. START DATE (with cascading if index === 0)
    if (field === 'startDate') {
      const currentItem = planItems[index];
      if (!isValidStartDate(currentItem, value)) {
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
          return next.map((it, idx) => {
            if (idx === 0) {
              const updated = { ...it, startDate: value };
              if ((dept === 'delivery' || dept === 'yd') && value) {
                const d = new Date(value);
                d.setDate(d.getDate() - 4);
                updated.floorStartDate = d.toISOString().split('T')[0];
              }
              if (!isValidPlanType(updated, value, updated.endDate, updated.planType)) {
                updated.planType = '';
              }
              return updated;
            }

            if (isValidStartDate(it, value)) {
              const updated = { ...it, startDate: value };
              if ((dept === 'delivery' || dept === 'yd') && value) {
                const d = new Date(value);
                d.setDate(d.getDate() - 4);
                updated.floorStartDate = d.toISOString().split('T')[0];
              }
              if (!isValidPlanType(updated, value, updated.endDate, updated.planType)) {
                updated.planType = '';
              }
              return updated;
            } else {
              return { ...it, startDate: '' };
            }
          });
        } else {
          const updated = { ...next[index], startDate: value };
          if ((dept === 'delivery' || dept === 'yd') && value) {
            const d = new Date(value);
            d.setDate(d.getDate() - 4);
            updated.floorStartDate = d.toISOString().split('T')[0];
          }
          if (!isValidPlanType(updated, value, updated.endDate, updated.planType)) {
            updated.planType = '';
          }
          next[index] = updated;
          return next;
        }
      });
      return;
    }

    // 4. END DATE (with cascading if index === 0)
    if (field === 'endDate') {
      const currentItem = planItems[index];
      if (!isValidEndDate(currentItem, value)) {
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
              const updated = { ...it, endDate: value };
              if ((dept === 'delivery' || dept === 'yd') && value) {
                const d = new Date(value);
                d.setDate(d.getDate() - 4);
                updated.floorEndDate = d.toISOString().split('T')[0];
              }
              if (!isValidPlanType(updated, updated.startDate, value, updated.planType)) {
                updated.planType = '';
              }
              return updated;
            }

            if (isValidEndDate(it, value)) {
              const updated = { ...it, endDate: value };
              if ((dept === 'delivery' || dept === 'yd') && value) {
                const d = new Date(value);
                d.setDate(d.getDate() - 4);
                updated.floorEndDate = d.toISOString().split('T')[0];
              }
              if (!isValidPlanType(updated, updated.startDate, value, updated.planType)) {
                updated.planType = '';
              }
              return updated;
            } else {
              return { ...it, endDate: '' };
            }
          });
        } else {
          const updated = { ...next[index], endDate: value };
          if ((dept === 'delivery' || dept === 'yd') && value) {
            const d = new Date(value);
            d.setDate(d.getDate() - 4);
            updated.floorEndDate = d.toISOString().split('T')[0];
          }
          if (!isValidPlanType(updated, updated.startDate, value, updated.planType)) {
            updated.planType = '';
          }
          next[index] = updated;
          return next;
        }
      });
      return;
    }

    // 5. PLAN TYPE (with cascading if index === 0)
    if (field === 'planType') {
      const currentItem = planItems[index];
      if (!isValidPlanType(currentItem, currentItem.startDate, currentItem.endDate, value)) {
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
            if (idx === 0) return { ...it, planType: value };
            if (!value) return { ...it, planType: '' };
            if (isValidPlanType(it, it.startDate, it.endDate, value)) {
              return { ...it, planType: value };
            } else {
              return { ...it, planType: '' };
            }
          });
        } else {
          next[index] = { ...next[index], planType: value };
          return next;
        }
      });
      return;
    }

    // 6. FLOOR DATES (Floor Start, Floor End, Floor Plan Type)
    if (field === 'floorStartDate' || field === 'floorEndDate' || field === 'floorPlanType') {
      setPlanItems((prev) => {
        const next = [...prev];
        if (index === 0) {
          return next.map((it) => ({ ...it, [field]: value }));
        } else {
          next[index] = { ...next[index], [field]: value };
          return next;
        }
      });
      return;
    }

    // 7. OTHER FIELDS (limitation, remarks, yarnOkDate, matchingOptionDate)
    setPlanItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Exp pre-save validation suite (save-planning.js lines 4-167)
  const handleSavePlanning = async () => {
    if (planItems.length === 0) {
      showToast('No fabric items to save! Please upload department data first.');
      return;
    }

    for (let i = 0; i < planItems.length; i++) {
      const it = planItems[i];
      const { knitItem, dyeItem, isKnitTypeSelected, isDyeTypeSelected } = getUpstreamPlans(it);

      // Start vs End Date
      if (it.startDate && it.endDate && new Date(it.startDate) > new Date(it.endDate)) {
        showToast(`Row #${i + 1}: Save failed: End date cant be less than start date.`);
        return;
      }

      // Floor Start vs Floor End
      if (it.floorStartDate && it.floorEndDate && new Date(it.floorStartDate) > new Date(it.floorEndDate)) {
        showToast(`Row #${i + 1}: Save failed: End date cant be less than start date.`);
        return;
      }

      // Plan Type requires dates
      if ((it.planType === 'Confirm' || it.planType === 'Tentative') && (!it.startDate || !it.endDate)) {
        showToast(`Row #${i + 1}: Save failed: Plan Type selected without Start and End dates.`);
        return;
      }

      // Knitting conditions
      if (dept === 'knitting') {
        const hasYarn = it.yarnDate && it.yarnDate.trim() !== '' && it.yarnDate !== '-' && it.yarnDate !== 'N/A';
        if (it.planType === 'Confirm' && !hasYarn) {
          showToast(`Row #${i + 1}: Save failed: Without Yarn Date input, Knitting Plan Type cannot be 'Confirm'!`);
          return;
        }
        if (it.startDate && hasYarn && new Date(it.startDate).setHours(0, 0, 0, 0) < new Date(it.yarnDate).setHours(0, 0, 0, 0)) {
          showToast(`Row #${i + 1}: Save failed: Knitting Planning Start Date cannot be less than Yarn Date!`);
          return;
        }
      }

      // Dyeing conditions
      if (dept === 'dyeing') {
        const hasDyePlanInput = Boolean(
          it.startDate || it.endDate || (it.planType && it.planType !== 'Select' && it.planType !== '')
        );
        if (hasDyePlanInput && !isKnitTypeSelected) {
          showToast(`Row #${i + 1}: Save failed: Knitting Plan type selection is mandatory before inputting Dyeing plan!`);
          return;
        }
        if (it.startDate && knitItem?.startDate && new Date(it.startDate).setHours(0, 0, 0, 0) < new Date(knitItem.startDate).setHours(0, 0, 0, 0)) {
          showToast(`Row #${i + 1}: Save failed: Dyeing Start Date cannot be before Knitting Start Date!`);
          return;
        }
        if (it.endDate && knitItem?.endDate && new Date(it.endDate).setHours(0, 0, 0, 0) < new Date(knitItem.endDate).setHours(0, 0, 0, 0)) {
          showToast(`Row #${i + 1}: Save failed: Dyeing End Date cannot be before Knitting End Date!`);
          return;
        }
      }

      // Delivery conditions
      if (dept === 'delivery') {
        const hasDeliPlanInput = Boolean(
          it.startDate ||
            it.endDate ||
            (it.planType && it.planType !== 'Select' && it.planType !== '') ||
            it.floorStartDate ||
            it.floorEndDate ||
            (it.floorPlanType && it.floorPlanType !== 'Select' && it.floorPlanType !== '')
        );
        if (hasDeliPlanInput && !isDyeTypeSelected) {
          showToast(`Row #${i + 1}: Save failed: Dyeing Plan type selection is mandatory before inputting Delivery plan!`);
          return;
        }
        if (it.startDate && dyeItem?.startDate && new Date(it.startDate).setHours(0, 0, 0, 0) < new Date(dyeItem.startDate).setHours(0, 0, 0, 0)) {
          showToast(`Row #${i + 1}: Save failed: Delivery Start Date cannot be before Dyeing Start Date!`);
          return;
        }
        if (it.endDate && dyeItem?.endDate && new Date(it.endDate).setHours(0, 0, 0, 0) < new Date(dyeItem.endDate).setHours(0, 0, 0, 0)) {
          showToast(`Row #${i + 1}: Save failed: Delivery End Date cannot be before Dyeing End Date!`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');

      // Auto-transition to Confirm if all items are Confirm
      let finalStatus = orderStatus;
      if (planItems.length > 0 && planItems.every((it) => it.planType === 'Confirm')) {
        finalStatus = 'Confirm';
        setOrderStatus('Confirm');
      }

      const res = await fetch(`${API_BASE}/api/orders/save-dates`, {
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
    <div className="space-y-4 pb-20 max-w-[1800px] mx-auto animate-fade-in text-[11px]">
      {/* Toast notification matching Exp */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-bounce">
          <div
            className={`alert ${
              toast.type === 'success' ? 'alert-success' : 'alert-error'
            } shadow-lg text-xs font-bold py-2 px-4 rounded border`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-[#2a3346] pb-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/planning/${dept}`}
            className="btn btn-ghost btn-sm btn-square border border-gray-300 dark:border-[#2a3346] hover:border-primary"
            title="Return to Planning List"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-gray-800 dark:text-gray-100">
                Order Planning: <span className="text-blue-600 dark:text-blue-400 font-mono">{orderNo}</span>
              </h1>
              <span className="badge badge-sm badge-outline font-bold uppercase">{deptMeta.name}</span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Buyer: <span className="font-semibold text-gray-800 dark:text-gray-200">{order.buyer || 'N/A'}</span> • Style:{' '}
              <span className="font-semibold text-gray-800 dark:text-gray-200">{order.style || 'N/A'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-[#1f2637] px-3 py-1.5 rounded border border-gray-300 dark:border-[#2a3346]">
            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400">Status:</span>
            <select
              value={orderStatus}
              onChange={(e) => setOrderStatus(e.target.value)}
              className="select select-bordered select-xs font-bold text-[11px] bg-white dark:bg-[#151921]"
            >
              <option value="On Process">On Process</option>
              <option value="Confirm">Confirm</option>
              <option value="Tentative">Tentative</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <button
            onClick={handleSavePlanning}
            className="btn btn-primary btn-sm text-xs font-bold shadow-sm gap-1.5"
            disabled={saving}
          >
            {saving ? <span className="loading loading-spinner loading-xs" /> : <Save className="h-3.5 w-3.5" />}
            Save Planning
          </button>
        </div>
      </div>

      {/* General Information Card (Exp Parity) */}
      <div className="bg-white dark:bg-[#151921] border border-gray-200 dark:border-[#2a3346] rounded-sm shadow-sm overflow-hidden">
        <div className="bg-gray-100 dark:bg-[#1f2637] p-2 font-bold text-gray-800 dark:text-gray-200 text-xs flex items-center border-b border-gray-200 dark:border-[#2a3346]">
          <Layers className="h-3.5 w-3.5 text-blue-500 mr-2" /> General Information
        </div>
        <div className="p-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-[11px]">
          <div>
            <span className="text-gray-500 dark:text-gray-400 block text-[10px]">Booking / EWO</span>
            <span className="font-bold text-gray-800 dark:text-gray-200 font-mono">{order.orderNo}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400 block text-[10px]">Order Qty (Kg)</span>
            <span className="font-bold text-gray-800 dark:text-gray-200 font-mono">
              {Number(displayQty).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400 block text-[10px]">Booking Date</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">
              {formatDateDisplay(order.bookingDate)}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400 block text-[10px]">Gmt Unit / Floor</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">
              {order.gmtUnit || order.bookingUnit || '—'} / {order.floor || order.unit || '—'}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400 block text-[10px]">Final Confirmation</span>
            <span
              className={`font-bold ${
                String(order.finalConfirmation).toLowerCase() === 'no' ? 'text-red-500' : 'text-green-600'
              }`}
            >
              {order.finalConfirmation || '—'}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400 block text-[10px]">PMC</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{order.pmc || '—'}</span>
          </div>
        </div>
      </div>

      {/* Fabric Items Table matching Exp table-headers.js and detailed-view.js */}
      <div className="bg-white dark:bg-[#151921] border border-gray-200 dark:border-[#2a3346] rounded-sm shadow-sm overflow-hidden flex flex-col">
        <div className="bg-gray-100 dark:bg-[#1f2637] p-2 font-bold text-gray-800 dark:text-gray-200 text-xs flex items-center justify-between border-b border-gray-200 dark:border-[#2a3346]">
          <div className="flex items-center">
            <FileSpreadsheet className="h-3.5 w-3.5 text-blue-500 mr-2" />
            <span>Department Fabric Items</span>
            <span className="ml-2 px-1.5 py-0.2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-[10px] font-mono">
              {planItems.length}
            </span>
          </div>
          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-normal">
            Row 1 changes auto-fill all items below
          </span>
        </div>

        <div className="overflow-x-auto custom-scrollbar w-full bg-white dark:bg-[#151921]">
          <table className="w-full text-left whitespace-nowrap border-collapse min-w-[1600px]">
            {/* 2-Tier Dual Header Structure matching Exp */}
            <thead className="bg-white dark:bg-[#151921] shadow-xs">
              {/* Main Header Row */}
              <tr className="text-[10px] font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-[#1f2637] border-b border-gray-300 dark:border-[#2a3346]">
                <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center w-8">
                  #
                </th>
                <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[80px]">
                  Color
                </th>

                {dept !== 'yd' && (
                  <>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[100px]">
                      FabricConstruction
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[60px]">
                      GSM
                    </th>
                  </>
                )}

                {/* YD Left Columns */}
                {dept === 'yd' && (
                  <>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] min-w-[90px]">
                      Booking Type
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                      YDB
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                      YD Booking Date
                    </th>
                  </>
                )}

                {/* Dyeing / Finishing Unit & Process dropdowns */}
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

                {/* Dyeing: Knitting Upstream Planning columns */}
                {dept === 'dyeing' && (
                  <>
                    <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                      Knitting Planning
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                      Knitting Plan Type
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[100px]">
                      Knitting Limitation
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[100px]">
                      Remarks (Knitting)
                    </th>
                  </>
                )}

                {/* Knitting: Yarn Date */}
                {dept === 'knitting' && (
                  <th
                    rowSpan={2}
                    className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[95px] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-400 font-bold"
                  >
                    Yarn Date
                  </th>
                )}

                {/* Delivery: Floor Planning */}
                {dept === 'delivery' && (
                  <>
                    <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                      Delivery Planning (Floor)
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[95px]">
                      Plan Type (Floor)
                    </th>
                  </>
                )}

                {/* Standard Department Planning Header Block */}
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

                {/* YD Extra Columns */}
                {dept === 'yd' && (
                  <>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                      Yarn Ok<br />Date
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[90px]">
                      Matching<br />Option Date
                    </th>
                    <th colSpan={3} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                      YD Planning (Floor)
                    </th>
                    <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                      T&A YD Plan
                    </th>
                    <th colSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-gray-200 dark:bg-[#283347]">
                      Knit Plan
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
                    <th rowSpan={2} className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px] text-orange-600 font-bold">
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

              {/* Sub Header Row */}
              <tr className="text-[9px] bg-gray-50 dark:bg-[#181f2c] border-b border-gray-300 dark:border-[#2a3346] text-gray-600 dark:text-gray-400 font-semibold">
                {/* Sub headers for Dyeing Knitting block */}
                {dept === 'dyeing' && (
                  <>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center">Start Date</th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center">End Date</th>
                  </>
                )}

                {/* Sub headers for Delivery Floor block */}
                {dept === 'delivery' && (
                  <>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center">Start Date</th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center">End Date</th>
                  </>
                )}

                {/* Standard department Start/End Date */}
                <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center">Start Date</th>
                <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center">End Date</th>

                {/* Sub headers for Delivery Dyeing & Knitting blocks */}
                {dept === 'delivery' && (
                  <>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center">Start Date</th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center">End Date</th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center">Start Date</th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center">End Date</th>
                  </>
                )}

                {/* Sub headers for YD */}
                {dept === 'yd' && (
                  <>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center">YD Start</th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center">YD End</th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center">Plan Type</th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center">YD T&A Start</th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center">YD T&A End</th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center">Knit Start</th>
                    <th className="p-1 border-r border-gray-300 dark:border-[#2a3346] text-center">Knit End</th>
                  </>
                )}
              </tr>
            </thead>

            {/* Table Body matching Exp detailed-view.js */}
            <tbody className="text-[10px] bg-white dark:bg-[#151921] text-gray-700 dark:text-gray-200 divide-y divide-gray-200 dark:divide-[#2a3346]">
              {planItems.map((item, idx) => {
                const { knitItem, dyeItem } = getUpstreamPlans(item);

                // Gating checks matching Exp
                const dyeReady = isDyeRowReady(item);
                const deliReady = isDeliRowReady(item);
                const isConfirmed = item.planType === 'Confirm';
                const isLockedByConfirm = isConfirmed && !isAdmin;

                // Inputs disabled state
                const isRowPlanningDisabled =
                  (dept === 'dyeing' && !dyeReady) ||
                  (dept === 'delivery' && !deliReady) ||
                  isLockedByConfirm;

                const disabledClass = isRowPlanningDisabled
                  ? 'bg-gray-100 dark:bg-gray-800/60 opacity-60 cursor-not-allowed'
                  : 'bg-white dark:bg-[#151921]';

                const disabledTitle =
                  dept === 'dyeing' && !dyeReady
                    ? 'Unit & Process Name must be selected before planning'
                    : dept === 'delivery' && !deliReady
                    ? 'Dyeing plan is required before inputting Delivery plan'
                    : isLockedByConfirm
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
                            onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
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
                            onChange={(e) => handleItemChange(idx, 'processName', e.target.value)}
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
                          onChange={(e) => handleItemChange(idx, 'yarnDate', e.target.value)}
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
                            disabled={!deliReady || isLockedByConfirm}
                            title={disabledTitle}
                            onChange={(e) => handleItemChange(idx, 'floorStartDate', e.target.value)}
                            className={`row-floor-start p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[95px] focus:border-blue-500 outline-none bg-blue-50 dark:bg-blue-950/20 ${
                              !deliReady || isLockedByConfirm ? 'opacity-60 cursor-not-allowed' : ''
                            }`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center bg-blue-50/40">
                          <input
                            type="date"
                            value={item.floorEndDate || ''}
                            min={item.floorStartDate || undefined}
                            disabled={!deliReady || isLockedByConfirm}
                            title={disabledTitle}
                            onChange={(e) => handleItemChange(idx, 'floorEndDate', e.target.value)}
                            className={`row-floor-end p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[95px] focus:border-blue-500 outline-none bg-blue-50 dark:bg-blue-950/20 ${
                              !deliReady || isLockedByConfirm ? 'opacity-60 cursor-not-allowed' : ''
                            }`}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <select
                            value={item.floorPlanType || ''}
                            disabled={!deliReady || isLockedByConfirm}
                            title={disabledTitle}
                            onChange={(e) => handleItemChange(idx, 'floorPlanType', e.target.value)}
                            className={`row-floor-plan p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none cursor-pointer ${
                              !deliReady || isLockedByConfirm ? 'opacity-60 cursor-not-allowed' : ''
                            }`}
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
                        disabled={isRowPlanningDisabled}
                        title={disabledTitle}
                        onChange={(e) => handleItemChange(idx, 'startDate', e.target.value)}
                        className={`row-start-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[95px] focus:border-blue-500 outline-none ${disabledClass}`}
                      />
                    </td>

                    {/* Standard Planning End Date */}
                    <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                      <input
                        type="date"
                        value={item.endDate || ''}
                        min={item.startDate || (dept === 'knitting' ? item.yarnDate || undefined : undefined)}
                        disabled={isRowPlanningDisabled}
                        title={disabledTitle}
                        onChange={(e) => handleItemChange(idx, 'endDate', e.target.value)}
                        className={`row-end-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[95px] focus:border-blue-500 outline-none ${disabledClass}`}
                      />
                    </td>

                    {/* Standard Plan Type */}
                    <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                      <select
                        value={item.planType || ''}
                        disabled={isRowPlanningDisabled}
                        title={disabledTitle}
                        onChange={(e) => handleItemChange(idx, 'planType', e.target.value)}
                        className={`row-plan-type p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none cursor-pointer font-bold ${disabledClass} ${
                          item.planType === 'Confirm'
                            ? 'text-green-600'
                            : item.planType === 'Tentative'
                            ? 'text-yellow-600'
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
                        placeholder="Limitation"
                        value={item.limitation || ''}
                        disabled={dept === 'dyeing' && !dyeReady}
                        onChange={(e) => handleItemChange(idx, 'limitation', e.target.value)}
                        className={`row-limitation w-full p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none ${
                          dept === 'dyeing' && !dyeReady ? 'bg-gray-100 dark:bg-gray-800/60 opacity-60 cursor-not-allowed' : ''
                        }`}
                      />
                    </td>

                    {/* Remarks */}
                    <td className="p-2 border-r border-gray-300 dark:border-[#2a3346]">
                      <input
                        type="text"
                        placeholder="Notes"
                        value={item.remarks || ''}
                        disabled={dept === 'dyeing' && !dyeReady}
                        onChange={(e) => handleItemChange(idx, 'remarks', e.target.value)}
                        className={`row-remarks w-full p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none ${
                          dept === 'dyeing' && !dyeReady ? 'bg-gray-100 dark:bg-gray-800/60 opacity-60 cursor-not-allowed' : ''
                        }`}
                      />
                    </td>

                    {/* Upstream Dyeing & Knitting columns for Delivery (detailed-view.js lines 409-414) */}
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

                    {/* YD Extra Columns (detailed-view.js lines 487-502) */}
                    {dept === 'yd' && (
                      <>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <input
                            type="date"
                            value={item.yarnOkDate || ''}
                            onChange={(e) => handleItemChange(idx, 'yarnOkDate', e.target.value)}
                            className="row-yarn-ok-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <input
                            type="date"
                            value={item.matchingOptionDate || ''}
                            onChange={(e) => handleItemChange(idx, 'matchingOptionDate', e.target.value)}
                            className="row-matching-option-date p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <input
                            type="date"
                            value={item.floorStartDate || ''}
                            onChange={(e) => handleItemChange(idx, 'floorStartDate', e.target.value)}
                            className="row-floor-start p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <input
                            type="date"
                            value={item.floorEndDate || ''}
                            min={item.floorStartDate || undefined}
                            onChange={(e) => handleItemChange(idx, 'floorEndDate', e.target.value)}
                            className="row-floor-end p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] w-[90px] focus:border-blue-500 outline-none"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center">
                          <select
                            value={item.floorPlanType || ''}
                            onChange={(e) => handleItemChange(idx, 'floorPlanType', e.target.value)}
                            className="row-floor-plan p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none cursor-pointer"
                          >
                            <option value="">Select</option>
                            <option value="Confirm">Confirm</option>
                            <option value="Tentative">Tentative</option>
                          </select>
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
                          {formatDateDisplay(item['YD T&A Start'] || item.YDTnAStart)}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
                          {formatDateDisplay(item['YD T&A End'] || item.YDTnAEnd)}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
                          {formatDateDisplay(knitItem?.startDate || knitItem?.planStart || order.knitStart)}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#181f2c] min-w-[80px]">
                          {formatDateDisplay(knitItem?.endDate || knitItem?.planEnd || order.knitEnd)}
                        </td>
                      </>
                    )}

                    {/* Department Specific Metric Rows (Exp Parity) */}
                    {dept === 'knitting' && (
                      <>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-mono">
                          {(item['Grey Req.'] || item.GreyReq || 0).toLocaleString()}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-mono">
                          {(item['Knit Prod.'] || item.KnitProd || 0).toLocaleString()}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-mono text-orange-600 font-bold">
                          {(item['Knit. Bala.'] || item.KnitBala || 0).toLocaleString()}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-mono">
                          {(item['Yarn req.'] || item.YarnReq || 0).toLocaleString()}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-mono">
                          {(item['Allocated Qty '] || item['Allocated Qty'] || item.AllocatedQty || 0).toLocaleString()}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-mono">
                          {(item['Yarn bala.'] || item.YarnBala || 0).toLocaleString()}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px] font-mono">
                          {item['Allowance %'] !== undefined ? `${(Number(item['Allowance %']) * 100).toFixed(0)}%` : '—'}
                        </td>
                      </>
                    )}

                    {(dept === 'dyeing' || dept === 'finishing') && (
                      <>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-mono">
                          {(item['BP Qty'] || item.BPQty || 0).toLocaleString()}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-mono">
                          {(item['Dyeing Prod.'] || item.DyeingProd || 0).toLocaleString()}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-mono text-orange-600 font-bold">
                          {(item['Dyeing Bala.'] || item.DyeingBala || 0).toLocaleString()}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-mono">
                          {(item['Knit Prod.'] || item.KnitProd || 0).toLocaleString()}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-mono">
                          {(item['Knit. Bala.'] || item.KnitBala || 0).toLocaleString()}
                        </td>
                      </>
                    )}

                    {dept === 'delivery' && (
                      <>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-mono">
                          {(item.RequiredQtyKgs || item['Req Qty'] || 0).toLocaleString()}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-mono">
                          {(item.NetReceivedQtyKgs || item.NetReceivedQty || 0).toLocaleString()}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-mono">
                          {(item.NetDeliveryQtyKgs || item.NetDeliveryQty || 0).toLocaleString()}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-mono text-orange-600 font-bold">
                          {(item['Deli. Bal.'] || item.DeliBal || 0).toLocaleString()}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-mono">
                          {(item.RFD || 0).toLocaleString()}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-mono">
                          {(item.Slowmoving || 0).toLocaleString()}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-mono">
                          {(item['FF Stock'] || item.FFStock || 0).toLocaleString()}
                        </td>
                      </>
                    )}

                    {dept === 'yd' && (
                      <>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                          <input
                            type="number"
                            value={item['Barrier Qty.'] !== undefined ? item['Barrier Qty.'] : ''}
                            onChange={(e) => handleItemChange(idx, 'Barrier Qty.', e.target.value)}
                            className="row-barrier-qty w-full p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center min-w-[80px]">
                          <input
                            type="number"
                            value={item['Workable Qty.'] !== undefined ? item['Workable Qty.'] : ''}
                            onChange={(e) => handleItemChange(idx, 'Workable Qty.', e.target.value)}
                            className="row-workable-qty w-full p-1 border border-gray-300 dark:border-[#2a3346] rounded text-[10px] focus:border-blue-500 outline-none"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-mono">
                          {(item['YD REQ.'] || item.YDReq || 0).toLocaleString()}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-mono">
                          {(item.DYED || item.Dyed || 0).toLocaleString()}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-mono text-orange-600 font-bold">
                          {(item['YD BALANCE'] || item.YDBalance || 0).toLocaleString()}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-mono">
                          {(item['YD Delivered'] || item.YDDelivered || 0).toLocaleString()}
                        </td>
                        <td className="p-2 border-r border-gray-300 dark:border-[#2a3346] text-center whitespace-normal min-w-[80px] font-mono text-red-600 font-bold">
                          {(item['YD DELIVERY BALANCE'] || 0).toLocaleString()}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom Save Bar */}
        <div className="bg-gray-100 dark:bg-[#1f2637] p-2.5 border-t border-gray-200 dark:border-[#2a3346] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-gray-600 dark:text-gray-400">
            Total <span className="font-bold text-gray-800 dark:text-gray-200">{planItems.length}</span> fabric items
            ready for schedule synchronization.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/planning/${dept}`)}
              className="btn btn-ghost btn-xs text-[11px] font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSavePlanning}
              className="btn btn-primary btn-xs text-[11px] font-bold shadow-xs gap-1"
              disabled={saving}
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
