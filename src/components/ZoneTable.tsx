import { zoneRanges } from '../lib/workout'

interface ZoneTableProps {
  ftpW: number
  className?: string
}

/**
 * The rider's power zones: one row per zone, Z1 to Z7, with its swatch and
 * code, name, % FTP range and watt range at the rider's FTP. Built from the
 * same boundaries as the workout strip (`ZONES` in lib/workout), so a block's
 * color and this chart always agree. No panel of its own: the host gives it one.
 */
export function ZoneTable({ ftpW, className = '' }: ZoneTableProps) {
  const rows = zoneRanges(ftpW)
  return (
    <table className={`ww-table ww-zone-table ${className}`}>
      <caption className="sr-only">Power zones at an FTP of {ftpW} watts</caption>
      <thead>
        <tr>
          <th scope="col" className="ww-label">
            Zone
          </th>
          <th scope="col" className="ww-label">
            <span className="sr-only">Name</span>
          </th>
          <th scope="col" className="ww-label">
            % FTP
          </th>
          <th scope="col" className="ww-label text-right">
            Watts
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((z) => (
          <tr key={z.zone}>
            <th scope="row" className="font-mono text-mono font-normal text-fg">
              <span className="flex items-center gap-2">
                <span aria-hidden className="h-3 w-3 rounded-sm" style={{ background: `var(--ww-z${z.zone})` }} />Z{z.zone}
              </span>
            </th>
            <td className="text-fg">{z.name}</td>
            <td className="font-mono text-mono whitespace-nowrap text-fg-muted">
              {z.toPct === null ? `over ${z.fromPct - 1}%` : z.fromPct === 0 ? `up to ${z.toPct}%` : `${z.fromPct} to ${z.toPct}%`}
            </td>
            <td className="text-right font-semibold whitespace-nowrap text-fg tabular-nums">
              {z.toW === null ? `${z.fromW} W and up` : `${z.fromW} to ${z.toW} W`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
