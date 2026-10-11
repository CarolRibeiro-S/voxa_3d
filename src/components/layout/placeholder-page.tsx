import { Card } from "@/components/ui/card";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-tinta">{title}</h1>
      <Card className="mt-6">
        <p className="text-tinta/70">Em construção.</p>
      </Card>
    </div>
  );
}
