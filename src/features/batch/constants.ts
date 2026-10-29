/* Batch Plan module constants: settings, default Setup tables and fixed column/label lists.
   Copied unchanged from the old project's js/batch/batch-app.js (the server keeps identical default
   Setup tables in its src/constants/batch-setup-defaults.ts). This module imports nothing, so every
   engine module can use these values while the modules are still loading. */

function batchSignedInUser(): string {
  try {
    return (typeof window !== 'undefined' && window.localStorage.getItem('username')) || 'User';
  } catch {
    return 'User';
  }
}

export const APP_SETTINGS = {
  companyName: 'Epyllion Fabrics Limited',
  // The signed-in user is read when it is used (the module can load before the session is known).
  get uploadedBy(): string {
    return batchSignedInUser();
  },
  correctionTimeZone: 'Asia/Dhaka', // Time zone for dated PMC corrections.
  get currentUsername(): string {
    return batchSignedInUser();
  },
  generalInfoSheetName: 'General Info',
  knittingPlanSheetName: 'Knitting & Delivery Plan',
  bpDataSheetName: 'BP Data',
};

export const DYEABLE_ALL = '__all__';
export const DYEABLE_UNASSIGNED = '__unassigned__';

export const INITIAL_FLAT_ALLOWANCE = [
 ['All','All','<100','+10 pcs'],
 ['Solid','Collar','100 to 200','8%'],['Solid','Collar','201 to 500','7%'],['Solid','Collar','Above 500','4%'],
 ['Solid','Cuff','100 to 200','8%'],['Solid','Cuff','201 to 500','7%'],['Solid','Cuff','501 to 2000','3%'],['Solid','Cuff','Above 2000','2%'],
 ['Solid','Hem','100 to 200','8%'],['Solid','Hem','201 to 500','7%'],['Solid','Hem','Above 500','4%'],
 ['Solid','Placket','100 to 200','8%'],['Solid','Placket','201 to 500','7%'],['Solid','Placket','501 to 2000','3%'],['Solid','Placket','Above 2000','2%'],
 ['YD','Collar','100 to 200','7%'],['YD','Collar','101 to 200','6%'],['YD','Collar','201 to 500','4%'],['YD','Collar','Above 500','3%'],
 ['YD','Cuff','100 to 200','8%'],['YD','Cuff','101 to 200','6%'],['YD','Cuff','201 to 500','4%'],['YD','Cuff','Above 500','2%'],
 ['YD','Hem','100 to 200','7%'],['YD','Hem','101 to 200','6%'],['YD','Hem','201 to 500','4%'],['YD','Hem','Above 500','3%'],
 ['YD','Placket','100 to 200','8%'],['YD','Placket','101 to 200','6%'],['YD','Placket','201 to 500','4%'],['YD','Placket','Above 500','2%']
].map(([dyeingType,flatType,range,loss],index)=>({id:'allowance_'+(index+1),dyeingType,flatType,range,loss}));

