import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { photoDb, type TopicRule } from "@/lib/photoDb";

export function useTopicRules() {
  const [rules, setRules] = useState<TopicRule[]>([]);
  useEffect(() => {
    const s = liveQuery(() =>
      photoDb.topicRules.orderBy("priority").toArray(),
    ).subscribe({ next: setRules });
    return () => s.unsubscribe();
  }, []);
  return rules;
}

export async function saveTopicRule(r: TopicRule) {
  await photoDb.topicRules.put(r);
}
export async function deleteTopicRule(id: string) {
  await photoDb.topicRules.delete(id);
}
