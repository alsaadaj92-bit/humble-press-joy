import { useEffect, useState } from "react";
import { isUnlocked, subscribeLockState } from "@/lib/lockedFolder";

export function useLockedFolder() {
  const [unlocked, setUnlocked] = useState(isUnlocked());
  useEffect(() => subscribeLockState(setUnlocked), []);
  return unlocked;
}
