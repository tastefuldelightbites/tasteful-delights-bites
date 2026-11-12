import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { bakeList, defaultDrop, getDrop, listDrops, ordersForDrop } from '@/lib/admin';
import { fmtDateTime, fmtPickupDate } from '@/lib/time';
import { dropName } from '@/lib/menu';
import { money } from '@/lib/money';
import { OrderFlags } from './OrderFlags';

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ drop?: string; view?: string; show?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const drops = await listDrops();
  const drop = (sp.drop && (await getDrop(sp.drop))) || (await defaultDrop());
  if (!drop) {
    return (
      <div className="stack">
        <h1>Orders</h1>
        <p className="muted">No Drops yet. <Link href="/admin/drops">Set up your first Drop</Link> to start taking orders.</p>
      </div>
    );
  }
  const all = await ordersForDrop(drop.id);
  const show = sp.show ?? 'all';
  const orders = all.filter((o) =>
    show === 'unpaid' ? !o.paid_at && !o.canceled_at :
    show === 'todo' ? !o.picked_up_at && !o.canceled_at :
    show === 'canceled' ? Boolean(o.canceled_at) : true);
  const active = all.filter((o) => !o.canceled_at);
  const bake = bakeList(all);
  const view = sp.view === 'bake' ? 'bake' : 'orders';
  const q = (extra: Record<string, string>) => '?' + new URLSearchParams({ drop: drop.id, view, show, ...extra }).toString();
  const thisName = dropName(drop);

  return (
    <div className="stack">
      <h1>Orders</h1>

      <form className="row" action="/admin/orders">
        <label className="flabel" htmlFor="drop">Which Drop:</label>
        <select id="drop" name="drop" className="select" defaultValue={drop.id} style={{ width: 'auto', minWidth: 260 }}>
          {drops.filter((d) => d.id === drop.id || d.order_count > 0 || new Date(d.opens_at).getTime() <= Date.now()).sort((a, b) => b.pickup_date.localeCompare(a.pickup_date)).map((d) => (
            <option key={d.id} value={d.id}>{dropName(d)} · pickup {fmtPickupDate(d.pickup_date)} ({d.order_count} orders)</option>
          ))}
        </select>
        <input type="hidden" name="view" value={view} />
        <button className="btn btn-sm">Show</button>
      </form>

      <p className="muted">{thisName}: ordering {fmtDateTime(drop.opens_at)} to {fmtDateTime(drop.closes_at)}. Pickup {fmtPickupDate(drop.pickup_date, true)}, {drop.pickup_hours}.</p>

      <div className="row">
        <Link className={`btn btn-sm ${view === 'orders' ? '' : 'btn-outline'}`} href={q({ view: 'orders' })}>Order List</Link>
        <Link className={`btn btn-sm ${view === 'bake' ? '' : 'btn-outline'}`} href={q({ view: 'bake' })}>Bake List</Link>
        <a className="btn btn-sm btn-outline" href={`/admin/orders/export?drop=${drop.id}`}>Download Spreadsheet</a>
      </div>

      {view === 'bake' ? (
        <div className="panel stack">
          <h3>What to bake for {thisName}</h3>
          <p className="muted">Totals from {active.length} orders (canceled orders are not counted).</p>
          {bake.cookies.length === 0 && bake.items.length === 0 && <p>Nothing ordered yet.</p>}
          {bake.cookies.length > 0 && (
            <table className="table">
              <thead><tr><th>Cookie flavor</th><th>How many</th></tr></thead>
              <tbody>
                {bake.cookies.map(([name, n]) => <tr key={name}><td>{name}</td><td><strong>{n}</strong></td></tr>)}
                <tr><td><strong>All cookies</strong></td><td><strong>{bake.totalCookies}</strong></td></tr>
              </tbody>
            </table>
          )}
          {bake.boxes.length > 0 && (
            <table className="table">
              <thead><tr><th>Boxes to pack</th><th>How many</th></tr></thead>
              <tbody>{bake.boxes.map(([name, n]) => <tr key={name}><td>{name}</td><td><strong>{n}</strong></td></tr>)}</tbody>
            </table>
          )}
          {bake.items.length > 0 && (
            <table className="table">
              <thead><tr><th>Cakes &amp; other items</th><th>How many</th></tr></thead>
              <tbody>{bake.items.map(([name, n]) => <tr key={name}><td>{name}</td><td><strong>{n}</strong></td></tr>)}</tbody>
            </table>
          )}
        </div>
      ) : (
        <>
          <div className="row">
            <span className="flabel">Show:</span>
            {[['all', `All orders (${all.length})`], ['unpaid', 'Not paid yet'], ['todo', 'Not picked up yet'], ['canceled', 'Canceled']].map(([k, label]) => (
              <Link key={k} href={q({ show: k })} style={{ fontWeight: show === k ? 800 : 600, textDecoration: show === k ? 'underline' : 'none', textDecorationThickness: 3, padding: '10px 6px' }}>{label}</Link>
            ))}
          </div>
          {orders.length === 0 && <p className="muted" style={{ fontSize: '1.15rem' }}>No orders here yet.</p>}
          <div className="stack">
            {orders.map((o) => (
              <div key={o.id} className={`order-card ${o.canceled_at ? 'canceled' : ''}`}>
                <div className="row" style={{ alignItems: 'baseline' }}>
                  <h3>#{o.order_number} · {o.name}</h3>
                  <span className="spacer" />
                  <strong style={{ fontSize: '1.3rem' }}>{money(o.total_cents)}</strong>
                </div>
                <p className="muted" style={{ marginTop: 4 }}>
                  <a href={`tel:${o.phone}`}>{o.phone}</a> · <a href={`mailto:${o.email}`}>{o.email}</a><br />
                  {o.fulfillment === 'pickup' ? 'Pickup' : `Delivery to ${o.address} (${o.distance_miles} mi, ${money(o.delivery_cents)})`} · ordered {fmtDateTime(o.created_at)}{o.payment_method && <><br />Paying with <strong>{o.payment_method}</strong></>}
                </p>
                <ul style={{ margin: '12px 0 0', paddingLeft: 22 }}>
                  {o.items.map((it) => (
                    <li key={it.id}>
                      <strong>{it.quantity} × {it.flavors.length ? it.name : `${it.name} (${it.option_label})`}</strong>
                      {it.flavors.length > 0 && <span className="muted">: {it.flavors.map((f) => `${f.qty} ${f.name}`).join(', ')}</span>}
                    </li>
                  ))}
                </ul>
                {o.notes && <p style={{ marginTop: 10 }}><strong>Note:</strong> {o.notes}</p>}
                <OrderFlags id={o.id} paid={Boolean(o.paid_at)} ready={Boolean(o.ready_at)} pickedUp={Boolean(o.picked_up_at)} canceled={Boolean(o.canceled_at)} delivery={o.fulfillment === 'delivery'} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
