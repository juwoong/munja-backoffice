import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTokenAmount(value: string, decimals = 18, precision = 4) {
  const tokenValue = BigInt(value);
  const divisor = 10n ** BigInt(decimals);
  const integerPart = tokenValue / divisor;
  const fractionalPart = tokenValue % divisor;

  if (fractionalPart === 0n) {
    return integerPart.toString();
  }

  const fractionalString = fractionalPart.toString().padStart(decimals, "0");
  const trimmedFractional = fractionalString.slice(0, precision).replace(/0+$/, "");

  return trimmedFractional.length > 0 ? `${integerPart}.${trimmedFractional}` : integerPart.toString();
}

export function parseTokenAmount(value: string, decimals = 18) {
  const formatted = formatTokenAmount(value, decimals, decimals);
  return Number(formatted);
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}
