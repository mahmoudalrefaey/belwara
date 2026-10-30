"use client";

import { createContext, useContext } from "react";
import type { WaraPose } from "@/components/illustrations/Wara";

export const MascotContext = createContext<(pose: WaraPose) => void>(() => {});

/** Forms tell the mascot what is happening (typing a password, submitting, an error). */
export const useMascot = () => useContext(MascotContext);
