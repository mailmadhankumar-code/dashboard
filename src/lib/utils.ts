
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function deepCopy<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  // For performance, using JSON.parse and JSON.stringify for deep cloning.
  // This is generally safe for the data structures used in this app.
  // It doesn't handle Dates, Functions, undefined, Infinity, RegExps, Maps, Sets, etc.
  // but our data store only contains plain objects, arrays, and primitives.
  return JSON.parse(JSON.stringify(obj));
}

    