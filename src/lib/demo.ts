// Demo-only accounts created by `npm run seed`. Shown on the login screens when DEMO_MODE=true.
export const DEMO_PASSWORD = process.env.SEED_PASSWORD || "campuscare-demo-2026";

export const DEMO_STUDENTS = [
  { roll_no: "21CS101", name: "Aarav Mehta", department: "Computer Science", hostel: "Hostel A" },
  { roll_no: "21EC112", name: "Diya Sharma", department: "Electronics", hostel: "Hostel B" },
  { roll_no: "22ME205", name: "Kabir Singh", department: "Mechanical", hostel: "Hostel A" },
  { roll_no: "22CE318", name: "Ananya Iyer", department: "Civil", hostel: "Hostel C" },
  { roll_no: "23CS044", name: "Rohan Das", department: "Computer Science", hostel: "Hostel A" },
  { roll_no: "23BT027", name: "Meera Nair", department: "Biotechnology", hostel: "Hostel B" },
];

export const DEMO_ADMINS = [
  { email: "committee@campuscare.demo", name: "Prof. S. Rao", role: "committee" },
  { email: "dean@campuscare.demo", name: "Dr. L. Banerjee", role: "dean" },
  { email: "external@campuscare.demo", name: "District Anti-Ragging Cell", role: "external" },
] as const;

export const isDemo = () => process.env.DEMO_MODE === "true";
