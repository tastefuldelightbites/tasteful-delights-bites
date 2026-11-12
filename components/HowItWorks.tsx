import type { Drop } from '@/lib/menu';
import { dropName } from '@/lib/menu';
import type { Settings } from '@/lib/settings';
import type { HolidayInfo } from '@/lib/holiday';
import { DAY_NAMES } from '@/lib/schedule';
import { fmtClock, fmtDayDate, fmtPickupDate, hoursInWords } from '@/lib/time';

/** "Cash App, Zelle, or Apple Pay" */
function orList(xs: string[]) {
  if (xs.length <= 1) return xs.join('');
  if (xs.length === 2) return `${xs[0]} or ${xs[1]}`;
  return `${xs.slice(0, -1).join(', ')}, or ${xs.at(-1)}`;
}

/**
 * How It Works, with every day, date and time filled in from Admin > Order Dates.
 * "This week" is the weekly order window that is open now; if this week is
 * closed or paused, it shows the next week customers can order.
 */
export function HowItWorks({ s, open, next, holidays, thanksgiving }: { s: Settings; open: Drop | null; next: Drop | null; holidays: Drop[]; thanksgiving?: HolidayInfo | null }) {
  const w = s.weekly;
  const closeDay = DAY_NAMES[w.close_day];
  const pickupDay = DAY_NAMES[w.pickup_day];
  const [street, city] = s.pickup_address.split(',').map((x) => x.trim());
  const where = `at the ${s.pickup_place} parking lot${street ? ` on ${street.replace(/^\d+\s+/, '')}` : ''}${city ? ` in ${city}` : ''}`;
  const pay = [s.cashapp && 'Cash App', s.zelle && 'Zelle', s.applepay && 'Apple Pay'].filter(Boolean) as string[];
  const holidayName = holidays[0] ? dropName(holidays[0]) : 'Thanksgiving';

  return (
    <section className="how" id="how" aria-labelledby="how-title">
      {thanksgiving && (
        <div className="how-holiday" aria-label={thanksgiving.title}>
          <h2>{thanksgiving.title}</h2>
          <p className="how-holiday-date">{thanksgiving.orderBy}</p>
          <p className="how-holiday-pickup">{thanksgiving.pickup}</p>
          {thanksgiving.notes && <p>{thanksgiving.notes}</p>}
          {thanksgiving.delivery && <p>{thanksgiving.delivery}</p>}
        </div>
      )}
      <div className="how-head">
        <span className="label">How it works</span>
        {w.enabled ? (
          <>
            <h2 id="how-title">Order by {closeDay}. <em>Pick up {pickupDay}.</em></h2>
            {open ? (
              <p className="how-week">This week: Order by {fmtDayDate(open.closes_at)}. Pick up {fmtPickupDate(open.pickup_date, true)}.</p>
            ) : next ? (
              <p className="how-week">Next week: Ordering opens {fmtDayDate(next.opens_at)}. Order by {fmtDayDate(next.closes_at)}. Pick up {fmtPickupDate(next.pickup_date, true)}.</p>
            ) : (
              <p className="how-week">Weekly ordering is closed right now. Please check back soon.</p>
            )}
          </>
        ) : (
          <h2 id="how-title">Order ahead. <em>Pick up fresh.</em></h2>
        )}
      </div>

      <div className="steps">
        <div className="step"><div className="n">1</div><div><h3>Place your order.</h3><p>Pick your treats and place your order{w.enabled ? <> by {closeDay} at {fmtClock(w.close_time)}</> : null}.</p></div></div>
        <div className="step"><div className="n">2</div><div><h3>We bake it fresh.</h3><p>Everything is made from scratch just for you, so it takes a few days.</p></div></div>
        <div className="step"><div className="n">3</div><div>
          <h3>Pick up {w.enabled ? pickupDay : 'on your day'}.</h3>
          <p>Grab your treats {w.enabled ? <>{pickupDay} from {hoursInWords(w.pickup_hours)} </> : null}{where}{s.delivery_enabled ? ', or choose delivery' : ''}.</p>
        </div></div>
      </div>

      <div className="how-foot">
        <p><strong>Pay with {orList(pay.length ? pay : ['Cash App', 'Zelle', 'Apple Pay'])}.</strong></p>
        <p>Holiday boxes like {holidayName} have their own order by and pickup dates, shown on each box.</p>
      </div>
    </section>
  );
}
