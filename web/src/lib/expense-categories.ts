import type { ExpenseCategory } from "@/generated/prisma/enums";

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  FOOD: "Food – meal or drink",
  GROCERY: "Grocery",
  TRAVEL_GAS: "Travel – gas",
  TRAVEL_CAR: "Travel – car",
  TRAVEL_FLIGHT: "Travel – flight",
  TRAVEL_TAXI: "Travel – taxi",
  TRAVEL_PARKING: "Travel – parking",
  TRAVEL_PUBLIC_TRANSPORT: "Travel – public transport",
  TRAVEL_OTHER: "Travel – other",
  GEAR: "Gear",
  GENERIC: "Generic expense",
};

export const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABEL) as ExpenseCategory[];
