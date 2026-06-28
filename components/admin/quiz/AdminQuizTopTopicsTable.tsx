import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AdminQuizTopTopic } from '@/types/admin-quiz';

/** Most-served topics in the window (topic + serve count). */
export function AdminQuizTopTopicsTable({ data }: { data: AdminQuizTopTopic[] }) {
  if (!data.length) {
    return (
      <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
        No topics served in this period.
      </div>
    );
  }

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Topic</TableHead>
            <TableHead className="text-right">Serves</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((t) => (
            <TableRow key={t.topic_key}>
              <TableCell className="font-medium">{t.topic}</TableCell>
              <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                {t.serves.toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