export const INITIAL_MACHINE_SETUP = [
  {
    "id": "machine_1",
    "floor": "EFL",
    "mcType": "Bulk",
    "mcGroup": "Atmospheric",
    "mcBrand": "Son-Tech",
    "mcNo": "1",
    "capacity": "150",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_2",
    "floor": "EFL",
    "mcType": "Bulk",
    "mcGroup": "Atmospheric",
    "mcBrand": "Son-Tech",
    "mcNo": "2",
    "capacity": "75",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_3",
    "floor": "EFL",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Son-Tech",
    "mcNo": "3",
    "capacity": "30",
    "collarCuff": "NO",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_4",
    "floor": "EFL",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Fong's",
    "mcNo": "4",
    "capacity": "30",
    "collarCuff": "NO",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_5",
    "floor": "EFL",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Fong's",
    "mcNo": "5",
    "capacity": "10",
    "collarCuff": "NO",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_6",
    "floor": "EFL",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Son-Tech",
    "mcNo": "6",
    "capacity": "10",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_7",
    "floor": "EFL",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Canler",
    "mcNo": "7",
    "capacity": "50",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_8",
    "floor": "EFL",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Canler",
    "mcNo": "8",
    "capacity": "50",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_9",
    "floor": "EFL",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Canler",
    "mcNo": "9",
    "capacity": "50",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_10",
    "floor": "EFL",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Yabo",
    "mcNo": "10",
    "capacity": "5",
    "collarCuff": "NO",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_11",
    "floor": "EFL",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Fong's",
    "mcNo": "11",
    "capacity": "30",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_12",
    "floor": "EFL",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Fong's",
    "mcNo": "12",
    "capacity": "60",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_13",
    "floor": "EFL",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Fong's",
    "mcNo": "13",
    "capacity": "150",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_14",
    "floor": "EFL",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Fong's",
    "mcNo": "14",
    "capacity": "150",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_15",
    "floor": "EFL",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Fong's",
    "mcNo": "15",
    "capacity": "250",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_16",
    "floor": "EFL",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Fong's",
    "mcNo": "16",
    "capacity": "500",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_17",
    "floor": "EFL",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Fong's",
    "mcNo": "17",
    "capacity": "500",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_18",
    "floor": "EFL",
    "mcType": "Bulk",
    "mcGroup": "Atmospheric",
    "mcBrand": "Fong's",
    "mcNo": "18",
    "capacity": "500",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_19",
    "floor": "EFL",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Fong's",
    "mcNo": "19",
    "capacity": "750",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_20",
    "floor": "EFL",
    "mcType": "Bulk",
    "mcGroup": "Atmospheric",
    "mcBrand": "Fong's",
    "mcNo": "20",
    "capacity": "750",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_21",
    "floor": "EFL",
    "mcType": "Bulk",
    "mcGroup": "Atmospheric",
    "mcBrand": "Fong's",
    "mcNo": "21",
    "capacity": "1000",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_22",
    "floor": "EFL",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Thies",
    "mcNo": "22",
    "capacity": "1000",
    "collarCuff": "NO",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_23",
    "floor": "EFL",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Thies",
    "mcNo": "23",
    "capacity": "1000",
    "collarCuff": "NO",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_24",
    "floor": "EFL",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Thies",
    "mcNo": "24",
    "capacity": "1000",
    "collarCuff": "NO",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_25",
    "floor": "EFL",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Thies",
    "mcNo": "25",
    "capacity": "750",
    "collarCuff": "NO",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_26",
    "floor": "EFL",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Thies",
    "mcNo": "26",
    "capacity": "750",
    "collarCuff": "NO",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_27",
    "floor": "EFL",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Thies",
    "mcNo": "27",
    "capacity": "500",
    "collarCuff": "NO",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_28",
    "floor": "EFL",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Thies-I-Master",
    "mcNo": "28",
    "capacity": "1500",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_29",
    "floor": "EFL",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Thies-I-Master",
    "mcNo": "29",
    "capacity": "1500",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_30",
    "floor": "EKL",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Fong's",
    "mcNo": "1",
    "capacity": "10",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_31",
    "floor": "EKL",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Thies",
    "mcNo": "2",
    "capacity": "350",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_32",
    "floor": "EKL",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Thies (New)",
    "mcNo": "3",
    "capacity": "750",
    "collarCuff": "NO",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_33",
    "floor": "EKL",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Fong's",
    "mcNo": "4",
    "capacity": "500",
    "collarCuff": "NO",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_34",
    "floor": "EKL",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Fong's",
    "mcNo": "5",
    "capacity": "500",
    "collarCuff": "NO",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_35",
    "floor": "EKL",
    "mcType": "Bulk",
    "mcGroup": "ATM",
    "mcBrand": "Fong's",
    "mcNo": "6",
    "capacity": "750",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_36",
    "floor": "EKL",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Fong's",
    "mcNo": "7",
    "capacity": "250",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_37",
    "floor": "EKL",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Fong's",
    "mcNo": "8",
    "capacity": "30",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_38",
    "floor": "EKL",
    "mcType": "Bulk",
    "mcGroup": "ATM",
    "mcBrand": "Fong's",
    "mcNo": "9",
    "capacity": "1200",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_39",
    "floor": "EKL",
    "mcType": "Bulk",
    "mcGroup": "ATM",
    "mcBrand": "Son-Tech",
    "mcNo": "10",
    "capacity": "75",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_40",
    "floor": "EKL",
    "mcType": "Bulk",
    "mcGroup": "ATM",
    "mcBrand": "Son-Tech",
    "mcNo": "11",
    "capacity": "150",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_41",
    "floor": "EFL-EXT",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Thies (Z)",
    "mcNo": "1",
    "capacity": "400",
    "collarCuff": "No",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "75%"
  },
  {
    "id": "machine_42",
    "floor": "EFL-EXT",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "MCS",
    "mcNo": "2",
    "capacity": "1000",
    "collarCuff": "No",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_43",
    "floor": "EFL-EXT",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "MCS",
    "mcNo": "3",
    "capacity": "1000",
    "collarCuff": "No",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_44",
    "floor": "EFL-EXT",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Sclavos",
    "mcNo": "4",
    "capacity": "750",
    "collarCuff": "No",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_45",
    "floor": "EFL-EXT",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Sclavos",
    "mcNo": "5",
    "capacity": "250",
    "collarCuff": "No",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_46",
    "floor": "EFL-EXT",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Thies (Old)",
    "mcNo": "6",
    "capacity": "350",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_47",
    "floor": "EFL-EXT",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Sclavos",
    "mcNo": "7",
    "capacity": "500",
    "collarCuff": "No",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_48",
    "floor": "EFL-EXT",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Sclavos",
    "mcNo": "8",
    "capacity": "1000",
    "collarCuff": "No",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_49",
    "floor": "EFL-EXT",
    "mcType": "Bulk",
    "mcGroup": "HT HP",
    "mcBrand": "Sclavos",
    "mcNo": "9",
    "capacity": "1250",
    "collarCuff": "No",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_50",
    "floor": "EFL-EXT",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Canlar",
    "mcNo": "1",
    "capacity": "25",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_51",
    "floor": "EFL-EXT",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Fong's (Old)",
    "mcNo": "2",
    "capacity": "10",
    "collarCuff": "No",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_52",
    "floor": "EFL-EXT",
    "mcType": "Sample",
    "mcGroup": "ATM",
    "mcBrand": "Son-Tech (Old)",
    "mcNo": "3",
    "capacity": "10",
    "collarCuff": "No",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_53",
    "floor": "EFL-EXT",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Canlar",
    "mcNo": "4",
    "capacity": "100",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_54",
    "floor": "EFL-EXT",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Canlar",
    "mcNo": "5",
    "capacity": "50",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_55",
    "floor": "EFL-EXT",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Canlar",
    "mcNo": "6",
    "capacity": "50",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_56",
    "floor": "EFL-EXT",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Canlar",
    "mcNo": "7",
    "capacity": "25",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_57",
    "floor": "EFL-EXT",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Canlar",
    "mcNo": "8",
    "capacity": "25",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_58",
    "floor": "EFL-EXT",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Canlar",
    "mcNo": "9",
    "capacity": "25",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_59",
    "floor": "EFL-EXT",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Canlar",
    "mcNo": "10",
    "capacity": "10",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_60",
    "floor": "EFL-EXT",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Canlar",
    "mcNo": "11",
    "capacity": "50",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_61",
    "floor": "EFL-EXT",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Canlar",
    "mcNo": "12",
    "capacity": "25",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_62",
    "floor": "EFL-EXT",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Canlar",
    "mcNo": "13",
    "capacity": "10",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_63",
    "floor": "EFL-EXT",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Canlar",
    "mcNo": "14",
    "capacity": "25",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_64",
    "floor": "EFL-EXT",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Fong's (Old)",
    "mcNo": "15",
    "capacity": "30",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_65",
    "floor": "EFL-EXT",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Fong's (Old)",
    "mcNo": "16",
    "capacity": "30",
    "collarCuff": "YES",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_66",
    "floor": "EFL-EXT",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Suntex (Old)",
    "mcNo": "17",
    "capacity": "15",
    "collarCuff": "No",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_67",
    "floor": "EFL-EXT",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Suntex (Old)",
    "mcNo": "18",
    "capacity": "15",
    "collarCuff": "No",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_68",
    "floor": "EFL-EXT",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Son-Tech (Old)",
    "mcNo": "19",
    "capacity": "30",
    "collarCuff": "No",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_69",
    "floor": "EFL-EXT",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Labpro",
    "mcNo": "20",
    "capacity": "30",
    "collarCuff": "No",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_70",
    "floor": "EFL-EXT",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Labpro",
    "mcNo": "21",
    "capacity": "30",
    "collarCuff": "No",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_71",
    "floor": "EFL-EXT",
    "mcType": "Sample",
    "mcGroup": "HT HP",
    "mcBrand": "Labpro",
    "mcNo": "22",
    "capacity": "20",
    "collarCuff": "No",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": "85%"
  },
  {
    "id": "machine_72",
    "floor": "EFL-EXT",
    "mcType": "Bulk",
    "mcGroup": "Wash",
    "mcBrand": "Pluvia",
    "mcNo": "1",
    "capacity": "5000",
    "collarCuff": "",
    "notPossibleFabric": "",
    "notPossibleGsm": "",
    "loading": ""
  }
];

