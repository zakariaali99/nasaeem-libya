import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format date to localized Arabic format
export function formatDate(dateString: string): string {
  if (!dateString) return "";

  const date = new Date(dateString);
  return new Intl.DateTimeFormat("ar-LY", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// Format number as currency in Arabic (Libya) format
export function formatPrice(price: number): string {
  return new Intl.NumberFormat("ar-LY", {
    style: "currency",
    currency: "LYD", // You can change this to your desired currency
    minimumFractionDigits: 0,
  }).format(price);
}
