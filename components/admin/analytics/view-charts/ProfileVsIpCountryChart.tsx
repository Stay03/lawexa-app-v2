'use client';

import ReactCountryFlag from 'react-country-flag';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { ProfileCountryVsIpCountryData } from '@/types/admin';
import { getCountryCode } from '@/lib/constants/country-codes';

interface ProfileVsIpCountryChartProps {
  data: ProfileCountryVsIpCountryData;
}

const BAR_COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#f97316', '#ef4444'];

/**
 * Renders a single column of country bars.
 */
function CountryColumn({
  title,
  countries,
}: {
  title: string;
  countries: { country: string; count: number }[];
}) {
  if (!countries.length) {
    return (
      <div>
        <p className="text-sm font-medium mb-3">{title}</p>
        <p className="text-sm text-muted-foreground">No data</p>
      </div>
    );
  }
  const maxCount = Math.max(...countries.map((d) => d.count));
  return (
    <div>
      <p className="text-sm font-medium mb-3">{title}</p>
      <div className="space-y-3">
        {countries.map((item, index) => {
          const countryCode = getCountryCode(item.country);
          const barColor = BAR_COLORS[index % BAR_COLORS.length];
          const barWidthPercent = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
          return (
            <div key={item.country} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {countryCode ? (
                    <ReactCountryFlag
                      countryCode={countryCode}
                      svg
                      style={{ width: '1em', height: '1em', borderRadius: '2px' }}
                      aria-label={item.country}
                    />
                  ) : (
                    <span className="flex h-[1em] w-[1em] shrink-0 items-center justify-center rounded-sm bg-muted text-[9px] text-muted-foreground">
                      {item.country.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="text-xs text-foreground truncate">{item.country}</span>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                  {item.count.toLocaleString()}
                </span>
              </div>
              <div className="h-1 w-full rounded-full bg-muted/50">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${barWidthPercent}%`, backgroundColor: barColor }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProfileVsIpCountryChart({ data }: ProfileVsIpCountryChartProps) {
  const hasData = data.profile_countries.length > 0 || data.ip_countries.length > 0;

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Profile vs IP Country</CardTitle>
          <CardDescription>Where users say they are vs where they browse from</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile vs IP Country</CardTitle>
        <CardDescription>Where users say they are vs where they browse from</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CountryColumn title="Profile Country" countries={data.profile_countries} />
          <CountryColumn title="IP Country" countries={data.ip_countries} />
        </div>
      </CardContent>
    </Card>
  );
}
