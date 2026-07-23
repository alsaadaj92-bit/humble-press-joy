import { Images } from "lucide-react";

interface Props {
  title: string;
  body: string;
  action?: React.ReactNode;
}
export function EmptyState({ title, body, action }: Props) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center animate-fade-in">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
        <Images className="h-7 w-7" />
      </div>
      <div className="mb-1 text-base font-medium">{title}</div>
      <div className="text-sm text-muted-foreground">{body}</div>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
