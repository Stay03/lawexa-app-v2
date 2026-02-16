'use client';

import ReactCountryFlag from 'react-country-flag';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ViewsByCityRow } from '@/types/admin';
import { getCountryCode } from '@/lib/constants/country-codes';

interface ViewsByCityTableProps {
  data: ViewsByCityRow[];
}

export function ViewsByCityTable({ data }: ViewsByCityTableProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Views by City</CardTitle>
          <CardDescription>Geographic distribution by city</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Views by City</CardTitle>
        <CardDescription>Geographic distribution by city</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>City</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Country</TableHead>
              <TableHead className="text-right">Views</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              const countryCode = row.country ? getCountryCode(row.country) : null;
              return (
                <TableRow key={`${row.city}-${row.region}-${row.country}`}>
                  <TableCell className="font-medium">{row.city}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.region || 'N/A'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {countryCode ? (
                        <ReactCountryFlag
                          countryCode={countryCode}
                          svg
                          style={{ width: '1em', height: '1em', borderRadius: '2px' }}
                          aria-label={row.country || ''}
                        />
                      ) : null}
                      <span className="text-muted-foreground">{row.country || 'N/A'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.count.toLocaleString()}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
