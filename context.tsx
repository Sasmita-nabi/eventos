"use client";
import { createContext, useContext } from "react";
import type { AppMeta, Event, Role, Section, StoreData, Task } from "@/lib/types";
export interface AppContextValue {
  data: StoreData;
  meta: AppMeta;
  event: Event;
  role: Role;
  section: Section;
  setSection: (s: Section) => void;
  setRole: (r: Role) => void;
  selectEvent: (id: string) => void;
  request: <T = any>(endpoint: string, method?: string, body?: unknown) => Promise<T>;
  refresh: () => Promise<void>;
  notify: (message: string, tone?: "success" | "error" | "info") => void;
  openTask: (task?: Task) => void;
  openSession: (id?: string) => void;
  openPerson: (id?: string) => void;
  openResource: (id?: string) => void;
  openEvent: (create?: boolean) => void;
  openGuide: () => void;
}
export const AppContext = createContext<AppContextValue | null>(null);
export function useApp() { const app = useContext(AppContext); if (!app) throw new Error("EventOS context is missing."); return app; }