export const KNITTING_FABRIC_COLUMNS = {
  requiredFinish: 'E',
  construction: 'C', // FabricConstruction choices for Setup's Not Possible Fabric selector.
  peach: 'U',
  brush: 'V',
  heatset: 'W',
  yarn: 'X',
  width: 'Y',
  gaugeDia: 'Z',
  greyWaste: 'AA',
  dryMethod: 'AB',
  floor: 'AC' // Item-wise dyeing floor, used by the five Batch Plan submenus.
};

export const KNITTING_INFO_HEADERS = {
  composition: ['Fabric Composition','FabricComposition','Composition','Fab Composition'],
  greigeQty: ['Greige Qty','Greige Quantity','Greige Qty Kgs','Greige Quantity Kg','Greige Quantity Kgs','Greige Qty Kg',
    'Grey Qty','Grey Quantity','Grey Qty Kgs','Grey Quantity Kg','Grey Quantity Kgs','Grey Qty Kg','GreyReq','Grey Req Kgs',
    'GreigeReq','Greige Required Qty','Grey Required Qty','Greige Requirement','Grey Requirement',
    'RequiredQtyKgs','Required Qty Kgs','Required Qty (Kgs)'],
  ld: ['Lapdip Number','Lapdip No','Lap Dip Number','Lap Dip No','Labdip Number','Labdip No',
    'Lab Dip Number','Lab Dip No','LD Number','LD No','LD#'],
  reference: ['Reference','Colour Reference','Color Reference','Ref','Reference No']
};

