
"use client";

import { useState, useEffect } from "react";
import { getCustomersAction } from "@/app/actions";
import type { Customer } from "@/lib/types";

/**
 * A hook to fetch the list of customers and their databases.
 * It handles loading and error states internally, providing a clean interface to the component.
 */
export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      setIsLoading(true);
      try {
        const res = await getCustomersAction();
        if (res.data) {
          setCustomers(res.data);
        } else if (res.error) {
          throw new Error(res.error);
        }
      } catch (err: any) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  return { customers, isLoading, error };
}