export const MACHINE_SETUP_FIELDS = [
  ['floor', 'Dyeing Floor'], ['mcType', 'MC Type'], ['mcGroup', 'M/C Group'],
  ['mcBrand', 'MC Brand'], ['mcNo', 'MC No.'], ['capacity', 'Capacity'],
  ['collarCuff', 'Collar Cuff'], ['notPossibleFabric', 'Not Possible Fabric'],
  ['loading', 'Loading']
];

export const FLOOR_FACTORY_NAMES = {
  EFL: 'Epyllion Fabrics Limited',
  EKL: 'Epyllion Knitex Limited',
  PLUVIA: 'Epyllion Knitex Limited-Pluvia'
};

export const CONFIRMED_HEADER_FIELDS = ['displayNumber','displayConfirmedBy','number','buyer','team','date','eventDay','style','pmc','merchant','unit','brush','peach','heatset','knitStart','knitEnd','dyeStart','dyeEnd','deliveryStart','deliveryEnd','knittingPlan','dyeingPlan','deliveryPlan','lastRevised','batchDate','revisedBatch','instructions','fabric','batches','recipe'];

export const BATCH_CALCULATION = {
  semiBleachLoading: 0.90,
  defaultMaximumLoadingPercent: 80, // Configurable fallback; saved machine Setup loading takes precedence.
  kgPerNozzle: 250,
  maxRenderedBatches: 10000, // Display limit only; never changes machine ranking.
  colorHeaders: ['Color', 'Colour', 'Shade', 'Color Name', 'Colour Name'],
  quantityHeaders: ['RequiredQtyKgs', 'GreyReq', 'Required Qty Kgs', 'Required Qty (Kgs)', 'Grey Req'],
  ldHeaders: ['LD#', 'LD #', 'LD No', 'LD No.', 'LD Number', 'Lab Dip No'],
  referenceHeaders: ['Reference', 'Colour Reference', 'Color Reference', 'Ref']
};

export const MACHINE_FLOOR_POOLS = { EFL:['EFL'], EKL:['EKL','EXT'], EXT:['EXT'], PLUVIA:['PLUVIA'], OUTSIDE:['OUTSIDE'] };

export const FABRIC_ROW_FIELDS = [
  ['name','No of Fab'],['type','Fabric'],['composition','Fabric Composition'],['yarn','Yarn Count & Fabric'],
  ['gsm','GSM'],['width','Width'],['gaugeDia','Gauge & Dia'],['greyWaste','Grey Wst.%'],
  ['requiredFinish','Required (Finish)'],['greigeQty','Greige Qty'],['dryMethod','Dry Method'],['remarks','Remarks']
];

export const BP_DATA_HEADERS = {
  order:['OrderNo','Order No','Booking No','Booking Number'],
  colour:['Color','Colour','Shade','Color Name','Colour Name'],
  details:['FabricDetails','Fabric Details','Fabric Description'],
  fabricType:['FabricType','Fabric Type'],
  quantity:['RequiredQtyPCs','Required Qty PCs','Required Qty (Pcs)','Required Quantity PCs','Qty PCs'],
  quantityKg:['RequiredQtyKgs','Required Qty Kgs','Required Qty (Kgs)','Required Quantity Kg','RequiredQtyKg'],
  weight:['Weight /Pcs','Weight/Pcs','Weight Per Pcs','Weight Per Piece','WeightPerPcs','Kg / Pcs','Kg Per Piece'],
  size:['CCSize','Size','FabricSize','Fabric Size','Size Details','SizeDetails','Size Name','SizeName','Finish Size','Finished Size','Size (Length x Width)','Length x Width','Size (Inch)','Size (Inches)'],
  length:['Length','Fabric Length','Length Inch','Length Inches'],
  width:['Width','Fabric Width','Width Inch','Width Inches'],
  floor:['Dyeing Floor','DyeingFloor','Floor']
};

export const COMPONENT_KINDS = [['collar','Collar'],['cuff','Cuff'],['hem','Hem'],['placket','Placket']];

export const TENTATIVE_ANSWER_FIELDS = ['labDip','bookingHold','productionConfirmed'];

export const DYEABLE_FILTER_IDS = {knit:'dyeableKnit',labdip:'dyeableLabdip',buyer:'dyeableBuyer',floor:'dyeableFloor',machine:'dyeableMachine'};

export const DYEABLE_SUMMARY_CRITERIA = ['Knit Ok, Labdip Ok','Knit Ok, Labdip Pending','Knit Balance, Labdip ok'];

export const GENERAL_INFO_ROWS = [
[['displayNumber','Booking No.'],['buyer','Buyer Name'],['team','Buyer Team'],['knitStart','Knit Start'],['knitEnd','Knit End'],['knittingPlan','Knitting Plan']],
[['date','Booking Date'],['eventDay','Event Day'],['style','Style'],['dyeStart','Dyeing Start'],['dyeEnd','Dyeing End'],['dyeingPlan','Dyeing Plan']],
[['pmc','PMC'],['merchant','Merchant'],['deliveryStart','Delivery Start'],['deliveryEnd','Delivery End'],['deliveryPlan','Delivery Plan']],
[['displayConfirmedBy','confirmed by'],['batchDate','Batch Plan Date'],['revisedBatch','Revised Batch Plan Date']]];

export const INITIAL_UNIT_SETUP = [['Australian Open','EKL'],['BESTSELLER','EKL'],['BONDS','EKL'],['C&A','EKL'],['Calvin Klein Jeans','EFL'],['CARHARTT','EKL'],['CELIO','EKL'],['CHAMPION AUSTRALIA','EKL'],['CHAMPION EUROPE','EFL'],['CHAMPION USA','EFL'],['Country Road','EFL'],['Express','EFL'],['Gildan','EFL'],['G-STAR','EFL'],['H&M','EFL'],['J.Crew','EKL'],['Klattermusen','EKL'],['Lands End','EFL'],['M&S','EKL'],['MEDICINE','EFL'],['NEXT','EKL'],['OBEY','EKL'],['ORIGINAL MARINES','EKL'],['Puma','EFL'],['Ralph Lauren','EFL'],['RAW-ASOS','EFL'],['RIVER ISLAND','EKL'],['S.OLIVER','EFL'],['Sportsgirl','EFL'],['Stanley Stella','EFL'],['TARGET AUSTRALIA','EKL'],['Tommy Hilfiger','EFL'],['Tommy Jeans','EFL'],['VARNER','EKL'],['VISTULA','EFL'],['VOGUE SOURCING LIMITED','EFL']].map(([buyer,unit],index)=>({id:'unit_'+(index+1),buyer,unit,hidden:false}));

export const DAILY_CONFIRM_HEADERS = ['Order number','Buyer','Unit','Batch plan status','Confirm batch Plan Date','Confirmed by'];

